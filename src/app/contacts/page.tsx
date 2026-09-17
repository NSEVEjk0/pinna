"use client";

import { useState } from "react";
import { usePinna } from "@/lib/usePinna";
import { isValidAddress, shortAddress } from "@/lib/money";

export default function ContactsPage() {
  const { isConnected, contacts, saveContact, dropContact } = usePinna();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  if (!isConnected) {
    return (
      <div className="shell fade-in" style={{ paddingTop: 80 }}>
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
    <div className="shell fade-in" style={{ paddingTop: 56, paddingBottom: 40 }}>
      <p className="eyebrow" style={{ margin: "0 0 14px" }}>
        Contacts
      </p>
      <h1 className="display" style={{ fontSize: "clamp(2rem, 4.6vw, 3rem)", margin: "0 0 12px" }}>
        The people you pay.
      </h1>
      <p className="muted" style={{ maxWidth: "56ch", margin: "0 0 44px" }}>
        Names you type yourself. Pinna never guesses who an address is — it only remembers what you
        called them.
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
          <span className="faint" style={{ fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Name
          </span>
          <input
            className="field"
            value={name}
            placeholder="Franklin"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          <span className="faint" style={{ fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
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
            <div
              key={contact.address}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 20,
                padding: "18px 0",
                borderBottom: "1px solid var(--hairline)",
                flexWrap: "wrap",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: "1.05rem" }}>{contact.name}</p>
                <p className="faint mono" style={{ margin: "4px 0 0", fontSize: "0.78rem" }}>
                  {shortAddress(contact.address, 10, 6)}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <span className="chip">{contact.useCount} use{contact.useCount === 1 ? "" : "s"}</span>
                <button
                  type="button"
                  className="nav-link"
                  onClick={() => dropContact(contact.address)}
                  style={{ background: "transparent", border: 0, cursor: "pointer" }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
