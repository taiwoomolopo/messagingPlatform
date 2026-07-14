import { Router } from "express";
import { z } from "zod";
import { supabase } from "../db/supabaseClient.js";

export const signupRouter = Router();

const signupSchema = z.object({
  businessName: z.string().min(1),
  contactEmail: z.string().email(),
  userId: z.string().uuid(), // the Supabase Auth user id, created client-side via supabase.auth.signUp
});

/**
 * POST /v1/signup
 * Public (no auth) — but only ever does two inserts, both scoped to data the caller already
 * has (their own new Supabase user id). Called right after the portal's signup form runs
 * `supabase.auth.signUp()`, to create the corresponding account + membership row.
 *
 * The account starts as 'pending_approval' with no agreed rate — see
 * POST /v1/admin/accounts/:id/approve, which is what activates it.
 */
signupRouter.post("/v1/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  const { businessName, contactEmail, userId } = parsed.data;

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .insert({ business_name: businessName, contact_email: contactEmail, status: "pending_approval" })
    .select("id")
    .single();

  if (accountError || !account) {
    // Most likely cause: contact_email already used by an existing account.
    return res.status(409).json({ error: "signup_failed", details: accountError?.message });
  }

  const { error: membershipError } = await supabase
    .from("account_users")
    .insert({ account_id: account.id, user_id: userId, role: "owner" });

  if (membershipError) {
    return res.status(500).json({ error: "membership_link_failed", details: membershipError.message });
  }

  return res.status(201).json({ accountId: account.id, status: "pending_approval" });
});
