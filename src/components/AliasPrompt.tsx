"use client";

import { useEffect, useState } from "react";
import { useConnection } from "wagmi";
import { loadAlias, requestGreeting, saveAlias } from "@/lib/profile";

const DISMISS_KEY = "pinna:profile:aliasDismissed";

function wasDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // storage blocked — the prompt simply shows again next time
  }
}

/**
 * First run asks what to call you, as a strip at the top of the page rather
 * than a sheet over it: the app stays usable while you decide. Once answered
 * or dismissed it stays out of the way.
 */
export function AliasPrompt() {
  const { address, isConnected } = useConnection();
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!isConnected || !address) {
      setVisible(false);
      return;
    }
    const existing = loadAlias();
    if (existing) {
      setName(existing);
      setVisible(false);
      return;
    }
    setVisible(!wasDismissed());
  }, [isConnected, address]);

  if (!visible) return null;

  const preview = requestGreeting(name || "you", "the shared cost");

  return (
    <div
      style={{
        borderBottom: "1px solid var(--hairline)",
        background: "rgba(122,154,126,0.07)",
      }}
    >
      <div
        className="shell"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
          padding: "14px 0",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <p className="eyebrow" style={{ margin: "0 0 4px" }}>
            Your name on requests
          </p>
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
            So the person paying knows who is asking — “{preview}”
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            className="field"
            value={name}
            placeholder="Jake"
            aria-label="Your name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                saveAlias(name);
                setVisible(false);
              }
            }}
            style={{ width: 180 }}
          />
          <button
            className="button"
            disabled={!name.trim()}
            onClick={() => {
              saveAlias(name);
              setVisible(false);
            }}
          >
            Save
          </button>
          <button
            className="nav-link"
            style={{ background: "transparent", border: 0, cursor: "pointer" }}
            onClick={() => {
              rememberDismissed();
              setVisible(false);
            }}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

/** The alias for the connected wallet, with a setter that persists it. */
export function useAlias() {
  const [alias, setAliasState] = useState("");
  useEffect(() => {
    setAliasState(loadAlias());
  }, []);
  return {
    alias,
    setAlias: (next: string) => setAliasState(saveAlias(next)),
    missing: alias.length === 0,
  };
}
