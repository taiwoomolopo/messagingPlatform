"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { Brand } from "@/components/Brand";

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
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <Brand />
        </div>
        {status === "checking" && <p style={{ color: "var(--ink-muted)", fontSize: 14 }}>Confirming your account…</p>}
        {status === "success" && (
          <p style={{ color: "var(--ink-muted)", fontSize: 14 }}>You're confirmed — taking you to your dashboard…</p>
        )}
        {status === "error" && (
          <>
            <p style={{ fontSize: 14, marginBottom: 12 }}>That link didn't work, or has expired.</p>
            <p className="auth-footer-link" style={{ marginTop: 0 }}>
              <a href="/login">Try logging in</a> or <a href="/signup">sign up again</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
