"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { Brand } from "@/components/Brand";

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_API_URL ?? "http://localhost:4000";

export default function SignupPage() {
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (signUpError || !data.user) {
      setLoading(false);
      setError(signUpError?.message ?? "Sign up failed");
      return;
    }

    const res = await fetch(`${ENGINE_URL}/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName, contactEmail: email, userId: data.user.id }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to create account");
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">
            <Brand />
          </div>
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>Almost there</h1>
          <p style={{ color: "var(--ink-muted)", fontSize: 14, lineHeight: 1.6 }}>
            Check your email to confirm your address. Once that's done and your account is
            approved, you'll be able to log in and start sending.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <Brand />
        </div>
        <h1 style={{ fontSize: 20, marginBottom: 20 }}>Create your account</h1>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Business name</label>
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <div className="alert alert-danger">{error}</div>}
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
            {loading ? "Creating…" : "Sign up"}
          </button>
        </form>
        <p className="auth-footer-link">
          Already have an account? <a href="/login">Log in</a>
        </p>
      </div>
    </div>
  );
}
