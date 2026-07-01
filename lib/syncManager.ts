import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addPendingChange,
  clearPendingChanges,
  getPendingChanges,
  removePendingChange,
} from "@/lib/offlineQueue";

async function attemptWrite(
  supabase: SupabaseClient,
  chapter: number,
  section: number,
  completed: boolean,
  markedCompleteAt: string
): Promise<boolean> {
  const { error } = await supabase.rpc("mark_section_complete", {
    p_chapter: chapter,
    p_section: section,
    p_completed: completed,
    p_marked_complete_at: markedCompleteAt,
  });
  return !error;
}

// SPEC.md §3.2 step b/c/d: try the network write; if it fails for any
// reason (offline, dropped connection, transient server error), queue it
// instead of losing it. The local optimistic UI update already happened by
// the time this is called -- this only concerns the durable write.
export async function syncMarkSectionComplete(
  supabase: SupabaseClient,
  chapter: number,
  section: number,
  completed: boolean
) {
  const markedCompleteAt = new Date().toISOString();
  let ok: boolean;
  try {
    ok = await attemptWrite(supabase, chapter, section, completed, markedCompleteAt);
  } catch {
    ok = false;
  }
  if (!ok) {
    await addPendingChange({ chapter, section, completed, markedCompleteAt });
  }
}

// SPEC.md §3.2 step d / §6 sync diagram: replay the queue in order on
// reconnect. Stops at the first failure rather than skipping ahead, since
// a failure here almost always means we're still offline -- better to
// retry the same item next time than reorder writes.
export async function flushPendingChanges(supabase: SupabaseClient) {
  const pending = await getPendingChanges();
  for (const change of pending) {
    let ok: boolean;
    try {
      ok = await attemptWrite(
        supabase,
        change.chapter,
        change.section,
        change.completed,
        change.markedCompleteAt
      );
    } catch {
      ok = false;
    }
    if (!ok) break;
    if (change.id !== undefined) await removePendingChange(change.id);
  }
}

// SPEC.md §7 "Reset During Sync": clear anything queued so it doesn't
// replay after the reset.
export async function resetAndClearQueue(supabase: SupabaseClient, userId: string) {
  await clearPendingChanges();
  const { error } = await supabase.from("reading_progress").delete().eq("user_id", userId);
  if (error) throw error;
}
