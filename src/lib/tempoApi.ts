import { pad, stringToHex } from "viem";
import type { IncomingTransfer } from "./requests";
import type { TempoNetwork } from "./tempo";

/**
 * Tempo API reads.
 *
 * Tempo's own documentation marks the public RPC as best-effort and explicitly
 * outside the stable API contract, while offering an indexed API for exactly
 * this job: reading an account's payment history. Pinna reads history from the
 * API when it can and falls back to the RPC when it cannot, so a history is
 * never lost to an indexer being unreachable — and a payment is still never
 * taken on trust, because both paths read the chain's own record.
 *
 * The API is called from the server (see `/api/transfers`) rather than the
 * browser: it is a backend API, and routing it through our own origin keeps
 * the page free of cross-origin surprises.
 */

const API_BASE = process.env.TEMPO_API_URL || "https://api.tempo.xyz";

/**
 * A Tempo API key raises the read rate limit enormously (10,000 against a much
 * smaller anonymous allowance), which is what the live poller lives on. It is
 * read on the server only and never sent to the browser.
 */
export function tempoApiKey(): string | undefined {
  return process.env.TEMPO_API_KEY || undefined;
}

function apiHeaders(): Record<string, string> {
  const key = tempoApiKey();
  return key
    ? { accept: "application/json", "tempo-api-key": key }
    : { accept: "application/json" };
}

/** One transfer as the Tempo API returns it (the fields Pinna reads). */
export interface TempoTransfer {
  /** `<transactionHash>-<logIndex>`, unique per transfer event. */
  id?: string;
  sender?: string;
  recipient?: string;
  sourceAmount?: { baseUnits?: string; decimals?: number };
  /** ISO 8601 date-time. */
  timestamp?: string;
  transactionHash?: string;
  /** The decoded text memo, returned when `include=memo` is requested. */
  memo?: string;
}

/** The base URL of the Tempo API, so tests and self-hosting can point elsewhere. */
export function tempoApiBase(): string {
  return API_BASE.replace(/\/+$/, "");
}

/** Whether history should be read from the Tempo API. */
export function tempoApiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TEMPO_API !== "off";
}

/**
 * A memo arrives decoded as text, but Pinna matches on the bytes written into
 * the transfer. Text is re-encoded as the same zero-padded 32 bytes the
 * transfer itself carries, so `decodeMemo` reads both forms identically.
 */
function memoToBytes(memo: string | undefined): string | null {
  if (!memo) return null;
  if (/^0x[0-9a-fA-F]*$/.test(memo)) return memo;
  try {
    return pad(stringToHex(memo), { size: 32, dir: "right" });
  } catch {
    return null;
  }
}

/**
 * Turn one Tempo API transfer into the shape Pinna reads everywhere else.
 * Returns null for a record missing what a payment must have, rather than
 * filling it in with a guess.
 */
export function transferToIncoming(record: TempoTransfer): IncomingTransfer | null {
  const { sender, recipient, sourceAmount, transactionHash } = record;
  if (!sender || !recipient || !sourceAmount?.baseUnits || !transactionHash) return null;

  let amountUnits: bigint;
  try {
    amountUnits = BigInt(sourceAmount.baseUnits);
  } catch {
    return null;
  }

  const parsed = record.timestamp ? Date.parse(record.timestamp) : NaN;
  return {
    from: sender as `0x${string}`,
    to: recipient as `0x${string}`,
    amountUnits,
    memo: memoToBytes(record.memo),
    txHash: transactionHash,
    timestamp: Number.isNaN(parsed) ? undefined : Math.floor(parsed / 1000),
    logId: record.id,
  };
}

/** Map a whole response page, dropping anything that could not be read. */
export function transfersToIncoming(records: unknown): IncomingTransfer[] {
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => transferToIncoming(record as TempoTransfer))
    .filter((entry): entry is IncomingTransfer => entry !== null);
}

/**
 * The wire shape for a transfer. Amounts are base units as a decimal string:
 * the values are integers wider than a JS number, so they travel as text and
 * are parsed back into a bigint rather than through floating point.
 */
export interface IncomingTransferJson {
  from: string;
  to: string;
  amountUnits: string;
  memo: string | null;
  txHash: string;
  timestamp?: number;
  logId?: string;
}

export function toTransferJson(transfer: IncomingTransfer): IncomingTransferJson {
  return {
    from: transfer.from,
    to: transfer.to,
    amountUnits: transfer.amountUnits.toString(),
    memo: transfer.memo ?? null,
    txHash: transfer.txHash,
    timestamp: transfer.timestamp,
    logId: transfer.logId,
  };
}

/** Read a wire transfer back, or null when it is malformed. */
export function fromTransferJson(value: unknown): IncomingTransfer | null {
  const record = value as Partial<IncomingTransferJson> | null;
  if (!record?.from || !record?.to || !record?.amountUnits || !record?.txHash) return null;
  try {
    return {
      from: record.from as `0x${string}`,
      to: record.to as `0x${string}`,
      amountUnits: BigInt(record.amountUnits),
      memo: record.memo ?? null,
      txHash: record.txHash,
      timestamp: record.timestamp,
      logId: record.logId,
    };
  } catch {
    return null;
  }
}

export function transfersFromJson(values: unknown): IncomingTransfer[] {
  if (!Array.isArray(values)) return [];
  return values
    .map(fromTransferJson)
    .filter((entry): entry is IncomingTransfer => entry !== null);
}

interface TransferPage {
  data?: unknown;
  nextCursor?: string | null;
}

/**
 * Read a wallet's transfers from the Tempo API, newest first, following the
 * cursor for a few pages. `address` matches either side of a transfer, so this
 * returns money in and money out alike.
 */
export async function readTransfersViaApi(
  network: TempoNetwork,
  token: `0x${string}`,
  address: `0x${string}`,
  options: { pages?: number; limit?: number; role?: "address" | "recipient" | "sender" } = {}
): Promise<IncomingTransfer[]> {
  const pages = options.pages ?? 3;
  const limit = Math.min(Math.max(options.limit ?? 50, 5), 50);
  // `address` matches either side; the narrower filters are what a watcher
  // wants, since it only cares about money arriving (or only about money sent).
  const role = options.role ?? "address";
  const out: IncomingTransfer[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < pages; page += 1) {
    const url = new URL("/v1/transfers", tempoApiBase());
    url.searchParams.set(role, address);
    url.searchParams.set("token", token);
    url.searchParams.set("chainId", String(network.chainId));
    url.searchParams.set("include", "memo");
    url.searchParams.set("limit", String(limit));
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url, {
      headers: apiHeaders(),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Tempo API returned ${response.status}`);
    }

    const body = (await response.json()) as TransferPage;
    out.push(...transfersToIncoming(body.data));
    cursor = body.nextCursor ?? null;
    if (!cursor) break;
  }

  return out;
}
