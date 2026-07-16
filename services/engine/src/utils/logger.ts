import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { supabase } from "../db/supabaseClient.js";

type LogLevel = "info" | "warn" | "error";

export interface LogEventInput {
  level: LogLevel;
  event: string; // short machine-readable tag, e.g. "message.send.failed"
  message: string;
  accountId?: string | null;
  meta?: Record<string, unknown>;
}

/**
 * Three destinations, in order of what actually persists where:
 *
 * 1. Console (always) — this is what Railway's Deploy/Runtime Logs and Vercel's Logs tab
 *    capture automatically. Nothing extra to configure; just log well.
 * 2. Supabase `logs` table (always, best-effort) — the real per-client persistent record.
 *    Survives restarts/redeploys, unlike anything written to local disk on these hosts.
 *    Query it with `?accountId=...` via GET /v1/admin/logs when investigating one client.
 * 3. Local logs/<accountId>/<date>.log (only if LOG_TO_FILE=true) — genuinely useful while
 *    running on your own laptop, but does NOT persist on Railway or Vercel — both platforms
 *    run ephemeral filesystems that reset on every deploy/restart/scale event. Leave this off
 *    (default) in any deployed environment.
 */
export async function logEvent(input: LogEventInput): Promise<void> {
  const { level, event, message, accountId = null, meta } = input;
  const timestamp = new Date().toISOString();

  const line = JSON.stringify({ timestamp, level, event, accountId, message, meta });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // Best-effort — a logging failure must never break the request that triggered it.
  try {
    await supabase.from("logs").insert({
      account_id: accountId,
      level,
      event,
      message,
      meta: meta ?? null,
    });
  } catch (err) {
    console.error("[logger] failed to write to Supabase logs table:", err);
  }

  if (process.env.LOG_TO_FILE === "true") {
    try {
      const folder = accountId ?? "platform";
      const dir = path.join(process.cwd(), "logs", folder);
      await mkdir(dir, { recursive: true });
      const filePath = path.join(dir, `${timestamp.slice(0, 10)}.log`);
      await appendFile(filePath, line + "\n", "utf-8");
    } catch (err) {
      console.error("[logger] failed to write local log file:", err);
    }
  }
}
