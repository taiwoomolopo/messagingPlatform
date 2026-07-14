"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabaseClient";

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
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError || !data.user) {
      setLoading(false);
      setError(signUpError?.message ?? "Sign up failed");
      return;
    }

    // Create the pending account + link it to this new user (see routes/signup.ts on the engine).
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
      <main style={{ padding: 48, maxWidth: 480 }}>
        <h1>Almost there</h1>
        <p>
          Your account has been created and is pending approval. Once approved (and your
          pricing is set), you'll be able to log in and start sending.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 48, maxWidth: 400 }}>
      <h1>Create your account</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Business name</label>
          <br />
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Email</label>
          <br />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ width: "100%", padding: 8 }}
          />
        </div>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: "8px 16px" }}>
          {loading ? "Creating…" : "Sign up"}
        </button>
      </form>
    </main>
  );
}
