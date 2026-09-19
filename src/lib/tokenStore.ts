"use client";

import type { TempoToken } from "./tempo";

/**
 * The payment token choice, shared across the whole app.
 *
 * It lives in one module-level store rather than in each component, so picking
 * a token in the header changes what the send, request and automation screens
 * use immediately — not after a reload.
 */

export interface CustomToken extends TempoToken {
  /** The chain it was added on, when the token only exists on one. */
  chainId?: number;
  /** True for tokens the user added themselves. */
  custom: true;
}

interface TokenState {
  symbol: string | null;
  custom: CustomToken[];
}

const SYMBOL_KEY = "pinna:token";
const CUSTOM_KEY = "pinna:tokens";

function loadSymbol(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SYMBOL_KEY);
  } catch {
    return null;
  }
}

function loadCustom(): CustomToken[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CustomToken[]) : [];
  } catch {
    return [];
  }
}

let state: TokenState = { symbol: null, custom: [] };
let snapshot = { ...state };
let hydrated = false;

const listeners = new Set<() => void>();

function emit() {
  snapshot = { ...state };
  listeners.forEach((listener) => listener());
}

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  state = { symbol: loadSymbol(), custom: loadCustom() };
  snapshot = { ...state };
}

export function subscribeTokens(listener: () => void): () => void {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTokenSnapshot(): TokenState {
  hydrate();
  return snapshot;
}

export function setTokenSymbol(symbol: string): void {
  hydrate();
  state = { ...state, symbol };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SYMBOL_KEY, symbol);
    } catch {
      // storage blocked — the choice lasts this session
    }
  }
  emit();
}

export function addCustomToken(token: Omit<CustomToken, "custom">): void {
  hydrate();
  const key = token.address.toLowerCase();
  const next = [
    ...state.custom.filter((t) => t.address.toLowerCase() !== key),
    { ...token, custom: true as const },
  ];
  state = { ...state, custom: next };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
    } catch {
      // storage blocked
    }
  }
  emit();
}

export function removeCustomToken(address: string): void {
  hydrate();
  const key = address.toLowerCase();
  const next = state.custom.filter((t) => t.address.toLowerCase() !== key);
  state = { ...state, custom: next };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
    } catch {
      // storage blocked
    }
  }
  emit();
}

/** Every token that can be paid in on a network: built-in first, then added. */
export function tokensOnNetwork(
  networkTokens: TempoToken[],
  custom: CustomToken[],
  chainId: number
): (TempoToken | CustomToken)[] {
  const seen = new Set(networkTokens.map((t) => t.address.toLowerCase()));
  const extra = custom.filter(
    (t) => !seen.has(t.address.toLowerCase()) && (t.chainId == null || t.chainId === chainId)
  );
  return [...networkTokens, ...extra];
}
