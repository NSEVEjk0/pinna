"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePinna } from "@/lib/usePinna";
import { explorerForRecord, type TempoNetwork } from "@/lib/tempo";
import { findSettlement, findPossibleMatch, markPaid, cancel, type PaymentRequest } from "@/lib/requests";
import { parseAmount, formatAmount } from "@/lib/money";
import { downloadReceipt } from "@/lib/receipt";
import { findRepeats, type RepeatCandidate } from "@/lib/duplicates";
import { paidEvent } from "@/lib/events";
import { payLinkUrl } from "@/lib/paylink";
import type { LedgerEntry } from "@/lib/ledger";
import type { IncomingTransfer } from "@/lib/requests";
import { readIncomingTransfers } from "@/lib/chain";
import { whenText, hashLabel } from "@/lib/format";

const TABS = [
  "Money sent / paid by you",
  "Money requested / received by you",
  "Waiting (links not paid / outstanding payments)",
] as const;

type Tab = (typeof TABS)[number];

export default function HistoryPage() {
  const {
    isConnected,
    address,
    alias,
    network,
    token,
    sent,
    requests,
    ledger,
    lastSync,
    syncing,
    syncError,
    syncFromChain,
    saveRequest,
    notify,
  } = usePinna();

  const [tab, setTab] = useState<Tab>(TABS[0]);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [transfers, setTransfers] = useState<IncomingTransfer[]>([]);
  const [possible, setPossible] = useState<Record<string, IncomingTransfer>>({});
  const [note, setNote] = useState<string | null>(null);

  // Read the chain whenever the wallet or network changes.
  useEffect(() => {
    if (!address) return;
    void syncFromChain({ quiet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, network.chainId]);

  const sentLedger = useMemo(
    () => ledger.filter((e) => e.direction === "sent"),
    [ledger]
  );
  const receivedLedger = useMemo(
    () => ledger.filter((e) => e.direction === "received"),
    [ledger]
  );

  const paidRequests = requests.filter((r) => r.status === "paid");
  const waiting = requests.filter((r) => r.status === "waiting");
  const cancelled = requests.filter((r) => r.status === "cancelled");

  const repeatCandidates: RepeatCandidate[] = useMemo(
    () =>
      ledger
        .filter((e) => e.direction === "sent" && e.txHash)
        .map((e, i) => ({
          id: `${e.txHash}-${i}`,
          name: e.name || e.address,
          address: e.address,
          amount: e.amount,
          reason: e.reason,
          txHash: e.txHash,
          at: e.at,
        })),
    [ledger]
  );
  const repeats = useMemo(() => findRepeats(repeatCandidates), [repeatCandidates]);

  /** Settle waiting requests whose memo appeared, and offer the ones that did not. */
  async function checkTempo() {
    if (!address) return;
    setNote(null);
    setPossible({});
    const found = await syncFromChain();
    if (!found) {
      setNote(syncError ?? "Tempo could not be read just now.");
      return;
    }
    try {
      const incoming = await readIncomingTransfers(network, token.address, address);
      setTransfers(incoming);
      const candidates: Record<string, IncomingTransfer> = {};
      let settled = 0;

      const next = requests.map((request) => {
        if (request.status !== "waiting") return request;
        const amounts = { expectedUnits: parseAmount(request.amount, token.decimals) };
        const match = findSettlement(request, incoming, amounts);
        if (match) {
          settled += 1;
          const paid = markPaid(request, { txHash: match.txHash, settledBy: "detected" });
          paid.chainId = network.chainId;
          paid.explorerUrl = network.explorerUrl;
          notify(paidEvent(paid, match.txHash));
          return paid;
        }
        const maybe = findPossibleMatch(request, incoming, amounts);
        if (maybe) candidates[request.id] = maybe;
        return request;
      });

      next.forEach((r) => saveRequest(r));
      setPossible(candidates);
      setNote(
        settled > 0
          ? `${settled} payment${settled === 1 ? "" : "s"} matched by reference on Tempo.`
          : Object.keys(candidates).length > 0
            ? "No payment carried a matching reference. One transfer looks similar — check below."
            : "No matching transfer on Tempo yet."
      );
    } catch (err) {
      setNote(err instanceof Error ? `Could not read Tempo: ${err.message}` : "Could not read Tempo.");
    }
  }

  function receiptForEntry(entry: LedgerEntry) {
    downloadReceipt({
      title: entry.direction === "sent" ? "Payment receipt" : "Received payment",
      subject: entry.reference ? `Reference ${entry.reference}` : "Chain record",
      rows: [
        {
          id: entry.id,
          name: entry.name || entry.address,
          address: entry.address as `0x${string}`,
          amount: entry.amount,
          reason: entry.reason,
        },
      ],
      txHash: entry.txHash,
      explorerUrl: explorerForRecord(entry, network, entry.txHash),
      at: entry.at || new Date().toISOString(),
      tokenSymbol: entry.tokenSymbol,
      network: network.name,
      from: address ?? "",
      decimals: token.decimals,
      note: entry.reference
        ? `Reference ${entry.reference} was written into the transfer memo on Tempo.`
        : "Read from Tempo; no Pinna reference was attached to this transfer.",
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
      explorerUrl: request.txHash ? explorerForRecord(request, network, request.txHash) : "",
      at: request.paidAt ?? request.createdAt,
      tokenSymbol: token.symbol,
      network: network.name,
      from: request.hostAddress,
      decimals: token.decimals,
      note: request.status === "paid" ? "Settled by a verified Tempo transfer." : undefined,
    });
  }

  if (!isConnected) {
    return (
      <div className="shell fade-in" style={{ paddingTop: 40 }}>
        <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4.2vw, 2.8rem)", margin: "0 0 14px" }}>
          Connect a wallet to see history
        </h1>
        <p className="muted" style={{ maxWidth: "48ch" }}>
          Pinna reads your transactions from Tempo, so the history is the chain&apos;s, not a
          local copy.
        </p>
      </div>
    );
  }

  return (
    <div className="shell fade-in" style={{ paddingTop: 8, paddingBottom: 40 }}>
      <p className="eyebrow" style={{ margin: "0 0 14px" }}>
        History
      </p>
      <h1 className="display" style={{ fontSize: "clamp(2rem, 4.6vw, 3rem)", margin: "0 0 18px" }}>
        What moved, what is owed.
      </h1>

      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 28,
        }}
      >
        <button className="button button-quiet" onClick={checkTempo} disabled={syncing}>
          {syncing ? "Reading Tempo…" : "Sync from Tempo"}
        </button>
        <span className="faint" style={{ fontSize: "0.82rem" }}>
          {lastSync
            ? `Last checked ${whenText(lastSync)}`
            : "Not checked yet — press to read your transactions from the chain"}
        </span>
        {note ? (
          <span className="muted" style={{ fontSize: "0.88rem" }}>
            {note}
          </span>
        ) : null}
        {syncError ? <span style={{ color: "#c98b7f", fontSize: "0.88rem" }}>{syncError}</span> : null}
      </div>

      {repeats.length > 0 ? (
        <div className="panel" style={{ padding: 22, marginBottom: 34 }}>
          <p className="eyebrow" style={{ margin: "0 0 6px" }}>
            Repeated payments
          </p>
          <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.92rem" }}>
            The same person and the same amount, more than once — as recorded on Tempo.
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
                  {group.address.slice(0, 12)}…{group.address.slice(-6)}
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
        sentLedger.length === 0 ? (
          <p className="muted">
            Nothing sent yet. Press “Sync from Tempo” to read your past transfers.
          </p>
        ) : (
          <div style={{ borderTop: "1px solid var(--hairline)" }}>
            {sentLedger.map((entry) => (
              <LedgerRow
                key={entry.id}
                entry={entry}
                network={network}
                open={openRow === entry.id}
                onToggle={() => setOpenRow(openRow === entry.id ? null : entry.id)}
                onPdf={() => receiptForEntry(entry)}
              />
            ))}
          </div>
        )
      ) : null}

      {tab === TABS[1] ? (
        receivedLedger.length === 0 ? (
          <p className="muted">
            Nothing received yet. Press “Sync from Tempo” to read your past transfers.
          </p>
        ) : (
          <div style={{ borderTop: "1px solid var(--hairline)" }}>
            {receivedLedger.map((entry) => (
              <LedgerRow
                key={entry.id}
                entry={entry}
                network={network}
                open={openRow === entry.id}
                onToggle={() => setOpenRow(openRow === entry.id ? null : entry.id)}
                onPdf={() => receiptForEntry(entry)}
              />
            ))}
          </div>
        )
      ) : null}

      {tab === TABS[2] ? (
        <>
          {waiting.length === 0 ? (
            <p className="muted">Nothing waiting.</p>
          ) : (
            <div style={{ borderTop: "1px solid var(--hairline)" }}>
              {waiting.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  network={network}
                  open={openRow === request.id}
                  onToggle={() => setOpenRow(openRow === request.id ? null : request.id)}
                  onPdf={() => receiptForRequest(request)}
                  onCancel={() => saveRequest(cancel(request))}
                  onMarkPaid={() => {
                    const paid = markPaid(request, { settledBy: "marked" });
                    paid.chainId = network.chainId;
                    paid.explorerUrl = network.explorerUrl;
                    saveRequest(paid);
                    notify(paidEvent(paid));
                  }}
                  onAttachLink={() => saveRequest({ ...request, hasLink: true })}
                  hostAlias={alias}
                  possible={possible[request.id]}
                  onAcceptPossible={(transfer) => {
                    const paid = markPaid(request, {
                      txHash: transfer.txHash,
                      settledBy: "marked",
                    });
                    paid.chainId = network.chainId;
                    paid.explorerUrl = network.explorerUrl;
                    saveRequest(paid);
                    notify(paidEvent(paid, transfer.txHash));
                    setPossible((prev) => {
                      const next = { ...prev };
                      delete next[request.id];
                      return next;
                    });
                  }}
                />
              ))}
            </div>
          )}

          {paidRequests.length > 0 ? (
            <div style={{ marginTop: 34 }}>
              <p className="eyebrow" style={{ margin: "0 0 10px" }}>
                Settled
              </p>
              <div style={{ borderTop: "1px solid var(--hairline)" }}>
                {paidRequests.map((request) => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    network={network}
                    open={openRow === request.id}
                    onToggle={() => setOpenRow(openRow === request.id ? null : request.id)}
                    onPdf={() => receiptForRequest(request)}
                    hostAlias={alias}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {cancelled.length > 0 ? (
            <div style={{ marginTop: 30 }}>
              <button
                className="nav-link"
                onClick={() => setShowCancelled((v) => !v)}
                style={{ background: "transparent", border: 0, cursor: "pointer" }}
              >
                {showCancelled ? "Hide" : "Show"} cancelled ({cancelled.length})
              </button>
              {showCancelled ? (
                <div style={{ borderTop: "1px solid var(--hairline)", marginTop: 12 }}>
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
              ) : null}
            </div>
          ) : null}
          {transfers.length === 0 ? (
            <p className="faint" style={{ marginTop: 22, fontSize: "0.82rem" }}>
              “Sync from Tempo” reads the chain so links paid on another device are matched here.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function LedgerRow({
  entry,
  network,
  open,
  onToggle,
  onPdf,
}: {
  entry: LedgerEntry;
  network: TempoNetwork;
  open: boolean;
  onToggle: () => void;
  onPdf: () => void;
}) {
  return (
    <div>
      <button type="button" className="history-row" onClick={onToggle} aria-expanded={open}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1.4fr) minmax(0,0.8fr) minmax(0,1.3fr)",
            gap: 16,
            alignItems: "baseline",
          }}
          className="row-grid"
        >
          <div>
            <p style={{ margin: 0 }}>
              {entry.name || entry.address}
              {entry.reason ? (
                <span className="faint" style={{ marginLeft: 10, fontSize: "0.82rem" }}>
                  {entry.reason}
                </span>
              ) : null}
            </p>
            <p className="faint mono" style={{ margin: "4px 0 0", fontSize: "0.74rem" }}>
              {whenText(entry.at)}
              {entry.reference ? ` · ref ${entry.reference}` : ""}
            </p>
          </div>
          <p className="mono" style={{ margin: 0 }}>
            {entry.amount} {entry.tokenSymbol}
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
            <span className={`chip ${entry.status === "paid" ? "chip-sage" : "chip-sage"}`}>
              {entry.status === "paid" ? "✓ paid" : "↓ received"}
            </span>
            <a
              className="hash-link"
              style={{ fontSize: "0.78rem" }}
              href={explorerForRecord(entry, network, entry.txHash)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {hashLabel(entry.txHash)}
            </a>
          </div>
        </div>
      </button>

      {open ? (
        <div className="panel" style={{ padding: 20, margin: "10px 0 20px" }}>
          <div className="detail-grid">
            <Detail label="Status" value={entry.status} />
            <Detail label="Amount" value={`${entry.amount} ${entry.tokenSymbol}`} />
            <Detail label={entry.direction === "sent" ? "Sent to" : "Received from"} value={entry.address} />
            <Detail label="Reference" value={entry.reference ?? "none on this transfer"} />
            <Detail label="Reason" value={entry.reason || "—"} />
            <Detail label="Finalised" value={whenText(entry.at)} />
            <Detail label="Source" value={entry.fromChain ? "read from Tempo" : "local record"} />
            <Detail label="Transaction" value={hashLabel(entry.txHash, 16, 10)} />
          </div>

          <p style={{ marginTop: 16, fontSize: "0.85rem", wordBreak: "break-all" }}>
            <span className="faint" style={{ marginRight: 8 }}>
              Hash
            </span>
            <a
              className="hash-link"
              href={explorerForRecord(entry, network, entry.txHash)}
              target="_blank"
              rel="noreferrer"
            >
              {entry.txHash}
            </a>
          </p>

          <div style={{ marginTop: 18 }}>
            <button className="pdf-again" onClick={onPdf}>
              Download PDF
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className="faint"
        style={{ margin: 0, fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase" }}
      >
        {label}
      </p>
      <p className="mono" style={{ margin: "4px 0 0", fontSize: "0.88rem", wordBreak: "break-all" }}>
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
  onAcceptPossible,
  possible,
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
  onAcceptPossible?: (transfer: IncomingTransfer) => void;
  possible?: IncomingTransfer;
  hostAlias?: string;
}) {
  const hasHash = Boolean(request.txHash && request.txHash.startsWith("0x"));
  return (
    <div>
      <button type="button" className="history-row" onClick={onToggle} aria-expanded={open}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1.4fr) minmax(0,0.8fr) minmax(0,1.3fr)",
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
              {whenText(request.createdAt)} · ref {request.id}
            </p>
          </div>
          <p className="mono" style={{ margin: 0 }}>
            {request.amount}
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
            <span
              className={`chip ${
                request.status === "paid"
                  ? "chip-sage"
                  : request.status === "cancelled"
                    ? "chip-cancelled"
                    : ""
              }`}
            >
              {request.status === "paid" ? "✓ received" : request.status}
            </span>
            {hasHash ? (
              <a
                className="hash-link"
                style={{ fontSize: "0.78rem" }}
                href={explorerForRecord(request, network, request.txHash!)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {hashLabel(request.txHash!)}
              </a>
            ) : null}
          </div>
        </div>
      </button>

      {open ? (
        <div className="panel" style={{ padding: 20, margin: "10px 0 20px" }}>
          <div className="detail-grid">
            <Detail label="Amount" value={request.amount} />
            <Detail label="Reason" value={request.reason || "—"} />
            <Detail label="Created" value={whenText(request.createdAt)} />
            <Detail label="Finalised" value={request.paidAt ? whenText(request.paidAt) : "—"} />
            <Detail label="Settled by" value={request.settledBy ?? "—"} />
            <Detail label="Reference" value={request.id} />
          </div>

          {hasHash ? (
            <p style={{ marginTop: 16, fontSize: "0.85rem", wordBreak: "break-all" }}>
              <span className="faint" style={{ marginRight: 8 }}>
                Tx
              </span>
              <a
                className="hash-link"
                href={explorerForRecord(request, network, request.txHash!)}
                target="_blank"
                rel="noreferrer"
              >
                {request.txHash}
              </a>
            </p>
          ) : null}

          {possible && request.status === "waiting" ? (
            <div
              className="panel"
              style={{ padding: 14, marginTop: 16, background: "rgba(244,241,234,0.02)" }}
            >
              <p className="eyebrow" style={{ margin: "0 0 8px" }}>
                Possible match
              </p>
              <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.88rem" }}>
                A transfer of {formatAmount(possible.amountUnits, 6)} to you from{" "}
                {possible.from.slice(0, 10)}… carries no reference, so Pinna will not call it
                paid on its own. If this is the payment, confirm it.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <a
                  className="hash-link"
                  style={{ fontSize: "0.8rem" }}
                  href={explorerForRecord({}, network, possible.txHash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {hashLabel(possible.txHash)}
                </a>
                {onAcceptPossible ? (
                  <button className="pdf-again" onClick={() => onAcceptPossible(possible)}>
                    Yes, this is it
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap", alignItems: "center" }}>
            <button className="pdf-again" onClick={onPdf}>
              {request.status === "paid" ? "Redownload PDF" : "Download PDF"}
            </button>
            {onMarkPaid && request.status === "waiting" ? (
              <button
                className="nav-link"
                onClick={onMarkPaid}
                style={{ background: "transparent", border: 0, cursor: "pointer" }}
              >
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
              <button
                className="nav-link"
                onClick={onAttachLink}
                style={{ background: "transparent", border: 0, cursor: "pointer" }}
              >
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
                  hostName: request.hostAlias ?? hostAlias ?? "",
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
