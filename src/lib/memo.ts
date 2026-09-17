import { pad, stringToHex, hexToString } from "viem";

/**
 * Transfer memos carry the Pinna reference that ties an on-chain transfer to
 * a row or a request. Tempo memos are bytes32 (32 bytes), and the
 * TransferWithMemo event indexes the memo so it can be filtered directly.
 */

export const MEMO_PREFIX = "PINNA:";
export const MEMO_BYTES = 32;

/** Reference ids are short enough to fit the memo with the prefix. */
export function newReference(prefix = "pin"): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${prefix}_${out}`;
}

/**
 * Encode a reference into a 32-byte memo. The text sits at the start of the
 * word and the rest is zero-filled, which is how a reader finds it again.
 * Anything longer than the space after the prefix is truncated rather than
 * silently overflowing.
 */
export function encodeMemo(reference: string): `0x${string}` {
  const raw = `${MEMO_PREFIX}${reference}`;
  const maxChars = MEMO_BYTES - 1; // keep a trailing zero so decoding is clean
  return pad(stringToHex(raw.slice(0, maxChars)), { size: MEMO_BYTES, dir: "right" });
}

/** Decode a memo back to its reference, or null when it is not a Pinna memo. */
export function decodeMemo(memo: string | undefined | null): string | null {
  if (!memo || typeof memo !== "string") return null;
  try {
    const text = hexToString(memo as `0x${string}`).replace(/\0+$/, "");
    if (!text.startsWith(MEMO_PREFIX)) return null;
    const ref = text.slice(MEMO_PREFIX.length).trim();
    return ref.length > 0 ? ref : null;
  } catch {
    return null;
  }
}

export function isPinnaMemo(memo: string | undefined | null): boolean {
  return decodeMemo(memo) !== null;
}

/** The memo for a payment row: the request id when paying a request, else a row ref. */
export function memoForRow(row: { reason?: string; reference?: string }): `0x${string}` {
  return encodeMemo(row.reference || "row");
}
