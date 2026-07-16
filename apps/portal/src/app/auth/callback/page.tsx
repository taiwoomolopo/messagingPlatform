"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

/**
 * Landing page for links sent by Supabase Auth emails (signup confirmation, password reset,
 * etc.) — see src/app/signup/page.tsx, which sets emailRedirectTo to point here.
 *
 * Supabase's client library reads the session token out of the URL automatically as soon as
 * a client is instantiated on a page that has it in the URL (hash fragment) — the previous
 * version of this app had no dedicated page for that, so a confirmation click landed on the
 * plain homepage with an unprocessed token and no feedback. This page exists purely to give
 * that moment a clear, on-brand "confirming…" state before routing to where the user should
 * actually end up.
 */
export default function AuthCallbackPage() {
  const [status, setStatus] = useState<"checking" | "success" | "error">("checking");
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        setStatus("error");
        return;
      }
      setStatus("success");
      setTimeout(() => router.push("/dashboard"), 1200);
    });
  }, [router]);

  return (
    <main style={{ padding: 48, maxWidth: 480 }}>
      {status === "checking" && <p>Confirming your account…</p>}
      {status === "success" && <p>You're confirmed — taking you to your dashboard…</p>}
      {status === "error" && (
        <>
          <p>That link didn't work, or has expired.</p>
          <p>
            <a href="/login">Try logging in</a> or <a href="/signup">sign up again</a>.
          </p>
        </>
      )}
    </main>
  );
}
