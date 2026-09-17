"use client";

import { useCallback } from "react";

/**
 * Contacts can hand a person to the send or request screen. The hand-off is a
 * single draft in local storage, consumed once so it does not reappear.
 */
const DRAFT_KEY = "pinna:draft:contact";

export interface ContactDraft {
  address: `0x${string}`;
  name: string;
  mode: "send" | "request";
}

export function useDraftContact(mode: "send" | "request"): () => ContactDraft | null {
  // A stable identity, so an effect that consumes the draft runs once rather
  // than on every render.
  return useCallback(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ContactDraft;
      if (parsed.mode !== mode) return null;
      window.localStorage.removeItem(DRAFT_KEY);
      return parsed;
    } catch {
      return null;
    }
  }, [mode]);
}
