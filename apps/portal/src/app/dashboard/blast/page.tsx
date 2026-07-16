"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
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
    <>
      <div className="page-header">
        <div>
          <h1>Send a blast</h1>
          <p className="page-subtitle">Sends to every recipient one at a time — large lists can take a while</p>
        </div>
      </div>

      <div className="card form-card">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Recipients — {recipientList.length} detected</label>
            <textarea
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              required
              rows={8}
              placeholder={"+2348012345678\n+2348098765432"}
            />
            <div className="field-hint">One per line, or comma-separated</div>
          </div>
          <div className="field">
            <label>Message</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} required maxLength={1600} rows={4} />
          </div>
          {error && <div className="alert alert-danger">{error}</div>}
          <button type="submit" disabled={loading || recipientList.length === 0} className="btn btn-primary">
            <Megaphone size={15} />
            {loading ? "Sending…" : `Send to ${recipientList.length} recipients`}
          </button>
        </form>
      </div>

      {result && (
        <div className="card" style={{ marginTop: 20, maxWidth: 480 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: result.sampleErrors.length > 0 ? 12 : 0 }}>
            <span className="badge badge-success">{result.succeeded} succeeded</span>
            {result.failed > 0 && <span className="badge badge-danger">{result.failed} failed</span>}
            <span className="badge badge-neutral">{result.total} total</span>
          </div>
          {result.sampleErrors.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "var(--ink-muted)" }}>
              {result.sampleErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
