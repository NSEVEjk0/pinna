import type { PaymentRequest } from "./requests";
import type { LedgerEntry } from "./ledger";

/**
 * Everything Pinna knows lives in the browser, keyed by the connected wallet:
 * contacts, the lists you have sent, and the requests you have made. No
 * account, no server copy of your address book.
 */

export interface Contact {
  address: `0x${string}`;
  name: string;
  /** How many times this contact has been paid or asked — repeat contacts sort to the top. */
  useCount: number;
  lastUsedAt: string;
}

export interface SentRowSummary {
  name: string;
  address: string;
  amount: string;
  reason?: string;
}

export interface SentList {
  id: string;
  to: string[];
  rowCount: number;
  total: string;
  txHash: string;
  at: string;
  tokenSymbol: string;
  network: string;
  /** The chain the transfer actually happened on, so links never point
   *  at the wrong explorer when you later switch networks. */
  chainId?: number;
  explorerUrl?: string;
  /** The rows exactly as they were signed, so a receipt can be rebuilt. */
  rows?: SentRowSummary[];
}

export interface PinnaStore {
  contacts: Contact[];
  sent: SentList[];
  requests: PaymentRequest[];
}

const EMPTY: PinnaStore = { contacts: [], sent: [], requests: [] };

function keyFor(wallet: string, suffix: string): string {
  return `pinna:${wallet.toLowerCase()}:${suffix}`;
}

function read<T>(wallet: string, suffix: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(keyFor(wallet, suffix));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function write(wallet: string, suffix: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(wallet, suffix), JSON.stringify(value));
  } catch {
    // storage full or blocked — the app still works for this session
  }
}

export function loadContacts(wallet: string): Contact[] {
  return read<Contact[]>(wallet, "contacts", []);
}

/** Save or rename a contact, remembering how often they are used. */
export function upsertContact(
  wallet: string,
  contact: { address: `0x${string}`; name: string },
  options: { countUse?: boolean; at?: string } = {}
): Contact[] {
  const contacts = loadContacts(wallet);
  const at = options.at ?? new Date().toISOString();
  const idx = contacts.findIndex(
    (c) => c.address.toLowerCase() === contact.address.toLowerCase()
  );
  if (idx >= 0) {
    const existing = contacts[idx];
    contacts[idx] = {
      ...existing,
      name: contact.name || existing.name,
      useCount: existing.useCount + (options.countUse ? 1 : 0),
      lastUsedAt: options.countUse ? at : existing.lastUsedAt,
    };
  } else {
    contacts.push({
      address: contact.address,
      name: contact.name,
      useCount: options.countUse ? 1 : 0,
      lastUsedAt: at,
    });
  }
  write(wallet, "contacts", contacts);
  return contacts;
}

export function removeContact(wallet: string, address: string): Contact[] {
  const contacts = loadContacts(wallet).filter(
    (c) => c.address.toLowerCase() !== address.toLowerCase()
  );
  write(wallet, "contacts", contacts);
  return contacts;
}

/** Repeat contacts first, then most recently used, then name. */
export function sortContacts(contacts: Contact[]): Contact[] {
  return [...contacts].sort((a, b) => {
    if (b.useCount !== a.useCount) return b.useCount - a.useCount;
    const at = Date.parse(b.lastUsedAt || "") || 0;
    const bt = Date.parse(a.lastUsedAt || "") || 0;
    if (at !== bt) return at - bt;
    return a.name.localeCompare(b.name);
  });
}

export function findContact(wallet: string, address: string): Contact | undefined {
  return loadContacts(wallet).find(
    (c) => c.address.toLowerCase() === address.toLowerCase()
  );
}

export function loadSent(wallet: string): SentList[] {
  return read<SentList[]>(wallet, "sent", []);
}

export function addSent(wallet: string, entry: SentList): SentList[] {
  const sent = [entry, ...loadSent(wallet)];
  write(wallet, "sent", sent);
  return sent;
}

export function loadRequests(wallet: string): PaymentRequest[] {
  return read<PaymentRequest[]>(wallet, "requests", []);
}

export function saveRequests(wallet: string, requests: PaymentRequest[]): void {
  write(wallet, "requests", requests);
}

export function upsertRequest(wallet: string, request: PaymentRequest): PaymentRequest[] {
  const requests = loadRequests(wallet);
  const idx = requests.findIndex((r) => r.id === request.id);
  if (idx >= 0) requests[idx] = request;
  else requests.unshift(request);
  saveRequests(wallet, requests);
  return requests;
}

export function loadStore(wallet: string): PinnaStore {
  return {
    contacts: sortContacts(loadContacts(wallet)),
    sent: loadSent(wallet),
    requests: loadRequests(wallet),
  };
}

/** The last chain sync: every transfer in and out, as Tempo reported it. */
export function loadLedger(wallet: string): LedgerEntry[] {
  return read<LedgerEntry[]>(wallet, "ledger", []);
}

export function saveLedger(wallet: string, entries: LedgerEntry[]): LedgerEntry[] {
  write(wallet, "ledger", entries);
  return entries;
}

export function loadLastSync(wallet: string): string | null {
  return read<string | null>(wallet, "lastSync", null);
}

export function saveLastSync(wallet: string, at: string): void {
  write(wallet, "lastSync", at);
}

export { EMPTY as EMPTY_STORE };
