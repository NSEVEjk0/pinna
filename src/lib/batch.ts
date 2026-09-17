import { encodeFunctionData, parseUnits } from "viem";
import { Abis } from "viem/tempo";
import { encodeMemo } from "./memo";
import type { PayableRow } from "./money";

/**
 * One Tempo transaction can carry many calls. Pinna builds the whole list as
 * a single batch: each row becomes its own TIP-20 `transferWithMemo` call, so
 * a person appearing on three rows still produces three separate transfers,
 * each with its own memo — and the payer signs once.
 */

export interface TempoCall {
  to: `0x${string}`;
  data: `0x${string}`;
}

export interface BatchLine {
  row: PayableRow;
  memo: `0x${string}`;
  call: TempoCall;
}

export interface Batch {
  calls: TempoCall[];
  lines: BatchLine[];
}

export interface BuildBatchOptions {
  token: `0x${string}`;
  decimals?: number;
  /** Overrides the memo reference for a row (used when paying a request). */
  referenceFor?: (row: PayableRow, index: number) => string;
}

/**
 * Build the batch for a list of rows. Every row is encoded individually and
 * the order is preserved so receipts line up with what the payer wrote.
 */
export function buildBatch(rows: PayableRow[], options: BuildBatchOptions): Batch {
  const decimals = options.decimals ?? 6;
  const lines: BatchLine[] = rows.map((row, index) => {
    const reference = options.referenceFor
      ? options.referenceFor(row, index)
      : row.id || "row";
    const memo = encodeMemo(reference);
    const call: TempoCall = {
      to: options.token,
      data: encodeFunctionData({
        abi: Abis.tip20,
        functionName: "transferWithMemo",
        args: [row.address, parseUnits(row.amount, decimals), memo],
      }),
    };
    return { row, memo, call };
  });

  return { calls: lines.map((l) => l.call), lines };
}

/** How many transfers the batch will perform (one per row, never merged). */
export function batchSize(batch: Batch): number {
  return batch.calls.length;
}
