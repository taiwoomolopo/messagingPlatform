"use client";

import { useState } from "react";
import { callEngine } from "@/lib/engineClient";

export default function SendPage() {
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      await callEngine("/v1/portal/messages", { method: "POST", body: JSON.stringify({ to, body }) });
      setStatus("Sent.");
      setTo("");
      setBody("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 48, maxWidth: 480 }}>
      <h1>Send a message</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Recipient (E.164, e.g. +2348012345678)</label>
          <br />
          <input value={to} onChange={(e) => setTo(e.target.value)} required style={{ width: "100%", padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Message</label>
          <br />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={1600}
            rows={4}
            style={{ width: "100%", padding: 8 }}
          />
        </div>
        {status && <p>{status}</p>}
        <button type="submit" disabled={loading} style={{ padding: "8px 16px" }}>
          {loading ? "Sending…" : "Send"}
        </button>
      </form>
    </main>
  );
}
