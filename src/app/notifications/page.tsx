"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePinna } from "@/lib/usePinna";
import { explorerForRecord } from "@/lib/tempo";

/**
 * Notifications: the things that happened while you were away — most of all,
 * requests that got paid.
 */
export default function NotificationsPage() {
  const { isConnected, network, events, readNotifications } = usePinna();

  useEffect(() => {
    if (isConnected && events.some((e) => !e.read)) {
      readNotifications();
    }
  }, [isConnected, events, readNotifications]);

  if (!isConnected) {
    return (
      <div className="shell fade-in" style={{ paddingTop: 40 }}>
        <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4.2vw, 2.8rem)", margin: "0 0 14px" }}>
          Connect a wallet to see notifications
        </h1>
        <p className="muted" style={{ maxWidth: "48ch" }}>
          Notifications are kept per wallet, in this browser.
        </p>
      </div>
    );
  }

  return (
    <div className="shell fade-in" style={{ paddingTop: 8, paddingBottom: 40 }}>
      <p className="eyebrow" style={{ margin: "0 0 14px" }}>
        Notifications
      </p>
      <h1 className="display" style={{ fontSize: "clamp(2rem, 4.6vw, 3rem)", margin: "0 0 12px" }}>
        What happened.
      </h1>
      <p className="muted" style={{ margin: "0 0 34px", maxWidth: "56ch" }}>
        Payments that arrived, lists you sent, and requests you created. Checked automatically
        whenever you open History or press “Check Tempo for payments”.
      </p>

      {events.length === 0 ? (
        <p className="muted">
          Nothing yet. Once someone pays a request, it lands here.
        </p>
      ) : (
        <div style={{ borderTop: "1px solid var(--hairline)" }}>
          {events.map((event) => (
            <div key={event.id} className="notif-row">
              <div>
                <p style={{ margin: 0 }}>
                  {!event.read ? <span className="notif-dot" aria-hidden="true" /> : null}
                  {event.title}
                </p>
                <p className="faint" style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
                  {event.detail} · {event.at.slice(0, 16).replace("T", " ")}
                </p>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
                {event.txHash && event.txHash.startsWith("0x") ? (
                  <a
                    className="hash-link"
                    style={{ fontSize: "0.8rem" }}
                    href={explorerForRecord({}, network, event.txHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {event.txHash.slice(0, 10)}…
                  </a>
                ) : null}
                {event.requestId ? (
                  <Link className="link" style={{ fontSize: "0.85rem" }} href="/history">
                    View
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
