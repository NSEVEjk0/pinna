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
import type { PaymentRequest } from "./requests";

/**
 * The wallet is the identity: contacts, lists, requests and notifications are
 * keyed by the connected address and never leave the browser. The network and
 * token follow whichever Tempo chain the wallet is on.
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

  useEffect(() => {
    if (!address) {
      setContacts([]);
      setSent([]);
      setRequests([]);
      setEvents([]);
      setAliasState("");
      return;
    }
    setContacts(sortContacts(loadContacts(address)));
    setSent(loadSent(address));
    setRequests(loadRequests(address));
    setEvents(loadEvents(address));
    setAliasState(loadAlias());
  }, [address]);

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
    notify,
    readNotifications,
    saveContact,
    dropContact,
    recordSent,
    saveRequest,
    replaceRequests,
  };
}
