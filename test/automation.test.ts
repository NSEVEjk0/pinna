import { describe, expect, it } from "vitest";
import {
  FREQUENCY_LABEL,
  describeRule,
  dueRules,
  isDue,
  isValidTimeOfDay,
  nextRunAt,
  occurrencesBetween,
  type AutomationRule,
} from "@/lib/automation";
import { decodeNote, encodeNote, decodeMemo, MEMO_BYTES } from "@/lib/memo";
import { buildLedger } from "@/lib/ledger";
import { FAQ } from "@/components/Faq";

const HOST = "0x9999999999999999999999999999999999999999" as `0x${string}`;
const JAKE = "0x1111111111111111111111111111111111111111" as `0x${string}`;

function rule(partial: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: "auto_1",
    title: "Studio rent",
    name: "Jake",
    address: JAKE,
    amount: "400.00",
    memo: "Studio rent",
    frequency: "monthly",
    timeOfDay: "09:00",
    startsOn: "2026-01-01",
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    runCount: 0,
    ...partial,
  };
}

describe("scheduled payments", () => {
  it("validates the time of day", () => {
    expect(isValidTimeOfDay("09:00")).toBe(true);
    expect(isValidTimeOfDay("23:59")).toBe(true);
    expect(isValidTimeOfDay("24:00")).toBe(false);
    expect(isValidTimeOfDay("9:00")).toBe(false);
    expect(isValidTimeOfDay("")).toBe(false);
  });

  it("comes round daily at the chosen time", () => {
    const r = rule({ frequency: "daily", timeOfDay: "09:00", startsOn: "2026-09-01" });
    const from = new Date("2026-09-10T14:00:00");
    const next = nextRunAt(r, from);
    expect(next.toISOString().slice(0, 10)).toBe("2026-09-11");
    expect(next.getHours()).toBe(9);
  });

  it("uses today when the time has not passed yet", () => {
    const r = rule({ frequency: "daily", timeOfDay: "18:00", startsOn: "2026-09-01" });
    const next = nextRunAt(r, new Date("2026-09-10T08:00:00"));
    expect(next.toISOString().slice(0, 10)).toBe("2026-09-10");
    expect(next.getHours()).toBe(18);
  });

  it("comes round weekly, monthly and yearly", () => {
    // Weekly keeps the weekday the rule started on (2026-09-01 is a Tuesday).
    const weekly = nextRunAt(
      rule({ frequency: "weekly", timeOfDay: "09:00", startsOn: "2026-09-01" }),
      new Date("2026-09-02T10:00:00")
    );
    expect(weekly.toISOString().slice(0, 10)).toBe("2026-09-08");
    expect(weekly.getDay()).toBe(new Date("2026-09-01T09:00:00").getDay());

    const monthly = nextRunAt(
      rule({ frequency: "monthly", timeOfDay: "09:00", startsOn: "2026-01-15" }),
      new Date("2026-02-20T10:00:00")
    );
    expect(monthly.toISOString().slice(0, 10)).toBe("2026-03-15");

    const yearly = nextRunAt(
      rule({ frequency: "yearly", timeOfDay: "09:00", startsOn: "2026-03-01" }),
      new Date("2026-06-01T10:00:00")
    );
    expect(yearly.toISOString().slice(0, 10)).toBe("2027-03-01");
  });

  it("clamps a monthly run into a short month", () => {
    const r = rule({ frequency: "monthly", timeOfDay: "09:00", startsOn: "2026-01-31" });
    const next = nextRunAt(r, new Date("2026-02-01T10:00:00"));
    expect(next.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("respects the last time it ran", () => {
    const r = rule({
      frequency: "daily",
      timeOfDay: "09:00",
      startsOn: "2026-09-01",
      lastRunAt: "2026-09-10T09:00:00",
    });
    const next = nextRunAt(r, new Date("2026-09-10T10:00:00"));
    expect(next.toISOString().slice(0, 10)).toBe("2026-09-11");
  });

  it("knows what is due, and never runs a paused or future rule", () => {
    const now = new Date("2026-09-10T10:00:00");
    expect(isDue(rule({ frequency: "daily", timeOfDay: "09:00", startsOn: "2026-09-01" }), now)).toBe(true);
    expect(isDue(rule({ frequency: "daily", enabled: false }), now)).toBe(false);
    expect(isDue(rule({ frequency: "daily", startsOn: "2027-01-01" }), now)).toBe(false);

    const list = dueRules(
      [
        rule({ id: "a", frequency: "daily", timeOfDay: "09:00", startsOn: "2026-09-01" }),
        rule({ id: "b", enabled: false }),
      ],
      now
    );
    expect(list.map((r) => r.id)).toEqual(["a"]);
  });

  it("counts how often a rule came round, for catching up", () => {
    const r = rule({ frequency: "daily", timeOfDay: "09:00", startsOn: "2026-09-01" });
    const count = occurrencesBetween(r, new Date("2026-09-01T00:00:00"), new Date("2026-09-05T00:00:00"));
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(5);
  });

  it("labels and describes a rule", () => {
    expect(FREQUENCY_LABEL.monthly).toBe("Every month");
    expect(describeRule(rule({ frequency: "weekly", timeOfDay: "08:30" }))).toBe(
      "Every week at 08:30"
    );
    expect(describeRule(rule({ enabled: false }))).toContain("paused");
  });
});

describe("notes written into memos", () => {
  it("round-trips a plain note", () => {
    const memo = encodeNote("Studio rent");
    expect((memo.length - 2) / 2).toBe(MEMO_BYTES);
    expect(decodeNote(memo)).toBe("Studio rent");
  });

  it("does not look like a Pinna reference", () => {
    // A note is a label, not something a request should ever match on.
    expect(decodeMemo(encodeNote("Studio rent"))).toBeNull();
    expect(decodeNote(encodeNote("Studio rent"))).toBe("Studio rent");
  });

  it("trims a note that is too long", () => {
    const long = "x".repeat(80);
    expect(decodeNote(encodeNote(long))?.length).toBe(MEMO_BYTES - 1);
  });
});

describe("the ledger shows why money moved", () => {
  const base = {
    address: HOST,
    decimals: 6,
    tokenSymbol: "pathUSD",
    chainId: 42431,
    explorerUrl: "https://explore.testnet.tempo.xyz",
    nameFor: () => undefined,
  };

  it("takes the reason from the list this browser sent", () => {
    const [entry] = buildLedger({
      ...base,
      requests: [],
      sent: [
        {
          txHash: "0xtx",
          at: "2026-09-16T12:00:00.000Z",
          rows: [{ name: "Jake", address: JAKE, amount: "400.00", reason: "Studio rent" }],
        },
      ],
      transfers: [
        { from: HOST, to: JAKE, amountUnits: 400_000_000n, memo: null, txHash: "0xtx", timestamp: 1000 },
      ],
    });
    expect(entry.reason).toBe("Studio rent");
    expect(entry.name).toBe("Jake");
  });

  it("falls back to the note written in the memo", () => {
    const [entry] = buildLedger({
      ...base,
      requests: [],
      sent: [],
      transfers: [
        {
          from: HOST,
          to: JAKE,
          amountUnits: 400_000_000n,
          memo: encodeNote("Studio rent"),
          txHash: "0xnote",
          timestamp: 1000,
        },
      ],
    });
    expect(entry.reason).toBe("Studio rent");
    expect(entry.reference).toBeNull();
  });

  it("leaves the reason empty when nothing explains it", () => {
    const [entry] = buildLedger({
      ...base,
      requests: [],
      sent: [],
      transfers: [
        { from: HOST, to: JAKE, amountUnits: 1_000_000n, memo: null, txHash: "0xbare", timestamp: 1000 },
      ],
    });
    expect(entry.reason).toBe("");
  });
});

describe("the FAQ answers what people ask", () => {
  it("covers paying from a different wallet, with the reference rule", () => {
    const item = FAQ.find((f) => f.q.toLowerCase().includes("different from the one"));
    expect(item).toBeTruthy();
    expect(item!.a).toContain("reference id");
    expect(item!.a.toLowerCase()).toContain("assigns the payment to that request");
  });

  it("says the testnet is not reliable", () => {
    const item = FAQ.find((f) => f.q.toLowerCase().includes("which network"));
    expect(item!.a.toLowerCase()).toContain("mainnet");
    expect(item!.a.toLowerCase()).toContain("not very reliable");
  });

  it("is honest that Pinna cannot send on its own", () => {
    const item = FAQ.find((f) => f.q.toLowerCase().includes("on its own"));
    expect(item!.a.toLowerCase()).toContain("no key");
  });

  it("has a healthy number of entries, each with a real answer", () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(8);
    for (const item of FAQ) {
      expect(item.q.length).toBeGreaterThan(10);
      expect(item.a.length).toBeGreaterThan(40);
    }
  });
});
