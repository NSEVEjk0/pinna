import { decodeMemo } from "./memo";

/**
 * A request is money you are owed. It can carry a pay link, a PDF draft, or
 * neither (a reminder), and it stays under Waiting until it is paid — either
 * because the app saw a matching transfer on Tempo, or because you marked it
 * paid after taking the money another way.
 */

export type RequestStatus = "waiting" | "paid" | "cancelled";

export interface PaymentRequest {
  id: string;
  /** The wallet that is owed the money. */
  hostAddress: `0x${string}`;
  /** Who owes it. */
  partyName: string;
  partyAddress: `0x${string}`;
  amount: string;
  reason: string;
  /** The message the host writes for the payer, shown on the pay page. */
  message?: string;
  /** Which extras were chosen at creation. */
  hasLink: boolean;
  hasPdf: boolean;
  status: RequestStatus;
  createdAt: string;
  paidAt?: string;
  txHash?: string;
  /** How it was settled: a detected transfer, or marked by hand. */
  settledBy?: "detected" | "marked";
}

export const REQUEST_STATUSES: RequestStatus[] = ["waiting", "paid", "cancelled"];

const ALLOWED: Record<RequestStatus, RequestStatus[]> = {
  waiting: ["paid", "cancelled"],
  paid: [],
  cancelled: ["waiting"],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

export function transition(
  request: PaymentRequest,
  to: RequestStatus,
  patch: Partial<PaymentRequest> = {}
): PaymentRequest {
  if (!canTransition(request.status, to)) {
    throw new Error(`A request cannot move from ${request.status} to ${to}`);
  }
  return { ...request, ...patch, status: to };
}

export function markPaid(
  request: PaymentRequest,
  options: { txHash?: string; at?: string; settledBy?: "detected" | "marked" } = {}
): PaymentRequest {
  const at = options.at ?? new Date().toISOString();
  return transition(request, "paid", {
    paidAt: at,
    txHash: options.txHash,
    settledBy: options.settledBy ?? (options.txHash ? "detected" : "marked"),
  });
}

export function cancel(request: PaymentRequest): PaymentRequest {
  return transition(request, "cancelled");
}

export function reopen(request: PaymentRequest): PaymentRequest {
  return transition(request, "waiting", { paidAt: undefined, txHash: undefined, settledBy: undefined });
}

export interface IncomingTransfer {
  from: `0x${string}`;
  to: `0x${string}`;
  /** Base units as a decimal string. */
  amountUnits: bigint;
  memo?: string | null;
  txHash: string;
  /** Seconds since epoch, as reported by the chain. */
  timestamp?: number;
}

export interface Amounts {
  /** The requested amount in base units. */
  expectedUnits: bigint;
  decimals?: number;
}

/**
 * Decide whether an on-chain transfer settles a request.
 *
 * The memo wins: a transfer carrying this request's id is a match even if the
 * amount differs (people round, or pay a little extra). Without a memo, a
 * transfer counts only when it comes from the person who owes, goes to the
 * host, covers the amount, and is not older than the request.
 */
export function matchesRequest(
  request: PaymentRequest,
  transfer: IncomingTransfer,
  amounts: Amounts
): boolean {
  if (request.status === "paid") return false;

  const toHost = transfer.to.toLowerCase() === request.hostAddress.toLowerCase();
  if (!toHost) return false;

  const memoRef = decodeMemo(transfer.memo);
  if (memoRef) {
    if (memoRef === request.id) return true;
    // A memo for a different request is not a match, whatever the amount.
    return false;
  }

  const fromParty = transfer.from.toLowerCase() === request.partyAddress.toLowerCase();
  if (!fromParty) return false;
  if (transfer.amountUnits < amounts.expectedUnits) return false;

  if (transfer.timestamp && request.createdAt) {
    const created = Math.floor(new Date(request.createdAt).getTime() / 1000);
    // Allow a little clock slack, but not a payment from before the ask.
    if (transfer.timestamp < created - 120) return false;
  }
  return true;
}

/** The transfer that settles a request, if any — the earliest match wins. */
export function findSettlement(
  request: PaymentRequest,
  transfers: IncomingTransfer[],
  amounts: Amounts
): IncomingTransfer | null {
  const matches = transfers
    .filter((t) => matchesRequest(request, t, amounts))
    .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  return matches[0] ?? null;
}

export function pendingRequests(requests: PaymentRequest[]): PaymentRequest[] {
  return requests.filter((r) => r.status === "waiting");
}
