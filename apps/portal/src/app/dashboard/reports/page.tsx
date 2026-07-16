"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { callEngine } from "@/lib/engineClient";

type MessageRow = {
  id: string;
  to_number: string;
  status: string;
  source: string;
  created_at: string;
};

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "delivered" ? "badge-success" : status === "failed" || status === "undelivered" ? "badge-danger" : "badge-neutral";
  return <span className={`badge ${variant}`}>{status}</span>;
}

export default function ReportsPage() {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("messages")
      .select("id, to_number, status, source, created_at")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!error && data) setMessages(data);
        setLoading(false);
      });
  }, []);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const res = await callEngine("/v1/portal/messages/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "messages.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p className="page-subtitle">Historical message data for your account</p>
        </div>
        <button onClick={handleExport} disabled={exporting} className="btn btn-secondary">
          <Download size={15} />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="table-wrap">
        {loading && <div className="empty-state">Loading…</div>}
        {!loading && messages.length === 0 && <div className="empty-state">No messages sent yet.</div>}
        {!loading && messages.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>To</th>
                <th>Status</th>
                <th>Source</th>
                <th>Sent at</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td className="mono">{m.to_number}</td>
                  <td>
                    <StatusBadge status={m.status} />
                  </td>
                  <td>{m.source}</td>
                  <td className="mono">{new Date(m.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
