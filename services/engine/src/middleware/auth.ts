import type { Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { supabase } from "../db/supabaseClient.js";

// Augment Express's Request type so `req.accountId` is recognized elsewhere without `as any`.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      accountId?: string;
    }
  }
}

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Expects `Authorization: Bearer <api_key>`. Looks up the key by its hash (raw keys are never
 * stored — see supabase/migrations/0002_auth_and_pricing.sql), attaches the resolved account_id
 * to the request, and updates last_used_at. Fire-and-forget on the last_used_at update so it
 * doesn't add latency to every request.
 */
export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const [scheme, rawKey] = header.split(" ");

  if (scheme !== "Bearer" || !rawKey) {
    return res.status(401).json({ error: "missing_api_key" });
  }

  const keyHash = hashKey(rawKey);

  const { data: keyRow, error } = await supabase
    .from("api_keys")
    .select("id, account_id, status")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !keyRow || keyRow.status !== "active") {
    return res.status(401).json({ error: "invalid_api_key" });
  }

  req.accountId = keyRow.account_id;

  // Don't block the request on this — best-effort tracking of key usage.
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => {}, () => {});

  next();
}
