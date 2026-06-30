# Supabase setup

Schema lives in `supabase/migrations/`, following the standard Supabase CLI
migration layout. It was authored without a local Docker/Postgres available
(this sandbox had neither), so it has been reviewed carefully by hand but not
yet exercised against a live database — verify it after applying, using the
steps below.

## Applying the migration

Pick whichever you have available:

**Supabase CLI** (requires [Docker](https://docs.docker.com/get-docker/) only
if you also want to run things locally via `supabase start`; not required
just to push to a remote project):

```sh
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

**Supabase Dashboard**: open the SQL Editor for your project and paste the
contents of `supabase/migrations/20260630000000_init_schema.sql`, then run it.

## What it creates

- `public.users` — kept in sync with `auth.users` automatically by a trigger
  (`on_auth_user_change`); the app should never insert/update it directly.
- `public.reading_progress` — one row per `(user, chapter, section)`, RLS
  scoped so each user can only see/modify their own rows.
- `public.mark_section_complete(p_chapter, p_section, p_completed, p_marked_complete_at)`
  — RPC the app should call instead of writing to `reading_progress` directly.
  Applies last-write-wins conflict resolution and returns the resulting row.

## Verifying after applying

1. **Auto profile creation**: sign up a test user via magic link, then check
   `select * from public.users` — a row should appear automatically with
   matching `email` and `last_login` set.
2. **Last-write-wins**: as that user, call
   `select * from mark_section_complete(1, 1, true, now() - interval '1 minute')`
   then `select * from mark_section_complete(1, 1, false, now())`. The first
   call should set `completed = true`; the second (newer timestamp) should
   win and flip it to `false`. Then try replaying the first (older) call
   again — it should be rejected, and the returned row should still show
   `completed = false`.
3. **RLS isolation**: as a second test user, confirm
   `select * from public.reading_progress` only ever returns that user's own
   rows, and that calling `mark_section_complete` for the first user's
   `(chapter, section)` creates a separate row rather than overwriting theirs.
