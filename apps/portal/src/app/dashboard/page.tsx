"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

type MessageRow = {
  id: string;
  to_number: string;
  status: string;
  created_at: string;
};

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "delivered" ? "badge-success" : status === "failed" || status === "undelivered" ? "badge-danger" : "badge-neutral";
  return <span className={`badge ${variant}`}>{status}</span>;
}

export default function DashboardPage() {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("messages")
      .select("id, to_number, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!error && data) setMessages(data);
        setLoading(false);
      });
  }, []);

  const total = messages.length;
  const delivered = messages.filter((m) => m.status === "delivered").length;
  const failed = messages.filter((m) => m.status === "failed" || m.status === "undelivered").length;
  const deliveryRate = total > 0 ? ((delivered / total) * 100).toFixed(1) : "—";
  const failureRate = total > 0 ? ((failed / total) * 100).toFixed(1) : "—";

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Traffic</h1>
          <p className="page-subtitle">Recent activity across your account</p>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-label">Messages (last 100)</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Delivery rate</div>
          <div className="stat-value" style={{ color: "var(--accent-hover)" }}>
            {deliveryRate}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Failure rate</div>
          <div className="stat-value" style={{ color: failed > 0 ? "var(--danger)" : "inherit" }}>
            {failureRate}%
          </div>
        </div>
      </div>

      <div className="table-wrap">
        {loading && <div className="empty-state">Loading…</div>}
        {!loading && messages.length === 0 && (
          <div className="empty-state">No messages sent yet — try the Send page to send your first one.</div>
        )}
        {!loading && messages.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>To</th>
                <th>Status</th>
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
