# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository currently contains only a product specification (`SPEC.md`) — no application code has been written yet. There is no build, lint, or test tooling configured. `SPEC.md` is the authoritative design document; read it in full before implementing anything, and implement against it rather than improvising structure.

## Planned architecture (from SPEC.md)

**Stack:** Next.js (App Router) + Supabase (Postgres, Auth, Realtime) + Vercel, styled with Tailwind.

Key architectural decisions to preserve when building this out:

- **Content loading is abstracted behind a single module** (`lib/contentLoader.ts`), which loads the WCF chapter/section text from whatever source is current (JSON, flat text, API) and returns a standardized `WCFContent { chapters: Chapter[] }` shape. UI and data layers should depend only on this interface, not on the underlying content source, so the source can be swapped later.
- **Sync is optimistic and offline-first**: user actions update local state immediately, then attempt to write to Supabase. If offline, changes queue in IndexedDB (`pendingChanges` table) and flush on reconnect. Real-time updates from other devices arrive via Supabase subscriptions.
- **Conflict resolution is last-write-wins**, keyed on a `marked_complete_at` timestamp on each `reading_progress` row. The Supabase RPC `mark_section_complete(chapter, section, completed)` is intended to own the insert/update + conflict logic server-side.
- **Auth is passwordless** (Supabase magic link) — there is no password field in the data model.
- **Authorization is enforced via Postgres RLS** on `reading_progress`, scoped to `user_id = auth.uid()`. Any new queries against this table must work under RLS rather than bypassing it with a service role.

See `SPEC.md` §2–§3 for the full data model and sync state machine, and §10 for the originally proposed file layout — treat that layout as a starting suggestion, not a constraint, if a different structure better fits Next.js conventions as the app grows.
