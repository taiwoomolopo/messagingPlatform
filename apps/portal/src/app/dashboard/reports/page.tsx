"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { callEngine } from "@/lib/engineClient";

type MessageRow = {
  id: string;
  to_number: string;
  status: string;
  source: string;
  created_at: string;
};

/**
 * Historical message data + export. The table reads directly from Supabase (RLS-scoped, so
 * only this account's rows come back). Export goes through the engine so CSV formatting stays
 * server-side rather than pulling in a client-side CSV library for one button.
 */
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
    <main style={{ padding: 48 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Reports</h1>
        <button onClick={handleExport} disabled={exporting} style={{ padding: "8px 16px" }}>
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {loading && <p>Loading…</p>}
      {!loading && messages.length === 0 && <p>No messages sent yet.</p>}
      {!loading && messages.length > 0 && (
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
              <th>To</th>
              <th>Status</th>
              <th>Source</th>
              <th>Sent at</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{m.to_number}</td>
                <td>{m.status}</td>
                <td>{m.source}</td>
                <td>{new Date(m.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
