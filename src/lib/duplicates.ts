import { DEFAULT_DECIMALS, formatAmount, parseAmount } from "./money";

/**
 * Spotting repeats. If the same person is paid the same amount several times
 * — by accident, or on purpose — Pinna says so instead of quietly listing it.
 */

export interface RepeatCandidate {
  id: string;
  name: string;
  address: string;
  amount: string;
  reason?: string;
  txHash?: string;
  at: string;
}

export interface RepeatGroup {
  key: string;
  name: string;
  address: string;
  amount: string;
  count: number;
  items: RepeatCandidate[];
  /** Total across every repeat, so an accidental 100× payment is obvious. */
  total: string;
  firstAt: string;
  lastAt: string;
}

function amountKey(amount: string, decimals: number): string {
  try {
    return parseAmount(amount, decimals).toString();
  } catch {
    return amount.trim();
  }
}

/**
 * Group payments that repeat. Two payments count as a repeat when they go to
 * the same address for the same amount; rows sent inside one batch are
 * repeats too, which is exactly the case worth flagging.
 */
export function findRepeats(
  payments: RepeatCandidate[],
  decimals = DEFAULT_DECIMALS
): RepeatGroup[] {
  const groups = new Map<string, RepeatGroup>();
  for (const payment of payments) {
    const key = `${payment.address.toLowerCase()}|${amountKey(payment.amount, decimals)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.items.push(payment);
      if (payment.at < existing.firstAt) existing.firstAt = payment.at;
      if (payment.at > existing.lastAt) existing.lastAt = payment.at;
    } else {
      groups.set(key, {
        key,
        name: payment.name || payment.address,
        address: payment.address,
        amount: payment.amount,
        count: 1,
        items: [payment],
        total: payment.amount,
        firstAt: payment.at,
        lastAt: payment.at,
      });
    }
  }

  return [...groups.values()]
    .filter((g) => g.count > 1)
    .map((g) => {
      // Every item in a group carries the same amount, so the total is that
      // amount times the count — never a floating-point sum.
      let total = g.amount;
      try {
        total = formatAmount(parseAmount(g.amount, decimals) * BigInt(g.count), decimals);
      } catch {
        // an amount we cannot read is listed as it came, rather than guessed at
      }
      return { ...g, total };
    })
    .sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt));
}
