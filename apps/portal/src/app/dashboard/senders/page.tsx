"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { callEngine } from "@/lib/engineClient";

type Sender = { id: string; label: string; status: string; created_at: string };

/**
 * Lists this account's registered senders (read directly from Supabase — RLS-scoped) and lets
 * the user request a new one (goes through the engine, since there's deliberately no insert
 * policy for senders from the client — see supabase/migrations/0001_init.sql).
 */
export default function SendersPage() {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSenders() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("senders")
      .select("id, label, status, created_at")
      .order("created_at", { ascending: false });
    if (!error && data) setSenders(data);
    setLoading(false);
  }

  useEffect(() => {
    loadSenders();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await callEngine("/v1/portal/senders", { method: "POST", body: JSON.stringify({ label: newLabel }) });
      setNewLabel("");
      await loadSenders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create sender");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main style={{ padding: 48, maxWidth: 560 }}>
      <h1>Senders</h1>

      <form onSubmit={handleCreate} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="e.g. MyBrand"
          required
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" disabled={creating} style={{ padding: "8px 16px" }}>
          {creating ? "Requesting…" : "Request new sender"}
        </button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {loading && <p>Loading…</p>}
      {!loading && senders.length === 0 && <p>No senders yet.</p>}
      {!loading && senders.length > 0 && (
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
              <th>Label</th>
              <th>Status</th>
              <th>Requested</th>
            </tr>
          </thead>
          <tbody>
            {senders.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{s.label}</td>
                <td>{s.status}</td>
                <td>{new Date(s.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
