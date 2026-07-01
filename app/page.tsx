import { createClient } from "@/lib/supabase/server";
import { getWCFContent } from "@/lib/contentLoader";
import { LoginForm } from "@/components/auth/LoginForm";
import { ReadingApp } from "@/components/reading/ReadingApp";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <LoginForm />;
  }

  const content = await getWCFContent();

  return <ReadingApp content={content} userId={user.id} userEmail={user.email!} />;
}
