import type { ProviderAdapter, UnifiedMessage, ProviderSendResult, NormalizedDeliveryReport } from "../types/index.js";

/**
 * Infobip SMS API.
 * Docs: https://www.infobip.com/docs/api/channels/sms
 *
 * Auth: API Key (Bearer, header: "Authorization: App <api_key>").
 * Send: POST https://{base_url}/sms/3/messages
 *       JSON body: { messages: [{ sender, destinations: [{ to }], content: { body: { text } } }] }
 * Delivery reports: pushed to your notifyUrl, JSON payload with a `results` array containing
 *       messageId and status.groupName.
 */

const INFOBIP_BASE_URL = process.env.INFOBIP_BASE_URL ?? ""; // e.g. https://xxxxx.api.infobip.com
const INFOBIP_API_KEY = process.env.INFOBIP_API_KEY ?? "";

export const infobipAdapter: ProviderAdapter = {
  code: "infobip",
  displayName: "Infobip",

  // Infobip doesn't expose a public live pricing API — cost has to be entered manually
  // (providers.manual_cost_per_sms) whenever your negotiated rate changes.
  async getCost(): Promise<number | null> {
    return null;
  },

  async send(message: UnifiedMessage): Promise<ProviderSendResult> {
    const url = `${INFOBIP_BASE_URL}/sms/3/messages`;

    const body = {
      messages: [
        {
          sender: message.from,
          destinations: [{ to: message.to }],
          content: { body: { text: message.body, type: "TEXT" } },
        },
      ],
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `App ${INFOBIP_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        return {
          success: false,
          errorCode: json?.requestError?.serviceException?.messageId ?? String(res.status),
          errorMessage: json?.requestError?.serviceException?.text ?? "Infobip send failed",
          rawResponse: json,
        };
      }

      const result = json?.messages?.[0];
      return {
        success: true,
        providerMessageId: result?.messageId,
        rawResponse: json,
      };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : "Unknown Infobip error",
      };
    }
  },

  parseDeliveryReport(payload: unknown): NormalizedDeliveryReport {
    // Infobip notifyUrl payload shape: { results: [{ messageId, status: { groupName } }] }
    const p = payload as { results?: Array<{ messageId: string; status?: { groupName?: string } }> };
    const result = p.results?.[0];
    const groupName = result?.status?.groupName ?? "UNKNOWN";

    const statusMap: Record<string, NormalizedDeliveryReport["normalizedStatus"]> = {
      DELIVERED: "delivered",
      PENDING: "sent",
      UNDELIVERABLE: "undelivered",
      REJECTED: "failed",
      EXPIRED: "failed",
    };

    return {
      providerMessageId: result?.messageId ?? "",
      rawStatus: groupName,
      normalizedStatus: statusMap[groupName] ?? "failed",
      rawPayload: payload,
    };
  },
};
