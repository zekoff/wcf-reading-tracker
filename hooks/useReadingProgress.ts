"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  flushPendingChanges,
  flushPendingPosition,
  resetAndClearQueue,
  syncMarkSectionComplete,
  syncReadingPosition,
} from "@/lib/syncManager";

function key(chapter: number, section: number) {
  return `${chapter}:${section}`;
}

interface Position {
  chapter: number;
  section: number;
}

// SPEC.md §3.2/§6: fetch once, then listen for realtime changes so other
// devices' writes show up automatically. Marking/resetting go through
// mark_section_complete / a scoped delete (both RLS-enforced server-side),
// via lib/syncManager.ts so a failed write queues in IndexedDB instead of
// being lost, and gets flushed on reconnect.
export function useReadingProgress(userId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [progress, setProgress] = useState<Map<string, boolean>>(new Map());
  const [lastPosition, setLastPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      const [{ data, error }, { data: userRow, error: userError }] = await Promise.all([
        supabase
          .from("reading_progress")
          .select("chapter, section, completed")
          .eq("user_id", userId),
        supabase
          .from("users")
          .select("current_chapter, current_section")
          .eq("id", userId)
          .single(),
      ]);
      if (!active) return;
      if (error) {
        console.error("failed to load reading progress", error);
      }
      if (userError) {
        console.error("failed to load reading position", userError);
      }
      const map = new Map<string, boolean>();
      for (const row of data ?? []) {
        map.set(key(row.chapter, row.section), row.completed);
      }
      setProgress(map);
      if (userRow?.current_chapter != null && userRow?.current_section != null) {
        setLastPosition({ chapter: userRow.current_chapter, section: userRow.current_section });
      }
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
    flushPendingPosition(supabase);
    const handleOnline = () => {
      flushPendingChanges(supabase);
      flushPendingPosition(supabase);
    };
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

  const updatePosition = useCallback(
    async (chapter: number, section: number) => {
      await syncReadingPosition(supabase, chapter, section);
    },
    [supabase]
  );

  return { progress, loading, isComplete, markComplete, resetProgress, lastPosition, updatePosition };
}
