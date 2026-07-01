import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <span className="text-sm text-gray-600">Signed in as {user.email}</span>
        <SignOutButton />
      </header>
      <main className="flex flex-1 items-center justify-center p-8 text-center text-gray-500">
        Reading view coming next.
      </main>
    </div>
  );
}
