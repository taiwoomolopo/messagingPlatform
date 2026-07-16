"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

/**
 * Guards every /dashboard/* page: redirects to /login if there's no active session, rather
 * than silently showing empty tables (which is what RLS alone produces — technically safe,
 * but a confusing UX for someone who just isn't logged in). Also the one place a logout
 * control lives, since nothing in the portal previously offered a way to log out at all.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 48px",
          borderBottom: "1px solid #ddd",
        }}
      >
        <div style={{ display: "flex", gap: 16 }}>
          <Link href="/dashboard">Traffic</Link>
          <Link href="/dashboard/send">Send</Link>
          <Link href="/dashboard/blast">Blast</Link>
          <Link href="/dashboard/reports">Reports</Link>
          <Link href="/dashboard/senders">Senders</Link>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {email && <span style={{ color: "#666", fontSize: 14 }}>{email}</span>}
          <button onClick={handleLogout} style={{ padding: "6px 12px" }}>
            Log out
          </button>
        </div>
      </nav>
      {children}
    </div>
  );
}
