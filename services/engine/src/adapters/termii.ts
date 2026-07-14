import type { ProviderAdapter, UnifiedMessage, ProviderSendResult, NormalizedDeliveryReport } from "../types/index.js";

/**
 * Termii SMS API (Nigeria/Africa-focused).
 * Docs: https://developers.termii.com/messaging-api
 *
 * Auth: API key in the request body (not a header).
 * Send: POST https://api.ng.termii.com/api/sms/send
 *       JSON body: { api_key, to, from, sms, type: "plain", channel: "dnd" | "generic" }
 * Delivery reports: pushed to a webhook you configure, JSON payload.
 *
 * Note: Termii distinguishes "generic" (non-DND, cheaper, blocked 8pm-8am on MTN) vs. "dnd"
 * (transactional, reaches DND numbers, no time restriction). Defaulting to "dnd" here since
 * this platform can't assume every message is a low-priority marketing blast — the routing
 * engine or account settings should be able to override this per-message later.
 */

const TERMII_API_KEY = process.env.TERMII_API_KEY ?? "";
const TERMII_BASE_URL = process.env.TERMII_BASE_URL ?? "https://api.ng.termii.com";

export const termiiAdapter: ProviderAdapter = {
  code: "termii",
  displayName: "Termii",

  // No public live pricing API — cost is entered manually (providers.manual_cost_per_sms).
  async getCost(): Promise<number | null> {
    return null;
  },

  async send(message: UnifiedMessage): Promise<ProviderSendResult> {
    const url = `${TERMII_BASE_URL}/api/sms/send`;

    const body = {
      api_key: TERMII_API_KEY,
      to: message.to,
      from: message.from,
      sms: message.body,
      type: "plain",
      channel: "dnd",
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok || json?.code !== "ok") {
        return {
          success: false,
          errorCode: json?.code ?? String(res.status),
          errorMessage: json?.message ?? "Termii send failed",
          rawResponse: json,
        };
      }

      return {
        success: true,
        providerMessageId: json.message_id ?? json.message_id_str,
        rawResponse: json,
      };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : "Unknown Termii error",
      };
    }
  },

  parseDeliveryReport(payload: unknown): NormalizedDeliveryReport {
    // Termii webhook payload shape (approximate — confirm against sandbox before going live):
    // { message_id, status }
    const p = payload as { message_id?: string; status?: string };
    const statusMap: Record<string, NormalizedDeliveryReport["normalizedStatus"]> = {
      DELIVERED: "delivered",
      SENT: "sent",
      EXPIRED: "failed",
      REJECTED: "undelivered",
      FAILED: "failed",
    };

    return {
      providerMessageId: p.message_id ?? "",
      rawStatus: p.status ?? "UNKNOWN",
      normalizedStatus: statusMap[(p.status ?? "").toUpperCase()] ?? "failed",
      rawPayload: payload,
    };
  },
};
