"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RowsEditor, newRow, payableRows } from "@/components/RowsEditor";
import { usePinna } from "@/lib/usePinna";
import { displayName, formatAmount, listTotal, type PayableRow } from "@/lib/money";
import { newReference } from "@/lib/memo";
import { draftMessage, payLinkUrl, reminderMessage } from "@/lib/paylink";
import { downloadReceipt } from "@/lib/receipt";
import { requestGreeting } from "@/lib/profile";
import { useDraftContact } from "@/lib/useDraftContact";
import type { PaymentRequest } from "@/lib/requests";

type Stage = "edit" | "confirm" | "created";

interface DraftExtras {
  link: boolean;
  pdf: boolean;
  message: boolean;
}

export default function RequestPage() {
  const {
    address,
    isConnected,
    contacts,
    network,
    token,
    alias,
    saveAlias,
    saveContact,
    saveRequest,
    requests,
    notify,
  } = usePinna();
  const { consume } = useDraftContact("request");
  const [rows, setRows] = useState<PayableRow[]>([newRow()]);
  const [extras, setExtras] = useState<Record<string, DraftExtras>>({});
  const [stage, setStage] = useState<Stage>("edit");
  const [created, setCreated] = useState<PaymentRequest[]>([]);
  const [origin, setOrigin] = useState("");
  const [fromName, setFromName] = useState(alias);

  const ready = useMemo(() => payableRows(rows), [rows]);
  const total = useMemo(() => (ready.length ? listTotal(ready) : 0n), [ready]);

  useEffect(() => {
    setFromName(alias);
  }, [alias]);

  useEffect(() => {
    const draft = consume();
    if (!draft) return;
    setRows((prev) => {
      const first = { ...prev[0], name: draft.name, address: draft.address };
      return [first, ...prev.slice(1)];
    });
  }, [consume]);

  function update(id: string, patch: Partial<PayableRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function extrasFor(id: string): DraftExtras {
    return extras[id] ?? { link: true, pdf: false, message: true };
  }

  function setExtrasFor(id: string, patch: Partial<DraftExtras>) {
    setExtras((prev) => ({ ...prev, [id]: { ...extrasFor(id), ...patch } }));
  }

  function confirm() {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
    // The name used here becomes the name on future requests too.
    if (fromName.trim() && fromName.trim() !== alias) saveAlias(fromName);
    setStage("confirm");
  }

  function create() {
    if (!address) return;
    const at = new Date().toISOString();
    const made: PaymentRequest[] = ready.map((row) => {
      const choice = extrasFor(row.id);
      const request: PaymentRequest = {
        id: newReference("req"),
        hostAddress: address,
        partyName: row.name.trim(),
        partyAddress: row.address,
        amount: row.amount,
        reason: row.reason ?? "",
        hostAlias: fromName.trim() || alias,
        hasLink: choice.link,
        hasPdf: choice.pdf,
        status: "waiting",
        createdAt: at,
        chainId: network.chainId,
        explorerUrl: network.explorerUrl,
      };
      saveRequest(request);
      notify({
        kind: "request_created",
        title: `Requested ${request.amount} ${token.symbol}`,
        detail: `From ${request.partyName || request.partyAddress}${request.reason ? ` · ${request.reason}` : ""}`,
        requestId: request.id,
      });
      if (row.name.trim()) saveContact({ address: row.address, name: row.name.trim() }, true);
      return request;
    });
    setCreated(made);
    setStage("created");
  }

  if (!isConnected) {
    return (
      <div className="shell fade-in" style={{ paddingTop: 40 }}>
        <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4.2vw, 2.8rem)", margin: "0 0 14px" }}>
          Connect a wallet to request
        </h1>
        <p className="muted" style={{ maxWidth: "48ch" }}>
          A request is tied to the wallet that should receive the money.
        </p>
      </div>
    );
  }

  const greeting = requestGreeting(fromName || alias, ready[0]?.reason || "the shared cost");

  return (
    <div className="shell fade-in" style={{ paddingTop: 8, paddingBottom: 40 }}>
      <p className="eyebrow" style={{ margin: "0 0 14px" }}>
        Request
      </p>

      {stage === "edit" ? (
        <>
          <h1 className="display" style={{ fontSize: "clamp(2rem, 4.6vw, 3.2rem)", margin: "0 0 12px", maxWidth: "24ch" }}>
            Ask for what you are owed.
          </h1>
          <p className="muted" style={{ maxWidth: "56ch", margin: "0 0 34px" }}>
            Each row becomes a request that sits under Waiting until it is paid — by a link, by a
            PDF you send, or simply as a reminder you keep yourself.
          </p>

          <label style={{ display: "block", maxWidth: 380, marginBottom: 30 }}>
            <span
              className="faint"
              style={{ fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase" }}
            >
              Your name on this request
            </span>
            <input
              className="field"
              value={fromName}
              placeholder="Jake"
              onChange={(e) => setFromName(e.target.value)}
            />
            <span className="faint" style={{ display: "block", fontSize: "0.78rem", marginTop: 8 }}>
              “{greeting}”
            </span>
          </label>

          <RowsEditor
            rows={rows}
            contacts={contacts}
            tokenSymbol={token.symbol}
            totalLabel="Total requested"
            onChange={update}
            onAdd={() => setRows((prev) => [...prev, newRow()])}
            onRemove={(id) => setRows((prev) => prev.filter((r) => r.id !== id))}
            reasonPlaceholder="Dinner on Friday"
          />

          <div style={{ display: "flex", gap: 14, marginTop: 34, flexWrap: "wrap" }}>
            <button className="button" onClick={confirm} disabled={ready.length === 0}>
              Continue
            </button>
            <Link className="button button-quiet" href="/history">
              See what is waiting
            </Link>
          </div>
          <p className="faint" style={{ fontSize: "0.82rem", marginTop: 14 }}>
            Amounts must be above zero. A request of nothing is not a request.
          </p>
        </>
      ) : null}

      {stage === "confirm" ? (
        <>
          <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4.2vw, 2.9rem)", margin: "0 0 10px" }}>
            How should each one go out?
          </h1>
          <p className="muted" style={{ margin: "0 0 34px", maxWidth: "56ch" }}>
            A pay link lets them pay on Tempo in one tap. A PDF is for sending yourself. Choosing
            neither keeps it as a reminder — it still shows up under Waiting, and you can attach a
            link later.
          </p>

          <div style={{ borderTop: "1px solid var(--hairline)" }}>
            {ready.map((row) => {
              const choice = extrasFor(row.id);
              return (
                <div key={row.id} style={{ padding: "22px 0", borderBottom: "1px solid var(--hairline)" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 20,
                      alignItems: "baseline",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: "1.05rem" }}>{displayName(row)}</p>
                      <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.9rem" }}>
                        {row.reason || "no reason given"}
                      </p>
                    </div>
                    <p className="mono" style={{ margin: 0, fontSize: "1.15rem" }}>
                      {row.amount} {token.symbol}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 22, marginTop: 14, flexWrap: "wrap" }}>
                    <Toggle label="Pay link" checked={choice.link} onChange={(v) => setExtrasFor(row.id, { link: v })} />
                    <Toggle
                      label="Draft message"
                      checked={choice.message}
                      onChange={(v) => setExtrasFor(row.id, { message: v })}
                    />
                    <Toggle label="PDF" checked={choice.pdf} onChange={(v) => setExtrasFor(row.id, { pdf: v })} />
                  </div>
                </div>
              );
            })}
          </div>

          <p style={{ margin: "24px 0 0", display: "flex", justifyContent: "space-between" }}>
            <span className="eyebrow">Total requested</span>
            <span className="mono" style={{ fontSize: "1.5rem" }}>
              {formatAmount(total, token.decimals)} {token.symbol}
            </span>
          </p>

          <div style={{ display: "flex", gap: 14, marginTop: 32, flexWrap: "wrap" }}>
            <button className="button" onClick={create}>
              Create {ready.length} request{ready.length === 1 ? "" : "s"}
            </button>
            <button className="button button-quiet" onClick={() => setStage("edit")}>
              Back
            </button>
          </div>
        </>
      ) : null}

      {stage === "created" ? (
        <>
          <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4.2vw, 2.9rem)", margin: "0 0 10px" }}>
            Ready.
          </h1>
          <p className="muted" style={{ margin: "0 0 32px" }}>
            Every one of these is under Waiting until the money lands. You can cancel any of them
            from History.
          </p>

          {created.map((request) => {
            const choice = extrasFor(request.partyAddress);
            const url = payLinkUrl(origin || "https://pinna.app", {
              id: request.id,
              to: request.hostAddress,
              hostName: fromName || alias,
              amount: request.amount,
              reason: request.reason,
              message: request.message,
              token: token.symbol,
              network: network.name,
            });
            return (
              <div key={request.id} className="panel" style={{ padding: 22, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <p style={{ margin: 0 }}>
                    {request.partyName || request.partyAddress}
                    <span className="faint" style={{ marginLeft: 12, fontSize: "0.85rem" }}>
                      {request.reason || "no reason"}
                    </span>
                  </p>
                  <p className="mono" style={{ margin: 0 }}>
                    {request.amount} {token.symbol}
                  </p>
                </div>
                <p className="faint mono" style={{ fontSize: "0.74rem", margin: "10px 0 0" }}>
                  reference {request.id}
                </p>

                {request.hasLink ? (
                  <>
                    <p className="eyebrow" style={{ margin: "18px 0 8px" }}>
                      Pay link
                    </p>
                    <p className="mono" style={{ fontSize: "0.82rem", wordBreak: "break-all", margin: "0 0 12px" }}>
                      {url}
                    </p>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <button className="button button-quiet" onClick={() => navigator.clipboard?.writeText(url)}>
                        Copy link
                      </button>
                      {choice.message ? (
                        <button
                          className="button button-quiet"
                          onClick={() =>
                            navigator.clipboard?.writeText(
                              draftMessage({
                                hostName: fromName || alias,
                                partyName: request.partyName,
                                amount: request.amount,
                                reason: request.reason,
                                url,
                                tokenSymbol: token.symbol,
                              })
                            )
                          }
                        >
                          Copy message
                        </button>
                      ) : null}
                      <a className="button button-quiet" href={url} target="_blank" rel="noreferrer">
                        Open the pay page
                      </a>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="muted" style={{ marginTop: 16, fontSize: "0.9rem" }}>
                      No link — this one is a reminder. It stays under Waiting until you mark it
                      paid or a matching transfer arrives.
                    </p>
                    <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
                      <button
                        className="button button-quiet"
                        onClick={() =>
                          navigator.clipboard?.writeText(
                            reminderMessage({
                              hostName: fromName || alias,
                              partyName: request.partyName,
                              amount: request.amount,
                              reason: request.reason,
                              tokenSymbol: token.symbol,
                              reference: request.id,
                            })
                          )
                        }
                      >
                        Copy reminder
                      </button>
                    </div>
                  </>
                )}

                {request.hasPdf ? (
                  <div style={{ marginTop: 16 }}>
                    <button
                      className="button button-quiet"
                      onClick={() =>
                        downloadReceipt({
                          title: "Request draft",
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
                          txHash: "—",
                          explorerUrl: "",
                          at: new Date().toISOString(),
                          tokenSymbol: token.symbol,
                          network: network.name,
                          from: request.hostAddress,
                          decimals: token.decimals,
                          note: `Pay to ${request.hostAddress} on ${network.name}. Quote reference ${request.id}.`,
                        })
                      }
                    >
                      Download PDF draft
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}

          <div style={{ display: "flex", gap: 14, marginTop: 20, flexWrap: "wrap" }}>
            <Link className="button" href="/history">
              Go to History
            </Link>
            <button
              className="button button-quiet"
              onClick={() => {
                setRows([newRow()]);
                setExtras({});
                setCreated([]);
                setStage("edit");
              }}
            >
              Request again
            </button>
          </div>
          <p className="faint" style={{ marginTop: 20, fontSize: "0.85rem" }}>
            You have {requests.filter((r) => r.status === "waiting").length} request
            {requests.filter((r) => r.status === "waiting").length === 1 ? "" : "s"} waiting.
          </p>
        </>
      ) : null}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="nav-link"
      onClick={() => onChange(!checked)}
      style={{
        background: "transparent",
        border: 0,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: 0,
      }}
      aria-pressed={checked}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          border: `1px solid ${checked ? "var(--sage)" : "var(--hairline)"}`,
          background: checked ? "var(--sage)" : "transparent",
          display: "inline-block",
        }}
      />
      <span style={{ color: checked ? "var(--bone)" : "var(--muted)" }}>{label}</span>
    </button>
  );
}
