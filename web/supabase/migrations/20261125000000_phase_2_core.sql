create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'friend' check (char_length(display_name) between 1 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 42),
  icon text not null default '🌱',
  area text not null default 'Custom',
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  base_roots smallint not null check (base_roots between 1 and 3),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null,
  completed_on date not null default current_date,
  roots_awarded smallint not null check (roots_awarded between 1 and 3),
  created_at timestamptz not null default now(),
  constraint habit_completions_habit_owner_fk
    foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade,
  unique (habit_id, completed_on),
  unique (id, user_id)
);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  check_in_date date not null default current_date,
  day_state text not null check (day_state in ('steady', 'heavy', 'tiny')),
  mood smallint not null check (mood between 0 and 100),
  mental_load smallint not null check (mental_load between 0 and 100),
  reflection text not null default '' check (char_length(reflection) <= 2000),
  created_at timestamptz not null default now(),
  unique (user_id, check_in_date)
);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  intention text not null check (char_length(intention) between 1 and 72),
  depth text not null check (depth in ('light', 'medium', 'deep')),
  planned_minutes smallint not null check (planned_minutes in (25, 50, 90)),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  roots_awarded smallint not null default 0 check (roots_awarded >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.proof_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  object_path text not null unique,
  focus_session_id uuid,
  habit_completion_id uuid,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 10485760),
  created_at timestamptz not null default now(),
  constraint proof_photo_source_check
    check (focus_session_id is not null or habit_completion_id is not null),
  constraint proof_photo_focus_owner_fk
    foreign key (focus_session_id, user_id)
    references public.focus_sessions (id, user_id) on delete cascade,
  constraint proof_photo_habit_owner_fk
    foreign key (habit_completion_id, user_id)
    references public.habit_completions (id, user_id) on delete cascade
);

create index habits_user_created_idx on public.habits (user_id, created_at);
create index habit_completions_user_date_idx on public.habit_completions (user_id, completed_on desc);
create index check_ins_user_date_idx on public.check_ins (user_id, check_in_date desc);
create index focus_sessions_user_started_idx on public.focus_sessions (user_id, started_at desc);
create index proof_photos_user_created_idx on public.proof_photos (user_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger habits_set_updated_at
before update on public.habits
for each row execute function public.set_updated_at();

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(left(trim(new.raw_user_meta_data ->> 'display_name'), 24), ''), 'friend')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_user_created_profile
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

insert into public.profiles (id, display_name)
select
  auth_user.id,
  coalesce(
    nullif(left(trim(auth_user.raw_user_meta_data ->> 'display_name'), 24), ''),
    'friend'
  )
from auth.users as auth_user
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
alter table public.check_ins enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.proof_photos enable row level security;

create policy "Users can view their profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can manage their habits"
on public.habits for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create poliicy "Users can manage their habit completions"
on public.habit_completions for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.habits
    where habits.id = habit_completions.habit_id
      and habits.user_id = (select auth.uid())
  )
);

create policy "Users can manage their check-ins"
on public.check_ins for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage their focus sessions"
on public.focus_sessions for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage their proof metadata"
on public.proof_photos for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    focus_session_id is null
    or exists (
      select 1
      from public.focus_sessions
      where focus_sessions.id = proof_photos.focus_session_id
        and focus_sessions.user_id = (select auth.uid())
    )
  )
  and (
    habit_completion_id is null
    or exists (
      select 1
      from public.habit_completions
      where habit_completions.id = proof_photos.habit_completion_id
        and habit_completions.user_id = (select auth.uid())
    )
  )
);

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on
  public.habits,
  public.habit_completions,
  public.check_ins,
  public.focus_sessions,
  public.proof_photos
to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proof-photos',
  'proof-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can view their proof photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'proof-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can upload their proof photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'proof-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their proof photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'proof-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
