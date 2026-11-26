-- Execute against a disposable database after applying the Supabase migrations.
begin;

do $$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  session_id uuid;
  another_session_id uuid;
  receipt uuid;
  saved jsonb;
begin
  insert into auth.users (id) values (owner_id), (other_id);
  insert into public.focus_sessions (user_id, intention, depth, planned_minutes)
  values (owner_id, 'Read a book', 'light', 25) returning id into session_id;
  insert into public.focus_sessions (user_id, intention, depth, planned_minutes, started_at)
  values (owner_id, 'Take notes', 'medium', 50, statement_timestamp() - interval '1 hour')
  returning id into another_session_id;

  assert has_table_privilege('authenticated', 'public.focus_sessions', 'SELECT');
  assert not has_table_privilege('authenticated', 'public.focus_sessions', 'INSERT');
  assert not has_table_privilege('authenticated', 'public.focus_sessions', 'UPDATE');
  assert not has_table_privilege('authenticated', 'public.focus_sessions', 'DELETE');
  assert not has_function_privilege('authenticated', 'public.save_verified_focus_session(uuid,uuid,uuid)', 'EXECUTE');
  assert not has_function_privilege('anon', 'public.save_verified_focus_session(uuid,uuid,uuid)', 'EXECUTE');
  assert has_function_privilege('service_role', 'public.save_verified_focus_session(uuid,uuid,uuid)', 'EXECUTE');

  insert into public.habit_ai_jobs (user_id, cache_key, state, result)
  values (owner_id, 'focus:v1:mock', 'ready', jsonb_build_object(
    'focusSessionId', session_id, 'result', jsonb_build_object('verified', true)
  )) returning id into receipt;

  begin
    perform public.save_verified_focus_session(owner_id, session_id, receipt);
    assert false, 'An active timer accepted Focus proof';
  exception when raise_exception then
    assert sqlerrm = 'focus_timer_running';
  end;
  begin
    perform public.save_verified_focus_session(other_id, session_id, receipt);
    assert false, 'Cross-account Focus completion succeeded';
  exception when raise_exception then
    assert sqlerrm = 'focus_inactive';
  end;
  begin
    perform public.save_verified_focus_session(owner_id, another_session_id, receipt);
    assert false, 'A Focus receipt crossed session boundaries';
  exception when raise_exception then
    assert sqlerrm = 'focus_proof_required';
  end;

  update public.focus_sessions set started_at = statement_timestamp() - interval '25 minutes' where id = session_id;
  update public.habit_ai_jobs set updated_at = statement_timestamp() - interval '31 minutes' where id = receipt;
  begin
    perform public.save_verified_focus_session(owner_id, session_id, receipt);
    assert false, 'An expired Focus receipt was accepted';
  exception when raise_exception then
    assert sqlerrm = 'focus_proof_required';
  end;
  update public.habit_ai_jobs set updated_at = statement_timestamp(), result = jsonb_set(result, '{result,verified}', 'false')
  where id = receipt;
  begin
    perform public.save_verified_focus_session(owner_id, session_id, receipt);
    assert false, 'A rejected photo earned Focus roots';
  exception when raise_exception then
    assert sqlerrm = 'focus_proof_required';
  end;

  update public.habit_ai_jobs set result = jsonb_set(result, '{result,verified}', 'true') where id = receipt;
  saved := public.save_verified_focus_session(owner_id, session_id, receipt);
  assert saved = '{"newlyCompleted":true,"roots":15,"minutes":25}'::jsonb;
  assert (select consumed_at is not null from public.habit_ai_jobs where id = receipt);
  assert (select status = 'completed' and completed_at = statement_timestamp() and roots_awarded = 15
    from public.focus_sessions where id = session_id);
  assert public.save_verified_focus_session(owner_id, session_id, receipt) =
    '{"newlyCompleted":false,"roots":15,"minutes":25}'::jsonb;
end;
$$;

rollback;
