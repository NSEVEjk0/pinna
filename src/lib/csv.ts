import { explorerForRecord, type TempoNetwork } from "./tempo";
import type { LedgerEntry } from "./ledger";
import type { PaymentRequest } from "./requests";

/**
 * CSV out.
 *
 * The columns are the ones a finance system actually wants: when, which way,
 * who, what for, how much, in what, on which chain, and the two identifiers
 * that let anyone check it independently — the reference and the transaction
 * hash. Nothing is rounded or reformatted: the amounts are the same strings the
 * app displays, so a total in the spreadsheet matches a total on screen.
 */

export const CSV_HEADER = [
  "date",
  "direction",
  "counterparty",
  "name",
  "reason",
  "amount",
  "token",
  "network",
  "chain_id",
  "reference",
  "tx_hash",
  "explorer",
] as const;

/**
 * One CSV field, quoted only when it has to be. RFC 4180: a field containing a
 * comma, a quote or a newline is wrapped in quotes, and its quotes are doubled.
 */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A CSV document, CRLF-terminated so spreadsheets read it correctly. */
export function toCsv(rows: readonly (readonly unknown[])[], header: readonly string[]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function explorerLink(network: TempoNetwork, txHash: string): string {
  if (!txHash || !txHash.startsWith("0x")) return "";
  return explorerForRecord({}, network, txHash);
}

/** Every sent or received transfer, as the ledger shows it. */
export function ledgerCsv(entries: readonly LedgerEntry[], network: TempoNetwork): string {
  const rows = entries.map((entry) => [
    entry.at,
    entry.direction,
    entry.address,
    entry.name,
    entry.reason,
    entry.amount,
    entry.tokenSymbol,
    network.name,
    entry.chainId,
    entry.reference ?? "",
    entry.txHash,
    entry.explorerUrl ? explorerForRecord(entry, network, entry.txHash) : explorerLink(network, entry.txHash),
  ]);
  return toCsv(rows, CSV_HEADER);
}

/** Requests, whatever their state — waiting ones included. */
export function requestsCsv(requests: readonly PaymentRequest[], network: TempoNetwork): string {
  const rows = requests.map((request) => [
    request.paidAt ?? request.createdAt,
    request.status === "paid" ? "received" : request.status,
    request.partyAddress,
    request.partyName,
    request.reason,
    request.amount,
    "",
    network.name,
    request.chainId ?? network.chainId,
    request.id,
    request.txHash ?? "",
    request.txHash ? explorerForRecord(request, network, request.txHash) : "",
  ]);
  return toCsv(rows, CSV_HEADER);
}

/** Save a CSV in the browser. */
export function downloadCsv(filename: string, content: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
