import { parseUnits, formatUnits } from "viem";

/**
 * Amount maths in integer base units, so a list always totals exactly.
 * TIP-20 tokens here use 6 decimals, matching the stablecoin convention.
 */

export class AmountError extends Error {}

const AMOUNT_RE = /^\d+(\.\d{1,6})?$/;

export const DEFAULT_DECIMALS = 6;

export function parseAmount(input: string, decimals = DEFAULT_DECIMALS): bigint {
  const s = String(input ?? "").trim();
  if (!AMOUNT_RE.test(s)) {
    throw new AmountError(`Enter an amount like 18 or 18.50`);
  }
  return parseUnits(s, decimals);
}

export function formatAmount(units: bigint, decimals = DEFAULT_DECIMALS): string {
  const raw = formatUnits(units, decimals);
  // Trim trailing zeros but keep at least two decimals for money display.
  const [whole, frac = ""] = raw.split(".");
  const trimmed = frac.replace(/0+$/, "");
  const padded = trimmed.length < 2 ? trimmed.padEnd(2, "0") : trimmed;
  return `${whole}.${padded}`;
}

export function isAmountInput(input: string, decimals = DEFAULT_DECIMALS): boolean {
  try {
    parseAmount(input, decimals);
    return true;
  } catch {
    return false;
  }
}

/**
 * A payment has to be worth something. Anything above zero is allowed, however
 * small — but zero and blanks are not payments.
 */
export function isPositiveAmount(input: string, decimals = DEFAULT_DECIMALS): boolean {
  try {
    return parseAmount(input, decimals) > 0n;
  } catch {
    return false;
  }
}

export function sumAmounts(inputs: string[], decimals = DEFAULT_DECIMALS): bigint {
  return inputs.reduce((acc, v) => acc + parseAmount(v, decimals), 0n);
}

export interface PayableRow {
  id: string;
  /** Display name; may be empty for a pasted address. */
  name: string;
  address: `0x${string}`;
  amount: string;
  reason?: string;
}

export interface PersonGroup {
  address: `0x${string}`;
  name: string;
  count: number;
  totalUnits: bigint;
  rows: PayableRow[];
}

/**
 * Group rows by recipient for the review screen. The same person may appear
 * on several rows (segmented payments); each row stays its own transfer.
 */
export function groupByRecipient(
  rows: PayableRow[],
  decimals = DEFAULT_DECIMALS
): PersonGroup[] {
  const byAddress = new Map<string, PersonGroup>();
  for (const row of rows) {
    const key = row.address.toLowerCase();
    const existing = byAddress.get(key);
    const units = parseAmount(row.amount, decimals);
    if (existing) {
      existing.count += 1;
      existing.totalUnits += units;
      existing.rows.push(row);
      if (!existing.name && row.name) existing.name = row.name;
    } else {
      byAddress.set(key, {
        address: row.address,
        name: row.name,
        count: 1,
        totalUnits: units,
        rows: [row],
      });
    }
  }
  return [...byAddress.values()];
}

export function listTotal(rows: PayableRow[], decimals = DEFAULT_DECIMALS): bigint {
  return rows.reduce((acc, r) => acc + parseAmount(r.amount, decimals), 0n);
}

export function isValidAddress(value: string): value is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value ?? "").trim());
}

export function shortAddress(address: string, lead = 6, tail = 4): string {
  const a = String(address ?? "");
  if (a.length <= lead + tail + 2) return a;
  return `${a.slice(0, lead)}…${a.slice(-tail)}`;
}

export function displayName(row: { name?: string; address: string }): string {
  return row.name?.trim() || shortAddress(row.address);
}
