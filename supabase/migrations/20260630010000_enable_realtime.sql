-- Enables realtime replication for reading_progress (SPEC.md §3.2:
-- "Listen to real-time updates via Supabase subscriptions"). Tables are
-- not in the supabase_realtime publication by default -- without this,
-- postgres_changes subscriptions never fire, silently.
alter publication supabase_realtime add table public.reading_progress;
