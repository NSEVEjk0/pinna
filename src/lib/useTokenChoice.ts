"use client";

import { useCallback, useEffect, useState } from "react";
import { activeToken, type TempoNetwork, type TempoToken } from "./tempo";

/**
 * Which stablecoin Pinna pays in. Tempo settles fees in the token being sent,
 * so switching the token is all that is needed — there is no gas token to
 * swap first.
 */
const KEY = "pinna:token";

export function loadTokenPreference(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveTokenPreference(symbol: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, symbol);
  } catch {
    // storage blocked — the token simply resets next visit
  }
}

/** The tokens a network offers, with the environment override respected. */
export function tokensFor(network: TempoNetwork): TempoToken[] {
  const preferred = activeToken(network);
  const all = network.tokens.some((t) => t.symbol === preferred.symbol)
    ? network.tokens
    : [preferred, ...network.tokens];
  // The env-overridden token, when there is one, becomes the default choice.
  return [...all].sort((a, b) => (a.address === preferred.address ? -1 : b.address === preferred.address ? 1 : 0));
}

export function useTokenChoice(network: TempoNetwork) {
  const [symbol, setSymbol] = useState<string | null>(null);

  useEffect(() => {
    setSymbol(loadTokenPreference());
  }, []);

  const options = tokensFor(network);
  const selected =
    options.find((t) => t.symbol === symbol) ?? activeToken(network);

  const choose = useCallback((next: TempoToken) => {
    saveTokenPreference(next.symbol);
    setSymbol(next.symbol);
  }, []);

  return { token: selected, options, choose };
}
