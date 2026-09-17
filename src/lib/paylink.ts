import type { PaymentRequest } from "./requests";

/**
 * A pay link carries the whole request, so the public page needs no server:
 * the host address, the amount, the reason, and the message all travel in the
 * URL. The request id doubles as the transfer memo, which is how a payment
 * made from a link is matched back to it.
 */

export interface PayLinkPayload {
  id: string;
  to: `0x${string}`;
  hostName: string;
  amount: string;
  reason: string;
  message?: string;
  token: string;
  network: string;
}

function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  const b64 = typeof btoa === "function"
    ? btoa(binary)
    : Buffer.from(input, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const withPad = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  if (typeof atob === "function") {
    const binary = atob(withPad);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(withPad, "base64").toString("utf8");
}

export function encodePayLink(payload: PayLinkPayload): string {
  return base64UrlEncode(JSON.stringify(payload));
}

export function decodePayLink(encoded: string): PayLinkPayload | null {
  try {
    const parsed = JSON.parse(base64UrlDecode(encoded));
    if (!parsed?.id || !parsed?.to || !parsed?.amount) return null;
    return parsed as PayLinkPayload;
  } catch {
    return null;
  }
}

export function payLinkUrl(baseUrl: string, payload: PayLinkPayload): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/pay/${payload.id}?d=${encodePayLink(payload)}`;
}

export function payloadFromRequest(
  request: PaymentRequest,
  extras: { token: string; network: string }
): PayLinkPayload {
  return {
    id: request.id,
    to: request.hostAddress,
    hostName: request.partyName ? "" : "",
    amount: request.amount,
    reason: request.reason,
    message: request.message,
    token: extras.token,
    network: extras.network,
  };
}

/** The draft message a host can copy into a chat app along with the link. */
export function draftMessage(input: {
  hostName: string;
  partyName: string;
  amount: string;
  reason: string;
  url: string;
  tokenSymbol: string;
}): string {
  const lines = [
    `Hi ${input.partyName || "there"} — ${input.hostName || "I"} here.`,
    "",
    `${input.amount} ${input.tokenSymbol} for ${input.reason || "our shared costs"}.`,
    "",
    `Pay on Tempo: ${input.url}`,
    "",
    "The transfer carries a reference, so it is matched to this request automatically.",
  ];
  return lines.join("\n");
}
