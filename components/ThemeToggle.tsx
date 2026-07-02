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

// Rendered in-flow by each top-level page (ReadingApp's header, LoginForm,
// auth-code-error) rather than as one viewport-fixed element -- a fixed
// position risks colliding with different content on each page (it used to
// sit on top of ReadingView's "Next" button on narrow/short viewports).
// Callers position it via a wrapping element.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();

  if (!mounted) {
    return <div className="h-9 w-20" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
    >
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
