"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSendTransactionSync } from "wagmi";
import { RowsEditor, newRow, payableRows } from "@/components/RowsEditor";
import { usePinna } from "@/lib/usePinna";
import { buildBatch } from "@/lib/batch";
import { formatAmount, groupByRecipient, listTotal, displayName, type PayableRow } from "@/lib/money";
import { explorerTxUrl } from "@/lib/tempo";
import { downloadReceipt } from "@/lib/receipt";
import { useActiveNetwork } from "@/lib/useActiveNetwork";
import { useDraftContact } from "@/lib/useDraftContact";

type Stage = "edit" | "review" | "sent";

export default function SendPage() {
  const { address, isConnected, contacts, network, token, saveContact, recordSent } = usePinna();
  const { ensure, onRightChain, pending: switching, error: chainError, network: activeNet } =
    useActiveNetwork();
  const { consume } = useDraftContact("send");
  const [rows, setRows] = useState<PayableRow[]>([newRow(), newRow()]);
  const [stage, setStage] = useState<Stage>("edit");
  const [txHash, setTxHash] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const { sendTransactionSync } = useSendTransactionSync();

  // A contact chosen on the Contacts screen arrives as the first row.
  useEffect(() => {
    const draft = consume();
    if (!draft) return;
    setRows((prev) => {
      const first = { ...prev[0], name: draft.name, address: draft.address };
      return [first, ...prev.slice(1)];
    });
  }, [consume]);

  const ready = useMemo(() => payableRows(rows), [rows]);
  const total = useMemo(() => (ready.length ? listTotal(ready) : 0n), [ready]);
  const groups = useMemo(() => groupByRecipient(ready), [ready]);
  const batch = useMemo(
    () => (ready.length ? buildBatch(ready, { token: token.address, decimals: token.decimals }) : null),
    [ready, token]
  );

  function update(id: string, patch: Partial<PayableRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function pay() {
    if (!batch || !address) return;
    setError(null);
    setSending(true);
    try {
      const hash = sendTransactionSync({
        calls: batch.calls,
        feeToken: token.address,
      } as never);
      const resolved = typeof hash === "string" ? hash : "";
      setTxHash(resolved);
      setStage("sent");
      ready.forEach((row) => {
        if (row.name.trim()) saveContact({ address: row.address, name: row.name.trim() }, true);
      });
      recordSent({
        id: `list_${Date.now().toString(36)}`,
        to: groups.map((g) => displayName(g)),
        rowCount: ready.length,
        total: formatAmount(total, token.decimals),
        txHash: resolved,
        at: new Date().toISOString(),
        tokenSymbol: token.symbol,
        network: network.name,
        rows: ready.map((r) => ({
          name: r.name.trim() || r.address,
          address: r.address,
          amount: r.amount,
          reason: r.reason,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The wallet did not complete the payment.");
    } finally {
      setSending(false);
    }
  }

  if (!isConnected) {
    return (
      <EmptyState
        title="Connect a wallet to send"
        body="Pinna signs with your own wallet on Tempo. Nothing is held on a server."
      />
    );
  }

  return (
    <div className="shell fade-in" style={{ paddingTop: 56, paddingBottom: 40 }}>
      <p className="eyebrow" style={{ margin: "0 0 14px" }}>
        Send
      </p>

      {stage === "edit" ? (
        <>
          <h1 className="display" style={{ fontSize: "clamp(2rem, 4.6vw, 3.2rem)", margin: "0 0 12px", maxWidth: "24ch" }}>
            Write the list. Sign once.
          </h1>
          <p className="muted" style={{ maxWidth: "56ch", margin: "0 0 44px" }}>
            Add a row per payment. Two rows for the same person are two transfers — Pinna never
            merges them, so the amounts and reasons stay separate on chain.
          </p>

          <RowsEditor
            rows={rows}
            contacts={contacts}
            tokenSymbol={token.symbol}
            totalLabel="Total"
            onChange={update}
            onAdd={() => setRows((prev) => [...prev, newRow()])}
            onRemove={(id) => setRows((prev) => prev.filter((r) => r.id !== id))}
          />

          {error ? <p style={{ color: "#c98b7f", marginTop: 18 }}>{error}</p> : null}

          <div style={{ display: "flex", gap: 14, marginTop: 34, flexWrap: "wrap" }}>
            <button className="button" onClick={() => setStage("review")} disabled={ready.length === 0}>
              Pay this list
            </button>
            <Link className="button button-quiet" href="/contacts">
              Add a contact
            </Link>
          </div>
        </>
      ) : null}

      {stage === "review" ? (
        <>
          <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4.2vw, 2.9rem)", margin: "0 0 10px" }}>
            One signature, {ready.length} transfer{ready.length === 1 ? "" : "s"}
          </h1>
          <p className="muted" style={{ margin: "0 0 36px" }}>
            Fees are paid in {token.symbol} on {network.name}. There is no separate gas token to
            hold.
          </p>

          <div style={{ borderTop: "1px solid var(--hairline)" }}>
            {groups.map((group) => (
              <div
                key={group.address}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 20,
                  padding: "20px 0",
                  borderBottom: "1px solid var(--hairline)",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: "1.05rem" }}>{displayName(group)}</p>
                  <p className="faint mono" style={{ margin: "4px 0 0", fontSize: "0.78rem" }}>
                    {group.address}
                  </p>
                  {group.count > 1 ? (
                    <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.88rem" }}>
                      {group.count} payments: {group.rows.map((r) => r.amount).join(" + ")}
                    </p>
                  ) : null}
                </div>
                <p className="mono" style={{ margin: 0, fontSize: "1.2rem" }}>
                  {formatAmount(group.totalUnits, token.decimals)} {token.symbol}
                </p>
              </div>
            ))}
          </div>

          <p style={{ margin: "26px 0 0", display: "flex", justifyContent: "space-between" }}>
            <span className="eyebrow">Total</span>
            <span className="mono" style={{ fontSize: "1.6rem" }}>
              {formatAmount(total, token.decimals)} {token.symbol}
            </span>
          </p>

          {error ? <p style={{ color: "#c98b7f", marginTop: 18 }}>{error}</p> : null}

          {!onRightChain ? (
            <div className="panel" style={{ padding: 18, marginTop: 22 }}>
              <p style={{ margin: "0 0 12px" }}>
                Your wallet is not on {activeNet.name} yet. Add it in one step.
              </p>
              <button className="button button-quiet" onClick={ensure} disabled={switching}>
                {switching ? "Waiting for your wallet…" : `Switch to ${activeNet.name}`}
              </button>
              {chainError ? <p style={{ color: "#c98b7f", marginTop: 10 }}>{chainError}</p> : null}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 14, marginTop: 34, flexWrap: "wrap" }}>
            <button className="button" onClick={pay} disabled={sending || !onRightChain}>
              {sending ? "Waiting for your wallet…" : "Sign and pay"}
            </button>
            <button className="button button-quiet" onClick={() => setStage("edit")} disabled={sending}>
              Back to the list
            </button>
          </div>
        </>
      ) : null}

      {stage === "sent" ? (
        <>
          <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4.2vw, 2.9rem)", margin: "0 0 12px" }}>
            Paid.
          </h1>
          <p className="muted" style={{ margin: "0 0 30px" }}>
            {ready.length} transfers settled in one Tempo transaction, each carrying its own
            reference.
          </p>

          <div className="panel" style={{ padding: 24 }}>
            <p className="eyebrow" style={{ margin: "0 0 10px" }}>
              Tempo transaction
            </p>
            <p className="mono" style={{ margin: "0 0 14px", wordBreak: "break-all", fontSize: "0.92rem" }}>
              {txHash || "—"}
            </p>
            {txHash ? (
              <a className="link" href={explorerTxUrl(network, txHash)} target="_blank" rel="noreferrer">
                View on the Tempo explorer
              </a>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 14, marginTop: 28, flexWrap: "wrap" }}>
            <button
              className="button"
              onClick={() =>
                downloadReceipt({
                  title: "Payment receipt",
                  rows: ready,
                  txHash,
                  explorerUrl: txHash ? explorerTxUrl(network, txHash) : "",
                  at: new Date().toISOString(),
                  tokenSymbol: token.symbol,
                  network: network.name,
                  from: address ?? "",
                  decimals: token.decimals,
                  note: "Every transfer in this receipt carried a reference memo on Tempo.",
                })
              }
            >
              Download PDF receipt
            </button>
            <button
              className="button button-quiet"
              onClick={() => {
                setRows([newRow(), newRow()]);
                setTxHash("");
                setStage("edit");
              }}
            >
              Start another list
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="shell fade-in" style={{ paddingTop: 80 }}>
      <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4.2vw, 2.8rem)", margin: "0 0 14px" }}>
        {title}
      </h1>
      <p className="muted" style={{ maxWidth: "48ch" }}>
        {body}
      </p>
    </div>
  );
}
