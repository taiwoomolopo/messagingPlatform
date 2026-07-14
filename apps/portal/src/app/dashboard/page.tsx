"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

type MessageRow = {
  id: string;
  to_number: string;
  status: string;
  created_at: string;
};

/**
 * Traffic overview: recent messages plus summary stats (total sent, delivery rate, failure
 * rate), all computed from data the RLS policies already scope to the logged-in account.
 * Deliberately doesn't select provider_id — customers don't see which provider handled a
 * message (Section 2.5 of the concept doc).
 */
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
    <main style={{ padding: 48 }}>
      <h1>Traffic</h1>

      <div style={{ display: "flex", gap: 32, marginBottom: 32 }}>
        <Stat label="Messages (last 100)" value={String(total)} />
        <Stat label="Delivery rate" value={`${deliveryRate}%`} />
        <Stat label="Failure rate" value={`${failureRate}%`} />
      </div>

      {loading && <p>Loading…</p>}
      {!loading && messages.length === 0 && <p>No messages sent yet.</p>}
      {!loading && messages.length > 0 && (
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
              <th>To</th>
              <th>Status</th>
              <th>Sent at</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{m.to_number}</td>
                <td>{m.status}</td>
                <td>{new Date(m.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, minWidth: 160 }}>
      <div style={{ fontSize: 13, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: "bold" }}>{value}</div>
    </div>
  );
}
