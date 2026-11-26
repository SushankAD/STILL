begin;

drop policy if exists "Users can manage their focus sessions" on public.focus_sessions;
create policy "Users can read their focus sessions" on public.focus_sessions
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.focus_sessions from public, anon, authenticated;
grant select on public.focus_sessions to authenticated;
grant select, insert, update on public.focus_sessions to service_role;

create function public.save_verified_focus_session(p_user_id uuid, p_session_id uuid, p_attempt uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  session public.focus_sessions;
  attempt public.habit_ai_jobs;
  current_time_utc timestamptz := statement_timestamp();
begin
  select * into session from public.focus_sessions
  where id = p_session_id and user_id = p_user_id for update;
  if not found or session.status = 'abandoned' then
    raise exception 'focus_inactive';
  end if;

  -- A retry of an already committed session must not award roots again.
  if session.status = 'completed' then
    return jsonb_build_object('newlyCompleted', false, 'roots', session.roots_awarded, 'minutes', session.planned_minutes);
  end if;
  if current_time_utc < session.started_at + make_interval(mins => session.planned_minutes) then
    raise exception 'focus_timer_running';
  end if;

  select * into attempt from public.habit_ai_jobs
  where id = p_attempt and user_id = p_user_id for update;
  if not found or attempt.state <> 'ready' or attempt.consumed_at is not null
    or attempt.updated_at <= current_time_utc - interval '30 minutes'
    or attempt.result->>'focusSessionId' is distinct from session.id::text
    or attempt.result->'result'->'verified' is distinct from 'true'::jsonb then
    raise exception 'focus_proof_required';
  end if;

  update public.focus_sessions
  set status = 'completed', completed_at = current_time_utc,
      roots_awarded = case session.depth when 'light' then 15 when 'medium' then 35 else 70 end
  where id = session.id
  returning * into session;

  update public.habit_ai_jobs set consumed_at = current_time_utc where id = attempt.id;

  return jsonb_build_object('newlyCompleted', true, 'roots', session.roots_awarded, 'minutes', session.planned_minutes);
end;
$$;

revoke all on function public.save_verified_focus_session(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.save_verified_focus_session(uuid, uuid, uuid) to service_role;

commit;
