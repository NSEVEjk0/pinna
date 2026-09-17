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
  /** The chain the settling transfer landed on, remembered per request. */
  chainId?: number;
  explorerUrl?: string;
  /** How it was settled: a detected transfer, or marked by hand. */
  settledBy?: "detected" | "marked";
  /** The name the payer sees on the link, as written when it was created. */
  hostAlias?: string;
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
 * The memo decides. A transfer carrying this request's id settles it, whatever
 * the amount. A transfer carrying a *different* reference never does, and a
 * transfer with no memo is never taken as payment on its own — Pinna will not
 * call something paid because the numbers happened to line up. Those are
 * offered to you as possible matches instead (see `findPossibleMatch`).
 */
export function matchesRequest(
  request: PaymentRequest,
  transfer: IncomingTransfer,
  _amounts: Amounts
): boolean {
  if (request.status === "paid") return false;

  const toHost = transfer.to.toLowerCase() === request.hostAddress.toLowerCase();
  if (!toHost) return false;

  const memoRef = decodeMemo(transfer.memo);
  if (!memoRef) return false;

  return memoRef === request.id;
}

/**
 * A transfer that looks like it might be the payment but does not say so: no
 * memo, from the person who owes, at least the amount, after the request was
 * made. Pinna shows these and lets a human confirm — it never settles on one.
 */
export function findPossibleMatch(
  request: PaymentRequest,
  transfers: IncomingTransfer[],
  amounts: Amounts
): IncomingTransfer | null {
  if (request.status !== "waiting") return null;

  const created = request.createdAt ? Math.floor(new Date(request.createdAt).getTime() / 1000) : 0;
  const candidates = transfers
    .filter((t) => {
      if (t.to.toLowerCase() !== request.hostAddress.toLowerCase()) return false;
      if (decodeMemo(t.memo)) return false; // memoed transfers are settled or rejected above
      if (t.from.toLowerCase() !== request.partyAddress.toLowerCase()) return false;
      if (t.amountUnits < amounts.expectedUnits) return false;
      if (t.timestamp && created && t.timestamp < created - 120) return false;
      return true;
    })
    .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

  return candidates[0] ?? null;
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
