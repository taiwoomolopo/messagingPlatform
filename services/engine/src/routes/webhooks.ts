import { Router } from "express";
import { supabase } from "../db/supabaseClient.js";
import { getAdapter } from "../adapters/index.js";
import { verifyTwilioSignature, verifySharedSecretPath } from "../middleware/webhookVerification.js";
import { logEvent } from "../utils/logger.js";

export const webhooksRouter = Router();

/**
 * One webhook endpoint per provider. Configure these exact URLs in each provider's
 * dashboard/API config:
 *   POST /webhooks/twilio                                (real HMAC signature check)
 *   POST /webhooks/infobip/:secret                        (secret path — see webhookVerification.ts)
 *   POST /webhooks/africastalking/:secret
 *   POST /webhooks/termii/:secret
 * where :secret matches WEBHOOK_SECRET_INFOBIP / _AFRICASTALKING / _TERMII in .env.
 */

async function handleDeliveryReport(providerCode: string, payload: unknown) {
  const adapter = getAdapter(providerCode);
  const normalized = adapter.parseDeliveryReport(payload);

  const { data: providerRow } = await supabase.from("providers").select("id").eq("code", providerCode).single();

  const { data: message } = await supabase
    .from("messages")
    .select("id, account_id")
    .eq("provider_message_id", normalized.providerMessageId)
    .maybeSingle();

  if (!message) {
    await logEvent({
      level: "warn",
      event: "webhook.unmatched",
      message: `No message found for provider_message_id from ${providerCode}`,
      meta: { providerCode, providerMessageId: normalized.providerMessageId },
    });
    return;
  }

  await supabase.from("delivery_reports").insert({
    message_id: message.id,
    provider_id: providerRow?.id,
    raw_status: normalized.rawStatus,
    normalized_status: normalized.normalizedStatus,
    raw_payload: payload,
  });

  await supabase
    .from("messages")
    .update({ status: normalized.normalizedStatus, updated_at: new Date().toISOString() })
    .eq("id", message.id);

  await logEvent({
    level: normalized.normalizedStatus === "failed" || normalized.normalizedStatus === "undelivered" ? "warn" : "info",
    event: "webhook.delivery_report",
    message: `${providerCode} reported status: ${normalized.normalizedStatus}`,
    accountId: message.account_id,
    meta: { providerCode, messageId: message.id, rawStatus: normalized.rawStatus },
  });
}

webhooksRouter.post("/webhooks/twilio", async (req, res) => {
  if (!verifyTwilioSignature(req)) {
    await logEvent({ level: "warn", event: "webhook.invalid_signature", message: "Rejected Twilio webhook: bad signature" });
    return res.status(401).send("invalid signature");
  }
  await handleDeliveryReport("twilio", req.body);
  res.status(200).send("ok"); // Twilio expects 200/204, not JSON
});

webhooksRouter.post("/webhooks/infobip/:secret", async (req, res) => {
  if (!verifySharedSecretPath(req, "WEBHOOK_SECRET_INFOBIP")) return res.status(401).json({ error: "invalid_secret" });
  await handleDeliveryReport("infobip", req.body);
  res.status(200).json({ ok: true });
});

webhooksRouter.post("/webhooks/africastalking/:secret", async (req, res) => {
  if (!verifySharedSecretPath(req, "WEBHOOK_SECRET_AFRICASTALKING")) return res.status(401).send("invalid secret");
  await handleDeliveryReport("africastalking", req.body);
  res.status(200).send("ok");
});

webhooksRouter.post("/webhooks/termii/:secret", async (req, res) => {
  if (!verifySharedSecretPath(req, "WEBHOOK_SECRET_TERMII")) return res.status(401).json({ error: "invalid_secret" });
  await handleDeliveryReport("termii", req.body);
  res.status(200).json({ ok: true });
});
