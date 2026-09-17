"use client";

import { useState } from "react";
import { usePinna } from "@/lib/usePinna";
import { explorerTxUrl } from "@/lib/tempo";
import type { TempoNetwork } from "@/lib/tempo";
import { readIncomingTransfers } from "@/lib/chain";
import { findSettlement, markPaid, type PaymentRequest } from "@/lib/requests";
import { parseAmount } from "@/lib/money";
import { downloadReceipt } from "@/lib/receipt";

const TABS = [
  "Money sent / paid by you",
  "Money requested / received by you",
  "Waiting (links not paid / outstanding payments)",
] as const;

type Tab = (typeof TABS)[number];

export default function HistoryPage() {
  const { isConnected, address, network, token, sent, requests, replaceRequests, saveRequest } = usePinna();
  const [tab, setTab] = useState<Tab>(TABS[0]);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const paidRequests = requests.filter((r) => r.status === "paid");
  const waiting = requests.filter((r) => r.status === "waiting");

  /** Look for matching transfers on Tempo and settle the requests they pay. */
  async function checkTempo() {
    if (!address || waiting.length === 0) return;
    setChecking(true);
    setNote(null);
    try {
      const transfers = await readIncomingTransfers(network, token.address, address);
      let settled = 0;
      const next: PaymentRequest[] = requests.map((request) => {
        if (request.status !== "waiting") return request;
        const match = findSettlement(request, transfers, {
          expectedUnits: parseAmount(request.amount, token.decimals),
        });
        if (!match) return request;
        settled += 1;
        return markPaid(request, { txHash: match.txHash, settledBy: "detected" });
      });
      replaceRequests(next);
      setNote(
        settled > 0
          ? `${settled} payment${settled === 1 ? "" : "s"} matched on Tempo.`
          : "No matching transfer on Tempo yet."
      );
    } catch (err) {
      setNote(
        err instanceof Error ? `Could not read Tempo: ${err.message}` : "Could not read Tempo."
      );
    } finally {
      setChecking(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="shell fade-in" style={{ paddingTop: 80 }}>
        <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4.2vw, 2.8rem)", margin: "0 0 14px" }}>
          Connect a wallet to see history
        </h1>
        <p className="muted" style={{ maxWidth: "48ch" }}>
          History is kept per wallet, in this browser.
        </p>
      </div>
    );
  }

  return (
    <div className="shell fade-in" style={{ paddingTop: 56, paddingBottom: 40 }}>
      <p className="eyebrow" style={{ margin: "0 0 14px" }}>
        History
      </p>
      <h1 className="display" style={{ fontSize: "clamp(2rem, 4.6vw, 3rem)", margin: "0 0 30px" }}>
        What moved, what is owed.
      </h1>

      <div style={{ borderBottom: "1px solid var(--hairline)", marginBottom: 26, overflowX: "auto" }}>
        {TABS.map((t) => (
          <button key={t} className="tab" data-active={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === TABS[0] ? (
        sent.length === 0 ? (
          <p className="muted">Nothing sent yet.</p>
        ) : (
          <div style={{ borderTop: "1px solid var(--hairline)" }}>
            {sent.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)",
                  gap: 18,
                  padding: "20px 0",
                  borderBottom: "1px solid var(--hairline)",
                  alignItems: "baseline",
                }}
                className="row-grid"
              >
                <div>
                  <p style={{ margin: 0 }}>
                    {entry.to.join(", ") || "—"}
                    <span className="faint" style={{ marginLeft: 10, fontSize: "0.82rem" }}>
                      {entry.rowCount} transfer{entry.rowCount === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="faint mono" style={{ margin: "4px 0 0", fontSize: "0.74rem" }}>
                    {new Date(entry.at).toISOString().replace("T", " ").slice(0, 16)}
                  </p>
                </div>
                <p className="mono" style={{ margin: 0 }}>
                  {entry.total} {entry.tokenSymbol}
                </p>
                <div style={{ display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
                  {entry.txHash ? (
                    <a className="link" href={explorerTxUrl(network, entry.txHash)} target="_blank" rel="noreferrer">
                      {entry.txHash.slice(0, 10)}…
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="nav-link"
                    style={{ background: "transparent", border: 0, cursor: "pointer" }}
                    onClick={() =>
                      downloadReceipt({
                        title: "Payment receipt",
                        rows: (entry.rows ?? []).map((r, i) => ({
                          id: `${entry.id}-${i}`,
                          name: r.name,
                          address: (r.address as `0x${string}`) ?? (`0x${"0".repeat(40)}` as `0x${string}`),
                          amount: r.amount,
                          reason: r.reason,
                        })),
                        txHash: entry.txHash,
                        explorerUrl: entry.txHash ? explorerTxUrl(network, entry.txHash) : "",
                        at: entry.at,
                        tokenSymbol: entry.tokenSymbol,
                        network: entry.network,
                        from: address ?? "",
                        decimals: token.decimals,
                        note: `List total ${entry.total} ${entry.tokenSymbol} across ${entry.rowCount} transfers.`,
                      })
                    }
                  >
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}

      {tab === TABS[1] ? (
        paidRequests.length === 0 ? (
          <p className="muted">Nothing received yet.</p>
        ) : (
          <div style={{ borderTop: "1px solid var(--hairline)" }}>
            {paidRequests.map((request) => (
              <RequestRow key={request.id} request={request} network={network} />
            ))}
          </div>
        )
      ) : null}

      {tab === TABS[2] ? (
        <>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
            <button className="button button-quiet" onClick={checkTempo} disabled={checking || waiting.length === 0}>
              {checking ? "Reading Tempo…" : "Check Tempo for payments"}
            </button>
            {note ? <span className="muted" style={{ fontSize: "0.9rem" }}>{note}</span> : null}
          </div>
          {waiting.length === 0 ? (
            <p className="muted">Nothing waiting.</p>
          ) : (
            <div style={{ borderTop: "1px solid var(--hairline)" }}>
              {waiting.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  network={network}
                  actions={
                    <button
                      type="button"
                      className="nav-link"
                      style={{ background: "transparent", border: 0, cursor: "pointer" }}
                      onClick={() => saveRequest(markPaid(request, { settledBy: "marked" }))}
                    >
                      Mark paid
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function RequestRow({
  request,
  network,
  actions,
}: {
  request: PaymentRequest;
  network: TempoNetwork;
  actions?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)",
        gap: 18,
        padding: "20px 0",
        borderBottom: "1px solid var(--hairline)",
        alignItems: "baseline",
      }}
      className="row-grid"
    >
      <div>
        <p style={{ margin: 0 }}>
          {request.partyName || request.partyAddress}
          <span className="faint" style={{ marginLeft: 10, fontSize: "0.82rem" }}>
            {request.reason || "no reason"}
          </span>
        </p>
        <p className="faint mono" style={{ margin: "4px 0 0", fontSize: "0.74rem" }}>
          {new Date(request.createdAt).toISOString().replace("T", " ").slice(0, 16)} · ref {request.id}
        </p>
      </div>
      <p className="mono" style={{ margin: 0 }}>
        {request.amount}
      </p>
      <div style={{ display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
        <span className={`chip ${request.status === "paid" ? "chip-sage" : ""}`}>{request.status}</span>
        {request.txHash && request.txHash.startsWith("0x") ? (
          <a
            className="link"
            style={{ fontSize: "0.85rem" }}
            href={explorerTxUrl(network, request.txHash)}
            target="_blank"
            rel="noreferrer"
          >
            {request.txHash.slice(0, 10)}…
          </a>
        ) : null}
        {actions}
      </div>
    </div>
  );
}
