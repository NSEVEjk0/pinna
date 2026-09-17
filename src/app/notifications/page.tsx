"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePinna } from "@/lib/usePinna";
import { explorerForRecord } from "@/lib/tempo";
import { whenText, hashLabel } from "@/lib/format";

/**
 * Notifications: what actually moved. Every row is a transaction Pinna read
 * from Tempo — money received, money paid — with its hash, so the page is a
 * record rather than a pile of local guesses.
 */
export default function NotificationsPage() {
  const { isConnected, network, ledger, events, readNotifications, syncFromChain, syncing, lastSync } =
    usePinna();
  const [filter, setFilter] = useState<"all" | "received" | "sent">("all");

  useEffect(() => {
    if (!isConnected) return;
    void syncFromChain({ quiet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, network.chainId]);

  const received = ledger.filter((e) => e.direction === "received");
  const sentTx = ledger.filter((e) => e.direction === "sent");
  const rows = filter === "received" ? received : filter === "sent" ? sentTx : ledger;

  // Requests that were paid show up here too, even before a sync.
  const paidFromLocal = useMemo(
    () => events.filter((e) => e.kind === "request_paid" && e.txHash),
    [events]
  );

  useEffect(() => {
    if (isConnected && events.some((e) => !e.read)) readNotifications();
  }, [isConnected, events, readNotifications]);

  if (!isConnected) {
    return (
      <div className="shell fade-in" style={{ paddingTop: 40 }}>
        <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4.2vw, 2.8rem)", margin: "0 0 14px" }}>
          Connect a wallet to see notifications
        </h1>
        <p className="muted" style={{ maxWidth: "48ch" }}>
          Pinna reads your transactions from Tempo, so this page shows what actually happened on
          chain.
        </p>
      </div>
    );
  }

  return (
    <div className="shell fade-in" style={{ paddingTop: 8, paddingBottom: 40 }}>
      <p className="eyebrow" style={{ margin: "0 0 14px" }}>
        Notifications
      </p>
      <h1 className="display" style={{ fontSize: "clamp(2rem, 4.6vw, 3rem)", margin: "0 0 12px" }}>
        What happened.
      </h1>
      <p className="muted" style={{ margin: "0 0 22px", maxWidth: "56ch" }}>
        Every payment in and out of this wallet, read from Tempo — <strong>received</strong> for
        money that arrived, <strong>paid</strong> for money that left — each with its transaction
        hash.
      </p>

      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 26 }}>
        <button className="button button-quiet" onClick={() => syncFromChain()} disabled={syncing}>
          {syncing ? "Reading Tempo…" : "Sync from Tempo"}
        </button>
        <span className="faint" style={{ fontSize: "0.82rem" }}>
          {lastSync ? `Last checked ${whenText(lastSync)}` : "Not checked yet"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {(
          [
            ["all", `All (${ledger.length})`],
            ["received", `Received (${received.length})`],
            ["sent", `Paid (${sentTx.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className="pick-button"
            onClick={() => setFilter(key)}
            style={{
              borderColor: filter === key ? "var(--sage)" : undefined,
              color: filter === key ? "var(--sage)" : undefined,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="muted">
          Nothing yet. Press “Sync from Tempo” to read your transactions from the chain.
        </p>
      ) : (
        <div style={{ borderTop: "1px solid var(--hairline)" }}>
          {rows.map((entry) => (
            <div key={entry.id} className="notif-row">
              <div>
                <p style={{ margin: 0 }}>
                  <span className={`chip ${entry.direction === "received" ? "chip-sage" : ""}`} style={{ marginRight: 12 }}>
                    {entry.direction === "received" ? "↓ received" : "✓ paid"}
                  </span>
                  {entry.amount} {entry.tokenSymbol}
                  <span className="faint" style={{ marginLeft: 10, fontSize: "0.85rem" }}>
                    {entry.direction === "received" ? "from" : "to"}{" "}
                    {entry.name || entry.address.slice(0, 12) + "…"}
                  </span>
                </p>
                <p className="faint" style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
                  {whenText(entry.at)}
                  {entry.reason ? ` · ${entry.reason}` : ""}
                  {entry.reference ? ` · ref ${entry.reference}` : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
                <a
                  className="hash-link"
                  style={{ fontSize: "0.8rem" }}
                  href={explorerForRecord(entry, network, entry.txHash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {hashLabel(entry.txHash)}
                </a>
                <Link className="link" style={{ fontSize: "0.85rem" }} href="/history">
                  History
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {paidFromLocal.length > 0 ? (
        <div style={{ marginTop: 36 }}>
          <p className="eyebrow" style={{ margin: "0 0 10px" }}>
            Requests that were paid
          </p>
          <div style={{ borderTop: "1px solid var(--hairline)" }}>
            {paidFromLocal.map((event) => (
              <div key={event.id} className="notif-row">
                <div>
                  <p style={{ margin: 0 }}>{event.title}</p>
                  <p className="faint" style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
                    {event.detail} · {whenText(event.at)}
                  </p>
                </div>
                {event.txHash ? (
                  <a
                    className="hash-link"
                    style={{ fontSize: "0.8rem" }}
                    href={explorerForRecord({}, network, event.txHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {hashLabel(event.txHash)}
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
