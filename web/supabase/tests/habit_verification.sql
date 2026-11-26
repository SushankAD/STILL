-- Execute against a disposable database after applying the Supabase migrations.
begin;

do $$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  habit public.habits;
  social public.habits;
  legacy public.habits;
  sleep public.habits;
  receipt uuid;
  other_receipt uuid := gen_random_uuid();
  self_receipt uuid := gen_random_uuid();
  forged uuid := gen_random_uuid();
  saved public.habit_completions;
  job jsonb;
  occurrence date;
  sleep_day date;
  social_day date;
  base_policy jsonb := '{"safetyStatus":"ALLOWED","verificationMode":"PHOTO","dateBasis":"CURRENT_DAY"}';
  report_policy jsonb := '{"safetyStatus":"ALLOWED","verificationMode":"SCREENSHOT","dateBasis":"CURRENT_DAY"}';
begin
  insert into auth.users (id) values (owner_id), (other_id);
  insert into public.habits (user_id, title, difficulty, base_roots, verification_timezone, verification_policy)
  values (owner_id, 'Make the bed', 'medium', 3, 'America/New_York', base_policy) returning * into habit;
  insert into public.habits (user_id, title, difficulty, base_roots, verification_timezone, verification_policy, verification_template)
  values
    (owner_id, 'Sleep before 11', 'hard', 1, 'America/New_York', report_policy, 'sleep') returning * into sleep;
  insert into public.habits (user_id, title, difficulty, base_roots, verification_timezone, verification_policy, verification_template)
  values
    (owner_id, 'No social scrolling', 'easy', 1, 'America/New_York', report_policy, 'social') returning * into social;
  insert into public.habits (user_id, title, difficulty, base_roots)
  values (owner_id, 'An existing custom habit', 'easy', 1) returning * into legacy;
  occurrence := public.habit_verification_date(habit, statement_timestamp());
  sleep_day := public.habit_verification_date(sleep, statement_timestamp());
  social_day := public.habit_verification_date(social, statement_timestamp());

  assert not has_table_privilege('authenticated', 'public.habit_completions', 'INSERT');
  assert not has_table_privilege('authenticated', 'public.habit_completions', 'UPDATE');
  assert not has_table_privilege('authenticated', 'public.habit_completions', 'DELETE');
  assert not has_table_privilege('authenticated', 'public.habits', 'UPDATE');
  assert not has_table_privilege('anon', 'public.habit_ai_jobs', 'SELECT');
  assert not has_function_privilege('authenticated', 'public.save_verified_habit_completion(uuid,uuid,date,uuid,uuid,boolean)', 'EXECUTE');
  assert not has_function_privilege('anon', 'public.reserve_habit_ai_job(uuid,text)', 'EXECUTE');

  -- Legacy records are readable but missing policies cannot authorize rewards.
  insert into public.habit_completions (user_id, habit_id, completed_on, roots_awarded)
  values (owner_id, legacy.id, occurrence - 3, 1) returning * into saved;
  assert saved.verification_method = 'legacy';
  begin
    perform public.save_verified_habit_completion(owner_id, legacy.id,
      public.habit_verification_date(legacy, statement_timestamp()), legacy.policy_revision, forged, true);
    assert false, 'Missing policy accepted';
  exception when raise_exception then
    assert sqlerrm = 'habit_policy_unavailable';
  end;

  job := public.reserve_habit_ai_job(owner_id, 'proof:mock-image');
  assert job->>'state' = 'claimed';
  receipt := (job->>'id')::uuid;
  assert public.reserve_habit_ai_job(owner_id, 'proof:mock-image')->>'state' = 'pending';
  update public.habit_ai_jobs set state = 'ready', result = jsonb_build_object(
    'result', jsonb_build_object('status', 'PARTIAL'), 'habitId', habit.id, 'policyRevision', habit.policy_revision,
    'habitDate', occurrence, 'method', 'photo', 'imageHash', 'photo-sha'
  ) where id = receipt;
  assert public.reserve_habit_ai_job(owner_id, 'proof:mock-image')->>'id' = receipt::text;

  begin
    perform public.save_verified_habit_completion(owner_id, habit.id, occurrence, habit.policy_revision, receipt, false);
    assert false, 'Partial proof accepted';
  exception when raise_exception then
    assert sqlerrm = 'habit_proof_required';
  end;
  begin
    perform public.save_verified_habit_completion(owner_id, habit.id, occurrence, habit.policy_revision, forged, false);
    assert false, 'Missing receipt accepted';
  exception when raise_exception then
    assert sqlerrm = 'habit_proof_required';
  end;
  begin
    perform public.save_verified_habit_completion(other_id, habit.id, occurrence, habit.policy_revision, receipt, false);
    assert false, 'Cross-account habit completion succeeded';
  exception when raise_exception then
    assert sqlerrm = 'habit_not_found';
  end;
  begin
    perform public.save_verified_habit_completion(owner_id, habit.id, occurrence, habit.policy_revision, self_receipt, true);
    assert false, 'Photo habit accepted a self-report';
  exception when raise_exception then
    assert sqlerrm = 'habit_self_report_unavailable';
  end;

  update public.habit_ai_jobs set result = jsonb_set(result, '{result,status}', '"ACCEPTED"') where id = receipt;
  update public.habits set policy_revision = gen_random_uuid() where id = habit.id returning * into habit;
  begin
    perform public.save_verified_habit_completion(owner_id, habit.id, occurrence, habit.policy_revision, receipt, false);
    assert false, 'Receipt survived changed habit meaning';
  exception when raise_exception then
    assert sqlerrm = 'habit_proof_required';
  end;
  update public.habit_ai_jobs
  set result = jsonb_set(result, '{policyRevision}', to_jsonb(habit.policy_revision))
  where id = receipt;

  saved := public.save_verified_habit_completion(owner_id, habit.id, occurrence, habit.policy_revision, receipt, false);
  assert saved.id = receipt;
  assert saved.roots_awarded = 2 and saved.verification_method = 'photo';
  assert (public.save_verified_habit_completion(owner_id, habit.id, occurrence, habit.policy_revision, receipt, false)).id = saved.id;
  assert (select count(*) from public.habit_completions where habit_id = habit.id) = 1;
  begin
    perform public.save_verified_habit_completion(owner_id, habit.id, occurrence, habit.policy_revision, other_receipt, false);
    assert false, 'Second submission awarded roots';
  exception when raise_exception then
    assert sqlerrm = 'habit_already_complete';
  end;

  assert public.reserve_habit_ai_job(owner_id, 'proof:mock-image')->>'state' = 'used';
  perform public.undo_verified_habit_completion(owner_id, habit.id, saved.id, 'America/New_York');
  assert (select count(*) from public.habit_completions where habit_id = habit.id) = 0;
  begin
    perform public.save_verified_habit_completion(owner_id, habit.id, occurrence, habit.policy_revision, receipt, false);
    assert false, 'Consumed evidence could be reused after undo';
  exception when raise_exception then
    assert sqlerrm = 'habit_evidence_used';
  end;

  saved := public.save_verified_habit_completion(owner_id, sleep.id, sleep_day, sleep.policy_revision, self_receipt, true);
  assert saved.verification_method = 'self_report' and saved.roots_awarded = 3;
  assert saved.verification_time_zone = 'America/New_York';
  assert (public.save_verified_habit_completion(owner_id, sleep.id, sleep_day, sleep.policy_revision, self_receipt, true)).id = self_receipt;
  perform public.undo_verified_habit_completion(owner_id, sleep.id, saved.id, 'America/New_York');
  begin
    perform public.save_verified_habit_completion(owner_id, sleep.id, sleep_day, sleep.policy_revision, self_receipt, true);
    assert false, 'Undone self-report could be replayed';
  exception when raise_exception then
    assert sqlerrm = 'habit_evidence_used';
  end;

  assert public.habit_verification_date(social, '2026-11-25 04:59:59Z') = '2026-11-23';
  assert public.habit_verification_date(social, '2026-11-25 05:00:00Z') = '2026-11-24';
  begin
    perform public.save_verified_habit_completion(owner_id, social.id, social_day + 1, social.policy_revision, forged, false);
    assert false, 'A full-day habit completed before its window closed';
  exception when raise_exception then
    assert sqlerrm = 'habit_date_changed';
  end;
  social.social_window_end_hour := 18;
  assert public.habit_verification_date(social, '2026-11-25 22:59:59Z') = '2026-11-24';
  assert public.habit_verification_date(social, '2026-11-25 23:00:00Z') = '2026-11-25';
end;
$$;

rollback;
