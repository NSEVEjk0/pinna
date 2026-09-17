/** Small shared formatters for times and hashes in the interface. */

export function whenText(iso: string): string {
  if (!iso) return "time not reported";
  return iso.slice(0, 19).replace("T", " ");
}

export function hashLabel(hash: string, lead = 10, tail = 6): string {
  if (!hash || !hash.startsWith("0x")) return hash || "—";
  if (hash.length <= lead + tail + 2) return hash;
  return `${hash.slice(0, lead)}…${hash.slice(-tail)}`;
}
