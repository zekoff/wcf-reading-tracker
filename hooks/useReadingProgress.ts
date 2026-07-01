"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { flushPendingChanges, resetAndClearQueue, syncMarkSectionComplete } from "@/lib/syncManager";

function key(chapter: number, section: number) {
  return `${chapter}:${section}`;
}

// SPEC.md §3.2/§6: fetch once, then listen for realtime changes so other
// devices' writes show up automatically. Marking/resetting go through
// mark_section_complete / a scoped delete (both RLS-enforced server-side),
// via lib/syncManager.ts so a failed write queues in IndexedDB instead of
// being lost, and gets flushed on reconnect.
export function useReadingProgress(userId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [progress, setProgress] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data, error } = await supabase
        .from("reading_progress")
        .select("chapter, section, completed")
        .eq("user_id", userId);
      if (!active) return;
      if (error) {
        console.error("failed to load reading progress", error);
      }
      const map = new Map<string, boolean>();
      for (const row of data ?? []) {
        map.set(key(row.chapter, row.section), row.completed);
      }
      setProgress(map);
      setLoading(false);
    })();

    const channel = supabase
      .channel("reading_progress_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reading_progress",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setProgress((prev) => {
            const next = new Map(prev);
            if (payload.eventType === "DELETE") {
              const old = payload.old as { chapter: number; section: number };
              next.delete(key(old.chapter, old.section));
            } else {
              const row = payload.new as {
                chapter: number;
                section: number;
                completed: boolean;
              };
              next.set(key(row.chapter, row.section), row.completed);
            }
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  // Flush any changes queued while offline: once now (covers a session that
  // ended offline and reopened already-connected) and again on every
  // 'online' transition.
  useEffect(() => {
    flushPendingChanges(supabase);
    const handleOnline = () => flushPendingChanges(supabase);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [supabase]);

  const isComplete = useCallback(
    (chapter: number, section: number) => progress.get(key(chapter, section)) ?? false,
    [progress]
  );

  const markComplete = useCallback(
    async (chapter: number, section: number, completed: boolean) => {
      setProgress((prev) => {
        const next = new Map(prev);
        next.set(key(chapter, section), completed);
        return next;
      });
      await syncMarkSectionComplete(supabase, chapter, section, completed);
    },
    [supabase]
  );

  const resetProgress = useCallback(async () => {
    setProgress(new Map());
    try {
      await resetAndClearQueue(supabase, userId);
    } catch (error) {
      console.error("reset progress failed", error);
    }
  }, [supabase, userId]);

  return { progress, loading, isComplete, markComplete, resetProgress };
}
