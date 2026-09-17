"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePinna } from "@/lib/usePinna";
import { explorerTxUrl, type TempoNetwork } from "@/lib/tempo";
import { readIncomingTransfers } from "@/lib/chain";
import { cancel, findSettlement, markPaid, type PaymentRequest } from "@/lib/requests";
import { parseAmount } from "@/lib/money";
import { downloadReceipt } from "@/lib/receipt";
import { findRepeats, type RepeatCandidate } from "@/lib/duplicates";
import { paidEvent } from "@/lib/events";
import { payLinkUrl } from "@/lib/paylink";
import type { SentList } from "@/lib/storage";

const TABS = [
  "Money sent / paid by you",
  "Money requested / received by you",
  "Waiting (links not paid / outstanding payments)",
] as const;

type Tab = (typeof TABS)[number];

/** A short, recognisable form of a hash that still links to the full one. */
function hashLabel(hash: string, lead = 10, tail = 6): string {
  if (!hash || !hash.startsWith("0x")) return hash || "—";
  if (hash.length <= lead + tail + 2) return hash;
  return `${hash.slice(0, lead)}…${hash.slice(-tail)}`;
}

export default function HistoryPage() {
  const {
    isConnected,
    address,
    alias,
    network,
    token,
    sent,
    requests,
    replaceRequests,
    saveRequest,
    notify,
  } = usePinna();
  const [tab, setTab] = useState<Tab>(TABS[0]);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [openSent, setOpenSent] = useState<string | null>(null);
  const [openRequest, setOpenRequest] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);

  const paidRequests = requests.filter((r) => r.status === "paid");
  const waiting = requests.filter((r) => r.status === "waiting");
  const cancelled = requests.filter((r) => r.status === "cancelled");

  /** Every payment that left this wallet, flattened for the repeats section. */
  const repeatCandidates: RepeatCandidate[] = useMemo(
    () =>
      sent.flatMap((entry) =>
        (entry.rows ?? []).map((row, i) => ({
          id: `${entry.id}-${i}`,
          name: row.name,
          address: row.address,
          amount: row.amount,
          reason: row.reason,
          txHash: entry.txHash,
          at: entry.at,
        }))
      ),
    [sent]
  );
  const repeats = useMemo(() => findRepeats(repeatCandidates), [repeatCandidates]);

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
        const paid = markPaid(request, { txHash: match.txHash, settledBy: "detected" });
        notify(paidEvent(paid, match.txHash));
        return paid;
      });
      replaceRequests(next);
      setNote(
        settled > 0
          ? `${settled} payment${settled === 1 ? "" : "s"} matched on Tempo.`
          : "No matching transfer on Tempo yet."
      );
    } catch (err) {
      setNote(err instanceof Error ? `Could not read Tempo: ${err.message}` : "Could not read Tempo.");
    } finally {
      setChecking(false);
    }
  }

  function receiptForList(entry: SentList) {
    downloadReceipt({
      title: "Payment receipt",
      subject: `List ${entry.id}`,
      rows: (entry.rows ?? []).map((r, i) => ({
        id: `${entry.id}-${i}`,
        name: r.name,
        address: (r.address as `0x${string}`) || (`0x${"0".repeat(40)}` as `0x${string}`),
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
    });
  }

  function receiptForRequest(request: PaymentRequest) {
    downloadReceipt({
      title: request.status === "paid" ? "Payment receipt" : "Request draft",
      subject: `Reference ${request.id}`,
      rows: [
        {
          id: request.id,
          name: request.partyName,
          address: request.partyAddress,
          amount: request.amount,
          reason: request.reason,
        },
      ],
      txHash: request.txHash ?? "—",
      explorerUrl: request.txHash ? explorerTxUrl(network, request.txHash) : "",
      at: request.paidAt ?? request.createdAt,
      tokenSymbol: token.symbol,
      network: network.name,
      from: request.hostAddress,
      decimals: token.decimals,
      note:
        request.status === "paid"
          ? `Settled${request.settledBy === "marked" ? " and marked paid" : " from a matching Tempo transfer"}.`
          : `Pay to ${request.hostAddress} on ${network.name}. Quote reference ${request.id}.`,
    });
  }

  if (!isConnected) {
    return (
      <div className="shell fade-in" style={{ paddingTop: 40 }}>
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
    <div className="shell fade-in" style={{ paddingTop: 8, paddingBottom: 40 }}>
      <p className="eyebrow" style={{ margin: "0 0 14px" }}>
        History
      </p>
      <h1 className="display" style={{ fontSize: "clamp(2rem, 4.6vw, 3rem)", margin: "0 0 30px" }}>
        What moved, what is owed.
      </h1>

      {repeats.length > 0 ? (
        <div className="panel" style={{ padding: 22, marginBottom: 34 }}>
          <p className="eyebrow" style={{ margin: "0 0 6px" }}>
            Repeated payments
          </p>
          <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.92rem" }}>
            The same person and the same amount, more than once. Worth a look before anything else
            leaves the wallet.
          </p>
          {repeats.map((group) => (
            <div
              key={group.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 16,
                padding: "12px 0",
                borderTop: "1px solid var(--hairline)",
                flexWrap: "wrap",
              }}
            >
              <div>
                <p style={{ margin: 0 }}>
                  {group.name}
                  <span className="chip chip-repeat" style={{ marginLeft: 12 }}>
                    {group.count}×
                  </span>
                </p>
                <p className="faint mono" style={{ margin: "4px 0 0", fontSize: "0.74rem" }}>
                  {group.address.slice(0, 12)}…{group.address.slice(-6)} · last {group.lastAt.slice(0, 16).replace("T", " ")}
                </p>
              </div>
              <p className="mono" style={{ margin: 0 }}>
                {group.amount} each · {group.total} total
              </p>
            </div>
          ))}
        </div>
      ) : null}

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
            {sent.map((entry) => {
              const open = openSent === entry.id;
              return (
                <div key={entry.id}>
                  <button
                    type="button"
                    className="history-row"
                    onClick={() => setOpenSent(open ? null : entry.id)}
                    aria-expanded={open}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) minmax(0,1.2fr)",
                        gap: 16,
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
                          {entry.at.slice(0, 16).replace("T", " ")}
                        </p>
                      </div>
                      <p className="mono" style={{ margin: 0 }}>
                        {entry.total} {entry.tokenSymbol}
                      </p>
                      <p className="mono" style={{ margin: 0, fontSize: "0.82rem" }}>
                        {entry.txHash ? (
                          <a
                            className="hash-link"
                            href={explorerTxUrl(network, entry.txHash)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {hashLabel(entry.txHash)}
                          </a>
                        ) : (
                          "—"
                        )}
                      </p>
                    </div>
                  </button>

                  {open ? (
                    <div className="panel" style={{ padding: 20, margin: "10px 0 20px" }}>
                      <p className="eyebrow" style={{ margin: "0 0 14px" }}>
                        Batch detail
                      </p>
                      <p className="faint" style={{ margin: "0 0 16px", fontSize: "0.85rem" }}>
                        One Tempo transaction carried every row below. Each row is its own transfer
                        with its own reference, so the batch hash belongs to all of them.
                      </p>

                      <div className="detail-grid">
                        <Detail label="Transaction" value={hashLabel(entry.txHash, 14, 10)} />
                        <Detail label="Network" value={entry.network} />
                        <Detail label="Finalised" value={entry.at.slice(0, 19).replace("T", " ")} />
                        <Detail label="Transfers" value={String(entry.rowCount)} />
                      </div>

                      <div style={{ marginTop: 18, borderTop: "1px solid var(--hairline)" }}>
                        {(entry.rows ?? []).map((row, i) => (
                          <div
                            key={`${entry.id}-${i}`}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 14,
                              alignItems: "baseline",
                              padding: "11px 0",
                              borderBottom: "1px solid var(--hairline)",
                              flexWrap: "wrap",
                            }}
                          >
                            <span>{row.name}</span>
                            <span className="faint" style={{ fontSize: "0.85rem" }}>
                              {row.reason || "no reason"}
                            </span>
                            <span className="mono" style={{ fontSize: "0.88rem" }}>
                              {row.amount} {entry.tokenSymbol}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap", alignItems: "center" }}>
                        <a
                          className="link"
                          href={explorerTxUrl(network, entry.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: "0.88rem" }}
                        >
                          Open the full transaction
                        </a>
                        <button className="pdf-again" onClick={() => receiptForList(entry)}>
                          Redownload PDF
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )
      ) : null}

      {tab === TABS[1] ? (
        paidRequests.length === 0 ? (
          <p className="muted">Nothing received yet.</p>
        ) : (
          <div style={{ borderTop: "1px solid var(--hairline)" }}>
            {paidRequests.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                network={network}
                open={openRequest === request.id}
                onToggle={() => setOpenRequest(openRequest === request.id ? null : request.id)}
                onPdf={() => receiptForRequest(request)}
              />
            ))}
          </div>
        )
      ) : null}

      {tab === TABS[2] ? (
        <>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
            <button
              className="button button-quiet"
              onClick={checkTempo}
              disabled={checking || waiting.length === 0}
            >
              {checking ? "Reading Tempo…" : "Check Tempo for payments"}
            </button>
            {note ? (
              <span className="muted" style={{ fontSize: "0.9rem" }}>
                {note}
              </span>
            ) : null}
            {cancelled.length > 0 ? (
              <button className="nav-link" onClick={() => setShowCancelled((v) => !v)} style={{ background: "transparent", border: 0, cursor: "pointer" }}>
                {showCancelled ? "Hide" : "Show"} cancelled ({cancelled.length})
              </button>
            ) : null}
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
                  open={openRequest === request.id}
                  onToggle={() => setOpenRequest(openRequest === request.id ? null : request.id)}
                  onPdf={() => receiptForRequest(request)}
                  onCancel={() => saveRequest(cancel(request))}
                  onMarkPaid={() => {
                    const paid = markPaid(request, { settledBy: "marked" });
                    saveRequest(paid);
                    notify(paidEvent(paid));
                  }}
                  hostAlias={alias}
                  onAttachLink={() => {
                    saveRequest({ ...request, hasLink: true });
                  }}
                />
              ))}
            </div>
          )}

          {showCancelled && cancelled.length > 0 ? (
            <div style={{ marginTop: 30 }}>
              <p className="eyebrow" style={{ margin: "0 0 10px" }}>
                Cancelled
              </p>
              <div style={{ borderTop: "1px solid var(--hairline)" }}>
                {cancelled.map((request) => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    network={network}
                    open={false}
                    onToggle={() => {}}
                    onPdf={() => receiptForRequest(request)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="faint" style={{ margin: 0, fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
        {label}
      </p>
      <p className="mono" style={{ margin: "4px 0 0", fontSize: "0.9rem", wordBreak: "break-all" }}>
        {value}
      </p>
    </div>
  );
}

function RequestRow({
  request,
  network,
  open,
  onToggle,
  onPdf,
  onCancel,
  onMarkPaid,
  onAttachLink,
  hostAlias,
}: {
  request: PaymentRequest;
  network: TempoNetwork;
  open: boolean;
  onToggle: () => void;
  onPdf: () => void;
  onCancel?: () => void;
  onMarkPaid?: () => void;
  onAttachLink?: () => void;
  hostAlias?: string;
}) {
  const hasHash = Boolean(request.txHash && request.txHash.startsWith("0x"));
  return (
    <div>
      <button type="button" className="history-row" onClick={onToggle} aria-expanded={open}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1.4fr) minmax(0,0.8fr) minmax(0,1.2fr)",
            gap: 16,
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
              {request.createdAt.slice(0, 16).replace("T", " ")} · ref {request.id}
            </p>
          </div>
          <p className="mono" style={{ margin: 0 }}>
            {request.amount}
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
            <span
              className={`chip ${
                request.status === "paid" ? "chip-sage" : request.status === "cancelled" ? "chip-cancelled" : ""
              }`}
            >
              {request.status === "paid" ? "✓ paid" : request.status}
            </span>
            {hasHash ? (
              <a
                className="hash-link"
                style={{ fontSize: "0.78rem" }}
                href={explorerTxUrl(network, request.txHash!)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {request.txHash!.slice(0, 10)}…
              </a>
            ) : null}
          </div>
        </div>
      </button>

      {open ? (
        <div className="panel" style={{ padding: 20, margin: "10px 0 20px" }}>
          <div className="detail-grid">
            <Detail label="Amount" value={`${request.amount}`} />
            <Detail label="Reason" value={request.reason || "—"} />
            <Detail label="Created" value={request.createdAt.slice(0, 19).replace("T", " ")} />
            <Detail
              label="Finalised"
              value={request.paidAt ? request.paidAt.slice(0, 19).replace("T", " ") : "—"}
            />
            <Detail label="Settled by" value={request.settledBy ?? "—"} />
            <Detail label="Reference" value={request.id} />
          </div>

          {hasHash ? (
            <p style={{ marginTop: 16, fontSize: "0.85rem" }}>
              <span className="faint" style={{ marginRight: 8 }}>
                Tx
              </span>
              <a
                className="hash-link"
                href={explorerTxUrl(network, request.txHash!)}
                target="_blank"
                rel="noreferrer"
              >
                {request.txHash}
              </a>
            </p>
          ) : null}

          <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap", alignItems: "center" }}>
            <button className="pdf-again" onClick={onPdf}>
              {request.status === "paid" ? "Redownload PDF" : "Download PDF"}
            </button>
            {onMarkPaid && request.status === "waiting" ? (
              <button className="nav-link" onClick={onMarkPaid} style={{ background: "transparent", border: 0, cursor: "pointer" }}>
                Mark paid
              </button>
            ) : null}
            {onCancel && request.status === "waiting" ? (
              <button
                className="nav-link"
                onClick={onCancel}
                style={{ background: "transparent", border: 0, cursor: "pointer", color: "#c98b7f" }}
              >
                Cancel request
              </button>
            ) : null}
            {onAttachLink && request.status === "waiting" && !request.hasLink ? (
              <button className="nav-link" onClick={onAttachLink} style={{ background: "transparent", border: 0, cursor: "pointer" }}>
                Attach a pay link
              </button>
            ) : null}
            {request.hasLink && request.status === "waiting" ? (
              <Link
                className="link"
                style={{ fontSize: "0.88rem" }}
                href={payLinkUrl("/", {
                  id: request.id,
                  to: request.hostAddress,
                  hostName: hostAlias ?? "",
                  amount: request.amount,
                  reason: request.reason,
                  token: "USD",
                  network: network.name,
                })}
                target="_blank"
              >
                Open the pay page
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
