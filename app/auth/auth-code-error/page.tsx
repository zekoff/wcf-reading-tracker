import { ThemeToggle } from "@/components/ThemeToggle";

export default function AuthCodeErrorPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <h1 className="text-xl font-semibold">Sign-in link expired or invalid</h1>
      <p className="text-gray-600 dark:text-gray-400">
        Please request a new magic link and try again.
      </p>
    </div>
  );
}
