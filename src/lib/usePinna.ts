"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection } from "wagmi";
import { currentNetwork } from "./wagmi";
import { activeToken } from "./tempo";
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
import type { PaymentRequest } from "./requests";

/**
 * The wallet is the identity: contacts, lists and requests are keyed by the
 * connected address and never leave the browser.
 */
export function usePinna() {
  const { address, isConnected } = useConnection();
  const network = useMemo(() => currentNetwork(), []);
  const token = useMemo(() => activeToken(network), [network]);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sent, setSent] = useState<SentList[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);

  useEffect(() => {
    if (!address) {
      setContacts([]);
      setSent([]);
      setRequests([]);
      return;
    }
    setContacts(sortContacts(loadContacts(address)));
    setSent(loadSent(address));
    setRequests(loadRequests(address));
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

  return {
    address,
    isConnected,
    network,
    token,
    contacts,
    sent,
    requests,
    saveContact,
    dropContact,
    recordSent,
    saveRequest,
    replaceRequests,
  };
}
