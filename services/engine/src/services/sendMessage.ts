import { supabase } from "../db/supabaseClient.js";
import { getLatestProviderMetrics } from "../db/providerMetrics.js";
import { pickBestProvider } from "../routing/scorer.js";
import { getAdapter } from "../adapters/index.js";
import { logEvent } from "../utils/logger.js";

export interface SendMessageInput {
  accountId: string;
  to: string;
  body: string;
  senderId?: string;
  reference?: string;
  source: "api" | "portal_single" | "portal_blast";
}

export interface SendMessageOutcome {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * The one place that actually sends a message: resolves the account, picks a provider via the
 * routing engine, dispatches through that provider's adapter, and records the outcome +
 * billing ledger entry. Used by /v1/messages (API), /v1/portal/messages (single send from the
 * portal), and /v1/portal/messages/blast (loops over this per recipient).
 */
export async function sendMessage(input: SendMessageInput): Promise<SendMessageOutcome> {
  const { accountId, to, body, senderId, reference, source } = input;

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, agreed_rate_per_sms, status")
    .eq("id", accountId)
    .single();

  if (accountError || !account) {
    await logEvent({ level: "warn", event: "message.send.rejected", message: "Account not found", accountId, meta: { source } });
    return { ok: false, error: "account_not_found" };
  }
  if (account.status !== "active") {
    await logEvent({ level: "warn", event: "message.send.rejected", message: "Account not active", accountId, meta: { source, status: account.status } });
    return { ok: false, error: "account_not_active" };
  }
  if (account.agreed_rate_per_sms === null) {
    await logEvent({ level: "warn", event: "message.send.rejected", message: "Account has no agreed rate set", accountId, meta: { source } });
    return { ok: false, error: "account_missing_rate" };
  }

  const candidates = await getLatestProviderMetrics();
  if (candidates.length === 0) {
    await logEvent({ level: "error", event: "message.send.no_providers", message: "No provider metrics available to route through", accountId, meta: { source } });
    return { ok: false, error: "no_providers_available" };
  }
  const chosen = pickBestProvider(candidates);

  let fromLabel = process.env.DEFAULT_SENDER_ID ?? "Platform";
  if (senderId) {
    const { data: sender } = await supabase
      .from("senders")
      .select("label")
      .eq("id", senderId)
      .eq("account_id", accountId)
      .maybeSingle();
    if (sender) fromLabel = sender.label;
  }

  const { data: messageRow, error: insertError } = await supabase
    .from("messages")
    .insert({
      account_id: accountId,
      sender_id: senderId ?? null,
      provider_id: null,
      source,
      to_number: to,
      body,
      status: "queued",
      agreed_cost: account.agreed_rate_per_sms,
      actual_cost: chosen.costPerSms,
    })
    .select("id")
    .single();

  if (insertError || !messageRow) {
    await logEvent({ level: "error", event: "message.send.record_failed", message: "Failed to insert message row", accountId, meta: { source, error: insertError?.message } });
    return { ok: false, error: "failed_to_record_message" };
  }

  const adapter = getAdapter(chosen.providerCode);
  const result = await adapter.send({ to, from: fromLabel, body, accountId, senderId, reference });

  const { data: providerRow } = await supabase
    .from("providers")
    .select("id")
    .eq("code", chosen.providerCode)
    .single();

  await supabase
    .from("messages")
    .update({
      provider_id: providerRow?.id ?? null,
      status: result.success ? "sent" : "failed",
      provider_message_id: result.providerMessageId ?? null,
      error_code: result.errorCode ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", messageRow.id);

  if (result.success) {
    await supabase.from("billing_ledger").insert({
      account_id: accountId,
      message_id: messageRow.id,
      provider_id: providerRow?.id ?? null,
      agreed_cost: account.agreed_rate_per_sms,
      actual_cost: chosen.costPerSms,
    });
    await logEvent({
      level: "info",
      event: "message.send.succeeded",
      message: "Message sent",
      accountId,
      meta: { source, provider: chosen.providerCode, messageId: messageRow.id },
    });
  } else {
    await logEvent({
      level: "error",
      event: "message.send.failed",
      message: result.errorMessage ?? "Provider send failed",
      accountId,
      meta: { source, provider: chosen.providerCode, messageId: messageRow.id, errorCode: result.errorCode },
    });
  }

  if (!result.success) return { ok: false, messageId: messageRow.id, error: result.errorMessage };
  return { ok: true, messageId: messageRow.id };
}
