// Shared types across the routing engine, adapters, and routes.

export interface UnifiedMessage {
  to: string;              // recipient phone number, E.164 format
  from: string;             // sender ID / short code label (platform-level, not provider-specific)
  body: string;
  accountId: string;
  senderId?: string;
  reference?: string;      // idempotency key / client reference, optional
}

export interface ProviderSendResult {
  success: boolean;
  providerMessageId?: string;   // provider's own ID, used later to match delivery reports
  rawResponse?: unknown;
  errorCode?: string;
  errorMessage?: string;
}

export type NormalizedStatus = "sent" | "delivered" | "failed" | "undelivered";

export interface NormalizedDeliveryReport {
  providerMessageId: string;
  normalizedStatus: NormalizedStatus;
  rawStatus: string;
  rawPayload: unknown;
}

// Every provider adapter must implement this. This is the contract the routing engine
// and the rest of the platform depend on — provider-specific quirks stay inside the adapter.
export interface ProviderAdapter {
  code: "twilio" | "infobip" | "africastalking" | "termii";
  displayName: string;

  /** Send a single message through this provider. Must not throw — return a failed result instead. */
  send(message: UnifiedMessage): Promise<ProviderSendResult>;

  /**
   * Optional: fetch this provider's current live cost per SMS, if they expose a pricing API.
   * Return null if unsupported or the call fails — the metrics job falls back to
   * providers.manual_cost_per_sms (or the last known cost) in that case.
   */
  getCost?(): Promise<number | null>;

  /**
   * Parse this provider's webhook payload (delivery report / status callback) into the
   * platform's normalized shape. Each provider has a different payload structure — see
   * comments in each adapter file for the raw shape being parsed.
   */
  parseDeliveryReport(payload: unknown): NormalizedDeliveryReport;
}

// A provider's current standing, as read from provider_metrics, used by the scorer.
export interface ProviderScoreInput {
  providerCode: string;
  costPerSms: number;
  deliveryRate: number;   // 0..1
  failureRate: number;    // 0..1
}

export interface ScoringWeights {
  price: number;
  deliveryRate: number;
  failureRate: number;
}
