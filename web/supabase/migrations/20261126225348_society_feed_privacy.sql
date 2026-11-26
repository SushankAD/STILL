-- The client can read post and reply content without access to their author IDs.
revoke all on public.society_posts, public.society_comments, public.society_reactions
  from public, anon, authenticated;
grant select (id, icon, body, created_at), insert, delete on public.society_posts to authenticated;
grant select (id, post_id, body, created_at), insert, delete on public.society_comments to authenticated;
grant select, insert, update, delete on public.society_reactions to authenticated;

-- The existing owner policy handles direct reads and writes to the caller's reactions.
drop policy "Authenticated users can read society reactions" on public.society_reactions;

create schema if not exists still_private;
revoke all on schema still_private from public, anon;
grant usage on schema still_private to authenticated;

-- Aggregate across reaction rows without returning another account's identifiers.
create function still_private.society_post_reactions(p_post_id uuid)
returns table (reactions jsonb, reacted text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    jsonb_build_object(
      'like', count(*) filter (where item.reaction = 'like'),
      'love', count(*) filter (where item.reaction = 'love'),
      'same', count(*) filter (where item.reaction = 'same'),
      'proud', count(*) filter (where item.reaction = 'proud')
    ),
    max(item.reaction) filter (where item.user_id = (select auth.uid()))
  from public.society_reactions as item
  where item.post_id = p_post_id
  having (select auth.uid()) is not null;
$$;

revoke all on function still_private.society_post_reactions(uuid) from public, anon, authenticated;
grant execute on function still_private.society_post_reactions(uuid) to authenticated;

create function public.get_society_feed()
returns table (
  id uuid,
  icon text,
  body text,
  created_at timestamptz,
  reactions jsonb,
  reacted text,
  comments jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    post.id,
    post.icon,
    post.body,
    post.created_at,
    summary.reactions,
    summary.reacted,
    coalesce((
      select jsonb_agg(
        jsonb_build_object('id', reply.id, 'text', reply.body)
        order by reply.created_at, reply.id
      )
      from public.society_comments as reply
      where reply.post_id = post.id
    ), '[]'::jsonb)
  from (
    select item.id, item.icon, item.body, item.created_at
    from public.society_posts as item
    order by item.created_at desc, item.id desc
    limit 40
  ) as post
  cross join lateral still_private.society_post_reactions(post.id) as summary
  order by post.created_at desc, post.id desc;
$$;

revoke all on function public.get_society_feed() from public, anon, authenticated;
grant execute on function public.get_society_feed() to authenticated;
