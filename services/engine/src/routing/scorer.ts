import type { ProviderScoreInput, ScoringWeights } from "../types/index.js";

// Default weights — tune these based on real-world results. Price and delivery rate matter
// most; failure rate is a sharper signal than delivery rate for catching a provider having a
// bad day right now.
export const DEFAULT_WEIGHTS: ScoringWeights = {
  price: 0.4,
  deliveryRate: 0.4,
  failureRate: 0.2,
};

/**
 * Scores a set of providers and returns them ranked best-first.
 *
 * Approach: normalize each metric to a 0..1 "goodness" score (cheaper = better, higher
 * delivery rate = better, lower failure rate = better), then combine with weights.
 * This is intentionally simple to start — swap in something more sophisticated
 * (e.g. exponential smoothing, per-country scoring) once there's real data to tune against.
 */
export function scoreProviders(
  candidates: ProviderScoreInput[],
  weights: ScoringWeights = DEFAULT_WEIGHTS
): Array<ProviderScoreInput & { score: number }> {
  if (candidates.length === 0) return [];

  const maxCost = Math.max(...candidates.map((c) => c.costPerSms));
  const minCost = Math.min(...candidates.map((c) => c.costPerSms));
  const costRange = maxCost - minCost || 1; // avoid divide-by-zero when all costs are equal

  const scored = candidates.map((c) => {
    // Cheaper = closer to 1. If all costs are equal, everyone gets a neutral 1.
    const priceScore = maxCost === minCost ? 1 : (maxCost - c.costPerSms) / costRange;
    const deliveryScore = c.deliveryRate;         // already 0..1, higher is better
    const failureScore = 1 - c.failureRate;       // invert so higher is better

    const score =
      weights.price * priceScore +
      weights.deliveryRate * deliveryScore +
      weights.failureRate * failureScore;

    return { ...c, score };
  });

  return scored.sort((a, b) => b.score - a.score);
}

/** Picks the single best provider for a message. Throws if no candidates are given. */
export function pickBestProvider(
  candidates: ProviderScoreInput[],
  weights?: ScoringWeights
): ProviderScoreInput & { score: number } {
  const ranked = scoreProviders(candidates, weights);
  if (ranked.length === 0) {
    throw new Error("No active providers available to route this message");
  }
  return ranked[0];
}
