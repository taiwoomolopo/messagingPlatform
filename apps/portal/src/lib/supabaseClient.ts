import { createBrowserClient } from "@supabase/ssr";

// Uses the anon key — safe for the browser. Every query made with this client is subject to
// the Row Level Security policies defined in supabase/migrations/0001_init.sql, so a logged-in
// user only ever sees their own account's data.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
