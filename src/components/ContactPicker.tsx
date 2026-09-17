"use client";

import { useState } from "react";
import { shortAddress } from "@/lib/money";
import type { Contact } from "@/lib/storage";

/**
 * A small button beside a name field that opens the address book, so a row can
 * be filled from your contacts instead of typing an address again.
 */
export function ContactPicker({
  contacts,
  onPick,
  label = "Contacts",
}: {
  contacts: Contact[];
  onPick: (contact: Contact) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="pick-button"
        onClick={() => setOpen(true)}
        title="Pick from contacts"
      >
        {label}
      </button>

      {open ? (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div
            className="sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Pick a contact"
          >
            <div className="sheet-head">
              <p className="eyebrow" style={{ margin: 0 }}>
                Contacts
              </p>
              <button
                type="button"
                className="nav-link"
                onClick={() => setOpen(false)}
                style={{ background: "transparent", border: 0, cursor: "pointer" }}
              >
                Close
              </button>
            </div>

            {contacts.length === 0 ? (
              <p className="muted" style={{ marginTop: 18 }}>
                No contacts yet. Add someone under Contacts and they will appear here.
              </p>
            ) : (
              <div style={{ marginTop: 12 }}>
                {contacts.map((contact) => (
                  <button
                    key={contact.address}
                    type="button"
                    className="sheet-row"
                    onClick={() => {
                      onPick(contact);
                      setOpen(false);
                    }}
                  >
                    <span>{contact.name}</span>
                    <span className="faint mono" style={{ fontSize: "0.78rem" }}>
                      {shortAddress(contact.address, 8, 6)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
