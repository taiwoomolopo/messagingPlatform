import "dotenv/config";
import { randomBytes, createHash } from "node:crypto";
import { supabase } from "../db/supabaseClient.js";

/**
 * Usage:
 *   npm run create-key -- <accountId> ["label"]
 *
 * Prints the raw API key ONCE. It is not recoverable afterwards — only its hash is stored.
 * If it's lost, revoke it and create a new one.
 */
async function main() {
  const [accountId, label] = process.argv.slice(2);

  if (!accountId) {
    console.error('Usage: npm run create-key -- <accountId> ["label"]');
    process.exit(1);
  }

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, business_name")
    .eq("id", accountId)
    .single();

  if (accountError || !account) {
    console.error(`No account found with id ${accountId}`);
    process.exit(1);
  }

  const rawKey = `sk_live_${randomBytes(24).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12);

  const { error: insertError } = await supabase.from("api_keys").insert({
    account_id: accountId,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    label: label ?? null,
  });

  if (insertError) {
    console.error("Failed to create API key:", insertError.message);
    process.exit(1);
  }

  console.log(`API key created for ${account.business_name}:`);
  console.log(rawKey);
  console.log("\nStore this now — it will not be shown again.");
}

main();
