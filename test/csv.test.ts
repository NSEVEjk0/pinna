import { describe, expect, it } from "vitest";
import { CSV_HEADER, csvCell, ledgerCsv, requestsCsv, toCsv } from "@/lib/csv";
import { TEMPO_TESTNET } from "@/lib/tempo";
import type { LedgerEntry } from "@/lib/ledger";
import type { PaymentRequest } from "@/lib/requests";

function entry(partial: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: "0xabc-0",
    direction: "sent",
    status: "paid",
    address: "0x1111111111111111111111111111111111111111",
    name: "Jake",
    amount: "18.00",
    tokenSymbol: "pathUSD",
    reference: "row_1",
    reason: "Friday",
    txHash: "0xabc",
    at: "2026-09-25T10:00:00.000Z",
    chainId: 42431,
    explorerUrl: TEMPO_TESTNET.explorerUrl,
    fromChain: true,
    ...partial,
  };
}

describe("CSV fields", () => {
  it("leaves a plain value alone", () => {
    expect(csvCell("18.00")).toBe("18.00");
    expect(csvCell(42431)).toBe("42431");
  });

  it("quotes a value that would break the row", () => {
    expect(csvCell("Rent, week of the 12th")).toBe('"Rent, week of the 12th"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
  });

  it("writes nothing for an empty value", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("a CSV document", () => {
  it("puts the header first and uses CRLF", () => {
    const csv = toCsv([["a", "b"]], ["one", "two"]);
    expect(csv).toBe("one,two\r\na,b");
  });
});

describe("exporting the ledger", () => {
  it("carries the identifiers a finance system needs", () => {
    const csv = ledgerCsv([entry()], TEMPO_TESTNET);
    const [header, row] = csv.split("\r\n");
    expect(header).toBe(CSV_HEADER.join(","));
    const cells = row.split(",");
    expect(cells[0]).toBe("2026-09-25T10:00:00.000Z");
    expect(cells[1]).toBe("sent");
    expect(cells[5]).toBe("18.00");
    expect(cells[9]).toBe("row_1");
    expect(cells[10]).toBe("0xabc");
    expect(cells[11]).toContain("/tx/0xabc");
  });

  it("keeps an amount exact rather than rounding it", () => {
    const csv = ledgerCsv([entry({ amount: "0.000001" })], TEMPO_TESTNET);
    expect(csv.split("\r\n")[1]).toContain("0.000001");
  });
});

describe("exporting requests", () => {
  it("includes waiting ones, which have no transaction yet", () => {
    const request: PaymentRequest = {
      id: "req_1",
      hostAddress: "0x9999999999999999999999999999999999999999",
      partyName: "Jake",
      partyAddress: "0x1111111111111111111111111111111111111111",
      amount: "18.00",
      reason: "Dinner",
      hasLink: true,
      hasPdf: false,
      status: "waiting",
      createdAt: "2026-09-25T10:00:00.000Z",
    };
    const csv = requestsCsv([request], TEMPO_TESTNET);
    const cells = csv.split("\r\n")[1].split(",");
    expect(cells[1]).toBe("waiting");
    expect(cells[9]).toBe("req_1");
    expect(cells[10]).toBe("");
  });
});
