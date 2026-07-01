"use client";

import { useState } from "react";
import type { WCFContent } from "@/lib/contentLoader";

interface ChapterPickerProps {
  isOpen: boolean;
  onClose: () => void;
  content: WCFContent;
  currentChapter: number;
  isComplete: (chapter: number, section: number) => boolean;
  onSelect: (chapter: number, section: number) => void;
}

// SPEC.md §4.1 secondary nav: collapsible chapter list, jump to a chapter
// (-> its section 1) or a specific section directly, checkmarks for
// completed sections.
export function ChapterPicker({
  isOpen,
  onClose,
  content,
  currentChapter,
  isComplete,
  onSelect,
}: ChapterPickerProps) {
  const [openChapters, setOpenChapters] = useState<Set<number>>(
    () => new Set([currentChapter])
  );

  if (!isOpen) return null;

  function toggleChapter(chapterNumber: number, open: boolean) {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (open) next.add(chapterNumber);
      else next.delete(chapterNumber);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-sm flex-col overflow-y-auto bg-white p-4 sm:w-96"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Chapters</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <ul className="flex flex-col gap-1">
          {content.chapters.map((chapter) => (
            <li key={chapter.number}>
              <details
                open={openChapters.has(chapter.number)}
                onToggle={(e) => toggleChapter(chapter.number, e.currentTarget.open)}
              >
                <summary
                  className="cursor-pointer rounded-md px-2 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleChapter(chapter.number, !openChapters.has(chapter.number));
                    onSelect(chapter.number, 1);
                  }}
                >
                  {chapter.number}. {chapter.title}
                </summary>
                <ul className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-gray-200 pl-3">
                  {chapter.sections.map((section) => (
                    <li key={section.number}>
                      <button
                        onClick={() => onSelect(chapter.number, section.number)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-gray-600 hover:bg-gray-50"
                      >
                        <span className="w-4 shrink-0">
                          {isComplete(chapter.number, section.number) ? "✓" : ""}
                        </span>
                        Section {section.number}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
