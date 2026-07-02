interface ProgressBarProps {
  completed: number;
  total: number;
}

// SPEC.md §4.1: "Small progress indicator (e.g., '3/156 sections complete')".
export function ProgressBar({ completed, total }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div className="h-full bg-black dark:bg-white" style={{ width: `${pct}%` }} />
      </div>
      <span>
        {completed}/{total} sections complete
      </span>
    </div>
  );
}
