"use client";

import { useState } from "react";
import { usePinna } from "@/lib/usePinna";
import { readTokenMetadata } from "@/lib/chain";
import { isValidAddress, shortAddress } from "@/lib/money";
import type { CustomToken } from "@/lib/tokenStore";

/**
 * The payment token, chosen in the header. Every screen follows this choice
 * immediately, because it is one shared setting rather than a per-page copy.
 *
 * Tokens Tempo ships with are listed; any other TIP-20 can be added by its
 * contract address, and Pinna reads its symbol and decimals from the chain.
 */
export function TokenSwitch() {
  const { isConnected, network, token, tokenOptions, chooseToken, addToken, removeToken } =
    usePinna();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<{ symbol: string; name: string; decimals: number } | null>(
    null
  );

  function close() {
    setOpen(false);
    setAdding(false);
    setAddress("");
    setFound(null);
    setError(null);
  }

  async function lookUp() {
    setError(null);
    setFound(null);
    if (!isValidAddress(address)) {
      setError("That does not look like a contract address.");
      return;
    }
    setBusy(true);
    try {
      const meta = await readTokenMetadata(network, address);
      if (!meta) {
        setError(
          "Nothing answered symbol() and decimals() at that address on this network — it may not be a TIP-20 here."
        );
        return;
      }
      setFound(meta);
    } catch {
      setError("Tempo could not be read just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!found) return;
    addToken({
      address: address as `0x${string}`,
      symbol: found.symbol,
      name: found.name,
      decimals: found.decimals,
      chainId: network.chainId,
    });
    close();
  }

  const isCustom = (option: unknown) => Boolean((option as CustomToken)?.custom);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="chip"
        onClick={() => setOpen((v) => !v)}
        title="Choose the payment token"
        style={{ cursor: "pointer", borderColor: "rgba(122,154,126,0.45)", color: "var(--sage)" }}
      >
        {token.symbol} ▾
      </button>

      {open ? (
        <>
          <div
            onClick={close}
            style={{ position: "fixed", inset: 0, zIndex: 25 }}
            aria-hidden="true"
          />
          <div
            className="panel"
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 10px)",
              background: "#191919",
              minWidth: 300,
              zIndex: 30,
              padding: 8,
            }}
          >
            {!adding ? (
              <>
                <p className="eyebrow" style={{ margin: "8px 12px 6px" }}>
                  Pay in
                </p>
                {tokenOptions.map((option) => {
                  const active = option.address === token.address;
                  return (
                    <div
                      key={option.address}
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          chooseToken(option);
                          close();
                        }}
                        style={{
                          flex: 1,
                          textAlign: "left",
                          background: "transparent",
                          border: 0,
                          padding: "10px 12px",
                          cursor: "pointer",
                          color: active ? "var(--sage)" : "var(--bone)",
                          font: "inherit",
                        }}
                      >
                        {option.symbol}
                        <span className="faint" style={{ display: "block", fontSize: "0.72rem" }}>
                          {option.name} · {option.decimals} decimals
                          {isCustom(option) ? " · added by you" : ""}
                        </span>
                      </button>
                      {isCustom(option) ? (
                        <button
                          type="button"
                          className="faint"
                          title="Remove this token"
                          onClick={() => removeToken(option.address)}
                          style={{
                            background: "transparent",
                            border: 0,
                            cursor: "pointer",
                            padding: "6px 10px",
                            font: "inherit",
                          }}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: 0,
                    borderTop: "1px solid var(--hairline)",
                    marginTop: 4,
                    padding: "12px 12px",
                    cursor: "pointer",
                    color: "var(--sage)",
                    font: "inherit",
                  }}
                >
                  + Add a stablecoin by address
                </button>
                <p className="faint" style={{ margin: 0, padding: "6px 12px 8px", fontSize: "0.74rem" }}>
                  Fees are paid in the same token you send.
                  {isConnected ? "" : " Connect a wallet to pay."}
                </p>
              </>
            ) : (
              <div style={{ padding: "12px 12px 8px", minWidth: 280 }}>
                <p className="eyebrow" style={{ margin: "0 0 8px" }}>
                  Add a token on {network.name}
                </p>
                <input
                  className="field mono"
                  autoFocus
                  value={address}
                  placeholder="0x… contract address"
                  onChange={(e) => {
                    setAddress(e.target.value.trim());
                    setFound(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void lookUp();
                  }}
                />
                {found ? (
                  <p className="muted" style={{ margin: "10px 0 0", fontSize: "0.86rem" }}>
                    Found <strong>{found.symbol}</strong> — {found.name}, {found.decimals} decimals.
                  </p>
                ) : null}
                {error ? (
                  <p style={{ color: "#c98b7f", margin: "10px 0 0", fontSize: "0.84rem" }}>{error}</p>
                ) : null}

                <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                  {found ? (
                    <button className="button" onClick={save}>
                      Add {found.symbol}
                    </button>
                  ) : (
                    <button className="button" onClick={lookUp} disabled={busy}>
                      {busy ? "Reading Tempo…" : "Look it up"}
                    </button>
                  )}
                  <button
                    className="button button-quiet"
                    onClick={() => {
                      setAdding(false);
                      setFound(null);
                      setError(null);
                    }}
                  >
                    Back
                  </button>
                </div>

                <p className="faint" style={{ margin: "12px 0 0", fontSize: "0.76rem" }}>
                  Pinna reads the symbol and decimals from the contract itself. It never guesses.
                </p>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

export type { CustomToken };
