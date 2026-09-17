import type { PaymentRequest } from "./requests";

/**
 * A small local log of things that happened, so the app can tell you when a
 * request gets paid without you going looking for it.
 */

export type PinnaEventKind =
  | "request_paid"
  | "request_created"
  | "list_sent"
  | "request_cancelled"
  | "payment_completed";

export interface PinnaEvent {
  id: string;
  kind: PinnaEventKind;
  title: string;
  detail: string;
  at: string;
  txHash?: string;
  requestId?: string;
  /** Unread events show a dot until the notifications section is opened. */
  read?: boolean;
}

const EVENTS_KEY = (wallet: string) => `pinna:${wallet.toLowerCase()}:events`;
const EVENTS_LIMIT = 60;

export function loadEvents(wallet: string): PinnaEvent[] {
  if (typeof window === "undefined" || !wallet) return [];
  try {
    const raw = window.localStorage.getItem(EVENTS_KEY(wallet));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PinnaEvent[]) : [];
  } catch {
    return [];
  }
}

export function saveEvents(wallet: string, events: PinnaEvent[]): void {
  if (typeof window === "undefined" || !wallet) return;
  try {
    window.localStorage.setItem(EVENTS_KEY(wallet), JSON.stringify(events.slice(0, EVENTS_LIMIT)));
  } catch {
    // ignore storage failures
  }
}

export function pushEvent(wallet: string, event: Omit<PinnaEvent, "id" | "at" | "read"> & { at?: string }): PinnaEvent[] {
  const entry: PinnaEvent = {
    id: `ev_${Math.random().toString(36).slice(2, 10)}`,
    at: event.at ?? new Date().toISOString(),
    read: false,
    ...event,
  } as PinnaEvent;
  const next = [entry, ...loadEvents(wallet)];
  saveEvents(wallet, next);
  return next;
}

export function markAllRead(wallet: string): PinnaEvent[] {
  const next = loadEvents(wallet).map((e) => ({ ...e, read: true }));
  saveEvents(wallet, next);
  return next;
}

export function unreadCount(events: PinnaEvent[]): number {
  return events.filter((e) => !e.read).length;
}

/** Build the event for a request that has just been paid. */
export function paidEvent(request: PaymentRequest, txHash?: string): Omit<PinnaEvent, "id" | "at" | "read"> {
  return {
    kind: "request_paid",
    title: `${request.partyName || request.partyAddress} paid ${request.amount}`,
    detail: request.reason || "A request you sent",
    txHash,
    requestId: request.id,
  };
}
