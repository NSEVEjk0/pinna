import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The watcher reads the chain, not the index — so the chain read is what the
 * test stands in for.
 */
const { readChain } = vi.hoisted(() => ({ readChain: vi.fn() }));
vi.mock("@/lib/chain", () => ({
  readIncomingTransfers: readChain,
  RECENT_LOOKBACK: 50_000n,
}));

import { subscribe } from "@/lib/server/watchHub";

const TOKEN = "0x20c0000000000000000000000000000000000000";
const HOST = "0x9999999999999999999999999999999999999999";
const PAYER = "0x1111111111111111111111111111111111111111";

function transfer(hash: string) {
  return {
    from: PAYER,
    to: HOST,
    amountUnits: 18_000_000n,
    memo: null,
    txHash: hash,
    logId: `${hash}-0`,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  readChain.mockReset();
  readChain.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

const key = { chainId: 42431, token: TOKEN, address: HOST, role: "recipient" as const };

describe("watching for payments as they land", () => {
  it("seeds on the first poll, then emits only what is new", async () => {
    readChain.mockResolvedValueOnce([transfer("0xaaa")]);
    readChain.mockResolvedValueOnce([transfer("0xaaa"), transfer("0xbbb")]);

    const seen: string[] = [];
    const unsubscribe = subscribe(key, (transfers) => {
      seen.push(...transfers.map((t) => t.txHash));
    });

    await vi.advanceTimersByTimeAsync(0);
    // The first poll records what is already there rather than replaying it —
    // the app's own mount sync covers history.
    expect(seen).toEqual([]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(seen).toEqual(["0xbbb"]);

    // Nothing new on the next tick means nothing is pushed.
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen).toEqual(["0xbbb"]);

    unsubscribe();
  });

  it("polls about once a second, so a payment settles promptly", async () => {
    const unsubscribe = subscribe(key, () => {});
    await vi.advanceTimersByTimeAsync(0);
    const afterFirst = readChain.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3000);
    // Three more ticks in three seconds — not one.
    expect(readChain.mock.calls.length).toBe(afterFirst + 3);
    unsubscribe();
  });

  it("shares one poller between listeners on the same address", async () => {
    readChain.mockResolvedValueOnce([transfer("0xaaa")]);
    readChain.mockResolvedValueOnce([transfer("0xaaa"), transfer("0xbbb")]);

    const first: string[] = [];
    const second: string[] = [];
    const offFirst = subscribe(key, (t) => first.push(...t.map((x) => x.txHash)));
    const offSecond = subscribe(key, (t) => second.push(...t.map((x) => x.txHash)));

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);

    // Both listeners hear about the same new transfer, from one poll.
    expect(first).toEqual(["0xbbb"]);
    expect(second).toEqual(["0xbbb"]);
    expect(readChain.mock.calls.length).toBe(2);

    offFirst();
    offSecond();
  });

  it("keeps quiet and retries when the chain cannot be read", async () => {
    readChain.mockRejectedValue(new Error("rpc down"));
    const seen: string[] = [];
    const unsubscribe = subscribe(key, (t) => seen.push(...t.map((x) => x.txHash)));

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(3000);

    // A failed read is a delay, never a payment.
    expect(seen).toEqual([]);
    unsubscribe();
  });
});
