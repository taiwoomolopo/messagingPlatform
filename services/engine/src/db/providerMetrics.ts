import { supabase } from "./supabaseClient.js";
import type { ProviderScoreInput } from "../types/index.js";

/**
 * Returns the latest metrics row for every active provider, shaped for the scorer.
 *
 * This currently reads whatever was last written to provider_metrics. Populating that table
 * with live data (polling provider pricing APIs, computing rolling delivery/failure rates from
 * delivery_reports) is a separate background job — not built yet, tracked as the next real
 * piece of routing-engine work.
 */
export async function getLatestProviderMetrics(): Promise<ProviderScoreInput[]> {
  const { data: providers, error: providersError } = await supabase
    .from("providers")
    .select("id, code")
    .eq("is_active", true);

  if (providersError) throw providersError;
  if (!providers || providers.length === 0) return [];

  const results: ProviderScoreInput[] = [];

  for (const provider of providers) {
    const { data: metric, error } = await supabase
      .from("provider_metrics")
      .select("cost_per_sms, delivery_rate, failure_rate")
      .eq("provider_id", provider.id)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!metric) continue; // no metrics yet for this provider — skip it from routing until it has data

    results.push({
      providerCode: provider.code,
      costPerSms: Number(metric.cost_per_sms),
      deliveryRate: Number(metric.delivery_rate ?? 0),
      failureRate: Number(metric.failure_rate ?? 0),
    });
  }

  return results;
}
