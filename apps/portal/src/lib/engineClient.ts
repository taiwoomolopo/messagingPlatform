import { createClient } from "./supabaseClient";

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_API_URL ?? "http://localhost:4000";

/**
 * Calls the engine service, attaching the current Supabase session's access token as a
 * Bearer token. The engine's portalAuth/adminAuth middleware verify this token and resolve
 * it to an account (or check platform_admins membership) — see services/engine/src/middleware.
 */
export async function callEngine(path: string, options: RequestInit = {}) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error("Not logged in");

  const res = await fetch(`${ENGINE_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }

  return res;
}
