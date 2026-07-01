import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Magic link lands here (SPEC.md §3.3, step 3): exchanges the one-time code
// for a session, which also triggers our public.users sync (see the
// on_auth_user_change trigger in supabase/migrations).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
