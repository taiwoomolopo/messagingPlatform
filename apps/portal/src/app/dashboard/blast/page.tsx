"use client";

import { useState } from "react";
import { callEngine } from "@/lib/engineClient";

type BlastResult = { total: number; succeeded: number; failed: number; sampleErrors: string[] };

export default function BlastPage() {
  const [recipients, setRecipients] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<BlastResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const recipientList = recipients
    .split(/[\n,]/)
    .map((r) => r.trim())
    .filter(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await callEngine("/v1/portal/messages/blast", {
        method: "POST",
        body: JSON.stringify({ recipients: recipientList, body }),
      });
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Blast failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 48, maxWidth: 560 }}>
      <h1>Send a blast</h1>
      <p style={{ color: "#666" }}>
        This dispatches one at a time and can take a while for large lists — see the note in
        services/engine/src/routes/portal.ts about moving this to a background job before real
        production volume.
      </p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Recipients (one per line, or comma-separated) — {recipientList.length} detected</label>
          <br />
          <textarea
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            required
            rows={8}
            placeholder={"+2348012345678\n+2348098765432"}
            style={{ width: "100%", padding: 8 }}
          />
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
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={loading || recipientList.length === 0} style={{ padding: "8px 16px" }}>
          {loading ? "Sending…" : `Send to ${recipientList.length} recipients`}
        </button>
      </form>

      {result && (
        <div style={{ marginTop: 24, border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <p>
            {result.succeeded} succeeded, {result.failed} failed, out of {result.total}.
          </p>
          {result.sampleErrors.length > 0 && (
            <ul>
              {result.sampleErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
