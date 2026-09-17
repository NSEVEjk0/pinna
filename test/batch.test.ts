import { describe, expect, it } from "vitest";
import { decodeFunctionData, parseUnits, pad, stringToHex } from "viem";
import { Abis } from "viem/tempo";
import { buildBatch, batchSize } from "@/lib/batch";
import { decodeMemo, encodeMemo, isPinnaMemo, MEMO_BYTES, MEMO_PREFIX, newReference } from "@/lib/memo";
import type { PayableRow } from "@/lib/money";

const TOKEN = "0x20c0000000000000000000000000000000000000" as `0x${string}`;
const JAKE = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const SOPHIA = "0x2222222222222222222222222222222222222222" as `0x${string}`;

function row(partial: Partial<PayableRow>): PayableRow {
  return {
    id: partial.id ?? "row_x",
    name: partial.name ?? "",
    address: partial.address ?? JAKE,
    amount: partial.amount ?? "1.00",
    reason: partial.reason,
  };
}

describe("memos", () => {
  it("encodes a reference into exactly 32 bytes", () => {
    const memo = encodeMemo("req_abc123");
    expect((memo.length - 2) / 2).toBe(MEMO_BYTES);
    expect(memo.length).toBe(66);
  });

  it("round-trips the reference", () => {
    const ref = newReference("req");
    expect(decodeMemo(encodeMemo(ref))).toBe(ref);
  });

  it("decodes a reference written by the docs' own encoding", () => {
    // pad(stringToHex("PINNA:req_1"), { size: 32 }) is what the docs show for memos
    const memo = encodeMemo("req_1");
    expect(decodeMemo(memo)).toBe("req_1");
  });

  it("returns null for a memo that is not ours", () => {
    // A memo someone else wrote: readable text, but no Pinna prefix.
    const foreign = pad(stringToHex("INV-12345"), { size: 32, dir: "right" });
    expect(decodeMemo(foreign)).toBeNull();
    expect(isPinnaMemo(foreign)).toBe(false);

    const other = "0x" + "ab".repeat(32);
    expect(decodeMemo(other)).toBeNull();
    expect(decodeMemo(undefined)).toBeNull();
  });

  it("truncates rather than overflowing a long reference", () => {
    const long = "x".repeat(80);
    const memo = encodeMemo(long);
    expect(memo.length).toBe(66);
    expect(decodeMemo(memo)?.length).toBe(MEMO_BYTES - 1 - MEMO_PREFIX.length);
  });
});

describe("batch building", () => {
  it("makes one memoed call per row, in order", () => {
    const rows = [
      row({ id: "r1", name: "Jake", address: JAKE, amount: "25.00", reason: "Friday" }),
      row({ id: "r2", name: "Jake", address: JAKE, amount: "25.00", reason: "Saturday" }),
      row({ id: "r3", name: "Sophia", address: SOPHIA, amount: "10.50" }),
    ];
    const batch = buildBatch(rows, { token: TOKEN });
    expect(batchSize(batch)).toBe(3);

    batch.calls.forEach((call, i) => {
      expect(call.to).toBe(TOKEN);
      const decoded = decodeFunctionData({ abi: Abis.tip20, data: call.data });
      expect(decoded.functionName).toBe("transferWithMemo");
      const [to, amount, memo] = decoded.args as unknown as [string, bigint, string];
      expect(to.toLowerCase()).toBe(rows[i].address.toLowerCase());
      expect(amount).toBe(parseUnits(rows[i].amount, 6));
      expect(decodeMemo(memo)).toBe(rows[i].id);
    });
  });

  it("keeps two payments to the same person as two separate transfers", () => {
    const rows = [row({ id: "a", address: JAKE, amount: "5" }), row({ id: "b", address: JAKE, amount: "5" })];
    const batch = buildBatch(rows, { token: TOKEN });
    expect(batch.calls).toHaveLength(2);
    expect(batch.calls[0].data).not.toBe(batch.calls[1].data);
  });

  it("honours a reference override, as when paying a request", () => {
    const batch = buildBatch([row({ id: "ignored" })], {
      token: TOKEN,
      referenceFor: () => "req_payme",
    });
    const decoded = decodeFunctionData({ abi: Abis.tip20, data: batch.calls[0].data });
    const memo = (decoded.args as unknown as [string, bigint, string])[2];
    expect(decodeMemo(memo)).toBe("req_payme");
  });
});
