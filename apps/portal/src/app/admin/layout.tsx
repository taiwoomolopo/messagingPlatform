"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { LogOut } from "lucide-react";
import { Brand } from "@/components/Brand";

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
      <div style={{ padding: 44 }}>
        <p style={{ color: "var(--ink-muted)" }}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 44px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink)" }}>
          <Brand size={18} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: "var(--accent-ink)",
              background: "#e4f7f1",
              padding: "2px 8px",
              borderRadius: 999,
              textTransform: "uppercase",
            }}
          >
            Admin
          </span>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {email && <span style={{ color: "var(--ink-muted)", fontSize: 13.5 }}>{email}</span>}
          <button onClick={handleLogout} className="btn btn-ghost">
            <LogOut size={15} />
            Log out
          </button>
        </div>
      </nav>
      <div style={{ padding: "36px 44px" }}>{children}</div>
    </div>
  );
}
