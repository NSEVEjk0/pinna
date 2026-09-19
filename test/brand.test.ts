import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BRAND, EXAMPLE_CARDS, FEATURES, TEMPO_COPY } from "@/lib/brand";
import { Fern, Wordmark } from "@/components/Fern";
import { SiteFooter } from "@/components/SiteFooter";
import {
  TEMPO_MAINNET,
  TEMPO_TESTNET,
  activeNetwork,
  activeToken,
  explorerTxUrl,
} from "@/lib/tempo";
import { decodePayLink, draftMessage, encodePayLink, payLinkUrl } from "@/lib/paylink";
import { receiptModel } from "@/lib/receipt";

describe("branding", () => {
  it("carries the name, the handle and the X link", () => {
    const html = renderToStaticMarkup(createElement(SiteFooter));
    expect(html).toContain("Pinna");
    expect(html).toContain("Built by CK");
    expect(html).toContain("https://x.com/CRYPTFRANI");
  });

  it("explains Tempo and why Pinna uses it", () => {
    const html = renderToStaticMarkup(createElement(SiteFooter));
    expect(html).toContain("Tempo");
    expect(BRAND.footer).toContain("batch");
    expect(BRAND.footer).toContain("memo");
    expect(TEMPO_COPY.steps).toHaveLength(4);
  });

  it("describes the whole product in one phrase", () => {
    expect(BRAND.oneLiner).toContain("Tempo");
    expect(BRAND.oneLiner.length).toBeLessThan(90);
    // The phrase covers paying, asking, and keeping the record.
    expect(BRAND.oneLiner.toLowerCase()).toContain("pay a list");
    expect(BRAND.oneLiner.toLowerCase()).toContain("request money");
    expect(BRAND.oneLiner.toLowerCase()).toContain("receipt");
  });

  it("says what Pinna is trying to achieve", () => {
    expect(TEMPO_COPY.goal.length).toBeGreaterThan(120);
    expect(TEMPO_COPY.goal.toLowerCase()).toContain("contact list");
    // It is about Pinna's aim, not Tempo's.
    expect(TEMPO_COPY.goal.toLowerCase()).not.toContain("tempo is betting");
  });

  it("says what Pinna does on Tempo, and lists every feature", () => {
    expect(TEMPO_COPY.onTempo.toLowerCase()).toContain("batch");
    expect(TEMPO_COPY.onTempo.toLowerCase()).toContain("memo");
    expect(FEATURES.length).toBeGreaterThanOrEqual(10);
    for (const feature of FEATURES) {
      expect(feature.title.length).toBeGreaterThan(3);
      expect(feature.body.length).toBeGreaterThan(40);
    }
    const titles = FEATURES.map((f) => f.title.toLowerCase()).join(" ");
    expect(titles).toContain("contacts");
    expect(titles).toContain("sync");
    expect(titles).toContain("stablecoin");
  });

  it("draws the fern as an svg mark", () => {
    const html = renderToStaticMarkup(createElement(Fern, { size: 40 }));
    expect(html).toContain("<svg");
    expect(html).toContain("#7A9A7E");
    const mark = renderToStaticMarkup(createElement(Wordmark));
    expect(mark).toContain("Pinna");
  });

  it("has the five example cards, using the named people", () => {
    expect(EXAMPLE_CARDS).toHaveLength(5);
    const titles = EXAMPLE_CARDS.map((c) => c.title);
    expect(titles).toEqual([
      "Friday payroll",
      "Flatmates",
      "Freelance invoice",
      "Vendor list",
      "Friend reminder",
    ]);
    const names = new Set(EXAMPLE_CARDS.flatMap((c) => [...c.people]));
    expect(names.has("Franklin")).toBe(true);
    expect(names.has("Jake")).toBe(true);
    expect(names.has("Sophia")).toBe(true);
    expect(names.has("Stephanie")).toBe(true);
    expect(EXAMPLE_CARDS[4].body).toContain("$18");
  });
});

describe("tempo networks", () => {
  it("uses the documented chain ids and endpoints", () => {
    expect(TEMPO_MAINNET.chainId).toBe(4217);
    expect(TEMPO_MAINNET.rpcUrl).toBe("https://rpc.tempo.xyz");
    expect(TEMPO_MAINNET.explorerUrl).toBe("https://explore.tempo.xyz");
    expect(TEMPO_MAINNET.defaultToken.address).toBe("0x20c0000000000000000000000000000000000000");

    expect(TEMPO_TESTNET.chainId).toBe(42431);
    expect(TEMPO_TESTNET.rpcUrl).toBe("https://rpc.moderato.tempo.xyz");
    expect(TEMPO_TESTNET.explorerUrl).toBe("https://explore.testnet.tempo.xyz");
  });

  it("defaults to the testnet unless mainnet is asked for", () => {
    expect(activeNetwork(undefined).key).toBe("testnet");
    expect(activeNetwork("moderato").key).toBe("testnet");
    expect(activeNetwork("mainnet").key).toBe("mainnet");
  });

  it("picks a known token or falls back to the default", () => {
    expect(activeToken(TEMPO_TESTNET, "AlphaUSD").symbol).toBe("AlphaUSD");
    expect(activeToken(TEMPO_TESTNET, "nonsense").symbol).toBe("pathUSD");
  });

  it("links a transaction on the right explorer", () => {
    expect(explorerTxUrl(TEMPO_TESTNET, "0xabc")).toBe(
      "https://explore.testnet.tempo.xyz/tx/0xabc"
    );
  });
});

describe("pay links", () => {
  const payload = {
    id: "req_123",
    to: "0x9999999999999999999999999999999999999999" as `0x${string}`,
    hostName: "Sophia",
    amount: "18.00",
    reason: "Dinner on Friday",
    message: "No rush — pay when you can.",
    token: "pathUSD",
    network: "Tempo Testnet (Moderato)",
  };

  it("round-trips the whole request through the url", () => {
    expect(decodePayLink(encodePayLink(payload))).toEqual(payload);
  });

  it("builds a shareable url on any origin", () => {
    const url = payLinkUrl("https://pinna.app/", payload);
    expect(url.startsWith("https://pinna.app/pay/req_123?d=")).toBe(true);
  });

  it("refuses to decode a link that is not ours", () => {
    expect(decodePayLink("not-base64-json")).toBeNull();
  });

  it("drafts a message naming the person, amount and link", () => {
    const msg = draftMessage({
      hostName: "Sophia",
      partyName: "Jake",
      amount: "18.00",
      reason: "Dinner",
      url: "https://pinna.app/pay/req_123?d=x",
      tokenSymbol: "pathUSD",
    });
    expect(msg).toContain("Jake");
    expect(msg).toContain("18.00 pathUSD");
    expect(msg).toContain("Dinner");
    expect(msg).toContain("https://pinna.app/pay/req_123?d=x");
  });
});

describe("receipt model", () => {
  it("totals the rows and keeps the transaction hash", () => {
    const model = receiptModel({
      title: "Payment receipt",
      rows: [
        { id: "a", name: "Jake", address: "0x1111111111111111111111111111111111111111", amount: "25.00" },
        { id: "b", name: "Jake", address: "0x1111111111111111111111111111111111111111", amount: "25.00" },
        { id: "c", name: "Sophia", address: "0x2222222222222222222222222222222222222222", amount: "10.50" },
      ],
      txHash: "0xfeed",
      explorerUrl: "https://explore.testnet.tempo.xyz/tx/0xfeed",
      at: "2026-09-12T09:00:00.000Z",
      tokenSymbol: "pathUSD",
      network: "Tempo Testnet (Moderato)",
      from: "0x9999999999999999999999999999999999999999",
    });
    expect(model.total).toBe("60.50");
    expect(model.lines).toHaveLength(3);
    expect(model.txHash).toBe("0xfeed");
    expect(model.lines[0].name).toBe("Jake");
  });
});
