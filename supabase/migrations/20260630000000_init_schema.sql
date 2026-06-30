-- Initial schema for WCF Reading Tracker (SPEC.md §2, §3.2, §3.3, §7, §8)

-- ============================================================================
-- users
-- ============================================================================
-- Mirrors auth.users (id, email, created_at, last_sign_in_at) so the app has
-- a public-schema profile table it can extend later without touching the
-- protected auth schema. Never written to directly by the app -- kept in
-- sync by the trigger defined below.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now(),
  last_login timestamptz
);

alter table public.users enable row level security;

create policy users_select_own
  on public.users
  for select
  using (auth.uid() = id);

-- ============================================================================
-- reading_progress
-- ============================================================================
create table public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  chapter integer not null,
  section integer not null,
  completed boolean not null default false,
  -- client-supplied timestamp of when the mark/unmark action happened;
  -- used for last-write-wins conflict resolution, see mark_section_complete.
  marked_complete_at timestamptz,
  -- server-side timestamp of the last write to this row; used to fetch
  -- "changes since last sync" on app load.
  updated_at timestamptz not null default now(),
  unique (user_id, chapter, section)
);

-- Powers "fetch all changes since last sync" (SPEC §2). The unique
-- constraint above already provides an index for (user_id, chapter,
-- section) lookups, so no separate index is needed for that.
create index reading_progress_user_updated_at_idx
  on public.reading_progress (user_id, updated_at);

alter table public.reading_progress enable row level security;

create policy reading_progress_users_can_read_own
  on public.reading_progress
  for select
  using (user_id = auth.uid());

create policy reading_progress_users_can_insert_own
  on public.reading_progress
  for insert
  with check (user_id = auth.uid());

create policy reading_progress_users_can_update_own
  on public.reading_progress
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy reading_progress_users_can_delete_own
  on public.reading_progress
  for delete
  using (user_id = auth.uid());

-- ============================================================================
-- Keep public.users in sync with auth.users (SPEC §3.3: "verifies token,
-- creates users record if new"; SPEC §2: last_login)
-- ============================================================================
create function public.handle_auth_user_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, created_at, last_login)
  values (new.id, new.email, now(), new.last_sign_in_at)
  on conflict (id) do update
    set email = excluded.email,
        last_login = excluded.last_login;
  return new;
end;
$$;

create trigger on_auth_user_change
  after insert or update of email, last_sign_in_at on auth.users
  for each row
  execute function public.handle_auth_user_sync();

-- ============================================================================
-- mark_section_complete RPC (SPEC §3.2, §6, §7)
-- ============================================================================
-- Upserts a reading_progress row for the calling user. Applies last-write-
-- wins conflict resolution: an incoming write is only applied if its
-- p_marked_complete_at is at least as new as the row's current
-- marked_complete_at. Returns the resulting row either way, so the caller
-- can tell whether its write actually won (if not, it should refetch).
create function public.mark_section_complete(
  p_chapter integer,
  p_section integer,
  p_completed boolean,
  p_marked_complete_at timestamptz default now()
)
returns public.reading_progress
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.reading_progress;
begin
  insert into public.reading_progress (
    user_id, chapter, section, completed, marked_complete_at, updated_at
  )
  values (
    auth.uid(), p_chapter, p_section, p_completed, p_marked_complete_at, now()
  )
  on conflict (user_id, chapter, section) do update
    set completed = excluded.completed,
        marked_complete_at = excluded.marked_complete_at,
        updated_at = now()
    where excluded.marked_complete_at >= public.reading_progress.marked_complete_at
       or public.reading_progress.marked_complete_at is null
  returning * into v_row;

  if v_row is null then
    select * into v_row
    from public.reading_progress
    where user_id = auth.uid() and chapter = p_chapter and section = p_section;
  end if;

  return v_row;
end;
$$;

revoke all on function public.mark_section_complete from public;
grant execute on function public.mark_section_complete to authenticated;
