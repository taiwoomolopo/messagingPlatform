"use client";

import { useEffect, useState } from "react";
import { callEngine } from "@/lib/engineClient";

type Account = {
  id: string;
  business_name: string;
  contact_email: string;
  status: string;
  agreed_rate_per_sms: number | null;
  created_at: string;
};

type UserRow = {
  user_id: string;
  role: string;
  created_at: string;
  accounts: { id: string; business_name: string; status: string } | null;
};

type Totals = { agreedTotal: number; actualTotal: number; marginTotal: number };

/**
 * Admin dashboard (Section 4 of the concept doc): approve/create accounts, see every user on
 * the platform, total traffic, and cost/margin broken down. Every request here goes through
 * adminAuth on the engine (Supabase session + platform_admins membership) — see
 * services/engine/src/middleware/adminAuth.ts. Getting into platform_admins itself isn't
 * self-service; add the first admin row directly in Supabase.
 */
export default function AdminPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [totalMessages, setTotalMessages] = useState<number | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});

  async function loadAll() {
    setError(null);
    try {
      const [accountsRes, usersRes, trafficRes, costRes] = await Promise.all([
        callEngine("/v1/admin/accounts"),
        callEngine("/v1/admin/users"),
        callEngine("/v1/admin/traffic"),
        callEngine("/v1/admin/cost-breakdown"),
      ]);
      setAccounts((await accountsRes.json()).accounts);
      setUsers((await usersRes.json()).users);
      setTotalMessages((await trafficRes.json()).totalMessages);
      setTotals((await costRes.json()).totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function approve(accountId: string) {
    const rate = Number(rateInputs[accountId]);
    if (!rate || rate <= 0) {
      setError("Enter a valid agreed rate before approving.");
      return;
    }
    try {
      await callEngine(`/v1/admin/accounts/${accountId}/approve`, {
        method: "POST",
        body: JSON.stringify({ agreedRatePerSms: rate }),
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    }
  }

  const pending = accounts.filter((a) => a.status === "pending_approval");
  const active = accounts.filter((a) => a.status === "active");

  return (
    <main style={{ padding: 48 }}>
      <h1>Admin</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <section style={{ marginBottom: 32 }}>
        <h2>Pending sign-ups ({pending.length})</h2>
        {pending.length === 0 && <p>Nothing pending.</p>}
        {pending.map((a) => (
          <div key={a.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <strong>{a.business_name}</strong> — {a.contact_email}
            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
              <input
                placeholder="Agreed rate per SMS (₦)"
                value={rateInputs[a.id] ?? ""}
                onChange={(e) => setRateInputs({ ...rateInputs, [a.id]: e.target.value })}
                style={{ padding: 6 }}
              />
              <button onClick={() => approve(a.id)} style={{ padding: "6px 12px" }}>
                Approve
              </button>
            </div>
          </div>
        ))}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Active accounts ({active.length})</h2>
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
              <th>Business</th>
              <th>Email</th>
              <th>Agreed rate</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            {active.map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{a.business_name}</td>
                <td>{a.contact_email}</td>
                <td>₦{a.agreed_rate_per_sms}</td>
                <td>{new Date(a.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Users on the platform ({users.length})</h2>
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
              <th>Account</th>
              <th>Role</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{u.accounts?.business_name ?? "—"}</td>
                <td>{u.role}</td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Traffic & cost</h2>
        <div style={{ display: "flex", gap: 32 }}>
          <Stat label="Total messages sent" value={totalMessages !== null ? String(totalMessages) : "—"} />
          <Stat label="Billed to customers" value={totals ? `₦${totals.agreedTotal.toFixed(2)}` : "—"} />
          <Stat label="Actual provider cost" value={totals ? `₦${totals.actualTotal.toFixed(2)}` : "—"} />
          <Stat label="Margin" value={totals ? `₦${totals.marginTotal.toFixed(2)}` : "—"} />
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, minWidth: 160 }}>
      <div style={{ fontSize: 13, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: "bold" }}>{value}</div>
    </div>
  );
}
