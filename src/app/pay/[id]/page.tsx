"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConnection, useSendTransactionSync } from "wagmi";
import { decodePayLink } from "@/lib/paylink";
import { buildBatch } from "@/lib/batch";
import { decodeMemo, encodeMemo } from "@/lib/memo";
import { explorerTxUrl } from "@/lib/tempo";
import { currentNetwork } from "@/lib/wagmi";
import { shortAddress } from "@/lib/money";
import { useEnsureTempoChain } from "@/lib/useEnsureTempoChain";

/**
 * The public pay page. The whole request travels in the link, so this page
 * needs no server and no account: the payer connects a wallet, presses pay,
 * and the transfer carries the request reference as its memo.
 */
export default function PayPage({ params }: { params: { id: string } }) {
  const search = useSearchParams();
  const encoded = search.get("d") ?? "";
  const payload = useMemo(() => decodePayLink(encoded), [encoded]);
  const network = useMemo(() => currentNetwork(), []);
  const { address, isConnected } = useConnection();
  const { sendTransactionSync } = useSendTransactionSync();
  const { ensure, onRightChain, pending: switching, error: chainError, network: activeNet } =
    useEnsureTempoChain();
  const [hash, setHash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

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
        token: (process.env.NEXT_PUBLIC_TIP20 as `0x${string}`) || defaultToken(network),
        decimals: 6,
        referenceFor: () => params.id,
      }
    );
  }, [payload, params.id, network]);

  function pay() {
    if (!batch) return;
    setError(null);
    setSending(true);
    try {
      const result = sendTransactionSync({
        calls: batch.calls,
        feeToken: batch.calls[0]?.to,
      } as never);
      setHash(typeof result === "string" ? result : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The wallet did not complete the payment.");
    } finally {
      setSending(false);
    }
  }

  if (!payload) {
    return (
      <div className="shell fade-in" style={{ paddingTop: 90 }}>
        <p className="eyebrow">Pinna</p>
        <h1 className="display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", margin: "12px 0" }}>
          This pay link is incomplete.
        </h1>
        <p className="muted">Ask for a fresh link — the details travel inside it.</p>
      </div>
    );
  }

  return (
    <div className="shell fade-in" style={{ paddingTop: 72, paddingBottom: 40, maxWidth: 720 }}>
      <p className="eyebrow" style={{ margin: "0 0 18px" }}>
        Request from {payload.hostName || shortAddress(payload.to)}
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

      <div style={{ borderTop: "1px solid var(--hairline)" }}>
        <Row label="Pay to" value={payload.to} mono />
        <Row label="On" value={payload.network} />
        <Row label="Reference" value={payload.id} mono />
      </div>

      {hash ? (
        <div className="panel" style={{ padding: 22, marginTop: 26 }}>
          <p className="eyebrow" style={{ margin: "0 0 10px" }}>
            Paid
          </p>
          <p className="mono" style={{ margin: "0 0 12px", wordBreak: "break-all", fontSize: "0.9rem" }}>
            {hash}
          </p>
          <a className="link" href={explorerTxUrl(network, hash)} target="_blank" rel="noreferrer">
            View on the Tempo explorer
          </a>
          <p className="faint" style={{ margin: "14px 0 0", fontSize: "0.85rem" }}>
            The transfer carried the reference {payload.id}, so it matches this request
            automatically.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 28 }}>
          {!onRightChain && isConnected ? (
            <div className="panel" style={{ padding: 16, marginBottom: 18 }}>
              <p style={{ margin: "0 0 10px", fontSize: "0.92rem" }}>
                Add {activeNet.name} to your wallet to pay.
              </p>
              <button className="button button-quiet" onClick={ensure} disabled={switching}>
                {switching ? "Waiting for your wallet…" : `Switch to ${activeNet.name}`}
              </button>
              {chainError ? <p style={{ color: "#c98b7f", marginTop: 10 }}>{chainError}</p> : null}
            </div>
          ) : null}
          <button
            className="button"
            onClick={pay}
            disabled={!isConnected || sending || !onRightChain}
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
            One signature. The fee is paid in the same stablecoin.
          </p>
        </div>
      )}

      <p className="faint" style={{ marginTop: 40, fontSize: "0.8rem" }}>
        Memo preview: {decodeMemo(encodeMemo(payload.id)) ?? payload.id}
      </p>
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
      <span className="faint" style={{ fontSize: "0.78rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
        {label}
      </span>
      <span className={mono ? "mono" : ""} style={{ wordBreak: "break-all", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function defaultToken(network: { defaultToken: { address: string } }): `0x${string}` {
  return network.defaultToken.address as `0x${string}`;
}
