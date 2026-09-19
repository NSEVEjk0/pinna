"use client";

import { useState } from "react";
import { useConnection } from "wagmi";
import { useActiveNetwork } from "@/lib/useActiveNetwork";
import { TEMPO_MAINNET, TEMPO_TESTNET } from "@/lib/tempo";

/**
 * Mainnet or testnet, switchable from the header — right beside the wallet.
 * The wallet is asked to move chains, so the money and the network never
 * disagree about where you are.
 */
export function NetworkSwitch() {
  const { isConnected } = useConnection();
  const { network, switchTo, pending, error } = useActiveNetwork();
  const [open, setOpen] = useState(false);

  const isMainnet = network.chainId === TEMPO_MAINNET.chainId;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="chip"
        onClick={() => setOpen((v) => !v)}
        disabled={!isConnected}
        title={isConnected ? "Switch Tempo network" : "Connect a wallet first"}
        style={{ cursor: isConnected ? "pointer" : "default" }}
      >
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: 999,
            background: isMainnet ? "var(--sage)" : "rgba(244,241,234,0.45)",
            marginRight: 8,
          }}
        />
        {isMainnet ? "Mainnet" : "Testnet"}
      </button>

      {open && isConnected ? (
        <div
          className="panel"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 10px)",
            background: "#191919",
            minWidth: 260,
            zIndex: 30,
            padding: 8,
          }}
        >
          {[TEMPO_TESTNET, TEMPO_MAINNET].map((option) => (
            <button
              key={option.chainId}
              type="button"
              onClick={async () => {
                setOpen(false);
                if (option.chainId !== network.chainId) await switchTo(option);
              }}
              disabled={pending}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: 0,
                padding: "10px 12px",
                cursor: "pointer",
                color: option.chainId === network.chainId ? "var(--sage)" : "var(--bone)",
                font: "inherit",
              }}
            >
              {option.name}
              <span className="faint" style={{ display: "block", fontSize: "0.72rem" }}>
                chain {option.chainId}
                {option.chainId === TEMPO_MAINNET.chainId ? " · real funds" : " · faucet funds"}
              </span>
            </button>
          ))}
          {error ? (
            <p className="faint" style={{ padding: "6px 12px", margin: 0, fontSize: "0.78rem" }}>
              {error}
            </p>
          ) : null}
          {!isMainnet ? (
            <p
              style={{
                margin: 0,
                padding: "10px 12px 12px",
                fontSize: "0.78rem",
                color: "#d8a79b",
                borderTop: "1px solid var(--hairline)",
              }}
            >
              ⚠ The testnet version is not very reliable. Please use mainnet for anything that
              matters.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
