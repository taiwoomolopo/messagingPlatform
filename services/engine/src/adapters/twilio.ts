import type { ProviderAdapter, UnifiedMessage, ProviderSendResult, NormalizedDeliveryReport } from "../types/index.js";

/**
 * Twilio Programmable Messaging API.
 * Docs: https://www.twilio.com/docs/messaging/api/message-resource
 *
 * Auth: HTTP Basic (Account SID as username, Auth Token as password).
 * Send: POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
 *       form-encoded body: To, From, Body
 * Delivery reports: arrive at the StatusCallback URL you configure, form-encoded,
 *       with fields MessageSid, MessageStatus, ErrorCode.
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
// ISO country code to price against — defaults to Nigeria since that's the initial target
// market. Twilio prices outbound SMS per destination country, so this should eventually be
// looked up per-message rather than fixed, once routing needs to compare cost by destination.
const TWILIO_PRICING_COUNTRY = process.env.TWILIO_PRICING_COUNTRY ?? "NG";

export const twilioAdapter: ProviderAdapter = {
  code: "twilio",
  displayName: "Twilio",

  /**
   * Twilio Pricing API: https://www.twilio.com/docs/messaging/api/pricing
   * GET https://pricing.twilio.com/v1/Messaging/Countries/{isoCountry}
   * Returns outbound_sms_prices[].prices[].current_price for that country.
   * Returns null (rather than throwing) on any failure — the metrics job falls back to
   * providers.manual_cost_per_sms when this happens.
   */
  async getCost(): Promise<number | null> {
    const url = `https://pricing.twilio.com/v1/Messaging/Countries/${TWILIO_PRICING_COUNTRY}`;
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

    try {
      const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
      if (!res.ok) return null;

      const json = await res.json();
      const price = json?.outbound_sms_prices?.[0]?.prices?.[0]?.current_price;
      return typeof price === "number" ? price : price ? Number(price) : null;
    } catch {
      return null;
    }
  },

  async send(message: UnifiedMessage): Promise<ProviderSendResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

    const body = new URLSearchParams({
      To: message.to,
      From: message.from,
      Body: message.body,
    });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      const json = await res.json();

      if (!res.ok) {
        return {
          success: false,
          errorCode: json?.code ?? String(res.status),
          errorMessage: json?.message ?? "Twilio send failed",
          rawResponse: json,
        };
      }

      return {
        success: true,
        providerMessageId: json.sid,
        rawResponse: json,
      };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : "Unknown Twilio error",
      };
    }
  },

  parseDeliveryReport(payload: unknown): NormalizedDeliveryReport {
    // Twilio's StatusCallback posts form-encoded data; by the time it reaches here it should
    // already be parsed into an object (see routes/webhooks.ts).
    const p = payload as Record<string, string>;
    const statusMap: Record<string, NormalizedDeliveryReport["normalizedStatus"]> = {
      sent: "sent",
      delivered: "delivered",
      failed: "failed",
      undelivered: "undelivered",
    };

    return {
      providerMessageId: p.MessageSid,
      rawStatus: p.MessageStatus,
      normalizedStatus: statusMap[p.MessageStatus] ?? "failed",
      rawPayload: payload,
    };
  },
};
