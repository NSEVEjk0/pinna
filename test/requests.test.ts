import { describe, expect, it } from "vitest";
import {
  canTransition,
  cancel,
  findSettlement,
  markPaid,
  matchesRequest,
  pendingRequests,
  reopen,
  transition,
  type IncomingTransfer,
  type PaymentRequest,
} from "@/lib/requests";
import { encodeMemo } from "@/lib/memo";
import { parseAmount } from "@/lib/money";

const HOST = "0x9999999999999999999999999999999999999999" as `0x${string}`;
const JAKE = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const STRANGER = "0x3333333333333333333333333333333333333333" as `0x${string}`;

function request(partial: Partial<PaymentRequest> = {}): PaymentRequest {
  return {
    id: partial.id ?? "req_1",
    hostAddress: partial.hostAddress ?? HOST,
    partyName: partial.partyName ?? "Jake",
    partyAddress: partial.partyAddress ?? JAKE,
    amount: partial.amount ?? "18.00",
    reason: partial.reason ?? "Dinner",
    hasLink: partial.hasLink ?? true,
    hasPdf: partial.hasPdf ?? false,
    status: partial.status ?? "waiting",
    createdAt: partial.createdAt ?? "2026-09-01T10:00:00.000Z",
    ...partial,
  };
}

function transfer(partial: Partial<IncomingTransfer> = {}): IncomingTransfer {
  return {
    from: partial.from ?? JAKE,
    to: partial.to ?? HOST,
    amountUnits: partial.amountUnits ?? 18_000_000n,
    memo: partial.memo ?? null,
    txHash: partial.txHash ?? "0xabc",
    timestamp: partial.timestamp ?? Math.floor(Date.parse("2026-09-02T10:00:00Z") / 1000),
  };
}

const AMOUNTS = { expectedUnits: parseAmount("18.00") };

describe("request status transitions", () => {
  it("allows exactly the sensible moves", () => {
    expect(canTransition("waiting", "paid")).toBe(true);
    expect(canTransition("waiting", "cancelled")).toBe(true);
    expect(canTransition("cancelled", "waiting")).toBe(true);
    expect(canTransition("paid", "waiting")).toBe(false);
    expect(canTransition("paid", "cancelled")).toBe(false);
  });

  it("marks paid with the transfer that settled it", () => {
    const paid = markPaid(request(), { txHash: "0xdead", at: "2026-09-03T00:00:00.000Z" });
    expect(paid.status).toBe("paid");
    expect(paid.txHash).toBe("0xdead");
    expect(paid.paidAt).toBe("2026-09-03T00:00:00.000Z");
    expect(paid.settledBy).toBe("detected");
  });

  it("marks paid by hand without a hash", () => {
    const marked = markPaid(request(), { settledBy: "marked" });
    expect(marked.status).toBe("paid");
    expect(marked.txHash).toBeUndefined();
    expect(marked.settledBy).toBe("marked");
  });

  it("refuses to move a paid request", () => {
    const paid = markPaid(request());
    expect(() => transition(paid, "waiting")).toThrow();
    expect(() => cancel(paid)).toThrow();
  });

  it("cancels and reopens", () => {
    const cancelled = cancel(request());
    expect(cancelled.status).toBe("cancelled");
    const back = reopen(cancelled);
    expect(back.status).toBe("waiting");
    expect(back.txHash).toBeUndefined();
    expect(back.paidAt).toBeUndefined();
  });

  it("lists only waiting requests as pending", () => {
    const list = [request({ id: "a" }), markPaid(request({ id: "b" })), cancel(request({ id: "c" }))];
    expect(pendingRequests(list).map((r) => r.id)).toEqual(["a"]);
  });
});

describe("matching an incoming transfer to a request", () => {
  it("matches on the memo, whatever the amount", () => {
    const withMemo = transfer({ memo: encodeMemo("req_1"), amountUnits: 1n, from: STRANGER });
    expect(matchesRequest(request(), withMemo, AMOUNTS)).toBe(true);
  });

  it("does not match a memo belonging to a different request", () => {
    const otherRef = transfer({ memo: encodeMemo("req_OTHER") });
    expect(matchesRequest(request(), otherRef, AMOUNTS)).toBe(false);
  });

  it("matches without a memo when the payer, amount and time line up", () => {
    expect(matchesRequest(request(), transfer(), AMOUNTS)).toBe(true);
  });

  it("rejects a transfer from someone else with no memo", () => {
    expect(matchesRequest(request(), transfer({ from: STRANGER }), AMOUNTS)).toBe(false);
  });

  it("rejects an underpayment with no memo", () => {
    expect(matchesRequest(request(), transfer({ amountUnits: 17_000_000n }), AMOUNTS)).toBe(false);
  });

  it("rejects a transfer that predates the request", () => {
    const old = transfer({ timestamp: Math.floor(Date.parse("2026-08-01T00:00:00Z") / 1000) });
    expect(matchesRequest(request(), old, AMOUNTS)).toBe(false);
  });

  it("rejects a transfer that is not to the host", () => {
    expect(matchesRequest(request(), transfer({ to: STRANGER }), AMOUNTS)).toBe(false);
  });

  it("never settles an already paid request", () => {
    const paid = markPaid(request());
    expect(matchesRequest(paid, transfer({ memo: encodeMemo("req_1") }), AMOUNTS)).toBe(false);
  });

  it("picks the earliest matching transfer", () => {
    const transfers = [
      transfer({ txHash: "0xlater", timestamp: 2_000 }),
      transfer({ from: STRANGER, txHash: "0xearlier", memo: encodeMemo("req_1"), timestamp: 1_000 }),
      transfer({ txHash: "0xother", from: STRANGER, timestamp: 3_000 }),
    ];
    const found = findSettlement(request(), transfers, AMOUNTS);
    expect(found?.txHash).toBe("0xearlier");
  });

  it("finds nothing when nothing matches", () => {
    expect(findSettlement(request(), [transfer({ from: STRANGER })], AMOUNTS)).toBeNull();
  });
});
