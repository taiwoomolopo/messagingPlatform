import type { Request, Response, NextFunction } from "express";
import { supabase } from "../db/supabaseClient.js";

declare global {
  namespace Express {
    interface Request {
      adminUserId?: string;
    }
  }
}

/**
 * Same token style as portalAuth (Supabase session access token), but checks platform_admins
 * instead of account_users. Platform staff and customer users are different populations —
 * a platform admin doesn't need to belong to any customer account.
 */
export async function adminAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "missing_session_token" });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: "invalid_session_token" });
  }

  const { data: admin, error: adminError } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError || !admin) {
    return res.status(403).json({ error: "not_a_platform_admin" });
  }

  req.adminUserId = userData.user.id;
  next();
}
