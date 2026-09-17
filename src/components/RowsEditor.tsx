"use client";

import { useMemo, useState } from "react";
import { isPositiveAmount, isValidAddress, type PayableRow } from "@/lib/money";
import type { Contact } from "@/lib/storage";
import { ContactPicker } from "./ContactPicker";

/**
 * The list editor. A row is a person, an amount and an optional reason; the
 * same person may appear on several rows on purpose. Every amount has to be
 * worth something — zero is not a payment.
 */
export function RowsEditor({
  rows,
  contacts,
  tokenSymbol,
  totalLabel,
  onChange,
  onAdd,
  onRemove,
  amountLabel = "Amount",
  reasonPlaceholder = "Rent, week of the 12th",
}: {
  rows: PayableRow[];
  contacts: Contact[];
  tokenSymbol: string;
  totalLabel: string;
  onChange: (id: string, patch: Partial<PayableRow>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  amountLabel?: string;
  reasonPlaceholder?: string;
}) {
  const contactOptions = useMemo(() => contacts.map((c) => c.name), [contacts]);
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const pickerRow = rows.find((r) => r.id === pickerFor) ?? null;

  return (
    <div>
      <datalist id="pinna-contacts">
        {contactOptions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div style={{ borderTop: "1px solid var(--hairline)" }}>
        {rows.map((row, index) => {
          const addressOk = isValidAddress(row.address);
          const amountOk = row.amount === "" || isPositiveAmount(row.amount);
          const matched = contacts.find(
            (c) => c.name.toLowerCase() === row.name.trim().toLowerCase()
          );
          return (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1.35fr) minmax(0, 1.7fr) minmax(0,1fr) minmax(0,1.2fr) 40px",
                gap: 16,
                alignItems: "end",
                padding: "16px 0",
                borderBottom: "1px solid var(--hairline)",
              }}
              className="row-grid"
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span className="faint" style={{ fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    Name
                  </span>
                  <button
                    type="button"
                    className="pick-button"
                    onClick={() => setPickerFor(row.id)}
                    title="Pick from contacts"
                  >
                    Contacts
                  </button>
                </div>
                <input
                  className="field"
                  list="pinna-contacts"
                  placeholder={index % 2 === 0 ? "Jake" : "Name"}
                  value={row.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const hit = contacts.find(
                      (c) => c.name.toLowerCase() === name.trim().toLowerCase()
                    );
                    onChange(row.id, hit ? { name, address: hit.address } : { name });
                  }}
                />
              </div>

              <div>
                <span className="faint" style={{ fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Tempo address
                </span>
                <input
                  className="field mono"
                  placeholder="0x… or pick a name"
                  value={matched && row.address === matched.address ? matched.address : row.address}
                  onChange={(e) => onChange(row.id, { address: e.target.value.trim() as `0x${string}` })}
                  style={{ borderBottomColor: row.address && !addressOk ? "#a0564a" : undefined }}
                />
              </div>

              <div>
                <span className="faint" style={{ fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  {amountLabel}
                </span>
                <input
                  className="field mono"
                  inputMode="decimal"
                  placeholder="18.00"
                  value={row.amount}
                  onChange={(e) => onChange(row.id, { amount: e.target.value })}
                  style={{ borderBottomColor: amountOk ? undefined : "#a0564a" }}
                />
              </div>

              <div>
                <span className="faint" style={{ fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Reason
                </span>
                <input
                  className="field"
                  placeholder={reasonPlaceholder}
                  value={row.reason ?? ""}
                  onChange={(e) => onChange(row.id, { reason: e.target.value })}
                />
              </div>

              <button
                type="button"
                className="faint"
                onClick={() => onRemove(row.id)}
                disabled={rows.length === 1}
                style={{
                  background: "transparent",
                  border: 0,
                  cursor: rows.length === 1 ? "default" : "pointer",
                  font: "inherit",
                  paddingBottom: 12,
                }}
                aria-label="Remove row"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          paddingTop: 18,
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="nav-link"
          onClick={onAdd}
          style={{ background: "transparent", border: 0, cursor: "pointer" }}
        >
          + Add a row
        </button>
        <p style={{ margin: 0 }}>
          <span
            className="faint"
            style={{
              fontSize: "0.8rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginRight: 12,
            }}
          >
            {totalLabel}
          </span>
          <span className="mono" style={{ fontSize: "1.5rem" }}>
            {formatTotal(rows)}
          </span>
          <span className="muted" style={{ marginLeft: 8, fontSize: "0.9rem" }}>
            {tokenSymbol}
          </span>
        </p>
      </div>
      <p className="faint" style={{ fontSize: "0.8rem", marginTop: 4 }}>
        {rows.length} row{rows.length === 1 ? "" : "s"} · each row is its own transfer with its own
        reference
      </p>

      {pickerRow ? (
        <ContactPicker
          contacts={contacts}
          onPick={(contact) => onChange(pickerRow.id, { name: contact.name, address: contact.address })}
        />
      ) : null}
    </div>
  );
}

function formatTotal(rows: PayableRow[]): string {
  let units = 0n;
  for (const r of rows) {
    if (!r.amount) continue;
    try {
      const [whole, frac = ""] = r.amount.split(".");
      units += BigInt(whole || "0") * 1_000_000n + BigInt((frac + "000000").slice(0, 6));
    } catch {
      // ignore an amount mid-typing
    }
  }
  const whole = units / 1_000_000n;
  const frac = (units % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}.${frac.length < 2 ? frac.padEnd(2, "0") : frac}`;
}

export function newRow(): PayableRow {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: "",
    address: "" as `0x${string}`,
    amount: "",
    reason: "",
  };
}

/** A row is payable when it has a valid address and an amount above zero. */
export function isRowComplete(row: PayableRow): boolean {
  return isValidAddress(row.address) && isPositiveAmount(row.amount);
}

export function payableRows(rows: PayableRow[]): PayableRow[] {
  return rows.filter(isRowComplete);
}
