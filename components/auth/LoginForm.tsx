"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";

type Status = "idle" | "sending" | "sent" | "error";

// SPEC.md §3.3 steps 1-2: email in, magic link out. Step 3-4 (link opens
// app, session verified) is handled by app/auth/callback/route.ts.
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-gray-600 dark:text-gray-400">
          We sent a sign-in link to <span className="font-medium">{email}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <div className="text-center">
          <h1 className="text-xl font-semibold">WCF Reading Tracker</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Sign in with your email to track your progress.
          </p>
        </div>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {status === "sending" ? "Sending..." : "Send magic link"}
        </button>
        {status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        )}
      </form>
    </div>
  );
}
