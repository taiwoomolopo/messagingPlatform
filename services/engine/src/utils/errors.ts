/**
 * Supabase's client throws plain objects (e.g. { message, details, hint, code }), not real
 * Error instances — `err instanceof Error` is false for those, which was silently collapsing
 * every DB-layer failure into "unknown error" wherever that check was used directly. This pulls
 * a real message out of both cases.
 */
export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return typeof err === "string" ? err : "unknown error";
}
