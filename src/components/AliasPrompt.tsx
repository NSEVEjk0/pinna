"use client";

import { useEffect, useState } from "react";
import { useConnection } from "wagmi";
import { hasAlias, loadAlias, requestGreeting, saveAlias } from "@/lib/profile";

/**
 * First run asks what to call you. The name is yours alone — it is attached to
 * the requests you send so the person paying knows who is asking, and it can
 * be changed at any time (including while writing a single request).
 */
export function AliasPrompt() {
  const { address, isConnected } = useConnection();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) {
      setOpen(false);
      setReady(false);
      return;
    }
    const existing = loadAlias();
    if (existing) {
      setName(existing);
      setOpen(false);
    } else {
      setOpen(true);
    }
    setReady(true);
  }, [isConnected, address]);

  if (!open || !ready) return null;

  const preview = requestGreeting(name || "you", "the shared cost");

  return (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-label="Your name" style={{ maxWidth: 520 }}>
        <p className="eyebrow" style={{ margin: "0 0 10px" }}>
          Before you start
        </p>
        <h2 className="display" style={{ fontSize: "1.7rem", margin: "0 0 10px" }}>
          What should people call you?
        </h2>
        <p className="muted" style={{ margin: "0 0 22px", fontSize: "0.95rem" }}>
          This name goes on the requests you send, so the person paying knows who is asking.
          It stays in this browser.
        </p>

        <input
          className="field"
          autoFocus
          value={name}
          placeholder="Jake"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) {
              saveAlias(name);
              setOpen(false);
            }
          }}
        />

        <p className="faint" style={{ fontSize: "0.85rem", marginTop: 14 }}>
          Preview: “{preview}”
        </p>

        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
          <button
            className="button"
            disabled={!name.trim()}
            onClick={() => {
              saveAlias(name);
              setOpen(false);
            }}
          >
            Save my name
          </button>
          <button className="button button-quiet" onClick={() => setOpen(false)}>
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

/** True when an alias exists — used to nudge before sending a request. */
export function useAlias() {
  const [alias, setAlias] = useState("");
  useEffect(() => {
    setAlias(loadAlias());
  }, []);
  return {
    alias,
    setAlias: (next: string) => {
      setAlias(saveAlias(next));
    },
    missing: alias.length === 0,
    exists: hasAlias(),
  };
}
