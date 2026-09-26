import { decodeEventLog, type Log } from "viem";
import { TRANSFER_WITH_MEMO, publicClientFor } from "./chain";
import { decodeMemo } from "./memo";
import type { IncomingTransfer } from "./requests";
import type { TempoNetwork } from "./tempo";

/**
 * Verifying a payment the moment it lands.
 *
 * A Tempo transaction returns its receipt as soon as it is included, and the
 * transfers it made are in that receipt's own logs. Reading them back and
 * matching them against what was asked for is therefore both instantaneous and
 * exact: it is the chain's record of the transaction itself, not an inference
 * from a balance change or a hope that a number lines up.
 *
 * The payer sees "verified" from their own receipt; the receiver sees it from
 * the same transfer, matched by the reference written into the memo.
 */

export interface DecodedTransfer {
  from: `0x${string}`;
  to: `0x${string}`;
  amountUnits: bigint;
  /** The raw bytes32 memo as the transfer carried it. */
  memo: string;
  /** The transaction the transfer was part of, when the log reports it. */
  txHash?: string;
}

/**
 * The transfers a transaction's logs record for one TIP-20 token. A log that
 * does not decode is skipped rather than guessed at.
 */
export function transfersFromLogs(
  logs: readonly unknown[],
  token: `0x${string}`
): DecodedTransfer[] {
  const out: DecodedTransfer[] = [];
  for (const log of logs as Log[]) {
    if (log?.address?.toLowerCase() !== token.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: [TRANSFER_WITH_MEMO],
        data: log.data,
        topics: log.topics,
      });
      const args = decoded.args as unknown as {
        from: `0x${string}`;
        to: `0x${string}`;
        value: bigint;
        memo: string;
      };
      out.push({
        from: args.from,
        to: args.to,
        amountUnits: args.value,
        memo: args.memo,
        txHash: log.transactionHash ?? undefined,
      });
    } catch {
      // not a TransferWithMemo log — skipped, never guessed at
    }
  }
  return out;
}

export interface Expectation {
  /** The wallet that should receive the money. */
  to: `0x${string}`;
  /** At least this much, in base units. An overpayment still settles. */
  amountUnits: bigint;
  /** The reference that must appear in the transfer's memo. */
  reference: string;
}

export interface Verdict {
  ok: boolean;
  matched?: DecodedTransfer;
  /** Why it did not match, when it did not. */
  reason?: "no-transfer" | "recipient" | "amount" | "reference";
}

/**
 * Does a set of transfers satisfy what was asked for?
 *
 * The reference decides: only a transfer carrying it counts, whatever wallet
 * sent the money — a request can be paid from any wallet, which is the point of
 * a pay link. The recipient must be the wallet that asked, and the amount must
 * cover what was requested.
 */
export function verifyTransfers(transfers: DecodedTransfer[], expected: Expectation): Verdict {
  const toThem = transfers.filter(
    (t) => t.to.toLowerCase() === expected.to.toLowerCase()
  );
  if (toThem.length === 0) {
    return { ok: false, reason: transfers.length > 0 ? "recipient" : "no-transfer" };
  }

  const carryingReference = toThem.filter((t) => decodeMemo(t.memo) === expected.reference);
  if (carryingReference.length === 0) return { ok: false, reason: "reference" };

  const covering = carryingReference.find((t) => t.amountUnits >= expected.amountUnits);
  if (!covering) return { ok: false, reason: "amount" };

  return { ok: true, matched: covering };
}

/**
 * Read a transaction's receipt and check the transfer it made. Resolves as soon
 * as the transaction is included — there is nothing to poll for.
 */
export async function verifyPayment(
  network: TempoNetwork,
  token: `0x${string}`,
  txHash: string,
  expected: Expectation
): Promise<Verdict> {
  const receipt = await publicClientFor(network).getTransactionReceipt({
    hash: txHash as `0x${string}`,
  });
  if (receipt.status !== "success") return { ok: false, reason: "no-transfer" };
  return verifyTransfers(transfersFromLogs(receipt.logs, token), expected);
}

/**
 * Transfers Pinna read elsewhere (the API, or a watch stream) are the same
 * shape the matcher works on, so a watched payment can be checked without
 * re-reading the chain.
 */
export function toDecoded(transfers: readonly IncomingTransfer[]): DecodedTransfer[] {
  return transfers.map((transfer) => ({
    from: transfer.from,
    to: transfer.to,
    amountUnits: transfer.amountUnits,
    memo: transfer.memo ?? "",
    txHash: transfer.txHash,
  }));
}
