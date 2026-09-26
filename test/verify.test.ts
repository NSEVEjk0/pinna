import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import { transfersFromLogs, verifyTransfers, type DecodedTransfer } from "@/lib/verify";
import { encodeMemo } from "@/lib/memo";

const TOKEN = "0x20c0000000000000000000000000000000000000" as `0x${string}`;
const HOST = "0x9999999999999999999999999999999999999999" as `0x${string}`;
const PAYER = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const OTHER = "0x3333333333333333333333333333333333333333" as `0x${string}`;

const TRANSFER_WITH_MEMO = {
  type: "event",
  name: "TransferWithMemo",
  inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "value", type: "uint256", indexed: false },
    { name: "memo", type: "bytes32", indexed: true },
  ],
} as const;

function log(options: { token?: string; from: string; to: string; value: bigint; memo: string }) {
  return {
    address: options.token ?? TOKEN,
    topics: encodeEventTopics({
      abi: [TRANSFER_WITH_MEMO],
      eventName: "TransferWithMemo",
      args: { from: options.from as `0x${string}`, to: options.to as `0x${string}`, memo: options.memo as `0x${string}` },
    }),
    data: encodeAbiParameters([{ type: "uint256" }], [options.value]),
  };
}

function transfer(partial: Partial<DecodedTransfer> = {}): DecodedTransfer {
  return {
    from: PAYER,
    to: HOST,
    amountUnits: 18_000_000n,
    memo: encodeMemo("req_1"),
    ...partial,
  };
}

describe("reading the transfers out of a transaction's logs", () => {
  it("decodes a transfer carrying a reference", () => {
    const [found] = transfersFromLogs(
      [log({ from: PAYER, to: HOST, value: 18_000_000n, memo: encodeMemo("req_1") })],
      TOKEN
    );
    expect(found.to).toBe(HOST);
    expect(found.from).toBe(PAYER);
    expect(found.amountUnits).toBe(18_000_000n);
  });

  it("ignores logs from another token", () => {
    expect(
      transfersFromLogs(
        [log({ token: OTHER, from: PAYER, to: HOST, value: 1n, memo: encodeMemo("req_1") })],
        TOKEN
      )
    ).toHaveLength(0);
  });

  it("ignores a log it cannot decode rather than guessing", () => {
    expect(transfersFromLogs([{ address: TOKEN, topics: ["0xdeadbeef"], data: "0x" }], TOKEN)).toHaveLength(0);
  });

  it("reads every transfer in a batch", () => {
    const logs = [
      log({ from: PAYER, to: HOST, value: 25_000_000n, memo: encodeMemo("row_a") }),
      log({ from: PAYER, to: HOST, value: 25_000_000n, memo: encodeMemo("row_b") }),
    ];
    expect(transfersFromLogs(logs, TOKEN)).toHaveLength(2);
  });
});

describe("deciding whether a payment settles what was asked", () => {
  const expected = { to: HOST, amountUnits: 18_000_000n, reference: "req_1" };

  it("accepts a transfer carrying the reference for the amount", () => {
    expect(verifyTransfers([transfer()], expected).ok).toBe(true);
  });

  it("accepts a payer who is not the wallet that was asked", () => {
    // A pay link can be paid from any wallet; the reference is what counts.
    expect(verifyTransfers([transfer({ from: OTHER })], expected).ok).toBe(true);
  });

  it("accepts an overpayment — the reference decides", () => {
    expect(verifyTransfers([transfer({ amountUnits: 20_000_000n })], expected).ok).toBe(true);
  });

  it("refuses a transfer with no reference", () => {
    const verdict = verifyTransfers([transfer({ memo: "0x" as string })], expected);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("reference");
  });

  it("refuses a transfer carrying a different reference", () => {
    expect(verifyTransfers([transfer({ memo: encodeMemo("req_OTHER") })], expected).reason).toBe(
      "reference"
    );
  });

  it("refuses a transfer to somebody else", () => {
    expect(verifyTransfers([transfer({ to: OTHER })], expected).reason).toBe("recipient");
  });

  it("refuses an underpayment", () => {
    expect(verifyTransfers([transfer({ amountUnits: 1n })], expected).reason).toBe("amount");
  });

  it("says so plainly when there is no transfer at all", () => {
    expect(verifyTransfers([], expected).reason).toBe("no-transfer");
  });

  it("picks the right transfer out of a batch", () => {
    const verdict = verifyTransfers(
      [
        transfer({ memo: encodeMemo("row_a"), amountUnits: 25_000_000n }),
        transfer({ memo: encodeMemo("req_1"), amountUnits: 18_000_000n }),
      ],
      expected
    );
    expect(verdict.ok).toBe(true);
    expect(verdict.matched?.amountUnits).toBe(18_000_000n);
  });
});
