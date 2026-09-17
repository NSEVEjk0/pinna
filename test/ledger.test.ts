import { describe, expect, it } from "vitest";
import {
  findPossibleMatch,
  findSettlement,
  matchesRequest,
  type IncomingTransfer,
  type PaymentRequest,
} from "@/lib/requests";
import { buildLedger, sentEntries, receivedEntries } from "@/lib/ledger";
import { encodeMemo } from "@/lib/memo";
import { parseAmount } from "@/lib/money";

const HOST = "0x9999999999999999999999999999999999999999" as `0x${string}`;
const JAKE = "0x1111111111111111111111111111111111111111" as `0x${string}`;

function request(partial: Partial<PaymentRequest> = {}): PaymentRequest {
  return {
    id: "req_1",
    hostAddress: HOST,
    partyName: "Jake",
    partyAddress: JAKE,
    amount: "0.20",
    reason: "Breakfast",
    hasLink: true,
    hasPdf: false,
    status: "waiting",
    createdAt: "2026-09-16T10:00:00.000Z",
    ...partial,
  };
}

function transfer(partial: Partial<IncomingTransfer> = {}): IncomingTransfer {
  return {
    from: JAKE,
    to: HOST,
    amountUnits: 200000n,
    memo: null,
    txHash: "0xabc",
    timestamp: Math.floor(Date.parse("2026-09-16T11:00:00Z") / 1000),
    ...partial,
  };
}

const AMOUNTS = { expectedUnits: parseAmount("0.20") };

describe("only a matching reference settles a request", () => {
  it("settles when the memo carries the request id", () => {
    expect(matchesRequest(request(), transfer({ memo: encodeMemo("req_1") }), AMOUNTS)).toBe(true);
  });

  it("refuses a transfer with no memo, however well it fits", () => {
    // Right person, right amount, right time — but nothing saying what it is for.
    expect(matchesRequest(request(), transfer({ memo: null }), AMOUNTS)).toBe(false);
  });

  it("refuses a memo belonging to a different request", () => {
    expect(matchesRequest(request(), transfer({ memo: encodeMemo("req_OTHER") }), AMOUNTS)).toBe(
      false
    );
  });

  it("refuses an unrelated transfer that happens to be large enough", () => {
    const old = transfer({
      amountUnits: 70_000_000n, // 70.00, nothing to do with a 0.20 request
      timestamp: Math.floor(Date.parse("2026-08-01T00:00:00Z") / 1000),
    });
    expect(matchesRequest(request(), old, AMOUNTS)).toBe(false);
  });

  it("never settles twice", () => {
    const paid = { ...request(), status: "paid" as const };
    expect(matchesRequest(paid, transfer({ memo: encodeMemo("req_1") }), AMOUNTS)).toBe(false);
  });

  it("finds the settlement among many transfers", () => {
    const transfers = [
      transfer({ txHash: "0xa", memo: null }),
      transfer({ txHash: "0xb", memo: encodeMemo("req_1") }),
    ];
    expect(findSettlement(request(), transfers, AMOUNTS)?.txHash).toBe("0xb");
  });
});

describe("possible matches are offered, never assumed", () => {
  it("offers a transfer with no memo that fits the person, amount and time", () => {
    const maybe = findPossibleMatch(request(), [transfer({ memo: null })], AMOUNTS);
    expect(maybe?.txHash).toBe("0xabc");
  });

  it("does not offer one from someone else", () => {
    const stranger = transfer({ from: "0x3333333333333333333333333333333333333333" });
    expect(findPossibleMatch(request(), [stranger], AMOUNTS)).toBeNull();
  });

  it("does not offer one from before the request", () => {
    const old = transfer({ timestamp: Math.floor(Date.parse("2026-08-01T00:00:00Z") / 1000) });
    expect(findPossibleMatch(request(), [old], AMOUNTS)).toBeNull();
  });

  it("does not offer one for less than the amount", () => {
    expect(findPossibleMatch(request(), [transfer({ amountUnits: 1n })], AMOUNTS)).toBeNull();
  });

  it("does not offer a memoed transfer — those are settled or rejected outright", () => {
    expect(
      findPossibleMatch(request(), [transfer({ memo: encodeMemo("req_OTHER") })], AMOUNTS)
    ).toBeNull();
  });

  it("does not offer anything for a request that is already settled", () => {
    const paid = { ...request(), status: "paid" as const };
    expect(findPossibleMatch(paid, [transfer({ memo: null })], AMOUNTS)).toBeNull();
  });
});

describe("the ledger, built from chain transfers", () => {
  const base = {
    address: HOST,
    decimals: 6,
    tokenSymbol: "pathUSD",
    chainId: 42431,
    explorerUrl: "https://explore.testnet.tempo.xyz",
    nameFor: (addr: string) => (addr.toLowerCase() === JAKE.toLowerCase() ? "Jake" : undefined),
  };

  it("marks outgoing transfers paid and incoming ones received", () => {
    const entries = buildLedger({
      ...base,
      sent: [],
      requests: [],
      transfers: [
        { from: HOST, to: JAKE, amountUnits: 500000n, memo: null, txHash: "0xout", timestamp: 1000 },
        { from: JAKE, to: HOST, amountUnits: 200000n, memo: null, txHash: "0xin", timestamp: 2000 },
      ],
    });
    expect(sentEntries(entries)).toHaveLength(1);
    expect(receivedEntries(entries)).toHaveLength(1);
    expect(sentEntries(entries)[0].status).toBe("paid");
    expect(receivedEntries(entries)[0].status).toBe("received");
    expect(sentEntries(entries)[0].amount).toBe("0.50");
    expect(sentEntries(entries)[0].name).toBe("Jake");
  });

  it("carries the hash and the reference onto the entry", () => {
    const [entry] = buildLedger({
      ...base,
      sent: [],
      requests: [request()],
      transfers: [
        {
          from: JAKE,
          to: HOST,
          amountUnits: 200000n,
          memo: encodeMemo("req_1"),
          txHash: "0xpaid",
          timestamp: 3000,
        },
      ],
    });
    expect(entry.txHash).toBe("0xpaid");
    expect(entry.reference).toBe("req_1");
    expect(entry.status).toBe("received");
    expect(entry.reason).toBe("Breakfast");
    expect(entry.name).toBe("Jake");
    expect(entry.at).toContain("1970"); // timestamp 3000 seconds
  });

  it("uses the local list to name and explain a payment that had no memo", () => {
    const [entry] = buildLedger({
      ...base,
      requests: [],
      sent: [
        {
          txHash: "0xlist",
          at: "2026-09-16T12:00:00.000Z",
          rows: [{ name: "Jake", address: JAKE, amount: "0.50", reason: "Friday payroll" }],
        },
      ],
      transfers: [
        { from: HOST, to: JAKE, amountUnits: 500000n, memo: null, txHash: "0xlist", timestamp: 4000 },
      ],
    });
    expect(entry.reason).toBe("Friday payroll");
    expect(entry.name).toBe("Jake");
  });

  it("keeps a settled request even when the transfer predates the window", () => {
    const entries = buildLedger({
      ...base,
      transfers: [],
      sent: [],
      requests: [
        {
          ...request(),
          status: "paid",
          txHash: "0xold",
          paidAt: "2026-09-16T11:30:00.000Z",
          settledBy: "detected",
        },
      ],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].txHash).toBe("0xold");
    expect(entries[0].fromChain).toBe(false);
  });

  it("does not duplicate a request that the chain already reported", () => {
    const entries = buildLedger({
      ...base,
      sent: [],
      requests: [{ ...request(), status: "paid", txHash: "0xpaid", paidAt: "2026-09-16T11:05:00.000Z" }],
      transfers: [
        {
          from: JAKE,
          to: HOST,
          amountUnits: 200000n,
          memo: encodeMemo("req_1"),
          txHash: "0xpaid",
          timestamp: 5000,
        },
      ],
    });
    expect(entries.filter((e) => e.reference === "req_1")).toHaveLength(1);
  });
});
