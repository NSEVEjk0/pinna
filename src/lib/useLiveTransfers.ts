"use client";

import { useEffect, useRef } from "react";
import { transfersFromJson } from "./tempoApi";
import type { IncomingTransfer } from "./requests";
import type { TempoNetwork } from "./tempo";

/**
 * Follow an address's transfers live.
 *
 * Opens a server-sent event stream and hands each new transfer to the caller as
 * it arrives, so a payment settles in the app the moment it lands rather than
 * at the next sync. The browser reconnects on its own if the stream drops, and
 * the poll behind it is shared server-side.
 *
 * `role` is which side of the transfer to watch: a recipient watches money
 * arriving, a sender watches money leaving.
 */
export function useLiveTransfers(
  network: TempoNetwork,
  token: `0x${string}` | undefined,
  address: `0x${string}` | undefined,
  role: "recipient" | "sender",
  onTransfers: (transfers: IncomingTransfer[]) => void
): { connected: boolean } {
  // Kept in a ref so a new callback identity does not tear the stream down.
  const handler = useRef(onTransfers);
  handler.current = onTransfers;

  const connected = useRef(false);

  useEffect(() => {
    if (!address || !token) return;
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    const query = new URLSearchParams({
      address,
      token,
      chain: String(network.chainId),
      role,
    });
    const source = new EventSource(`/api/watch?${query}`);

    source.addEventListener("ready", () => {
      connected.current = true;
    });
    source.addEventListener("transfers", (event) => {
      try {
        const transfers = transfersFromJson(JSON.parse((event as MessageEvent).data));
        if (transfers.length > 0) handler.current(transfers);
      } catch {
        // a frame we cannot read is ignored, never acted on
      }
    });
    // EventSource reconnects by itself; nothing to do on error but let it.

    return () => {
      connected.current = false;
      source.close();
    };
  }, [network.chainId, token, address, role]);

  return { connected: connected.current };
}
