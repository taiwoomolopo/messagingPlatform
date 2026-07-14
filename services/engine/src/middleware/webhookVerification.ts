import { createHmac } from "node:crypto";
import type { Request } from "express";

/**
 * Twilio signs every webhook with X-Twilio-Signature: base64(HMAC-SHA1(authToken, url + sortedParams)).
 * Docs: https://www.twilio.com/docs/usage/webhooks/webhook-security
 *
 * TWILIO_WEBHOOK_BASE_URL should be the exact public URL Twilio is configured to call (including
 * https:// and path) — required because signature verification depends on the exact URL Twilio
 * used, which may differ from what req.protocol/req.get('host') report behind a proxy/load balancer.
 */
export function verifyTwilioSignature(req: Request): boolean {
  const signature = req.header("x-twilio-signature");
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const baseUrl = process.env.TWILIO_WEBHOOK_BASE_URL;

  if (!signature || !authToken || !baseUrl) return false;

  const fullUrl = `${baseUrl.replace(/\/$/, "")}/webhooks/twilio`;
  const params = req.body as Record<string, string>;
  const sortedKeys = Object.keys(params).sort();
  const dataString = sortedKeys.reduce((acc, key) => acc + key + params[key], fullUrl);

  const expected = createHmac("sha1", authToken).update(dataString, "utf-8").digest("base64");
  return expected === signature;
}

/**
 * Infobip, Africa's Talking, and Termii don't have a widely-documented HMAC webhook-signing
 * scheme the way Twilio does. As a pragmatic stand-in, each of their webhook URLs includes an
 * unguessable secret path segment (configured on the provider's side as the callback/notify URL,
 * and checked here) — e.g. https://your-engine.example.com/webhooks/infobip/<secret>.
 * This isn't as strong as real payload signing, but it means the endpoint can't be discovered
 * and spoofed just by guessing a predictable URL.
 */
export function verifySharedSecretPath(req: Request, expectedSecretEnvVar: string): boolean {
  const expected = process.env[expectedSecretEnvVar];
  const provided = req.params.secret;
  return Boolean(expected) && expected === provided;
}
