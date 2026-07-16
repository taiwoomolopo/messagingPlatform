"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

/**
 * Same reasoning as dashboard/layout.tsx — redirect if there's no session at all, rather than
 * showing a page that just fails every fetch silently. Note this only checks for a logged-in
 * session, not admin status specifically — a non-admin who's logged in will still hit real
 * 403s from the engine's adminAuth middleware when the page's fetches run. That's an
 * acceptable gap for now (the API is still correctly locked down), but a nicer "you're not an
 * admin" message here is a reasonable follow-up.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/login");
        return;
      }
      setEmail(data.session.user.email ?? null);
      setChecked(true);
    });
  }, [router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!checked) {
    return (
      <main style={{ padding: 48 }}>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <div>
      <nav
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 12,
          padding: "16px 48px",
          borderBottom: "1px solid #ddd",
        }}
      >
        {email && <span style={{ color: "#666", fontSize: 14 }}>{email}</span>}
        <button onClick={handleLogout} style={{ padding: "6px 12px" }}>
          Log out
        </button>
      </nav>
      {children}
    </div>
  );
}
