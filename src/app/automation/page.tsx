"use client";

import { useEffect, useMemo, useState } from "react";
import { useSendTransactionSync } from "wagmi";
import { usePinna } from "@/lib/usePinna";
import { newReference } from "@/lib/memo";
import { ContactPicker } from "@/components/ContactPicker";
import { isValidAddress, isPositiveAmount } from "@/lib/money";
import {
  FREQUENCIES,
  FREQUENCY_LABEL,
  describeRule,
  dueRules,
  isValidTimeOfDay,
  nextRunAt,
  type AutomationRule,
  type Frequency,
} from "@/lib/automation";
import { buildBatch } from "@/lib/batch";
import { encodeNote } from "@/lib/memo";
import { explorerTxUrl } from "@/lib/tempo";
import { AutomationAgentPanel } from "@/components/AutomationAgentPanel";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function blankRule(): AutomationRule {
  return {
    id: newReference("auto"),
    title: "",
    name: "",
    address: "" as `0x${string}`,
    amount: "",
    memo: "",
    frequency: "monthly",
    timeOfDay: "09:00",
    startsOn: todayIso(),
    enabled: true,
    createdAt: new Date().toISOString(),
    runCount: 0,
  };
}

/**
 * Scheduled payments. Pinna holds no key and runs no server, so a schedule
 * cannot sign by itself: when a run comes due and the app is open, it appears
 * here ready for you to sign.
 */
export default function AutomationPage() {
  const { address, isConnected, contacts, network, token, rules, saveRule, deleteRule, notify } =
    usePinna();
  const { sendTransactionSyncAsync } = useSendTransactionSync();
  const [draft, setDraft] = useState<AutomationRule>(blankRule);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Keep the "due" list honest without a reload.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const due = useMemo(() => dueRules(rules, now), [rules, now]);

  function save() {
    setError(null);
    if (!draft.title.trim()) return setError("Give the schedule a name so you know what it is.");
    if (!isValidAddress(draft.address)) return setError("That does not look like a wallet address.");
    if (!isPositiveAmount(draft.amount)) return setError("The amount has to be above zero.");
    if (!isValidTimeOfDay(draft.timeOfDay)) return setError("The time should look like 09:00.");
    saveRule(draft);
    setDraft(blankRule());
  }

  async function run(rule: AutomationRule) {
    if (!address) return;
    setError(null);
    setBusyId(rule.id);
    try {
      const batch = buildBatch(
        [
          {
            id: rule.id,
            name: rule.name,
            address: rule.address,
            amount: rule.amount,
            reason: rule.memo,
          },
        ],
        {
          token: token.address,
          decimals: token.decimals,
          // A scheduled payment writes the note you chose straight into the memo.
          referenceFor: () => rule.memo || rule.title || rule.id,
        }
      );
      const hash = await sendTransactionSyncAsync({
        calls: batch.calls,
        feeToken: token.address,
      } as never);
      const resolved = typeof hash === "string" ? hash : "";
      if (!resolved) {
        setError("The wallet did not return a transaction hash. Nothing was recorded.");
        return;
      }
      setLastHash(resolved);
      saveRule({
        ...rule,
        lastRunAt: new Date().toISOString(),
        lastRunTxHash: resolved,
        runCount: rule.runCount + 1,
      });
      notify({
        kind: "list_sent",
        title: `Scheduled payment sent: ${rule.amount} ${token.symbol}`,
        detail: `${rule.name || rule.address}${rule.memo ? ` · ${rule.memo}` : ""}`,
        txHash: resolved,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The wallet did not complete the payment.");
    } finally {
      setBusyId(null);
    }
  }

  if (!isConnected) {
    return (
      <div className="shell fade-in" style={{ paddingTop: 40 }}>
        <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4.2vw, 2.8rem)", margin: "0 0 14px" }}>
          Connect a wallet to set up payments
        </h1>
        <p className="muted" style={{ maxWidth: "48ch" }}>
          A schedule is signed by your wallet, so Pinna needs to know which one.
        </p>
      </div>
    );
  }

  return (
    <div className="shell fade-in" style={{ paddingTop: 8, paddingBottom: 40 }}>
      <p className="eyebrow" style={{ margin: "0 0 14px" }}>
        Automation
      </p>
      <h1 className="display" style={{ fontSize: "clamp(2rem, 4.6vw, 3rem)", margin: "0 0 12px" }}>
        Payments that come round.
      </h1>
      <p className="muted" style={{ maxWidth: "62ch", margin: "0 0 14px" }}>
        Set a payment to repeat daily, weekly, monthly or yearly, with its own note written into
        the memo and a time of day to send it.
      </p>
      <div className="network-warning" style={{ maxWidth: 640, marginBottom: 34 }}>
        <span aria-hidden="true">⚠</span>
        <span>
          Pinna holds no keys and runs no server, so a schedule cannot sign on its own. When a run
          is due and Pinna is open, it appears below ready for you to sign. Nothing is sent
          without your wallet.
        </span>
      </div>

      {due.length > 0 ? (
        <div className="panel" style={{ padding: 22, marginBottom: 34 }}>
          <p className="eyebrow" style={{ margin: "0 0 6px" }}>
            Due now
          </p>
          <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.92rem" }}>
            These came round while the app was closed.
          </p>
          {due.map((rule) => (
            <div
              key={rule.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 16,
                padding: "14px 0",
                borderTop: "1px solid var(--hairline)",
                flexWrap: "wrap",
              }}
            >
              <div>
                <p style={{ margin: 0 }}>
                  {rule.title}
                  <span className="faint" style={{ marginLeft: 10, fontSize: "0.84rem" }}>
                    {rule.name || rule.address}
                  </span>
                </p>
                <p className="faint" style={{ margin: "4px 0 0", fontSize: "0.78rem" }}>
                  {describeRule(rule)} · due {nextRunAt(rule, now).toISOString().slice(0, 16).replace("T", " ")}
                </p>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
                <span className="mono">
                  {rule.amount} {token.symbol}
                </span>
                <button className="pdf-again" onClick={() => run(rule)} disabled={busyId === rule.id}>
                  {busyId === rule.id ? "Waiting for wallet…" : "Sign and send"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="panel" style={{ padding: 22, marginBottom: 34 }}>
        <p className="eyebrow" style={{ margin: "0 0 16px" }}>
          New schedule
        </p>

        <div className="detail-grid">
          <label>
            <span className="faint" style={{ fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              What is it for
            </span>
            <input
              className="field"
              value={draft.title}
              placeholder="Studio rent"
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>

          <label>
            <span className="faint" style={{ fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Amount ({token.symbol})
            </span>
            <input
              className="field mono"
              inputMode="decimal"
              value={draft.amount}
              placeholder="400.00"
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            />
          </label>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="faint" style={{ fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Who gets paid
              </span>
              <ContactPicker
                contacts={contacts}
                onPick={(contact) => setDraft({ ...draft, name: contact.name, address: contact.address })}
              />
            </div>
            <input
              className="field"
              value={draft.name}
              placeholder="Name"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>

          <label>
            <span className="faint" style={{ fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Their address
            </span>
            <input
              className="field mono"
              value={draft.address}
              placeholder="0x…"
              onChange={(e) => setDraft({ ...draft, address: e.target.value.trim() as `0x${string}` })}
            />
          </label>

          <label>
            <span className="faint" style={{ fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Memo written on each transfer
            </span>
            <input
              className="field"
              value={draft.memo}
              placeholder="Studio rent"
              onChange={(e) => setDraft({ ...draft, memo: e.target.value })}
            />
          </label>

          <label>
            <span className="faint" style={{ fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              How often
            </span>
            <select
              className="field"
              value={draft.frequency}
              onChange={(e) => setDraft({ ...draft, frequency: e.target.value as Frequency })}
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f} style={{ color: "#111" }}>
                  {FREQUENCY_LABEL[f]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="faint" style={{ fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Time to send
            </span>
            <input
              className="field mono"
              type="time"
              value={draft.timeOfDay}
              onChange={(e) => setDraft({ ...draft, timeOfDay: e.target.value })}
            />
          </label>

          <label>
            <span className="faint" style={{ fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Starting
            </span>
            <input
              className="field mono"
              type="date"
              value={draft.startsOn}
              onChange={(e) => setDraft({ ...draft, startsOn: e.target.value })}
            />
          </label>
        </div>

        <p className="faint" style={{ fontSize: "0.82rem", marginTop: 14 }}>
          The memo must fit 32 bytes — longer notes are trimmed.
        </p>

        {error ? <p style={{ color: "#c98b7f", marginTop: 12 }}>{error}</p> : null}

        <div style={{ marginTop: 18 }}>
          <button className="button" onClick={save}>
            Save schedule
          </button>
        </div>
      </div>

      {rules.length > 0 ? (
        <>
          <p className="eyebrow" style={{ margin: "0 0 6px" }}>
            Your schedules
          </p>
          <div style={{ borderTop: "1px solid var(--hairline)" }}>
            {rules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 16,
                  padding: "18px 0",
                  borderBottom: "1px solid var(--hairline)",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <p style={{ margin: 0 }}>
                    {rule.title}
                    <span className="chip" style={{ marginLeft: 12 }}>
                      {rule.enabled ? "active" : "paused"}
                    </span>
                  </p>
                  <p className="faint" style={{ margin: "4px 0 0", fontSize: "0.78rem" }}>
                    {rule.name || rule.address} · {describeRule(rule)} · next{" "}
                    {nextRunAt(rule, now).toISOString().slice(0, 16).replace("T", " ")}
                    {rule.runCount > 0 ? ` · sent ${rule.runCount}×` : ""}
                  </p>
                  {rule.memo ? (
                    <p className="faint" style={{ margin: "4px 0 0", fontSize: "0.78rem" }}>
                      memo: {encodeNote(rule.memo) && rule.memo}
                    </p>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span className="mono">
                    {rule.amount} {token.symbol}
                  </span>
                  {rule.lastRunTxHash ? (
                    <a
                      className="hash-link"
                      style={{ fontSize: "0.78rem" }}
                      href={explorerTxUrl(network, rule.lastRunTxHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {rule.lastRunTxHash.slice(0, 10)}…
                    </a>
                  ) : null}
                  <button
                    className="nav-link"
                    style={{ background: "transparent", border: 0, cursor: "pointer" }}
                    onClick={() => saveRule({ ...rule, enabled: !rule.enabled })}
                  >
                    {rule.enabled ? "Pause" : "Resume"}
                  </button>
                  <button
                    className="pdf-again"
                    onClick={() => run(rule)}
                    disabled={busyId === rule.id}
                  >
                    {busyId === rule.id ? "Waiting…" : "Send now"}
                  </button>
                  <button
                    className="nav-link"
                    style={{ background: "transparent", border: 0, cursor: "pointer", color: "#c98b7f" }}
                    onClick={() => deleteRule(rule.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div style={{ marginTop: 40 }}>
        <AutomationAgentPanel />
      </div>

      {lastHash ? (
        <p className="faint" style={{ marginTop: 22, fontSize: "0.85rem", wordBreak: "break-all" }}>
          Last scheduled payment:{" "}
          <a className="hash-link" href={explorerTxUrl(network, lastHash)} target="_blank" rel="noreferrer">
            {lastHash}
          </a>
        </p>
      ) : null}
    </div>
  );
}
