import { Router } from "express";
import { z } from "zod";
import { supabase } from "../db/supabaseClient.js";

export const adminRouter = Router();

/** GET /v1/admin/accounts — list all businesses on the platform, newest first. */
adminRouter.get("/v1/admin/accounts", async (_req, res) => {
  const { data, error } = await supabase
    .from("accounts")
    .select("id, business_name, contact_email, status, agreed_rate_per_sms, created_at")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: "failed_to_list_accounts" });
  return res.json({ accounts: data });
});

const createAccountSchema = z.object({
  businessName: z.string().min(1),
  contactEmail: z.string().email(),
  agreedRatePerSms: z.number().positive().optional(),
});

/** POST /v1/admin/accounts — admin-provisioned onboarding (Section 4.2 of the concept doc):
 *  create an account directly, without the business going through self-signup first. */
adminRouter.post("/v1/admin/accounts", async (req, res) => {
  const parsed = createAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  const { businessName, contactEmail, agreedRatePerSms } = parsed.data;

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      business_name: businessName,
      contact_email: contactEmail,
      agreed_rate_per_sms: agreedRatePerSms ?? null,
      status: agreedRatePerSms ? "active" : "pending_approval",
    })
    .select("id, status")
    .single();

  if (error) return res.status(409).json({ error: "failed_to_create_account", details: error.message });
  return res.status(201).json({ account: data });
});

const approveSchema = z.object({
  agreedRatePerSms: z.number().positive(),
});

/** POST /v1/admin/accounts/:id/approve — activates a pending signup and sets its agreed rate. */
adminRouter.post("/v1/admin/accounts/:id/approve", async (req, res) => {
  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }

  const { data, error } = await supabase
    .from("accounts")
    .update({ status: "active", agreed_rate_per_sms: parsed.data.agreedRatePerSms })
    .eq("id", req.params.id)
    .eq("status", "pending_approval") // no-op if it's not actually pending — avoids re-approving/re-pricing by accident
    .select("id, status")
    .maybeSingle();

  if (error) return res.status(500).json({ error: "failed_to_approve" });
  if (!data) return res.status(404).json({ error: "account_not_pending_or_not_found" });
  return res.json({ account: data });
});

/**
 * GET /v1/admin/logs — recent log entries, optionally filtered to one account. This is the
 * practical "per-client folder" for investigation: query ?accountId=<id> to see everything
 * logged for that business specifically, across sends, webhooks, and rejections.
 */
adminRouter.get("/v1/admin/logs", async (req, res) => {
  const accountId = typeof req.query.accountId === "string" ? req.query.accountId : undefined;
  const level = typeof req.query.level === "string" ? req.query.level : undefined;

  let query = supabase
    .from("logs")
    .select("id, account_id, level, event, message, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (accountId) query = query.eq("account_id", accountId);
  if (level) query = query.eq("level", level);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: "failed_to_load_logs" });
  return res.json({ logs: data });
});
adminRouter.get("/v1/admin/users", async (_req, res) => {
  const { data, error } = await supabase
    .from("account_users")
    .select("user_id, role, created_at, accounts(id, business_name, status)")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: "failed_to_list_users" });
  return res.json({ users: data });
});

/** GET /v1/admin/traffic — total traffic across the whole platform, plus a per-account breakdown. */
adminRouter.get("/v1/admin/traffic", async (_req, res) => {
  const { count: totalMessages } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true });

  const { data: perAccount, error } = await supabase.rpc("messages_per_account");
  // Falls back gracefully if the RPC function hasn't been created (see migration 0004) —
  // still returns the platform-wide total either way.
  if (error) {
    return res.json({ totalMessages: totalMessages ?? 0, perAccount: null, note: "messages_per_account RPC not available yet" });
  }

  return res.json({ totalMessages: totalMessages ?? 0, perAccount });
});

/**
 * GET /v1/admin/cost-breakdown — margin per account/provider (Section 4.3 of the concept doc):
 * actual provider cost vs. what the customer is billed, and the resulting margin.
 */
adminRouter.get("/v1/admin/cost-breakdown", async (req, res) => {
  const accountId = typeof req.query.accountId === "string" ? req.query.accountId : undefined;

  let query = supabase
    .from("billing_ledger")
    .select("account_id, provider_id, agreed_cost, actual_cost, margin, billed, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (accountId) query = query.eq("account_id", accountId);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: "failed_to_load_cost_breakdown" });

  const totals = (data ?? []).reduce(
    (acc, row) => {
      acc.agreedTotal += Number(row.agreed_cost);
      acc.actualTotal += Number(row.actual_cost);
      acc.marginTotal += Number(row.margin);
      return acc;
    },
    { agreedTotal: 0, actualTotal: 0, marginTotal: 0 }
  );

  return res.json({ rows: data, totals });
});
