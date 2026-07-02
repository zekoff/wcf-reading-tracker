"use client";

import type { FlatSection } from "@/lib/wcfNavigation";

interface ReadingViewProps {
  section: FlatSection;
  completed: boolean;
  onToggleComplete: (completed: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

// SPEC.md §4.1 (primary/linear nav) + §4.3 (location indicator).
export function ReadingView({
  section,
  completed,
  onToggleComplete,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: ReadingViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
        Chapter {section.chapter}, Section {section.section}
      </div>

      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{section.chapterTitle}</h1>
        <p className="mt-4 whitespace-pre-wrap text-base leading-7 text-gray-800 dark:text-gray-200">
          {section.text}
        </p>
      </div>

      {section.footnotes && section.footnotes.length > 0 && (
        <details className="rounded-md border border-gray-200 p-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
          <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">
            Scripture proofs ({section.footnotes.length})
          </summary>
          <ol className="mt-3 flex flex-col gap-3 pl-4 list-decimal">
            {section.footnotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ol>
        </details>
      )}

      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={completed}
          onChange={(e) => onToggleComplete(e.target.checked)}
          className="h-4 w-4"
        />
        Mark section complete
      </label>

      <div className="mt-auto flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
        >
          Previous
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          Next
        </button>
      </div>
    </div>
  );
}
