"use client";

import { useState } from "react";
import { Send as SendIcon } from "lucide-react";
import { callEngine } from "@/lib/engineClient";

export default function SendPage() {
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      await callEngine("/v1/portal/messages", { method: "POST", body: JSON.stringify({ to, body }) });
      setStatus({ type: "success", text: "Message sent." });
      setTo("");
      setBody("");
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Failed to send" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Send a message</h1>
          <p className="page-subtitle">Goes through the same routing engine as the API</p>
        </div>
      </div>

      <div className="card form-card">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Recipient</label>
            <input value={to} onChange={(e) => setTo(e.target.value)} required placeholder="+2348012345678" />
            <div className="field-hint">E.164 format, including country code</div>
          </div>
          <div className="field">
            <label>Message</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} required maxLength={1600} rows={4} />
          </div>
          {status && <div className={`alert ${status.type === "error" ? "alert-danger" : "alert-info"}`}>{status.text}</div>}
          <button type="submit" disabled={loading} className="btn btn-primary">
            <SendIcon size={15} />
            {loading ? "Sending…" : "Send"}
          </button>
        </form>
      </div>
    </>
  );
}
