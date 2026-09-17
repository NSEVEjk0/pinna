"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection } from "wagmi";
import { activeToken } from "./tempo";
import { useActiveNetwork } from "./useActiveNetwork";
import {
  addSent,
  loadContacts,
  loadRequests,
  loadSent,
  removeContact,
  sortContacts,
  upsertContact,
  upsertRequest,
  type Contact,
  type SentList,
} from "./storage";
import { loadEvents, markAllRead, pushEvent, type PinnaEvent } from "./events";
import { loadAlias, saveAlias as persistAlias } from "./profile";
import { loadLedger, loadLastSync, saveLastSync, saveLedger } from "./storage";
import { buildLedger, type LedgerEntry } from "./ledger";
import { readWalletTransfers, DEEP_LOOKBACK } from "./chain";
import { markPaid, type PaymentRequest } from "./requests";

/**
 * The wallet is the identity: contacts, lists, requests and notifications are
 * keyed by the connected address and never leave the browser. The network and
 * token follow whichever Tempo chain the wallet is on.
 *
 * The chain itself is the record of what moved: `syncFromChain` reads every
 * transfer in and out of the wallet and turns it into the ledger.
 */
export function usePinna() {
  const { address, isConnected } = useConnection();
  const { network } = useActiveNetwork();
  const token = useMemo(() => activeToken(network, undefined), [network]);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sent, setSent] = useState<SentList[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [events, setEvents] = useState<PinnaEvent[]>([]);
  const [alias, setAliasState] = useState("");
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setContacts([]);
      setSent([]);
      setRequests([]);
      setEvents([]);
      setAliasState("");
      setLedger([]);
      setLastSync(null);
      return;
    }
    setContacts(sortContacts(loadContacts(address)));
    setSent(loadSent(address));
    setRequests(loadRequests(address));
    setEvents(loadEvents(address));
    setAliasState(loadAlias());
    setLedger(loadLedger(address));
    setLastSync(loadLastSync(address));
  }, [address]);

  /**
   * Read the wallet's transfers from Tempo and rebuild the ledger. New
   * arrivals become notifications; requests whose memo shows up are settled.
   */
  const syncFromChain = useCallback(
    async (options: { quiet?: boolean } = {}) => {
      if (!address) return null;
      setSyncing(true);
      setSyncError(null);
      try {
        // A quiet automatic pass looks at recent history only; the manual
      // "Sync from Tempo" button reaches much further back.
      const transfers = await readWalletTransfers(network, token.address, address, {
        lookbackBlocks: options.quiet ? 1_000_000n : DEEP_LOOKBACK,
      });
        const nameFor = (addr: string) =>
          loadContacts(address).find((c) => c.address.toLowerCase() === addr.toLowerCase())?.name;

        const currentRequests = loadRequests(address);
        const entries = buildLedger({
          transfers,
          sent: loadSent(address),
          requests: currentRequests,
          address,
          decimals: token.decimals,
          tokenSymbol: token.symbol,
          chainId: network.chainId,
          explorerUrl: network.explorerUrl,
          nameFor,
        });

        // Settle any waiting request whose reference appeared on chain.
        const settledIds = new Set(
          entries.map((e) => e.reference).filter(Boolean) as string[]
        );
        let changed = false;
        const nextRequests = currentRequests.map((request) => {
          if (request.status !== "waiting" || !settledIds.has(request.id)) return request;
          const entry = entries.find((e) => e.reference === request.id);
          if (!entry) return request;
          changed = true;
          const paid = markPaid(request, { txHash: entry.txHash, settledBy: "detected" });
          paid.chainId = network.chainId;
          paid.explorerUrl = network.explorerUrl;
          return paid;
        });
        if (changed) {
          nextRequests.forEach((r) => upsertRequest(address, r));
          setRequests(loadRequests(address));
        }

        // Tell the user about what the chain showed that we had not seen.
        const previous = loadLedger(address);
        const known = new Set(previous.map((e) => e.id));
        const fresh = entries.filter((e) => !known.has(e.id));
        if (fresh.length > 0 && !options.quiet) {
          for (const entry of fresh.slice(0, 5)) {
            pushEvent(address, {
              kind: entry.direction === "sent" ? "list_sent" : "request_paid",
              title:
                entry.direction === "sent"
                  ? `Paid ${entry.amount} ${entry.tokenSymbol}`
                  : `Received ${entry.amount} ${entry.tokenSymbol}`,
              detail: `${entry.name || entry.address}${entry.reason ? ` · ${entry.reason}` : ""}`,
              txHash: entry.txHash,
              requestId: entry.reference ?? undefined,
            });
          }
        }

        saveLedger(address, entries);
        setLedger(entries);
        const at = new Date().toISOString();
        saveLastSync(address, at);
        setLastSync(at);
        setEvents(loadEvents(address));
        return entries;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Tempo could not be read just now.";
        setSyncError(message);
        return null;
      } finally {
        setSyncing(false);
      }
    },
    [address, network, token]
  );

  const saveContact = useCallback(
    (contact: { address: `0x${string}`; name: string }, countUse = false) => {
      if (!address) return;
      setContacts(sortContacts(upsertContact(address, contact, { countUse })));
    },
    [address]
  );

  const dropContact = useCallback(
    (addr: string) => {
      if (!address) return;
      setContacts(sortContacts(removeContact(address, addr)));
    },
    [address]
  );

  const recordSent = useCallback(
    (entry: SentList) => {
      if (!address) return;
      setSent(addSent(address, entry));
      setEvents(
        pushEvent(address, {
          kind: "list_sent",
          title: `Sent ${entry.total} ${entry.tokenSymbol}`,
          detail: `${entry.rowCount} transfer${entry.rowCount === 1 ? "" : "s"} to ${entry.to.join(", ")}`,
          txHash: entry.txHash,
        })
      );
    },
    [address]
  );

  const saveRequest = useCallback(
    (request: PaymentRequest) => {
      if (!address) return;
      setRequests(upsertRequest(address, request));
    },
    [address]
  );

  const replaceRequests = useCallback(
    (next: PaymentRequest[]) => {
      if (!address) return;
      next.forEach((r) => upsertRequest(address, r));
      setRequests(loadRequests(address));
    },
    [address]
  );

  /** Record something worth telling the user about. */
  const notify = useCallback(
    (event: Parameters<typeof pushEvent>[1]) => {
      if (!address) return;
      setEvents(pushEvent(address, event));
    },
    [address]
  );

  const readNotifications = useCallback(() => {
    if (!address) return;
    setEvents(markAllRead(address));
  }, [address]);

  const saveAlias = useCallback((next: string) => {
    setAliasState(persistAlias(next));
  }, []);

  return {
    address,
    isConnected,
    network,
    token,
    alias,
    saveAlias,
    contacts,
    sent,
    requests,
    events,
    ledger,
    lastSync,
    syncing,
    syncError,
    syncFromChain,
    notify,
    readNotifications,
    saveContact,
    dropContact,
    recordSent,
    saveRequest,
    replaceRequests,
  };
}
