import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribe } from "@/lib/server/watchHub";

const TOKEN = "0x20c0000000000000000000000000000000000000";
const HOST = "0x9999999999999999999999999999999999999999";

function record(hash: string, memo?: string) {
  return {
    id: `${hash}-0`,
    sender: "0x1111111111111111111111111111111111111111",
    recipient: HOST,
    sourceAmount: { baseUnits: "18000000", decimals: 6 },
    timestamp: "2026-09-25T10:00:00.000Z",
    transactionHash: hash,
    ...(memo ? { memo } : {}),
  };
}

let pages: unknown[][] = [];
let calls = 0;

beforeEach(() => {
  vi.useFakeTimers();
  calls = 0;
  pages = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const page = pages[Math.min(calls, pages.length - 1)] ?? [];
      calls += 1;
      return new Response(JSON.stringify({ data: page, nextCursor: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    })
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const key = { chainId: 42431, token: TOKEN, address: HOST, role: "recipient" as const };

describe("watching for payments as they land", () => {
  it("seeds on the first poll, then emits only what is new", async () => {
    pages = [
      [record("0xaaa", "PINNA:req_1")],
      [record("0xaaa", "PINNA:req_1"), record("0xbbb", "PINNA:req_2")],
    ];
    const seen: string[] = [];
    const unsubscribe = subscribe(key, (transfers) => {
      seen.push(...transfers.map((t) => t.txHash));
    });

    await vi.advanceTimersByTimeAsync(0);
    // The first poll records what is already there rather than replaying it —
    // the app's own mount sync covers history.
    expect(seen).toEqual([]);

    await vi.advanceTimersByTimeAsync(2000);
    expect(seen).toEqual(["0xbbb"]);

    // Nothing new on the next tick means nothing is pushed.
    await vi.advanceTimersByTimeAsync(2000);
    expect(seen).toEqual(["0xbbb"]);

    unsubscribe();
  });

  it("shares one poller between listeners on the same address", async () => {
    pages = [[record("0xaaa")], [record("0xaaa"), record("0xbbb")]];
    const first: string[] = [];
    const second: string[] = [];

    const offFirst = subscribe(key, (t) => first.push(...t.map((x) => x.txHash)));
    const offSecond = subscribe(key, (t) => second.push(...t.map((x) => x.txHash)));

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2000);

    // Both listeners hear about the same new transfer, from one poll.
    expect(first).toEqual(["0xbbb"]);
    expect(second).toEqual(["0xbbb"]);

    offFirst();
    offSecond();
  });

  it("keeps quiet and retries when the index cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502 })));
    const seen: string[] = [];
    const unsubscribe = subscribe(key, (t) => seen.push(...t.map((x) => x.txHash)));

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(4000);

    // A failed read is a delay, never a payment.
    expect(seen).toEqual([]);
    unsubscribe();
  });
});
