import { Waypoints } from "lucide-react";

/**
 * The one deliberate signature element in this UI: a routing-path glyph (Waypoints icon)
 * paired with the wordmark. It's a quiet nod to what the platform actually does — route
 * messages across providers — rather than a generic logo mark, and it's kept to exactly
 * this one spot rather than repeated as decoration elsewhere.
 */
export function Brand({ size = 20 }: { size?: number }) {
  return (
    <>
      <Waypoints size={size} strokeWidth={2} />
      <span>Messaging Platform</span>
    </>
  );
}
