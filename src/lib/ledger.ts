import { decodeMemo } from "./memo";
import { formatAmount } from "./money";
import type { IncomingTransfer, PaymentRequest } from "./requests";
import type { SentRowSummary } from "./storage";

/**
 * The ledger: what actually happened, taken from Tempo itself.
 *
 * Local records know what a payment was *for*; the chain knows what actually
 * moved. Merging them is what lets Pinna say "paid" for transfers already sent
 * and "received" for transfers already received — with the hash — even for
 * transactions made before this browser ever saw the app.
 */

export type LedgerDirection = "sent" | "received";
export type LedgerStatus = "paid" | "received";

export interface LedgerEntry {
  id: string;
  direction: LedgerDirection;
  status: LedgerStatus;
  /** Who was on the other side. */
  address: string;
  /** Their name, when we know it. */
  name: string;
  amount: string;
  tokenSymbol: string;
  reference: string | null;
  reason: string;
  txHash: string;
  at: string;
  chainId: number;
  explorerUrl: string;
  /** True when the entry came from the chain rather than this browser. */
  fromChain: boolean;
}

export interface BuildLedgerInput {
  transfers: IncomingTransfer[];
  sent: { rows?: SentRowSummary[]; txHash: string; at: string; rowsMap?: Record<string, SentRowSummary> }[];
  requests: PaymentRequest[];
  address: string;
  decimals: number;
  tokenSymbol: string;
  chainId: number;
  explorerUrl: string;
  nameFor: (address: string) => string | undefined;
}

function isoFrom(timestamp?: number): string {
  return timestamp ? new Date(timestamp * 1000).toISOString() : "";
}

/**
 * Build the ledger from chain transfers, filling in names, reasons and
 * references from local records where they exist.
 */
export function buildLedger(input: BuildLedgerInput): LedgerEntry[] {
  const { transfers, requests, address, decimals, tokenSymbol, chainId, explorerUrl } = input;
  const me = address.toLowerCase();

  // What each tx hash was for, from the lists this browser sent.
  const reasonByHash = new Map<string, { reason: string; name: string }>();
  for (const list of input.sent) {
    for (const row of list.rows ?? []) {
      const key = `${list.txHash.toLowerCase()}|${row.address.toLowerCase()}`;
      reasonByHash.set(key, { reason: row.reason ?? "", name: row.name });
    }
  }

  const requestById = new Map(requests.map((r) => [r.id, r]));

  const entries: LedgerEntry[] = transfers.map((transfer, index) => {
    const outgoing = transfer.from.toLowerCase() === me;
    const counterparty = outgoing ? transfer.to : transfer.from;
    const reference = decodeMemo(transfer.memo);

    const request = reference ? requestById.get(reference) : undefined;
    const local = reasonByHash.get(`${transfer.txHash.toLowerCase()}|${counterparty.toLowerCase()}`);

    // The name shown is always the other side's: for money in, the person who
    // paid; for money out, the person paid.
    const name =
      local?.name ||
      request?.partyName ||
      input.nameFor(counterparty) ||
      "";

    const reason = request?.reason || local?.reason || "";

    return {
      id: `${transfer.txHash}-${index}`,
      direction: outgoing ? "sent" : "received",
      status: outgoing ? "paid" : "received",
      address: counterparty,
      name,
      amount: formatAmount(transfer.amountUnits, decimals),
      tokenSymbol,
      reference,
      reason,
      txHash: transfer.txHash,
      at: isoFrom(transfer.timestamp),
      chainId,
      explorerUrl,
      fromChain: true,
    };
  });

  // A request settled by a transfer that predates our lookback window still
  // deserves a row, so the record is not lost.
  const seenReferences = new Set(entries.map((e) => e.reference).filter(Boolean) as string[]);
  for (const request of requests) {
    if (request.status !== "paid" || !request.txHash) continue;
    if (seenReferences.has(request.id)) continue;
    entries.push({
      id: `${request.txHash}-${request.id}`,
      direction: "received",
      status: "received",
      address: request.partyAddress,
      name: request.partyName || request.partyAddress,
      amount: request.amount,
      tokenSymbol,
      reference: request.id,
      reason: request.reason,
      txHash: request.txHash,
      at: request.paidAt ?? request.createdAt,
      chainId: request.chainId ?? chainId,
      explorerUrl: request.explorerUrl ?? explorerUrl,
      fromChain: false,
    });
  }

  return entries.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
}

export function sentEntries(entries: LedgerEntry[]): LedgerEntry[] {
  return entries.filter((e) => e.direction === "sent");
}

export function receivedEntries(entries: LedgerEntry[]): LedgerEntry[] {
  return entries.filter((e) => e.direction === "received");
}
