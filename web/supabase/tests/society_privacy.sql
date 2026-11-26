-- Execute against a disposable database after applying the Supabase migrations.
begin;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000011'),
  ('00000000-0000-4000-8000-000000000022');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);

insert into public.society_posts (id, user_id, body) values
  ('00000000-0000-4000-8000-000000000033', auth.uid(), 'Read a page.')
  returning id, icon, body;
insert into public.society_reactions (post_id, user_id, reaction) values
  ('00000000-0000-4000-8000-000000000033', auth.uid(), 'love');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000022', true);

insert into public.society_comments (id, post_id, user_id, body) values
  ('00000000-0000-4000-8000-000000000044', '00000000-0000-4000-8000-000000000033', auth.uid(), 'I did too.')
  returning id, body;
insert into public.society_reactions (post_id, user_id, reaction) values
  ('00000000-0000-4000-8000-000000000033', auth.uid(), 'same')
  on conflict (post_id, user_id) do update set reaction = excluded.reaction;

do $$
declare
  fixture_post constant uuid := '00000000-0000-4000-8000-000000000033';
  feed_post record;
begin
  assert not has_column_privilege('authenticated', 'public.society_posts', 'user_id', 'SELECT');
  assert not has_column_privilege('authenticated', 'public.society_comments', 'user_id', 'SELECT');
  assert not has_function_privilege('anon', 'public.get_society_feed()', 'EXECUTE');
  assert (select count(*) from public.society_reactions where post_id = fixture_post) = 1;

  select * into strict feed_post from public.get_society_feed() where id = fixture_post;
  assert feed_post.body = 'Read a page.';
  assert feed_post.reactions = '{"like": 0, "love": 1, "same": 1, "proud": 0}'::jsonb;
  assert feed_post.reacted = 'same';
  assert feed_post.comments = '[{"id": "00000000-0000-4000-8000-000000000044", "text": "I did too."}]'::jsonb;
end;
$$;

rollback;
