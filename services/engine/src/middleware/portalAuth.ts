import type { Request, Response, NextFunction } from "express";
import { supabase } from "../db/supabaseClient.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      accountRole?: "owner" | "member";
    }
  }
}

/**
 * Expects `Authorization: Bearer <supabase_access_token>` — the session token the portal gets
 * from Supabase Auth after a user logs in (supabase.auth.getSession()).
 *
 * Verifies the token with Supabase Auth itself (a network call — fine for this scaffold's
 * traffic level; worth caching/short-circuiting with a JWT-local verification later), then
 * resolves it to the account via account_users. Sets req.accountId and req.userId.
 */
export async function portalAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "missing_session_token" });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: "invalid_session_token" });
  }

  req.userId = userData.user.id;

  const { data: membership, error: membershipError } = await supabase
    .from("account_users")
    .select("account_id, role")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return res.status(403).json({ error: "no_account_membership" });
  }

  req.accountId = membership.account_id;
  req.accountRole = membership.role;
  next();
}
