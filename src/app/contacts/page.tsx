"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePinna } from "@/lib/usePinna";
import { isValidAddress, shortAddress } from "@/lib/money";
import type { Contact } from "@/lib/storage";

export default function ContactsPage() {
  const { isConnected, contacts, saveContact, dropContact } = usePinna();
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Contact | null>(null);

  function add() {
    setError(null);
    if (!name.trim()) {
      setError("A name is what makes a contact useful.");
      return;
    }
    if (!isValidAddress(address)) {
      setError("That does not look like a wallet address.");
      return;
    }
    saveContact({ address, name: name.trim() }, false);
    setName("");
    setAddress("");
  }

  function go(contact: Contact, mode: "send" | "request") {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "pinna:draft:contact",
        JSON.stringify({ address: contact.address, name: contact.name, mode })
      );
    }
    setSelected(null);
    router.push(mode === "send" ? "/send" : "/request");
  }

  if (!isConnected) {
    return (
      <div className="shell fade-in" style={{ paddingTop: 40 }}>
        <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4.2vw, 2.8rem)", margin: "0 0 14px" }}>
          Connect a wallet to keep contacts
        </h1>
        <p className="muted" style={{ maxWidth: "48ch" }}>
          Contacts belong to the wallet that uses them, and stay in this browser.
        </p>
      </div>
    );
  }

  return (
    <div className="shell fade-in" style={{ paddingTop: 8, paddingBottom: 40 }}>
      <p className="eyebrow" style={{ margin: "0 0 14px" }}>
        Contacts
      </p>
      <h1 className="display" style={{ fontSize: "clamp(2rem, 4.6vw, 3rem)", margin: "0 0 12px" }}>
        The people you pay.
      </h1>
      <p className="muted" style={{ maxWidth: "56ch", margin: "0 0 44px" }}>
        Names you type yourself. Pinna never guesses who an address is — it only remembers what you
        called them. Tap a name to send to them or request from them.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(0,1.6fr) auto",
          gap: 18,
          alignItems: "end",
          borderBottom: "1px solid var(--hairline)",
          paddingBottom: 18,
        }}
        className="row-grid"
      >
        <label>
          <span
            className="faint"
            style={{ fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            Name
          </span>
          <input className="field" value={name} placeholder="Franklin" onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span
            className="faint"
            style={{ fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            Tempo address
          </span>
          <input
            className="field mono"
            value={address}
            placeholder="0x…"
            onChange={(e) => setAddress(e.target.value.trim())}
          />
        </label>
        <button className="button" onClick={add}>
          Save
        </button>
      </div>

      {error ? <p style={{ color: "#c98b7f", marginTop: 14 }}>{error}</p> : null}

      {contacts.length === 0 ? (
        <p className="muted" style={{ marginTop: 36 }}>
          No contacts yet. Add Franklin, Jake, Sophia or Stephanie to get started.
        </p>
      ) : (
        <div style={{ marginTop: 32, borderTop: "1px solid var(--hairline)" }}>
          {contacts.map((contact) => (
            <button
              key={contact.address}
              type="button"
              className="history-row"
              onClick={() => setSelected(contact)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 20,
                flexWrap: "wrap",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: "1.05rem" }}>{contact.name}</p>
                <p className="faint mono" style={{ margin: "4px 0 0", fontSize: "0.78rem" }}>
                  {shortAddress(contact.address, 10, 6)}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span className="chip">
                  {contact.useCount} use{contact.useCount === 1 ? "" : "s"}
                </span>
                <span className="faint" style={{ fontSize: "0.85rem" }}>
                  open
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <div className="sheet-backdrop" onClick={() => setSelected(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={selected.name}>
            <p className="eyebrow" style={{ margin: "0 0 8px" }}>
              Contact
            </p>
            <h2 className="display" style={{ fontSize: "1.7rem", margin: "0 0 6px" }}>
              {selected.name}
            </h2>
            <p className="faint mono" style={{ margin: "0 0 24px", fontSize: "0.8rem", wordBreak: "break-all" }}>
              {selected.address}
            </p>

            <div style={{ display: "grid", gap: 12 }}>
              <button className="button" onClick={() => go(selected, "send")}>
                Send money to {selected.name}
              </button>
              <button className="button button-quiet" onClick={() => go(selected, "request")}>
                Request money from {selected.name}
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, gap: 12 }}>
              <button
                type="button"
                className="nav-link"
                style={{ background: "transparent", border: 0, cursor: "pointer", color: "#c98b7f" }}
                onClick={() => {
                  dropContact(selected.address);
                  setSelected(null);
                }}
              >
                Remove contact
              </button>
              <button
                type="button"
                className="nav-link"
                style={{ background: "transparent", border: 0, cursor: "pointer" }}
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
