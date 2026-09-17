"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConnection, useConnect, useDisconnect } from "wagmi";
import { Wordmark } from "./Fern";
import { shortAddress } from "@/lib/money";

function ConnectButton() {
  const { address, isConnected } = useConnection();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

  if (isConnected && address) {
    return (
      <button
        type="button"
        className="nav-link"
        onClick={() => disconnect()}
        title="Disconnect"
      >
        <span className="mono">{shortAddress(address)}</span>
        <span className="faint" style={{ marginLeft: 8 }}>
          disconnect
        </span>
      </button>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="button button-quiet" onClick={() => setOpen((v) => !v)}>
        Connect wallet
      </button>
      {open ? (
        <div
          className="panel"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 10px)",
            background: "#191919",
            minWidth: 220,
            zIndex: 20,
            padding: 8,
          }}
        >
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              type="button"
              className="nav-link"
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: 0,
                padding: "10px 12px",
                cursor: "pointer",
              }}
              disabled={isPending}
              onClick={() => {
                connect({ connector });
                setOpen(false);
              }}
            >
              {connector.name}
            </button>
          ))}
          {connectors.length === 0 ? (
            <p className="faint" style={{ padding: 12, margin: 0, fontSize: "0.85rem" }}>
              No wallet found in this browser.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Home" },
    { href: "/contacts", label: "Contacts" },
    { href: "/history", label: "History" },
  ];
  return (
    <header className="hairline">
      <div
        className="shell"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "22px 0",
        }}
      >
        <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <Wordmark />
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 26 }}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="nav-link"
              data-active={pathname === l.href}
            >
              {l.label}
            </Link>
          ))}
          <ConnectButton />
        </nav>
      </div>
    </header>
  );
}
