"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { callEngine } from "@/lib/engineClient";

type Sender = { id: string; label: string; status: string; created_at: string };

function StatusBadge({ status }: { status: string }) {
  const variant = status === "active" ? "badge-success" : status === "disabled" ? "badge-danger" : "badge-warning";
  return <span className={`badge ${variant}`}>{status}</span>;
}

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
    <>
      <div className="page-header">
        <div>
          <h1>Senders</h1>
          <p className="page-subtitle">Sender IDs registered on your account</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, maxWidth: 520 }}>
        <form onSubmit={handleCreate} style={{ display: "flex", gap: 8 }}>
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. MyBrand" required />
          <button type="submit" disabled={creating} className="btn btn-primary" style={{ flexShrink: 0 }}>
            <Plus size={15} />
            {creating ? "Requesting…" : "Request sender"}
          </button>
        </form>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="table-wrap">
        {loading && <div className="empty-state">Loading…</div>}
        {!loading && senders.length === 0 && <div className="empty-state">No senders yet — request one above.</div>}
        {!loading && senders.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Status</th>
                <th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {senders.map((s) => (
                <tr key={s.id}>
                  <td>{s.label}</td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="mono">{new Date(s.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
