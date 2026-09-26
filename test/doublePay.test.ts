import { describe, expect, it } from "vitest";
import { findDuplicateReferences, settlingTx } from "@/lib/doublePay";

const row = (reference: string | null, txHash: string, amount = "18.00") => ({
  reference,
  txHash,
  amount,
});

describe("paying the same reference twice", () => {
  it("finds a reference carried by two different transactions", () => {
    const found = findDuplicateReferences([
      row("req_1", "0xaaa"),
      row("req_1", "0xbbb"),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].reference).toBe("req_1");
    expect(found[0].count).toBe(2);
    expect(found[0].txHashes).toEqual(["0xaaa", "0xbbb"]);
  });

  it("does not flag a reference that appears once per transaction", () => {
    // A batch paying three rows to one person carries three different
    // references, which is not a repeat.
    expect(
      findDuplicateReferences([
        row("row_a", "0xaaa"),
        row("row_b", "0xaaa"),
        row("row_c", "0xaaa"),
      ])
    ).toHaveLength(0);
  });

  it("counts the same transaction once", () => {
    expect(findDuplicateReferences([row("req_1", "0xaaa"), row("req_1", "0xaaa")])).toHaveLength(0);
  });

  it("ignores transfers with no reference", () => {
    expect(findDuplicateReferences([row(null, "0xaaa"), row(null, "0xbbb")])).toHaveLength(0);
  });

  it("is not fooled by the payer being a different wallet", () => {
    // The row carries no payer — the reference alone decides.
    const found = findDuplicateReferences([row("req_1", "0xaaa"), row("req_1", "0xbbb")]);
    expect(found[0].count).toBe(2);
  });

  it("puts the worst first", () => {
    const found = findDuplicateReferences([
      row("req_1", "0xaaa"),
      row("req_1", "0xbbb"),
      row("req_2", "0xccc"),
      row("req_2", "0xddd"),
      row("req_2", "0xeee"),
    ]);
    expect(found[0].reference).toBe("req_2");
    expect(found[0].count).toBe(3);
  });

  it("settles on the earliest transaction", () => {
    expect(settlingTx(["0xaaa", "0xbbb"])).toBe("0xaaa");
    expect(settlingTx([])).toBeUndefined();
  });
});
