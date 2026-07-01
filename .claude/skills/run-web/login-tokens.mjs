// Prints "<access_token> <refresh_token>" for a test login, bypassing
// Supabase's email-send rate limit entirely (no email is sent -- this uses
// the admin API to generate a magic link, then follows its redirect
// server-side to read the tokens out of the Location header).
//
// Usage: SUPABASE_SERVICE_ROLE_KEY=... node login-tokens.mjs [email]
// Feed the output straight into the driver's login-as command:
//   node driver.mjs <<EOF
//   launch
//   login-as $(node login-tokens.mjs test@example.com)
//   EOF
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2] || "wcf-ui-testuser@example.com";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("ERROR: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const { data, error } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email,
});
if (error) {
  console.error("ERROR", error);
  process.exit(1);
}

const res = await fetch(data.properties.action_link, { redirect: "manual" });
const location = res.headers.get("location");
if (!location || !location.includes("access_token")) {
  console.error("ERROR: no tokens in redirect:", location);
  process.exit(1);
}
const hash = new URLSearchParams(location.split("#")[1]);
console.log(`${hash.get("access_token")} ${hash.get("refresh_token")}`);
