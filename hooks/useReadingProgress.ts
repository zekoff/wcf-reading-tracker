"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function key(chapter: number, section: number) {
  return `${chapter}:${section}`;
}

// SPEC.md §3.2/§6: fetch once, then listen for realtime changes so other
// devices' writes show up automatically. Marking/resetting go through
// mark_section_complete / a scoped delete, both RLS-enforced server-side.
// Online-first for now -- lib/syncManager.ts (added later) will take over
// the actual write path to add offline queueing without changing this
// hook's public shape.
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
      const { error } = await supabase.rpc("mark_section_complete", {
        p_chapter: chapter,
        p_section: section,
        p_completed: completed,
      });
      if (error) {
        console.error("mark_section_complete failed", error);
      }
    },
    [supabase]
  );

  const resetProgress = useCallback(async () => {
    setProgress(new Map());
    const { error } = await supabase
      .from("reading_progress")
      .delete()
      .eq("user_id", userId);
    if (error) {
      console.error("reset progress failed", error);
    }
  }, [supabase, userId]);

  return { progress, loading, isComplete, markComplete, resetProgress };
}
