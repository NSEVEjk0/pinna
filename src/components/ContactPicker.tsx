"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { shortAddress } from "@/lib/money";
import { Avatar } from "./Avatar";
import type { Contact } from "@/lib/storage";

/**
 * The small button beside a name field. It opens a panel of every contact you
 * have, scrollable and searchable, so a row can be filled without typing an
 * address again.
 */
export function ContactPicker({
  contacts,
  onPick,
  align = "right",
}: {
  contacts: Contact[];
  onPick: (contact: Contact) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q)
    );
  }, [contacts, query]);

  return (
    <div style={{ position: "relative" }} ref={boxRef}>
      <button
        type="button"
        className="pick-button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Pick from contacts"
      >
        ▾ Contacts
      </button>

      {open ? (
        <div
          className="contact-panel"
          style={{ [align]: 0 } as React.CSSProperties}
          role="listbox"
        >
          <div className="contact-panel-head">
            <input
              className="field"
              autoFocus
              value={query}
              placeholder="Search contacts"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {contacts.length === 0 ? (
            <p className="muted" style={{ padding: "14px 14px 18px", margin: 0, fontSize: "0.88rem" }}>
              No contacts yet. Add someone under Contacts and they will appear here.
            </p>
          ) : filtered.length === 0 ? (
            <p className="muted" style={{ padding: "14px 14px 18px", margin: 0, fontSize: "0.88rem" }}>
              No contact matches “{query}”.
            </p>
          ) : (
            <div className="contact-panel-list">
              {filtered.map((contact) => (
                <button
                  key={contact.address}
                  type="button"
                  className="contact-panel-row"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    onPick(contact);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Avatar name={contact.name} address={contact.address} src={contact.avatar} size={26} />
                    <span>{contact.name}</span>
                  </span>
                  <span className="faint mono" style={{ fontSize: "0.76rem" }}>
                    {shortAddress(contact.address, 8, 6)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <p className="faint" style={{ padding: "10px 14px", margin: 0, fontSize: "0.75rem" }}>
            {contacts.length} contact{contacts.length === 1 ? "" : "s"}
            {contacts.length > 6 ? " · scroll for more" : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
