import { describe, expect, it } from "vitest";
import {
  fromTransferJson,
  toTransferJson,
  transferToIncoming,
  transfersToIncoming,
  transfersFromJson,
} from "@/lib/tempoApi";
import { decodeMemo } from "@/lib/memo";

const SENDER = "0x1111111111111111111111111111111111111111";
const RECIPIENT = "0x2222222222222222222222222222222222222222";

function record(partial: Record<string, unknown> = {}) {
  return {
    sender: SENDER,
    recipient: RECIPIENT,
    sourceAmount: { baseUnits: "18000000", decimals: 6 },
    timestamp: "2026-09-23T08:45:44.000Z",
    transactionHash: "0x36403918902f60fd512954da892baca30227c9d14019712635915747b1cfbf89",
    ...partial,
  };
}

describe("reading history from the Tempo API", () => {
  it("maps a transfer onto the shape Pinna reads everywhere else", () => {
    const transfer = transferToIncoming(record({ memo: "PINNA:req_1" }));
    expect(transfer?.from).toBe(SENDER);
    expect(transfer?.to).toBe(RECIPIENT);
    expect(transfer?.amountUnits).toBe(18_000_000n);
    expect(transfer?.txHash).toBe(record().transactionHash);
    expect(transfer?.timestamp).toBe(Math.floor(Date.parse("2026-09-23T08:45:44.000Z") / 1000));
  });

  it("re-encodes the decoded memo so it reads like a transfer memo", () => {
    // The API hands memos back as text; Pinna matches on the bytes the
    // transfer carried, so the text is put back into that form.
    const transfer = transferToIncoming(record({ memo: "PINNA:req_9" }));
    expect(decodeMemo(transfer?.memo)).toBe("req_9");
  });

  it("passes a hex memo through untouched", () => {
    const transfer = transferToIncoming(record({ memo: "0x50494e4e41" }));
    expect(transfer?.memo).toBe("0x50494e4e41");
  });

  it("leaves a transfer with no memo without one", () => {
    expect(transferToIncoming(record())?.memo).toBeNull();
  });

  it("refuses a record missing what a payment must have", () => {
    expect(transferToIncoming({ sender: SENDER, recipient: RECIPIENT } as never)).toBeNull();
    expect(transferToIncoming({} as never)).toBeNull();
    expect(transferToIncoming(record({ transactionHash: undefined }) as never)).toBeNull();
    expect(
      transferToIncoming(record({ sourceAmount: { baseUnits: "not-a-number" } }) as never)
    ).toBeNull();
  });

  it("keeps an amount no floating point could hold exact", () => {
    const huge = "123456789012345678901234567890";
    const transfer = transferToIncoming(record({ sourceAmount: { baseUnits: huge } }) as never);
    expect(transfer?.amountUnits).toBe(BigInt(huge));
  });

  it("drops malformed entries rather than guessing at them", () => {
    expect(transfersToIncoming([{ sender: SENDER }, record()])).toHaveLength(1);
    expect(transfersToIncoming("not an array")).toHaveLength(0);
  });
});

describe("transfers over the wire", () => {
  it("carries base units as text, never as a number", () => {
    const json = toTransferJson({
      from: SENDER as `0x${string}`,
      to: RECIPIENT as `0x${string}`,
      amountUnits: 18_000_000n,
      memo: null,
      txHash: "0xabc",
    });
    expect(json.amountUnits).toBe("18000000");
    // JSON has no bigint, so the value has to survive as a string.
    expect(JSON.parse(JSON.stringify(json)).amountUnits).toBe("18000000");
    expect(fromTransferJson(json)?.amountUnits).toBe(18_000_000n);
  });

  it("reads a malformed wire transfer as nothing", () => {
    expect(fromTransferJson({ from: SENDER })).toBeNull();
    expect(fromTransferJson({ from: SENDER, to: RECIPIENT, amountUnits: "x", txHash: "0x" })).toBeNull();
    expect(transfersFromJson([{ from: SENDER }, toTransferJson({
      from: SENDER as `0x${string}`,
      to: RECIPIENT as `0x${string}`,
      amountUnits: 1n,
      memo: null,
      txHash: "0x1",
    })])).toHaveLength(1);
  });
});
