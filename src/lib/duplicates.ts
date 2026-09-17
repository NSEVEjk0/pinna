import { parseAmount } from "./money";

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

function amountKey(amount: string): string {
  try {
    return parseAmount(amount).toString();
  } catch {
    return amount.trim();
  }
}

/**
 * Group payments that repeat. Two payments count as a repeat when they go to
 * the same address for the same amount; rows sent inside one batch are
 * repeats too, which is exactly the case worth flagging.
 */
export function findRepeats(payments: RepeatCandidate[]): RepeatGroup[] {
  const groups = new Map<string, RepeatGroup>();
  for (const payment of payments) {
    const key = `${payment.address.toLowerCase()}|${amountKey(payment.amount)}`;
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
    .map((g) => ({
      ...g,
      total: sumOf(g.items.map((i) => i.amount)),
    }))
    .sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt));
}

function sumOf(amounts: string[]): string {
  let units = 0n;
  for (const a of amounts) {
    try {
      const [whole, frac = ""] = a.split(".");
      units += BigInt(whole || "0") * 1_000_000n + BigInt((frac + "000000").slice(0, 6));
    } catch {
      // skip an amount we cannot read
    }
  }
  const whole = units / 1_000_000n;
  const frac = (units % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}.${frac.length < 2 ? frac.padEnd(2, "0") : frac}`;
}
