"use client";

import { useState } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";

interface AccountMenuProps {
  userEmail: string;
  onReset: () => void;
}

// Tucks Reset/Sign out behind a click instead of leaving them as
// always-visible header buttons -- both are used far less often than
// Chapters, and on narrow viewports a wrapped header previously left Reset
// sitting directly under Chapters, risking an accidental click.
export function AccountMenu({ userEmail, onReset }: AccountMenuProps) {
  const [isOpen, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        {userEmail}
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 flex w-44 flex-col gap-1 rounded-md border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onReset();
              }}
              className="w-full rounded-md px-2 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Reset progress
            </button>
            <SignOutButton />
          </div>
        </>
      )}
    </div>
  );
}
