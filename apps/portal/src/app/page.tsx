import { Brand } from "@/components/Brand";

export default function HomePage() {
  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="auth-brand" style={{ justifyContent: "center" }}>
          <Brand />
        </div>
        <p style={{ color: "var(--ink-muted)", fontSize: 14, marginBottom: 24 }}>
          Multi-provider SMS routing, with one dashboard for sending, reporting, and billing.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <a href="/login" className="btn btn-primary">
            Log in
          </a>
          <a href="/signup" className="btn btn-secondary">
            Sign up
          </a>
        </div>
        <p className="auth-footer-link">
          <a href="/admin">Admin</a>
        </p>
      </div>
    </div>
  );
}
