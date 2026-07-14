import type { ProviderAdapter } from "../types/index.js";
import { twilioAdapter } from "./twilio.js";
import { infobipAdapter } from "./infobip.js";
import { africasTalkingAdapter } from "./africastalking.js";
import { termiiAdapter } from "./termii.js";

// Central registry — the routing engine picks an adapter from here by provider code.
// Adding a new provider means: write an adapter implementing ProviderAdapter, add it here,
// and add a row to the `providers` table in Supabase. Nothing else in the engine needs to change.
export const adapters: Record<string, ProviderAdapter> = {
  twilio: twilioAdapter,
  infobip: infobipAdapter,
  africastalking: africasTalkingAdapter,
  termii: termiiAdapter,
};

export function getAdapter(providerCode: string): ProviderAdapter {
  const adapter = adapters[providerCode];
  if (!adapter) {
    throw new Error(`No adapter registered for provider code "${providerCode}"`);
  }
  return adapter;
}
