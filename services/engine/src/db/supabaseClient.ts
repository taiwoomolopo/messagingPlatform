import { createClient } from "@supabase/supabase-js";

// The engine always uses the service-role key — it needs to write messages, delivery reports,
// and billing ledger rows, which RLS policies deliberately don't allow the anon/authenticated
// role to do (see supabase/migrations/0001_init.sql). Never expose this key to the portal/browser.
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
