import type { WCFContent } from "@/lib/contentLoader";

export interface FlatSection {
  index: number;
  chapter: number;
  chapterTitle: string;
  section: number;
  totalSectionsInChapter: number;
  text: string;
  footnotes?: string[];
}

// Reading order is chapter-then-section ascending, matching the source
// document -- used for prev/next nav and for "resume where you left off".
export function flattenSections(content: WCFContent): FlatSection[] {
  const flat: FlatSection[] = [];
  for (const chapter of content.chapters) {
    for (const section of chapter.sections) {
      flat.push({
        index: flat.length,
        chapter: chapter.number,
        chapterTitle: chapter.title,
        section: section.number,
        totalSectionsInChapter: chapter.sections.length,
        text: section.text,
        footnotes: section.footnotes,
      });
    }
  }
  return flat;
}

// SPEC.md §5.1: fallback for a user with no recorded reading position yet
// (see ReadingApp.tsx's lastPosition/updatePosition, which take precedence
// once a position has been recorded) -- land on the first unread section,
// or the very first section if the user has no progress yet, or the last
// section if everything is already complete.
export function findResumeIndex(
  flat: FlatSection[],
  isComplete: (chapter: number, section: number) => boolean
): number {
  const firstIncomplete = flat.findIndex((s) => !isComplete(s.chapter, s.section));
  if (firstIncomplete !== -1) return firstIncomplete;
  return flat.length > 0 ? flat.length - 1 : 0;
}
