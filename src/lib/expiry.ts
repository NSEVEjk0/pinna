/**
 * Link expiry. A request can be open for ever, or close on a date the person
 * asking chooses. The reference still identifies the payment after that, so a
 * transfer that arrives late is still recognised — the app simply stops
 * offering the link.
 */

export type ExpiryChoice = "never" | "24h" | "7d" | "30d" | "custom";

export const EXPIRY_OPTIONS: { key: ExpiryChoice; label: string }[] = [
  { key: "never", label: "No expiry — stays open" },
  { key: "24h", label: "24 hours" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "custom", label: "Pick a date" },
];

/** Work out the expiry moment for a choice, or null when it never expires. */
export function resolveExpiry(
  choice: ExpiryChoice,
  customDate: string,
  now: Date = new Date()
): string | null {
  switch (choice) {
    case "never":
      return null;
    case "24h":
      return new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
    case "7d":
      return new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
    case "30d":
      return new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
    case "custom": {
      if (!customDate) return null;
      // End of the chosen day, so a link dated today works all day.
      const picked = new Date(`${customDate}T23:59:59`);
      return Number.isNaN(picked.getTime()) ? null : picked.toISOString();
    }
  }
}

export function isExpired(
  expiresAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!expiresAt) return false;
  const when = new Date(expiresAt);
  if (Number.isNaN(when.getTime())) return false;
  return now > when;
}

export function describeExpiry(
  expiresAt: string | null | undefined,
  now: Date = new Date()
): string {
  if (!expiresAt) return "No expiry";
  const when = new Date(expiresAt);
  if (Number.isNaN(when.getTime())) return "No expiry";
  const stamp = when.toISOString().slice(0, 16).replace("T", " ");
  return isExpired(expiresAt, now) ? `Expired ${stamp}` : `Open until ${stamp}`;
}
