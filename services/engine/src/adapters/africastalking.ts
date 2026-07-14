import type { ProviderAdapter, UnifiedMessage, ProviderSendResult, NormalizedDeliveryReport } from "../types/index.js";

/**
 * Africa's Talking SMS API.
 * Docs: https://developers.africastalking.com/docs/sms/overview
 *
 * Auth: apiKey header + username, form-encoded body.
 * Send: POST https://api.africastalking.com/version1/messaging
 *       form-encoded: username, to, message, from, bulkSMSMode=1
 * Delivery reports: pushed to a callback URL you configure in the dashboard, form-encoded,
 *       with fields id, status, phoneNumber.
 */

const AT_USERNAME = process.env.AFRICASTALKING_USERNAME ?? "";
const AT_API_KEY = process.env.AFRICASTALKING_API_KEY ?? "";
const AT_BASE_URL = process.env.AFRICASTALKING_BASE_URL ?? "https://api.africastalking.com";

export const africasTalkingAdapter: ProviderAdapter = {
  code: "africastalking",
  displayName: "Africa's Talking",

  // No public live pricing API — cost is entered manually (providers.manual_cost_per_sms)
  // and updated whenever Africa's Talking changes rates.
  async getCost(): Promise<number | null> {
    return null;
  },

  async send(message: UnifiedMessage): Promise<ProviderSendResult> {
    const url = `${AT_BASE_URL}/version1/messaging`;

    const body = new URLSearchParams({
      username: AT_USERNAME,
      to: message.to,
      message: message.body,
      from: message.from,
      bulkSMSMode: "1",
    });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          apiKey: AT_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
      });
      const json = await res.json();

      const recipient = json?.SMSMessageData?.Recipients?.[0];

      if (!res.ok || !recipient || recipient.status !== "Success") {
        return {
          success: false,
          errorCode: recipient?.statusCode ? String(recipient.statusCode) : String(res.status),
          errorMessage: recipient?.status ?? "Africa's Talking send failed",
          rawResponse: json,
        };
      }

      return {
        success: true,
        providerMessageId: recipient.messageId,
        rawResponse: json,
      };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : "Unknown Africa's Talking error",
      };
    }
  },

  parseDeliveryReport(payload: unknown): NormalizedDeliveryReport {
    // Callback payload shape (form-encoded, parsed to object by the time it reaches here):
    // { id, status, phoneNumber, networkCode, failureReason }
    const p = payload as { id?: string; status?: string };
    const statusMap: Record<string, NormalizedDeliveryReport["normalizedStatus"]> = {
      Success: "delivered",
      Sent: "sent",
      Buffered: "sent",
      Failed: "failed",
      Rejected: "undelivered",
    };

    return {
      providerMessageId: p.id ?? "",
      rawStatus: p.status ?? "UNKNOWN",
      normalizedStatus: statusMap[p.status ?? ""] ?? "failed",
      rawPayload: payload,
    };
  },
};
