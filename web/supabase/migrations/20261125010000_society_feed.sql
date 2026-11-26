-- Phase 2 Slice: Anonymous Society feed (posts, gentle reactions, replies)

create table public.society_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  icon text not null default '🌱',
  body text not null check (char_length(trim(body)) between 1 and 180),
  created_at timestamptz not null default now()
);

create table public.society_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.society_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reaction text not null check (reaction in ('like', 'love', 'same', 'proud')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table public.society_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.society_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 240),
  created_at timestamptz not null default now()
);

create index society_posts_created_idx on public.society_posts (created_at desc);
create index society_reactions_post_idx on public.society_reactions (post_id);
create index society_comments_post_created_idx on public.society_comments (post_id, created_at asc);

alter table public.society_posts enable row level security;
alter table public.society_reactions enable row level security;
alter table public.society_comments enable row level security;

create policy "Authenticated users can read society posts"
on public.society_posts for select to authenticated
using (true);

create policy "Users can create their own society posts"
on public.society_posts for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own society posts"
on public.society_posts for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can read society reactions"
on public.society_reactions for select to authenticated
using (true);

create policy "Users can manage their own society reactions"
on public.society_reactions for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Authenticated users can read society comments"
on public.society_comments for select to authenticated
using (true);

create policy "Users can create their own society comments"
on public.society_comments for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own society comments"
on public.society_comments for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, delete on public.society_posts to authenticated;
grant select, insert, update, delete on public.society_reactions to authenticated;
grant select, insert, delete on public.society_comments to authenticated;
