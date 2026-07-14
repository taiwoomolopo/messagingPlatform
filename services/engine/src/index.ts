import "dotenv/config";
import express from "express";
import { messagesRouter } from "./routes/messages.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { portalRouter } from "./routes/portal.js";
import { adminRouter } from "./routes/admin.js";
import { signupRouter } from "./routes/signup.js";
import { apiKeyAuth } from "./middleware/auth.js";
import { portalAuth } from "./middleware/portalAuth.js";
import { adminAuth } from "./middleware/adminAuth.js";
import { refreshProviderMetrics } from "./jobs/refreshProviderMetrics.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Twilio posts form-encoded

app.get("/health", (_req, res) => res.json({ ok: true }));

// Public — no auth. Creates a pending account right after Supabase Auth signup.
app.use(signupRouter);

// Each auth middleware is scoped to its own path prefix — mounted separately from its router
// so it doesn't intercept requests to other route groups (e.g. apiKeyAuth must not block
// /v1/portal/* or /webhooks/* requests).
app.use("/v1/messages", apiKeyAuth);
app.use("/v1/portal", portalAuth);
app.use("/v1/admin", adminAuth);

app.use(messagesRouter);
app.use(portalRouter);
app.use(adminRouter);
app.use(webhooksRouter);

app.post("/internal/refresh-metrics", async (req, res) => {
  if (req.header("x-internal-secret") !== process.env.INTERNAL_ADMIN_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const results = await refreshProviderMetrics();
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "unknown error" });
  }
});

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => {
  console.log(`Engine service listening on port ${PORT}`);
});

/**
 * On a serverless/free-tier host (e.g. Railway's free plan), the process sleeps between
 * requests — a setInterval here would silently stop firing once that happens. Metrics refresh
 * is instead triggered externally on a schedule by default (see
 * .github/workflows/refresh-metrics.yml), which hits POST /internal/refresh-metrics and works
 * the same whether the service is always-on or serverless.
 *
 * If you're on an always-on plan and would rather not depend on GitHub Actions, set
 * ENABLE_INTERNAL_SCHEDULER=true to fall back to the in-process timer instead.
 */
async function runScheduledRefresh() {
  try {
    const results = await refreshProviderMetrics();
    const skipped = results.filter((r) => r.skipped);
    if (skipped.length > 0) {
      console.warn("[metrics] skipped providers with no cost data:", skipped.map((r) => r.providerCode));
    }
  } catch (err) {
    console.error("[metrics] scheduled refresh failed:", err);
  }
}

// Always run once on boot, regardless of scheduler mode — cheap, and means a fresh deploy
// doesn't start with completely empty provider_metrics.
runScheduledRefresh();

if (process.env.ENABLE_INTERNAL_SCHEDULER === "true") {
  const REFRESH_INTERVAL_MS = Number(process.env.METRICS_REFRESH_INTERVAL_MS ?? 5 * 60 * 1000);
  setInterval(runScheduledRefresh, REFRESH_INTERVAL_MS);
  console.log(`[metrics] internal scheduler enabled, refreshing every ${REFRESH_INTERVAL_MS}ms`);
} else {
  console.log("[metrics] internal scheduler disabled — relying on external cron hitting /internal/refresh-metrics");
}
