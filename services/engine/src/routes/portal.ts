import { Router } from "express";
import { z } from "zod";
import { supabase } from "../db/supabaseClient.js";
import { sendMessage } from "../services/sendMessage.js";

export const portalRouter = Router();

const MAX_BLAST_RECIPIENTS = 5000;

const singleSendSchema = z.object({
  to: z.string().min(6),
  body: z.string().min(1).max(1600),
  senderId: z.string().uuid().optional(),
});

/** POST /v1/portal/messages — single send from the portal's compose screen. */
portalRouter.post("/v1/portal/messages", async (req, res) => {
  const parsed = singleSendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  const accountId = req.accountId!;
  const outcome = await sendMessage({ accountId, source: "portal_single", ...parsed.data });

  if (!outcome.ok) return res.status(502).json({ error: outcome.error });
  return res.status(202).json({ messageId: outcome.messageId, status: "sent" });
});

const blastSendSchema = z.object({
  recipients: z.array(z.string().min(6)).min(1).max(MAX_BLAST_RECIPIENTS),
  body: z.string().min(1).max(1600),
  senderId: z.string().uuid().optional(),
});

/**
 * POST /v1/portal/messages/blast — bulk send from the portal.
 *
 * This dispatches sequentially and returns a summary rather than one result per message, to
 * keep the response manageable for large lists. For real production volume, this should become
 * a queued background job instead of a synchronous request — sending 5,000 messages inline in
 * one HTTP request is a scaffold-stage simplification, not something to ship as-is.
 */
portalRouter.post("/v1/portal/messages/blast", async (req, res) => {
  const parsed = blastSendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  const accountId = req.accountId!;
  const { recipients, body, senderId } = parsed.data;

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const to of recipients) {
    const outcome = await sendMessage({ accountId, source: "portal_blast", to, body, senderId });
    if (outcome.ok) succeeded++;
    else {
      failed++;
      if (errors.length < 10) errors.push(`${to}: ${outcome.error}`);
    }
  }

  return res.status(200).json({ total: recipients.length, succeeded, failed, sampleErrors: errors });
});

const createSenderSchema = z.object({
  label: z.string().min(1).max(64),
});

/** GET /v1/portal/senders — list this account's senders. (Also readable directly via RLS from
 *  the portal's Supabase client — this endpoint exists for symmetry with the create action.) */
portalRouter.get("/v1/portal/senders", async (req, res) => {
  const { data, error } = await supabase
    .from("senders")
    .select("id, label, status, created_at")
    .eq("account_id", req.accountId!)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: "failed_to_list_senders" });
  return res.json({ senders: data });
});

/** POST /v1/portal/senders — register a new sender ID. Goes through the engine (service role)
 *  since RLS deliberately has no insert policy for the anon/authenticated role on this table. */
portalRouter.post("/v1/portal/senders", async (req, res) => {
  const parsed = createSenderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }

  const { data, error } = await supabase
    .from("senders")
    .insert({ account_id: req.accountId!, label: parsed.data.label, status: "pending" })
    .select("id, label, status")
    .single();

  if (error) return res.status(500).json({ error: "failed_to_create_sender" });
  return res.status(201).json({ sender: data });
});

/**
 * GET /v1/portal/messages/export — CSV export for the account's message history.
 * Also directly queryable from the portal via Supabase (RLS-scoped), but CSV formatting is
 * done here server-side so the portal doesn't need a CSV library.
 */
portalRouter.get("/v1/portal/messages/export", async (req, res) => {
  const { data, error } = await supabase
    .from("messages")
    .select("to_number, status, source, created_at")
    .eq("account_id", req.accountId!)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (error) return res.status(500).json({ error: "failed_to_export" });

  const header = "to_number,status,source,created_at";
  const rows = (data ?? []).map((m) =>
    [m.to_number, m.status, m.source, m.created_at].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
  );
  const csv = [header, ...rows].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=messages.csv");
  return res.send(csv);
});
