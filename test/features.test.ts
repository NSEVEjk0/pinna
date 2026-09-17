import { describe, expect, it } from "vitest";
import { findRepeats, type RepeatCandidate } from "@/lib/duplicates";
import { isPositiveAmount, groupByRecipient, formatAmount, type PayableRow } from "@/lib/money";
import { normalizeAlias, requestGreeting } from "@/lib/profile";
import { paymentConfirmation, reminderMessage, draftMessage } from "@/lib/paylink";
import { explorerForRecord } from "@/lib/tempo";
import { TEMPO_MAINNET, TEMPO_TESTNET } from "@/lib/tempo";

function payment(partial: Partial<RepeatCandidate>): RepeatCandidate {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2, 8),
    name: partial.name ?? "Jake",
    address: partial.address ?? "0x1111111111111111111111111111111111111111",
    amount: partial.amount ?? "25.00",
    reason: partial.reason,
    txHash: partial.txHash,
    at: partial.at ?? "2026-09-10T10:00:00.000Z",
  };
}

describe("repeated payments", () => {
  it("flags the same person paid the same amount more than once", () => {
    const repeats = findRepeats([
      payment({ id: "a", amount: "25.00" }),
      payment({ id: "b", amount: "25.00" }),
      payment({ id: "c", amount: "10.00" }),
    ]);
    expect(repeats).toHaveLength(1);
    expect(repeats[0].count).toBe(2);
    expect(repeats[0].total).toBe("50.00");
    expect(repeats[0].name).toBe("Jake");
  });

  it("counts a hundred accidental payments", () => {
    const many = Array.from({ length: 100 }, (_, i) => payment({ id: `p${i}` }));
    const repeats = findRepeats(many);
    expect(repeats[0].count).toBe(100);
    expect(repeats[0].total).toBe("2500.00");
  });

  it("does not flag different amounts to the same person", () => {
    expect(findRepeats([payment({ amount: "25.00" }), payment({ amount: "26.00" })])).toHaveLength(0);
  });

  it("does not flag the same amount to different people", () => {
    const repeats = findRepeats([
      payment({ address: "0x1111111111111111111111111111111111111111" }),
      payment({ address: "0x2222222222222222222222222222222222222222" }),
    ]);
    expect(repeats).toHaveLength(0);
  });

  it("orders the worst repeats first and keeps the window", () => {
    const repeats = findRepeats([
      payment({ id: "a", at: "2026-09-01T00:00:00.000Z" }),
      payment({ id: "b", at: "2026-09-05T00:00:00.000Z" }),
      payment({ id: "c", amount: "5.00", at: "2026-09-02T00:00:00.000Z" }),
      payment({ id: "d", amount: "5.00", at: "2026-09-03T00:00:00.000Z" }),
      payment({ id: "e", amount: "5.00", at: "2026-09-04T00:00:00.000Z" }),
    ]);
    expect(repeats[0].count).toBe(3);
    expect(repeats[0].amount).toBe("5.00");
    expect(repeats[1].count).toBe(2);
    expect(repeats[1].firstAt).toBe("2026-09-01T00:00:00.000Z");
    expect(repeats[1].lastAt).toBe("2026-09-05T00:00:00.000Z");
  });
});

describe("amounts must be worth something", () => {
  it("rejects zero and blanks", () => {
    expect(isPositiveAmount("0")).toBe(false);
    expect(isPositiveAmount("0.00")).toBe(false);
    expect(isPositiveAmount("0.000000")).toBe(false);
    expect(isPositiveAmount("")).toBe(false);
    expect(isPositiveAmount("abc")).toBe(false);
  });

  it("accepts anything above zero, however small", () => {
    expect(isPositiveAmount("0.000001")).toBe(true);
    expect(isPositiveAmount("0.01")).toBe(true);
    expect(isPositiveAmount("1")).toBe(true);
    expect(isPositiveAmount("999999.99")).toBe(true);
  });

  it("a zero row is not payable but a tiny one is", () => {
    const base = { id: "r", name: "Jake", address: "0x1111111111111111111111111111111111111111" as `0x${string}` };
    const rows: PayableRow[] = [
      { ...base, id: "z", amount: "0.00" },
      { ...base, id: "t", amount: "0.000001" },
    ];
    const payable = groupByRecipient([
      { ...rows[1], reason: undefined },
    ]);
    expect(payable[0].totalUnits).toBe(1n);
  });
});

describe("alias and greetings", () => {
  it("normalises a name", () => {
    expect(normalizeAlias("  Jake   B  ")).toBe("Jake B");
    expect(normalizeAlias("")).toBe("");
    expect(normalizeAlias("x".repeat(80)).length).toBe(40);
  });

  it("opens a request with the name", () => {
    expect(requestGreeting("Jake", "dinner")).toBe(
      "Hey, it's me Jake. I'm requesting payment for dinner."
    );
    expect(requestGreeting("", "dinner")).toBe(
      "Hey, it's me me. I'm requesting payment for dinner."
    );
  });
});

describe("payer messages", () => {
  it("names the requester in the draft message", () => {
    const text = draftMessage({
      hostName: "Ckay",
      partyName: "John",
      amount: "0.2",
      reason: "Breakfast",
      url: "https://pinna.app/pay/req_1?d=x",
      tokenSymbol: "pathUSD",
    });
    expect(text).toContain("Hi John — it's me Ckay.");
    expect(text).toContain("Please pay up your bill of 0.2 pathUSD for Breakfast.");
    expect(text).toContain("https://pinna.app/pay/req_1?d=x");
  });

  it("writes a confirmation naming the requester with the full hash", () => {
    const text = paymentConfirmation({
      payerName: "Stephanie",
      hostName: "Ckay",
      amount: "0.2",
      reason: "Breakfast",
      tokenSymbol: "pathUSD",
      txHash: "0xabc123",
      explorerUrl: "https://explore.testnet.tempo.xyz/tx/0xabc123",
      reference: "req_123",
    });
    expect(text).toContain("Hello Ckay — Stephanie here.");
    expect(text).toContain("completed my payment of 0.2 pathUSD for Breakfast");
    expect(text).toContain("Transaction hash: 0xabc123");
    expect(text).toContain("https://explore.testnet.tempo.xyz/tx/0xabc123");
    expect(text).toContain("req_123");
  });

  it("writes a reminder for requests with no link", () => {
    const text = reminderMessage({
      hostName: "Jake",
      partyName: "Franklin",
      amount: "18.00",
      reason: "Dinner",
      tokenSymbol: "pathUSD",
      reference: "req_9",
    });
    expect(text).toContain("Jake");
    expect(text).toContain("reminder");
    expect(text).toContain("req_9");
    expect(text).not.toContain("http");
  });

  it("keeps totals exact when a repeat is summed", () => {
    expect(formatAmount(0n)).toBe("0.00");
    expect(isPositiveAmount(formatAmount(0n))).toBe(false);
  });
});

describe("transaction links follow the chain they happened on", () => {
  it("sends a mainnet hash to the mainnet explorer even from the testnet view", () => {
    const url = explorerForRecord({ chainId: 4217 }, TEMPO_TESTNET, "0xdead");
    expect(url).toBe("https://explore.tempo.xyz/tx/0xdead");
  });

  it("sends a testnet hash to the testnet explorer from the mainnet view", () => {
    const url = explorerForRecord({ chainId: 42431 }, TEMPO_MAINNET, "0xbeef");
    expect(url).toBe("https://explore.testnet.tempo.xyz/tx/0xbeef");
  });

  it("prefers an explorer recorded on the row itself", () => {
    const url = explorerForRecord(
      { explorerUrl: "https://explore.tempo.xyz/" },
      TEMPO_TESTNET,
      "0x1"
    );
    expect(url).toBe("https://explore.tempo.xyz/tx/0x1");
  });

  it("falls back to the current network when nothing was recorded", () => {
    expect(explorerForRecord({}, TEMPO_TESTNET, "0x2")).toBe(
      "https://explore.testnet.tempo.xyz/tx/0x2"
    );
  });
});
