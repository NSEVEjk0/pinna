import { describe, expect, it } from "vitest";
import {
  formatAmount,
  groupByRecipient,
  isAmountInput,
  isValidAddress,
  listTotal,
  parseAmount,
  shortAddress,
  sumAmounts,
  type PayableRow,
} from "@/lib/money";

function row(partial: Partial<PayableRow>): PayableRow {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2, 8),
    name: partial.name ?? "",
    address: (partial.address ?? "0x0000000000000000000000000000000000000001") as `0x${string}`,
    amount: partial.amount ?? "0",
    reason: partial.reason,
  };
}

describe("amounts", () => {
  it("parses decimals into base units", () => {
    expect(parseAmount("18")).toBe(18_000_000n);
    expect(parseAmount("18.5")).toBe(18_500_000n);
    expect(parseAmount("0.000001")).toBe(1n);
    expect(parseAmount(" 12.34 ")).toBe(12_340_000n);
  });

  it("rejects anything that is not a plain decimal", () => {
    expect(isAmountInput("")).toBe(false);
    expect(isAmountInput("abc")).toBe(false);
    expect(isAmountInput("-5")).toBe(false);
    expect(isAmountInput("1.2345678")).toBe(false);
    expect(isAmountInput("18.50")).toBe(true);
  });

  it("formats base units back to money, keeping two decimals", () => {
    expect(formatAmount(18_000_000n)).toBe("18.00");
    expect(formatAmount(18_500_000n)).toBe("18.50");
    expect(formatAmount(1n)).toBe("0.000001");
    expect(formatAmount(0n)).toBe("0.00");
  });

  it("sums a list exactly, with no floating point drift", () => {
    const rows = [row({ amount: "0.1" }), row({ amount: "0.2" })];
    expect(listTotal(rows)).toBe(300_000n);
    expect(formatAmount(listTotal(rows))).toBe("0.30");

    const awkward = [row({ amount: "18.33" }), row({ amount: "18.33" }), row({ amount: "18.34" })];
    expect(formatAmount(listTotal(awkward))).toBe("55.00");
    expect(sumAmounts(["18.33", "18.33", "18.34"])).toBe(55_000_000n);
  });
});

describe("grouping for review", () => {
  it("groups the same person across rows but keeps every row separate", () => {
    const jake = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const rows = [
      row({ name: "Jake", address: jake, amount: "25.00", reason: "Friday" }),
      row({ name: "Jake", address: jake, amount: "25.00", reason: "Saturday" }),
      row({ name: "Jake", address: jake, amount: "25.00", reason: "Sunday" }),
      row({ name: "Sophia", address: "0x2222222222222222222222222222222222222222", amount: "25.00" }),
    ];
    const groups = groupByRecipient(rows);
    expect(groups).toHaveLength(2);
    const jakeGroup = groups.find((g) => g.name === "Jake")!;
    expect(jakeGroup.count).toBe(3);
    expect(formatAmount(jakeGroup.totalUnits)).toBe("75.00");
    expect(jakeGroup.rows).toHaveLength(3);
  });

  it("treats the same address in different case as one person", () => {
    const rows = [
      row({ address: "0xAbC0000000000000000000000000000000000001" }),
      row({ address: "0xabc0000000000000000000000000000000000001" }),
    ];
    expect(groupByRecipient(rows)).toHaveLength(1);
  });
});

describe("addresses", () => {
  it("accepts only a full 0x address", () => {
    expect(isValidAddress("0x1111111111111111111111111111111111111111")).toBe(true);
    expect(isValidAddress("0x111")).toBe(false);
    expect(isValidAddress("1111111111111111111111111111111111111111")).toBe(false);
  });

  it("shortens for display without losing the ends", () => {
    expect(shortAddress("0x1111111111111111111111111111111111111111")).toBe("0x1111…1111");
  });
});
