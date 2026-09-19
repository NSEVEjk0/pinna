"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useConnection, useSendTransactionSync } from "wagmi";
import { decodePayLink, encodePayLink, paymentConfirmation } from "@/lib/paylink";
import { buildBatch } from "@/lib/batch";
import { explorerTxUrl, explorerForRecord } from "@/lib/tempo";
import { shortAddress } from "@/lib/money";
import { useActiveNetwork } from "@/lib/useActiveNetwork";
import { usePinna } from "@/lib/usePinna";
import { downloadReceipt } from "@/lib/receipt";
import { findTransferByReference } from "@/lib/chain";
import { describeExpiry, isExpired } from "@/lib/expiry";

/**
 * The public pay page. The whole request travels in the link, so this page
 * needs no server and no account: the payer connects a wallet, presses pay,
 * and the transfer carries the request reference as its memo.
 *
 * Once the reference has been paid, the page stops offering a payment and
 * becomes a receipt — on any device, because the answer comes from the chain,
 * not from this browser.
 */

interface Settled {
  txHash: string;
  at?: string;
  amount?: string;
  from?: string;
}

/** A local memory of payments made from this browser, as a fast path. */
function readLocalSettlement(id: string): Settled | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`pinna:paid:${id}`);
    return raw ? (JSON.parse(raw) as Settled) : null;
  } catch {
    return null;
  }
}

function writeLocalSettlement(id: string, settled: Settled): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`pinna:paid:${id}`, JSON.stringify(settled));
  } catch {
    // storage blocked — the chain check still covers it
  }
}

export default function PayPage({ params }: { params: { id: string } }) {
  const search = useSearchParams();
  const encoded = search.get("d") ?? "";
  const payload = useMemo(() => decodePayLink(encoded), [encoded]);
  const { network, ensure, onRightChain, pending: switching, error: chainError } = useActiveNetwork();
  const { token: preferredToken, tokenOptions } = usePinna();
  const { address, isConnected } = useConnection();
  const { sendTransactionSyncAsync } = useSendTransactionSync();
  const [settled, setSettled] = useState<Settled | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkingChain, setCheckingChain] = useState(true);
  const [checkNote, setCheckNote] = useState<string | null>(null);

  // The link names the token it asked for; fall back to the preferred one when
  // the link predates that, so an older link still pays.
  const linkToken = payload
    ? tokenOptions.find((t) => t.symbol === payload.token) ?? preferredToken
    : preferredToken;
  const tokenAddress = linkToken.address;
  const host = payload?.hostName?.trim() || (payload ? shortAddress(payload.to) : "");

  // Fast path: this browser already paid it.
  useEffect(() => {
    const local = readLocalSettlement(params.id);
    if (local) setSettled(local);
  }, [params.id]);

  /** Ask Tempo whether this reference has been paid. */
  const checkTempo = useCallback(
    async (announce = false) => {
      if (!payload) return;
      setCheckingChain(true);
      if (announce) setCheckNote(null);
      try {
        const found = await findTransferByReference(network, tokenAddress, payload.to, params.id);
        if (found) {
          setSettled({
            txHash: found.txHash,
            at: found.timestamp ? new Date(found.timestamp * 1000).toISOString() : undefined,
            from: found.from,
          });
          if (announce) setCheckNote("Tempo confirms this reference has been paid.");
        } else if (announce) {
          setCheckNote("Tempo has no transfer carrying this reference yet.");
        }
      } catch (err) {
        if (announce) {
          setCheckNote(
            err instanceof Error ? `Could not read Tempo: ${err.message}` : "Could not read Tempo."
          );
        }
      } finally {
        setCheckingChain(false);
      }
    },
    [payload, network, tokenAddress, params.id]
  );

  // Run the check as soon as the page knows what it is looking for.
  useEffect(() => {
    if (!payload) {
      setCheckingChain(false);
      return;
    }
    void checkTempo(false);
  }, [payload, checkTempo]);

  const batch = useMemo(() => {
    if (!payload) return null;
    return buildBatch(
      [
        {
          id: params.id,
          name: payload.hostName || "",
          address: payload.to,
          amount: payload.amount,
          reason: payload.reason,
        },
      ],
      {
        token: tokenAddress,
        decimals: linkToken.decimals,
        referenceFor: () => params.id,
      }
    );
  }, [payload, params.id, tokenAddress, network]);

  async function pay() {
    if (!batch) return;
    setError(null);
    setSending(true);
    try {
      const hash = await sendTransactionSyncAsync({
        calls: batch.calls,
        feeToken: tokenAddress,
      } as never);
      const resolved = typeof hash === "string" ? hash : "";
      if (!resolved) {
        setError("The wallet did not return a transaction hash, so nothing was recorded.");
        return;
      }
      const entry = { txHash: resolved, at: new Date().toISOString(), from: address ?? undefined };
      writeLocalSettlement(params.id, entry);
      setSettled(entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The wallet did not complete the payment.");
    } finally {
      setSending(false);
    }
  }

  if (!payload) {
    return (
      <div className="shell fade-in" style={{ paddingTop: 60 }}>
        <p className="eyebrow">Pinna</p>
        <h1 className="display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", margin: "12px 0" }}>
          This pay link is incomplete.
        </h1>
        <p className="muted">Ask for a fresh link — the details travel inside it.</p>
        <Link className="link" href="/" style={{ display: "inline-block", marginTop: 20 }}>
          Go to Pinna
        </Link>
      </div>
    );
  }

  const expired = isExpired(payload.expiresAt);
  const agentUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/pay/${params.id}?d=${encodePayLink(payload)}`
      : "";

  const explorer = settled
    ? explorerForRecord({}, network, settled.txHash)
    : "";

  const confirmation = paymentConfirmation({
    payerName: address ? shortAddress(address, 6, 4) : "me",
    hostName: host,
    amount: payload.amount,
    reason: payload.reason,
    tokenSymbol: payload.token,
    txHash: settled?.txHash ?? "",
    explorerUrl: explorer,
    reference: payload.id,
  });

  return (
    <div className="shell fade-in" style={{ paddingTop: 34, paddingBottom: 40, maxWidth: 720 }}>
      <p className="eyebrow" style={{ margin: "0 0 18px" }}>
        Request from {host}
      </p>
      <h1 className="display" style={{ fontSize: "clamp(2.4rem, 6vw, 3.6rem)", margin: "0 0 6px" }}>
        {payload.amount} <span style={{ color: "var(--sage)" }}>{payload.token}</span>
      </h1>
      <p className="muted" style={{ margin: "0 0 30px", fontSize: "1.05rem" }}>
        {payload.reason || "A shared cost"}
      </p>

      {payload.message ? (
        <div className="panel" style={{ padding: "18px 20px", marginBottom: 26 }}>
          <p className="muted" style={{ margin: 0, fontStyle: "italic" }}>
            “{payload.message}”
          </p>
        </div>
      ) : null}

      {agentUrl ? (
        <div className="panel" style={{ padding: 18, marginBottom: 24 }}>
          <p className="eyebrow" style={{ margin: "0 0 8px" }}>
            Agents can pay this too
          </p>
          <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.9rem" }}>
            The same request answers a machine: ask without paying and it replies 402 with what is
            owed, then check the transfer hash and return a receipt.
          </p>
          <p className="mono" style={{ margin: "0 0 10px", fontSize: "0.78rem", wordBreak: "break-all" }}>
            GET {agentUrl}
          </p>
          <button className="pdf-again" onClick={() => navigator.clipboard?.writeText(agentUrl)}>
            Copy endpoint
          </button>
        </div>
      ) : null}

      <div style={{ borderTop: "1px solid var(--hairline)" }}>
        <Row label="Pay to" value={payload.to} mono />
        <Row label="On" value={payload.network} />
        <Row label="Reference" value={payload.id} mono />
        <Row label="Link" value={describeExpiry(payload.expiresAt)} />
        {payload.partyAddress ? (
          <Row
            label="Requested from"
            value={payload.partyName ? `${payload.partyName} · ${payload.partyAddress}` : payload.partyAddress}
          />
        ) : null}
      </div>

      {payload.partyAddress &&
      address &&
      address.toLowerCase() !== payload.partyAddress.toLowerCase() &&
      !settled ? (
        <p className="faint" style={{ marginTop: 16, fontSize: "0.86rem" }}>
          This request was addressed to {payload.partyName || "someone else"}, and you are paying
          from a different wallet. That is fine — the transfer carries the reference{" "}
          {payload.id}, and that reference is what marks the request paid.
        </p>
      ) : null}

      {settled ? (
        <div className="panel" style={{ padding: 26, marginTop: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <span className="check" aria-hidden="true">
              ✓
            </span>
            <div>
              <p className="eyebrow" style={{ margin: "0 0 6px" }}>
                Transaction completed
              </p>
              <p style={{ margin: 0, fontSize: "1.05rem" }}>
                This request has already been paid — {payload.amount} {payload.token} to {host}.
              </p>
            </div>
          </div>

          <p className="faint" style={{ margin: "18px 0 0", fontSize: "0.88rem" }}>
            Nothing more is owed on this link.
          </p>

          <div className="detail-grid" style={{ marginTop: 22 }}>
            <Detail label="Reference" value={payload.id} />
            <Detail
              label="Finalised"
              value={
                settled.at
                  ? settled.at.slice(0, 19).replace("T", " ")
                  : "recorded on Tempo"
              }
            />
            {settled.from ? <Detail label="Paid by" value={settled.from} /> : null}
            <Detail label="Amount" value={`${payload.amount} ${payload.token}`} />
          </div>

          <p style={{ marginTop: 18, fontSize: "0.9rem" }}>
            <span className="faint" style={{ marginRight: 8 }}>
              Tx
            </span>
            <a className="hash-link" href={explorer} target="_blank" rel="noreferrer">
              {settled.txHash}
            </a>
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 22, flexWrap: "wrap", alignItems: "center" }}>
            <button
              className="button"
              onClick={() =>
                downloadReceipt({
                  title: "Payment receipt",
                  subject: `Reference ${payload.id}`,
                  rows: [
                    {
                      id: params.id,
                      name: host,
                      address: payload.to,
                      amount: payload.amount,
                      reason: payload.reason,
                    },
                  ],
                  txHash: settled.txHash,
                  explorerUrl: explorer,
                  at: settled.at ?? new Date().toISOString(),
                  tokenSymbol: payload.token,
                  network: payload.network,
                  from: address ?? settled.from ?? "",
                  decimals: linkToken.decimals,
                  note: "This transfer carried the request reference as its memo.",
                })
              }
            >
              Download PDF receipt
            </button>
            <button
              className="button button-quiet"
              onClick={() => checkTempo(true)}
              disabled={checkingChain}
            >
              {checkingChain ? "Reading Tempo…" : "Check Tempo again"}
            </button>
            <button
              className="pdf-again"
              onClick={async () => {
                await navigator.clipboard?.writeText(confirmation);
                setCopied(true);
                setTimeout(() => setCopied(false), 2400);
              }}
            >
              {copied ? "Copied" : "Copy confirmation"}
            </button>
          </div>

          {checkNote ? (
            <p className="muted" style={{ marginTop: 16, fontSize: "0.86rem" }}>
              {checkNote}
            </p>
          ) : null}

          <div className="panel" style={{ padding: 18, marginTop: 22, background: "rgba(244,241,234,0.02)" }}>
            <p className="eyebrow" style={{ margin: "0 0 10px" }}>
              Send this back to {host}
            </p>
            <p className="muted" style={{ margin: 0, fontSize: "0.92rem", whiteSpace: "pre-line" }}>
              {confirmation}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 28 }}>
          {!onRightChain && isConnected ? (
            <div className="panel" style={{ padding: 16, marginBottom: 18 }}>
              <p style={{ margin: "0 0 10px", fontSize: "0.92rem" }}>
                Add {network.name} to your wallet to pay.
              </p>
              <button className="button button-quiet" onClick={ensure} disabled={switching}>
                {switching ? "Waiting for your wallet…" : `Switch to ${network.name}`}
              </button>
              {chainError ? <p style={{ color: "#c98b7f", marginTop: 10 }}>{chainError}</p> : null}
            </div>
          ) : null}
          {expired ? (
            <div className="network-warning" style={{ marginBottom: 18 }}>
              <span aria-hidden="true">⚠</span>
              <span>
                This link closed on {describeExpiry(payload.expiresAt).replace("Expired ", "")} and
                no longer accepts payment. Ask {host} for a new one, or press Check Tempo if you
                paid before it closed.
              </span>
            </div>
          ) : null}
          <button
            className="button"
            onClick={pay}
            disabled={!isConnected || sending || !onRightChain || expired}
          >
            {sending ? "Waiting for your wallet…" : `Pay ${payload.amount} ${payload.token} on Tempo`}
          </button>
          {!isConnected ? (
            <p className="faint" style={{ marginTop: 12, fontSize: "0.85rem" }}>
              Connect a wallet to pay.
            </p>
          ) : null}
          {error ? <p style={{ color: "#c98b7f", marginTop: 12 }}>{error}</p> : null}
          <p className="faint" style={{ marginTop: 14, fontSize: "0.82rem" }}>
            One signature. The fee is paid in the same stablecoin, and the transfer carries the
            reference {payload.id}.
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
            <button
              className="button button-quiet"
              onClick={() => checkTempo(true)}
              disabled={checkingChain}
            >
              {checkingChain ? "Reading Tempo…" : "Check Tempo"}
            </button>
            {checkNote ? (
              <span className="muted" style={{ fontSize: "0.86rem" }}>
                {checkNote}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 20,
        padding: "16px 0",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <span
        className="faint"
        style={{ fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase" }}
      >
        {label}
      </span>
      <span className={mono ? "mono" : ""} style={{ wordBreak: "break-all", textAlign: "right" }}>
        {value}
      </span>
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
