import { Router } from "express";
import { z } from "zod";
import { sendMessage } from "../services/sendMessage.js";

export const messagesRouter = Router();

const sendMessageSchema = z.object({
  to: z.string().min(6),
  body: z.string().min(1).max(1600),
  senderId: z.string().uuid().optional(),
  reference: z.string().optional(),
});

/**
 * POST /v1/messages
 * The unified send endpoint for API customers. Protected by apiKeyAuth (src/middleware/auth.ts),
 * which resolves the Bearer token to req.accountId before this handler runs.
 */
messagesRouter.post("/v1/messages", async (req, res) => {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }

  const accountId = req.accountId;
  if (!accountId) return res.status(401).json({ error: "unauthorized" });

  const outcome = await sendMessage({ accountId, source: "api", ...parsed.data });

  if (!outcome.ok) {
    const status = outcome.error === "account_not_found" ? 404
      : outcome.error === "account_not_active" ? 403
      : outcome.error === "no_providers_available" ? 503
      : 502;
    return res.status(status).json({ error: outcome.error });
  }

  // Deliberately NOT returning which provider handled this — Section 2.5 of the concept doc
  // is explicit that provider identity stays hidden from the customer.
  return res.status(202).json({ messageId: outcome.messageId, status: "sent" });
});
