/**
 * Paying the same thing twice.
 *
 * A reference is meant to settle exactly once. Nothing on a public chain can
 * stop a second transfer being sent with the same reference — but it can be
 * *recognised*, which is what matters: the request is settled by the first
 * transfer that carries it, and a second one carrying the same reference is a
 * duplicate to be refunded, not another payment.
 *
 * The payer does not have to be the wallet the money was requested from, so
 * this cannot be decided by looking at who sent it. It is decided by the
 * reference alone.
 */

export interface ReferenceRow {
  reference: string | null;
  txHash: string;
  amount: string;
}

export interface DuplicateReference {
  reference: string;
  /** Every distinct transaction that carried this reference, earliest first. */
  txHashes: string[];
  /** How many transfers carried it. */
  count: number;
  /** The amount of the first (settling) transfer. */
  amount: string;
}

/** References carried by more than one transaction, and which ones. */
export function findDuplicateReferences(
  rows: readonly ReferenceRow[]
): DuplicateReference[] {
  const byReference = new Map<string, { hashes: string[]; amounts: string[] }>();

  for (const row of rows) {
    if (!row.reference || !row.txHash) continue;
    const seen = byReference.get(row.reference) ?? { hashes: [], amounts: [] };
    if (!seen.hashes.includes(row.txHash)) {
      seen.hashes.push(row.txHash);
      seen.amounts.push(row.amount);
    }
    byReference.set(row.reference, seen);
  }

  const out: DuplicateReference[] = [];
  for (const [reference, seen] of byReference) {
    if (seen.hashes.length < 2) continue;
    out.push({
      reference,
      txHashes: seen.hashes,
      count: seen.hashes.length,
      amount: seen.amounts[0],
    });
  }
  return out.sort((a, b) => b.count - a.count);
}

/**
 * The transaction that settles a reference: the earliest one that carried it.
 * Anything after it is a duplicate, so a late second payment never reopens or
 * re-settles a request.
 */
export function settlingTx(txHashes: readonly string[]): string | undefined {
  return txHashes[0];
}
