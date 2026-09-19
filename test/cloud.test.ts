import { describe, expect, it } from "vitest";
import {
  EXPIRY_OPTIONS,
  describeExpiry,
  isExpired,
  resolveExpiry,
} from "@/lib/expiry";
import {
  SYNC_MESSAGE,
  decryptBlob,
  emptyBlob,
  encryptBlob,
  keyFromSignature,
  mergeBlobs,
  type CloudBlob,
} from "@/lib/cloud";
import type { Contact, SentList } from "@/lib/storage";
import type { PaymentRequest } from "@/lib/requests";

const NOW = new Date("2026-09-19T12:00:00.000Z");
const HOST = "0x9999999999999999999999999999999999999999" as `0x${string}`;
const JAKE = "0x1111111111111111111111111111111111111111" as `0x${string}`;

function request(partial: Partial<PaymentRequest> = {}): PaymentRequest {
  return {
    id: "req_1",
    hostAddress: HOST,
    partyName: "Jake",
    partyAddress: JAKE,
    amount: "18.00",
    reason: "Dinner",
    hasLink: true,
    hasPdf: false,
    status: "waiting",
    createdAt: "2026-09-19T10:00:00.000Z",
    ...partial,
  };
}

function contact(partial: Partial<Contact> = {}): Contact {
  return {
    address: JAKE,
    name: "Jake",
    useCount: 1,
    lastUsedAt: "2026-09-19T10:00:00.000Z",
    ...partial,
  };
}

describe("link expiry", () => {
  it("offers never as the default choice", () => {
    expect(EXPIRY_OPTIONS[0].key).toBe("never");
    expect(resolveExpiry("never", "", NOW)).toBeNull();
  });

  it("counts hours and days from now", () => {
    expect(resolveExpiry("24h", "", NOW)).toBe("2026-09-20T12:00:00.000Z");
    expect(resolveExpiry("7d", "", NOW)).toBe("2026-09-26T12:00:00.000Z");
    expect(resolveExpiry("30d", "", NOW)).toBe("2026-10-19T12:00:00.000Z");
  });

  it("runs a picked date to the end of that day", () => {
    const iso = resolveExpiry("custom", "2026-09-25", NOW)!;
    expect(iso.slice(0, 10)).toBe("2026-09-25");
    expect(new Date(iso).getHours()).toBe(23);
  });

  it("treats a missing picked date as no expiry", () => {
    expect(resolveExpiry("custom", "", NOW)).toBeNull();
  });

  it("knows when a link has closed", () => {
    expect(isExpired(null, NOW)).toBe(false);
    expect(isExpired(undefined, NOW)).toBe(false);
    expect(isExpired("2026-09-19T11:59:00.000Z", NOW)).toBe(true);
    expect(isExpired("2026-09-19T12:01:00.000Z", NOW)).toBe(false);
    expect(isExpired("not a date", NOW)).toBe(false);
  });

  it("describes the state in words", () => {
    expect(describeExpiry(null, NOW)).toBe("No expiry");
    expect(describeExpiry("2026-09-20T12:00:00.000Z", NOW)).toContain("Open until");
    expect(describeExpiry("2026-09-18T12:00:00.000Z", NOW)).toContain("Expired");
  });
});

describe("the cloud copy", () => {
  it("round-trips an encrypted blob and refuses the wrong key", async () => {
    const key = await keyFromSignature("0xsignature-abc", HOST);
    const blob: CloudBlob = {
      ...emptyBlob(HOST),
      contacts: [contact()],
      savedAt: "2026-09-19T10:00:00.000Z",
    };
    const sealed = await encryptBlob(key, blob);
    expect(sealed).not.toContain("Jake"); // the names are not readable

    const opened = await decryptBlob(key, sealed);
    expect(opened?.contacts[0].name).toBe("Jake");

    const otherKey = await keyFromSignature("0xsignature-different", HOST);
    expect(await decryptBlob(otherKey, sealed)).toBeNull();

    const damaged = sealed.slice(0, sealed.length - 6) + "AAAAAA";
    expect(await decryptBlob(key, damaged)).toBeNull();
  });

  it("derives the same key from the same signature and address", async () => {
    const a = await keyFromSignature("0xsig", HOST);
    const b = await keyFromSignature("0xSIG", HOST.toUpperCase());
    const blob = { ...emptyBlob(HOST), contacts: [contact()] };
    const sealed = await encryptBlob(a, blob);
    expect(await decryptBlob(b, sealed)).not.toBeNull();
  });

  it("asks the wallet to sign a message naming the address", () => {
    expect(SYNC_MESSAGE(HOST)).toContain(HOST.toLowerCase());
    expect(SYNC_MESSAGE(HOST)).toContain("Pinna sync key");
  });

  it("merges without dropping anything", () => {
    const local: CloudBlob = {
      ...emptyBlob(HOST),
      savedAt: "2026-09-19T11:00:00.000Z",
      contacts: [contact({ name: "Jake" })],
      requests: [request({ id: "req_local" })],
      sent: [],
    };
    const remote: CloudBlob = {
      ...emptyBlob(HOST),
      savedAt: "2026-09-19T10:00:00.000Z",
      contacts: [contact({ address: "0x2222222222222222222222222222222222222222", name: "Sophia" })],
      requests: [request({ id: "req_remote" })],
      sent: [
        {
          id: "list_1",
          to: ["Jake"],
          rowCount: 1,
          total: "18.00",
          txHash: "0xabc",
          at: "2026-09-19T09:00:00.000Z",
          tokenSymbol: "pathUSD",
          network: "Tempo Testnet (Moderato)",
        } satisfies SentList,
      ],
    };

    const merged = mergeBlobs(local, remote);
    expect(merged.contacts.map((c) => c.name).sort()).toEqual(["Jake", "Sophia"]);
    expect(merged.requests.map((r) => r.id).sort()).toEqual(["req_local", "req_remote"]);
    expect(merged.sent).toHaveLength(1);
    expect(merged.savedAt).toBe("2026-09-19T11:00:00.000Z");
  });

  it("keeps the name that was set most recently, and the busier count", () => {
    const merged = mergeBlobs(
      {
        ...emptyBlob(HOST),
        contacts: [contact({ name: "Jakey", useCount: 1, lastUsedAt: "2026-09-01T00:00:00.000Z" })],
      },
      {
        ...emptyBlob(HOST),
        contacts: [contact({ name: "Jake", useCount: 7, lastUsedAt: "2026-09-19T00:00:00.000Z" })],
      }
    );
    expect(merged.contacts[0].name).toBe("Jake");
    expect(merged.contacts[0].useCount).toBe(7);
  });

  it("prefers a settled request over a waiting one", () => {
    const merged = mergeBlobs(
      {
        ...emptyBlob(HOST),
        requests: [request({ id: "req_1", status: "waiting" })],
      },
      {
        ...emptyBlob(HOST),
        requests: [request({ id: "req_1", status: "paid", txHash: "0xpaid", paidAt: "2026-09-19T11:00:00.000Z" })],
      }
    );
    expect(merged.requests[0].status).toBe("paid");
    expect(merged.requests[0].txHash).toBe("0xpaid");
  });
});
