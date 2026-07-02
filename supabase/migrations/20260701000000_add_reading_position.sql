-- Persists "current chapter/section being viewed" (SPEC.md §5.1: "Lands on
-- last viewed section") -- distinct from reading_progress.completed. One
-- row per user already exists (public.users, via the existing auth trigger),
-- so this is two columns + a timestamp on that table, not a new table.

alter table public.users
  add column current_chapter integer,
  add column current_section integer,
  add column position_updated_at timestamptz;

create policy users_update_own_position
  on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- RLS only scopes ROWS, not columns -- without this, the policy above would
-- let a client rewrite their own email/created_at/last_login directly via
-- PostgREST, bypassing the auth-trigger-driven sync. Restrict the grant to
-- just the position columns the RPC below actually touches.
revoke update on public.users from authenticated;
grant update (current_chapter, current_section, position_updated_at) on public.users to authenticated;

-- Mirrors mark_section_complete's shape: security invoker, LWW-guarded on a
-- client-supplied timestamp, falls back to a plain select if this write
-- loses the LWW race so the caller always gets the authoritative row back.
create function public.update_reading_position(
  p_chapter integer,
  p_section integer,
  p_updated_at timestamptz default now()
)
returns public.users
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.users;
begin
  update public.users
  set current_chapter = p_chapter,
      current_section = p_section,
      position_updated_at = p_updated_at
  where id = auth.uid()
    and (p_updated_at >= position_updated_at or position_updated_at is null)
  returning * into v_row;

  if v_row is null then
    select * into v_row from public.users where id = auth.uid();
  end if;

  return v_row;
end;
$$;

revoke all on function public.update_reading_position from public;
grant execute on function public.update_reading_position to authenticated;
