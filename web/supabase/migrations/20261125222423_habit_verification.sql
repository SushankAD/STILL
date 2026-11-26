begin;

alter table public.habits
  add column verification_policy jsonb,
  add column policy_revision uuid not null default gen_random_uuid(),
  add column verification_timezone text,
  add column verification_template text check (verification_template in ('water', 'movement', 'reading', 'journal', 'sleep', 'social')),
  add column social_limit_minutes smallint not null default 0 check (social_limit_minutes between 0 and 1440),
  add column social_window_end_hour smallint not null default 24 check (social_window_end_hour between 1 and 24);

update public.habits h set verification_template = mapping.template
from (values
  ('drink water', 'water'), ('move my body', 'movement'), ('read 20 pages', 'reading'),
  ('journal one page', 'journal'), ('sleep before 11', 'sleep'), ('no social scrolling', 'social')
) as mapping(title, template)
where lower(regexp_replace(btrim(h.title), '[[:space:]]+', ' ', 'g')) = mapping.title;

alter table public.habit_completions
  add column verification_method text not null default 'legacy'
    check (verification_method in ('legacy', 'photo', 'tracked', 'self_report')),
  add column proof_hash text,
  add column verification_time_zone text;

create unique index habit_completion_image_once on public.habit_completions (habit_id, proof_hash)
  where proof_hash is not null;

drop policy if exists "Users can manage their habits" on public.habits;
drop policy if exists "Users can manage their habit completions" on public.habit_completions;
create policy "Users can read their habits" on public.habits
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can read their habit completions" on public.habit_completions
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.habits, public.habit_completions from public, anon, authenticated;
grant select on public.habits, public.habit_completions to authenticated;
grant select, insert, update, delete on public.habits, public.habit_completions to service_role;
grant select, insert on public.proof_photos to service_role;

-- A database-backed reservation works across Edge Function instances. It contains hashes
-- and limited response data, never source images or transcripts.
create table public.habit_ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null,
  state text not null default 'running' check (state in ('running', 'ready', 'failed')),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  consumed_at timestamptz,
  unique (user_id, cache_key)
);

create index habit_ai_jobs_recent on public.habit_ai_jobs (user_id, created_at);
create index habit_ai_jobs_expiry on public.habit_ai_jobs (created_at);

alter table public.habit_ai_jobs enable row level security;
revoke all on public.habit_ai_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.habit_ai_jobs to service_role;

create function public.reserve_habit_ai_job(p_user_id uuid, p_cache_key text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  job public.habit_ai_jobs;
  current_time_utc timestamptz := statement_timestamp();
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  -- Bounded cleanup also covers expired jobs from inactive accounts.
  delete from public.habit_ai_jobs where id in (
    select id from public.habit_ai_jobs
    where created_at < current_time_utc - interval '1 day'
    order by created_at limit 32 for update skip locked
  );
  select * into job from public.habit_ai_jobs where user_id = p_user_id and cache_key = p_cache_key;
  if found then
    if job.consumed_at is not null then
      return jsonb_build_object('state', 'used');
    elsif job.state = 'ready' and job.updated_at > current_time_utc - interval '30 minutes' then
      return jsonb_build_object('state', 'ready', 'id', job.id, 'result', job.result);
    elsif (job.state = 'running' and job.updated_at > current_time_utc - interval '45 seconds')
       or (job.state = 'failed' and job.updated_at > current_time_utc - interval '5 seconds') then
      return jsonb_build_object('state', 'pending');
    end if;
  end if;

  if (select count(*) from public.habit_ai_jobs where user_id = p_user_id and state = 'running'
      and updated_at > current_time_utc - interval '45 seconds') >= 4 then
    return jsonb_build_object('state', 'limited');
  end if;

  if (select count(*) from public.habit_ai_jobs
      where user_id = p_user_id and cache_key not like 'self-report:%'
        and created_at > current_time_utc - interval '10 minutes') >= 30 then
    return jsonb_build_object('state', 'limited');
  end if;

  insert into public.habit_ai_jobs (user_id, cache_key)
  values (p_user_id, p_cache_key)
  on conflict (user_id, cache_key) do update
    set id = gen_random_uuid(), state = 'running', result = null,
        created_at = current_time_utc, updated_at = current_time_utc
    where habit_ai_jobs.consumed_at is null
  returning * into job;
  if not found then
    return jsonb_build_object('state', 'used');
  end if;
  return jsonb_build_object('state', 'claimed', 'id', job.id);
end;
$$;

create function public.habit_verification_date(p_habit public.habits, p_now timestamptz)
returns date language sql stable set search_path = '' as $$
  select local_time::date - case
    when p_habit.verification_template = 'sleep' then 1
    when p_habit.verification_template = 'social'
      then case when extract(hour from local_time) < p_habit.social_window_end_hour then 1 else 0 end
    when p_habit.verification_policy->>'dateBasis' = 'LAST_CLOSED_DAY' then 1
    else 0
  end
  from (select p_now at time zone coalesce(p_habit.verification_timezone, 'UTC') as local_time) as clock;
$$;

create function public.save_verified_habit_completion(
  p_user_id uuid, p_habit_id uuid, p_day date, p_revision uuid, p_attempt uuid, p_self_report boolean
)
returns public.habit_completions language plpgsql set search_path = '' as $$
declare
  habit public.habits;
  completion public.habit_completions;
  attempt public.habit_ai_jobs;
  method text;
  image_hash text;
  current_time_utc timestamptz := statement_timestamp();
begin
  select * into habit from public.habits
  where id = p_habit_id and user_id = p_user_id and not archived for update;
  if not found then raise exception 'habit_not_found'; end if;

  -- Repeating the same save after an ambiguous network response returns the committed row.
  select * into completion from public.habit_completions
  where habit_id = habit.id and user_id = p_user_id and completed_on = p_day;
  if found then
    if completion.id = p_attempt and p_self_report = (completion.verification_method = 'self_report') then
      return completion;
    end if;
    raise exception 'habit_already_complete';
  end if;

  if p_day is distinct from public.habit_verification_date(habit, current_time_utc) then
    raise exception 'habit_date_changed';
  end if;
  if habit.policy_revision is distinct from p_revision then raise exception 'habit_proof_required'; end if;
  if habit.verification_policy->>'safetyStatus' is distinct from 'ALLOWED' then
    raise exception 'habit_policy_unavailable';
  end if;

  if p_attempt is null or p_self_report is null then raise exception 'habit_proof_required'; end if;

  if p_self_report then
    if habit.verification_template is distinct from 'sleep'
      and habit.verification_policy->>'verificationMode' is distinct from 'SELF_REPORT' then
      raise exception 'habit_self_report_unavailable';
    end if;
    insert into public.habit_ai_jobs (id, user_id, cache_key, state, consumed_at)
    values (p_attempt, p_user_id, 'self-report:' || p_attempt, 'ready', current_time_utc)
    on conflict do nothing;
    if not found then raise exception 'habit_evidence_used'; end if;
    method := 'self_report';
  else
    select * into attempt from public.habit_ai_jobs where id = p_attempt and user_id = p_user_id for update;
    if not found or attempt.state <> 'ready' or attempt.updated_at <= current_time_utc - interval '30 minutes'
      or attempt.result->'result'->>'status' is distinct from 'ACCEPTED'
      or attempt.result->>'habitId' is distinct from habit.id::text
      or attempt.result->>'policyRevision' is distinct from habit.policy_revision::text
      or attempt.result->>'habitDate' is distinct from p_day::text then
      raise exception 'habit_proof_required';
    end if;
    if attempt.consumed_at is not null then raise exception 'habit_evidence_used'; end if;
    method := attempt.result->>'method';
    image_hash := attempt.result->>'imageHash';
    if method is null or method not in ('photo', 'tracked') or image_hash is null then
      raise exception 'habit_proof_required';
    end if;
    if exists (select 1 from public.habit_completions
      where habit_id = habit.id and proof_hash = image_hash) then
      raise exception 'habit_evidence_used';
    end if;
    update public.habit_ai_jobs set consumed_at = current_time_utc where id = p_attempt;
  end if;

  insert into public.habit_completions (
    id, user_id, habit_id, completed_on, roots_awarded, verification_method, proof_hash, verification_time_zone
  )
  values (
    p_attempt, p_user_id, habit.id, p_day,
    case habit.difficulty when 'easy' then 1 when 'medium' then 2 else 3 end,
    method, image_hash, habit.verification_timezone
  ) returning * into completion;
  return completion;
end;
$$;

create function public.undo_verified_habit_completion(p_user_id uuid, p_habit_id uuid, p_completion_id uuid, p_timezone text)
returns text[] language plpgsql set search_path = '' as $$
declare
  habit public.habits;
  completion public.habit_completions;
  paths text[];
  undo_day date;
begin
  select * into habit from public.habits
  where id = p_habit_id and user_id = p_user_id and not archived for update;
  if not found then raise exception 'habit_not_found'; end if;
  select * into completion from public.habit_completions
  where id = p_completion_id and habit_id = habit.id and user_id = p_user_id for update;
  if not found then return array[]::text[]; end if;
  habit.verification_timezone := coalesce(habit.verification_timezone, p_timezone);
  undo_day := public.habit_verification_date(habit, statement_timestamp());
  if completion.completed_on is distinct from undo_day then raise exception 'habit_date_changed'; end if;
  select array_agg(object_path) into paths from public.proof_photos
  where habit_completion_id = completion.id and user_id = p_user_id;
  delete from public.habit_completions where id = completion.id;
  return coalesce(paths, array[]::text[]);
end;
$$;

revoke all on function
  public.reserve_habit_ai_job(uuid, text),
  public.habit_verification_date(public.habits, timestamptz),
  public.save_verified_habit_completion(uuid, uuid, date, uuid, uuid, boolean),
  public.undo_verified_habit_completion(uuid, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function
  public.reserve_habit_ai_job(uuid, text),
  public.habit_verification_date(public.habits, timestamptz),
  public.save_verified_habit_completion(uuid, uuid, date, uuid, uuid, boolean),
  public.undo_verified_habit_completion(uuid, uuid, uuid, text)
to service_role;

commit;
