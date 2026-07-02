"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

function subscribeNoop() {
  return () => {};
}

// next-themes resolves the theme synchronously from localStorage on the
// client's very first render, before hydration -- so it never actually goes
// through an "undefined during hydration" phase to check against. Reading
// or rendering anything theme-dependent on that first pass would mismatch
// the server's render (which has no access to localStorage/matchMedia).
// useSyncExternalStore's separate server/client snapshots are the
// hydration-safe way to force "not yet mounted" on both sides without
// setting state inside an effect.
function useHasMounted() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}

// Rendered once from app/layout.tsx so it's present on every route without
// duplicating it per-page. Fixed bottom-right is empty space on all of
// them: ReadingApp's own header fills the top of the viewport, and
// LoginForm/auth-code-error content is vertically centered.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();

  if (!mounted) {
    return <div className="fixed bottom-4 right-4 z-40 h-9 w-20" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="fixed bottom-4 right-4 z-40 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
    >
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
