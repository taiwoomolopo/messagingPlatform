"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
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
    <>
      <div className="page-header">
        <div>
          <h1>Admin</h1>
          <p className="page-subtitle">Accounts, users, and platform-wide traffic</p>
        </div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-label">Total messages sent</div>
          <div className="stat-value">{totalMessages !== null ? totalMessages : "—"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Billed to customers</div>
          <div className="stat-value">{totals ? `₦${totals.agreedTotal.toFixed(2)}` : "—"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Actual provider cost</div>
          <div className="stat-value">{totals ? `₦${totals.actualTotal.toFixed(2)}` : "—"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Margin</div>
          <div className="stat-value" style={{ color: "var(--accent-hover)" }}>
            {totals ? `₦${totals.marginTotal.toFixed(2)}` : "—"}
          </div>
        </div>
      </div>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Pending sign-ups ({pending.length})</h2>
        {pending.length === 0 && (
          <div className="table-wrap">
            <div className="empty-state">Nothing pending.</div>
          </div>
        )}
        {pending.map((a) => (
          <div key={a.id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <strong>{a.business_name}</strong>
                <div style={{ color: "var(--ink-muted)", fontSize: 13.5 }}>{a.contact_email}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  placeholder="Agreed rate (₦)"
                  value={rateInputs[a.id] ?? ""}
                  onChange={(e) => setRateInputs({ ...rateInputs, [a.id]: e.target.value })}
                  style={{ width: 140 }}
                />
                <button onClick={() => approve(a.id)} className="btn btn-primary">
                  <Check size={15} />
                  Approve
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Active accounts ({active.length})</h2>
        <div className="table-wrap">
          {active.length === 0 && <div className="empty-state">No active accounts yet.</div>}
          {active.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Email</th>
                  <th>Agreed rate</th>
                  <th>Since</th>
                </tr>
              </thead>
              <tbody>
                {active.map((a) => (
                  <tr key={a.id}>
                    <td>{a.business_name}</td>
                    <td>{a.contact_email}</td>
                    <td className="mono">₦{a.agreed_rate_per_sms}</td>
                    <td className="mono">{new Date(a.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Users on the platform ({users.length})</h2>
        <div className="table-wrap">
          {users.length === 0 && <div className="empty-state">No users yet.</div>}
          {users.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Role</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id}>
                    <td>{u.accounts?.business_name ?? "—"}</td>
                    <td>
                      <span className="badge badge-neutral">{u.role}</span>
                    </td>
                    <td className="mono">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
