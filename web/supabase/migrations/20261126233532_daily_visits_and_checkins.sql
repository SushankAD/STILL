begin;

create table public.visit_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  visited_on date not null,
  first_seen timestamptz not null default now(),
  primary key (user_id, visited_on)
);
alter table public.visit_days enable row level security;
revoke all on public.visit_days from public, anon, authenticated;

-- Reconstruct dates with evidence of past use before recording foreground visits.
insert into public.visit_days(user_id, visited_on, first_seen)
select user_id, day, min(seen) from (
  select id as user_id, (created_at at time zone 'UTC')::date as day, created_at as seen from public.profiles
  union all select user_id, check_in_date, created_at from public.check_ins
  union all select user_id, completed_on, created_at from public.habit_completions
  union all select user_id, (started_at at time zone 'UTC')::date, started_at from public.focus_sessions
  union all select user_id, (completed_at at time zone 'UTC')::date, completed_at from public.focus_sessions where completed_at is not null
) history group by user_id, day;

create function public.record_still_visit(p_timezone text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Sign in to record a visit'; end if;
  insert into public.visit_days(user_id, visited_on)
    values (owner_id, (now() at time zone p_timezone)::date) on conflict do nothing;
  return (select jsonb_build_object('day', count(*), 'seventhVisitAt', min(first_seen) filter (where n = 7))
    from (select first_seen, row_number() over (order by first_seen, visited_on) n
          from public.visit_days where user_id = owner_id) visits);
end;
$$;

alter table public.check_ins add column roots_awarded smallint not null default 12;
alter table public.check_ins alter column roots_awarded set default 5;

revoke all on public.check_ins from public, anon, authenticated;
grant select on public.check_ins to authenticated;

create function public.save_daily_checkin(p_timezone text, p_state text, p_mood integer,
  p_load integer, p_reflection text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  today date := (now() at time zone p_timezone)::date;
  inserted boolean;
begin
  if owner_id is null then raise exception 'Sign in to check in'; end if;
  if (select count(*) from regexp_matches(p_reflection, '[^[:space:]]*[[:alnum:]][^[:space:]]*', 'g')) < 50 then
    raise exception 'Write at least 50 words to save your check-in.';
  end if;
  insert into public.check_ins(user_id, check_in_date, day_state, mood, mental_load, reflection)
  values (owner_id, today, p_state, p_mood, p_load, p_reflection)
  on conflict (user_id, check_in_date) do nothing;
  inserted := found;
  if not inserted then
    update public.check_ins set day_state = p_state, mood = p_mood, mental_load = p_load,
      reflection = p_reflection where user_id = owner_id and check_in_date = today;
  end if;
  return jsonb_build_object('checkInDate', today, 'earned', case when inserted then 5 else 0 end);
end;
$$;

revoke all on function public.record_still_visit(text), public.save_daily_checkin(text,text,integer,integer,text)
  from public, anon, authenticated;
grant execute on function public.record_still_visit(text), public.save_daily_checkin(text,text,integer,integer,text)
  to authenticated;
commit;
