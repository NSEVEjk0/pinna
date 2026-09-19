"use client";

import { useState } from "react";
import { useConnection } from "wagmi";
import { usePinna } from "@/lib/usePinna";

/**
 * Which stablecoin Pinna pays in. Tempo charges the fee in the token being
 * sent, so switching here is the whole story — no separate gas token.
 */
export function TokenSwitch() {
  const { isConnected, token, tokenOptions, chooseToken } = usePinna();
  const { } = useConnection();
  const [open, setOpen] = useState(false);

  if (tokenOptions.length <= 1) {
    return (
      <span className="chip" title="The stablecoin Pinna pays in">
        {token.symbol}
      </span>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="chip"
        onClick={() => setOpen((v) => !v)}
        disabled={!isConnected}
        title={isConnected ? "Choose the payment token" : "Connect a wallet first"}
        style={{ cursor: isConnected ? "pointer" : "default" }}
      >
        {token.symbol} ▾
      </button>

      {open && isConnected ? (
        <div
          className="panel"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 10px)",
            background: "#191919",
            minWidth: 240,
            zIndex: 30,
            padding: 8,
          }}
        >
          {tokenOptions.map((option) => (
            <button
              key={option.address}
              type="button"
              onClick={() => {
                chooseToken(option);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: 0,
                padding: "10px 12px",
                cursor: "pointer",
                color: option.address === token.address ? "var(--sage)" : "var(--bone)",
                font: "inherit",
              }}
            >
              {option.symbol}
              <span className="faint" style={{ display: "block", fontSize: "0.72rem" }}>
                {option.name}
              </span>
            </button>
          ))}
          <p className="faint" style={{ margin: 0, padding: "8px 12px", fontSize: "0.76rem" }}>
            Fees are paid in the same token.
          </p>
        </div>
      ) : null}
    </div>
  );
}
