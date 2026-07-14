import { supabase } from "../db/supabaseClient.js";
import { getAdapter } from "../adapters/index.js";

// How many of each provider's most recent messages to look at when computing delivery/failure
// rate. A count-based window (rather than a fixed time window) keeps this meaningful for both
// high- and low-volume providers.
const ROLLING_WINDOW_SIZE = Number(process.env.METRICS_ROLLING_WINDOW_SIZE ?? 200);

// Below this many *terminal* messages (delivered/failed/undelivered), there isn't enough
// signal yet — fall back to the previous rates rather than scoring on a handful of messages.
const MIN_TERMINAL_MESSAGES = Number(process.env.METRICS_MIN_TERMINAL_MESSAGES ?? 20);

interface RefreshResult {
  providerCode: string;
  costPerSms: number | null;
  deliveryRate: number | null;
  failureRate: number | null;
  sampledMessages: number;
  skipped: boolean;
  reason?: string;
}

/**
 * Recomputes and writes a fresh provider_metrics row for every active provider.
 * Safe to run repeatedly on an interval (see the scheduler in index.ts) or once via
 * `npm run job:metrics`.
 */
export async function refreshProviderMetrics(): Promise<RefreshResult[]> {
  const { data: providers, error } = await supabase
    .from("providers")
    .select("id, code, manual_cost_per_sms")
    .eq("is_active", true);

  if (error) throw error;
  if (!providers || providers.length === 0) return [];

  const results: RefreshResult[] = [];

  for (const provider of providers) {
    const result = await refreshOneProvider(provider);
    results.push(result);
  }

  return results;
}

async function refreshOneProvider(provider: {
  id: string;
  code: string;
  manual_cost_per_sms: number | null;
}): Promise<RefreshResult> {
  // 1. Cost: try the adapter's live pricing lookup first, fall back to the manual override,
  //    then fall back to the last stored value so a transient API failure doesn't zero it out.
  let costPerSms: number | null = null;
  try {
    const adapter = getAdapter(provider.code);
    costPerSms = (await adapter.getCost?.()) ?? null;
  } catch (err) {
    console.warn(`[metrics] getCost failed for ${provider.code}:`, err);
  }

  if (costPerSms === null) costPerSms = provider.manual_cost_per_sms;

  if (costPerSms === null) {
    const { data: lastMetric } = await supabase
      .from("provider_metrics")
      .select("cost_per_sms")
      .eq("provider_id", provider.id)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    costPerSms = lastMetric ? Number(lastMetric.cost_per_sms) : null;
  }

  if (costPerSms === null) {
    return {
      providerCode: provider.code,
      costPerSms: null,
      deliveryRate: null,
      failureRate: null,
      sampledMessages: 0,
      skipped: true,
      reason: "no cost data available (set providers.manual_cost_per_sms to unblock)",
    };
  }

  // 2. Delivery/failure rate: look at this provider's most recent messages that have reached
  //    a terminal state, and compute rates from there.
  const { data: recentMessages, error: messagesError } = await supabase
    .from("messages")
    .select("status")
    .eq("provider_id", provider.id)
    .in("status", ["delivered", "failed", "undelivered"])
    .order("created_at", { ascending: false })
    .limit(ROLLING_WINDOW_SIZE);

  if (messagesError) throw messagesError;

  const sampledMessages = recentMessages?.length ?? 0;

  let deliveryRate: number | null = null;
  let failureRate: number | null = null;

  if (sampledMessages >= MIN_TERMINAL_MESSAGES) {
    const delivered = recentMessages!.filter((m) => m.status === "delivered").length;
    const failedOrUndelivered = recentMessages!.filter(
      (m) => m.status === "failed" || m.status === "undelivered"
    ).length;

    deliveryRate = delivered / sampledMessages;
    failureRate = failedOrUndelivered / sampledMessages;
  } else {
    // Not enough data yet — carry forward the last known rates rather than writing a
    // misleadingly confident 0% or 100% from a tiny sample.
    const { data: lastMetric } = await supabase
      .from("provider_metrics")
      .select("delivery_rate, failure_rate")
      .eq("provider_id", provider.id)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    deliveryRate = lastMetric ? Number(lastMetric.delivery_rate) : null;
    failureRate = lastMetric ? Number(lastMetric.failure_rate) : null;
  }

  await supabase.from("provider_metrics").insert({
    provider_id: provider.id,
    cost_per_sms: costPerSms,
    delivery_rate: deliveryRate,
    failure_rate: failureRate,
  });

  return {
    providerCode: provider.code,
    costPerSms,
    deliveryRate,
    failureRate,
    sampledMessages,
    skipped: false,
  };
}

// Allows `npm run job:metrics` to run this once from the command line, separate from the
// interval-based scheduler wired into index.ts.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: dotenv } = await import("dotenv");
  dotenv.config();
  refreshProviderMetrics()
    .then((results) => {
      console.log(JSON.stringify(results, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error("Metrics refresh failed:", err);
      process.exit(1);
    });
}
