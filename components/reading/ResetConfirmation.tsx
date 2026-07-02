interface ResetConfirmationProps {
  isOpen: boolean;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// SPEC.md §5.5: confirm before deleting all reading_progress rows.
export function ResetConfirmation({ isOpen, isDeleting, onConfirm, onCancel }: ResetConfirmationProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={isDeleting ? undefined : onCancel}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-5 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Delete all progress?</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">This cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
          >
            {isDeleting ? "Deleting…" : "Delete everything"}
          </button>
        </div>
      </div>
    </div>
  );
}
