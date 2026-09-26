/**
 * The name Pinna puts on the things this browser sends out, so a stranger
 * receiving a request knows who is asking. Pinna asks for it once.
 *
 * It is one value for the whole browser, not one per wallet — the same key is
 * set in localStorage whichever address is connected.
 */

const ALIAS_KEY = "pinna:profile:alias";

export function normalizeAlias(input: string): string {
  return String(input ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
}

export function loadAlias(): string {
  if (typeof window === "undefined") return "";
  try {
    return normalizeAlias(window.localStorage.getItem(ALIAS_KEY) ?? "");
  } catch {
    return "";
  }
}

export function saveAlias(alias: string): string {
  const clean = normalizeAlias(alias);
  if (typeof window === "undefined") return clean;
  try {
    if (clean) window.localStorage.setItem(ALIAS_KEY, clean);
    else window.localStorage.removeItem(ALIAS_KEY);
  } catch {
    // storage blocked — the alias simply is not remembered
  }
  return clean;
}

export function hasAlias(): boolean {
  return loadAlias().length > 0;
}

/** The line a request opens with, so the payer knows who is asking. */
export function requestGreeting(alias: string, reason: string): string {
  const who = normalizeAlias(alias) || "me";
  const why = String(reason ?? "").trim();
  return why ? `Hey, it's me ${who}. I'm requesting payment for ${why}.` : `Hey, it's me ${who}. I'm requesting a payment.`;
}
