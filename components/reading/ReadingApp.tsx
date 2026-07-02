"use client";

import { useMemo, useState } from "react";
import type { WCFContent } from "@/lib/contentLoader";
import { flattenSections, findResumeIndex, type FlatSection } from "@/lib/wcfNavigation";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { ReadingView } from "@/components/reading/ReadingView";
import { ChapterPicker } from "@/components/reading/ChapterPicker";
import { ProgressBar } from "@/components/reading/ProgressBar";
import { ResetConfirmation } from "@/components/reading/ResetConfirmation";
import { SignOutButton } from "@/components/auth/SignOutButton";

interface ReadingAppProps {
  content: WCFContent;
  userId: string;
  userEmail: string;
}

export function ReadingApp({ content, userId, userEmail }: ReadingAppProps) {
  const flat = useMemo(() => flattenSections(content), [content]);
  const progress = useReadingProgress(userId);

  if (progress.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Loading your progress...
      </div>
    );
  }

  // Mounted fresh exactly once progress has loaded, so its resume-position
  // state initializes once from that snapshot (see the lazy useState below)
  // rather than being recomputed -- and possibly jumping the user to a
  // different section -- every time a realtime update changes what counts
  // as "first incomplete" (SPEC.md §5.6: a same-section update from another
  // device should update in place, not navigate away).
  return (
    <ReadingAppLoaded
      content={content}
      flat={flat}
      userEmail={userEmail}
      {...progress}
    />
  );
}

interface ReadingAppLoadedProps {
  content: WCFContent;
  flat: FlatSection[];
  userEmail: string;
  isComplete: (chapter: number, section: number) => boolean;
  markComplete: (chapter: number, section: number, completed: boolean) => Promise<void>;
  resetProgress: () => Promise<void>;
}

function ReadingAppLoaded({
  content,
  flat,
  userEmail,
  isComplete,
  markComplete,
  resetProgress,
}: ReadingAppLoadedProps) {
  const [currentIndex, setCurrentIndex] = useState(() => findResumeIndex(flat, isComplete));
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [isResetOpen, setResetOpen] = useState(false);
  const [isResetting, setResetting] = useState(false);

  const section = flat[currentIndex];
  const completedCount = flat.filter((s) => isComplete(s.chapter, s.section)).length;

  function selectSection(chapter: number, sectionNumber: number) {
    const idx = flat.findIndex((s) => s.chapter === chapter && s.section === sectionNumber);
    if (idx !== -1) setCurrentIndex(idx);
    setPickerOpen(false);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPickerOpen(true)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Chapters
          </button>
          <ProgressBar completed={completedCount} total={flat.length} />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setResetOpen(true)}
            className="text-sm text-gray-500 hover:text-red-600"
          >
            Reset
          </button>
          <span className="text-sm text-gray-600">{userEmail}</span>
          <SignOutButton />
        </div>
      </header>

      <ReadingView
        section={section}
        completed={isComplete(section.chapter, section.section)}
        onToggleComplete={(completed) => markComplete(section.chapter, section.section, completed)}
        onPrev={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
        onNext={() => setCurrentIndex(Math.min(flat.length - 1, currentIndex + 1))}
        hasPrev={currentIndex > 0}
        hasNext={currentIndex < flat.length - 1}
      />

      <ChapterPicker
        isOpen={isPickerOpen}
        onClose={() => setPickerOpen(false)}
        content={content}
        currentChapter={section.chapter}
        isComplete={isComplete}
        onSelect={selectSection}
      />

      <ResetConfirmation
        isOpen={isResetOpen}
        isDeleting={isResetting}
        onCancel={() => setResetOpen(false)}
        onConfirm={async () => {
          setResetting(true);
          await resetProgress();
          setResetting(false);
          setResetOpen(false);
          setCurrentIndex(0);
        }}
      />
    </div>
  );
}
