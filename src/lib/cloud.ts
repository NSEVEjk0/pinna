import type { Contact, SentList } from "./storage";
import type { PaymentRequest } from "./requests";

/**
 * The cloud copy of a wallet's data.
 *
 * The key is the Tempo address itself — there is no password and no account.
 * When encryption is on, the blob is sealed in the browser with a key derived
 * from a wallet signature, so the server stores something it cannot read.
 */

export interface CloudBlob {
  version: 1;
  address: string;
  savedAt: string;
  contacts: Contact[];
  requests: PaymentRequest[];
  sent: SentList[];
}

export const SYNC_MESSAGE = (address: string) =>
  `Pinna sync key v1\nAddress: ${address.toLowerCase()}\nSign to unlock your own data across devices.`;

export function emptyBlob(address: string): CloudBlob {
  return {
    version: 1,
    address: address.toLowerCase(),
    savedAt: new Date(0).toISOString(),
    contacts: [],
    requests: [],
    sent: [],
  };
}

/**
 * Merge what is here with what came back from the cloud. Nothing is ever
 * dropped: items are combined by identity (contact by address, requests and
 * lists by id), and for the same item the one touched most recently wins.
 */
export function mergeBlobs(local: CloudBlob, remote: CloudBlob): CloudBlob {
  const newer = (a?: string, b?: string) => (Date.parse(b ?? "") || 0) > (Date.parse(a ?? "") || 0);

  const contacts = new Map<string, Contact>();
  for (const contact of [...remote.contacts, ...local.contacts]) {
    const key = contact.address.toLowerCase();
    const existing = contacts.get(key);
    if (!existing) {
      contacts.set(key, contact);
      continue;
    }
    // Keep the busier record, and whichever name was set most recently.
    const name = newer(existing.lastUsedAt, contact.lastUsedAt) ? contact.name : existing.name;
    contacts.set(key, {
      ...existing,
      name,
      avatar: contact.avatar ?? existing.avatar,
      useCount: Math.max(existing.useCount, contact.useCount),
      lastUsedAt: newer(existing.lastUsedAt, contact.lastUsedAt)
        ? contact.lastUsedAt
        : existing.lastUsedAt,
    });
  }

  const requests = new Map<string, PaymentRequest>();
  for (const request of [...remote.requests, ...local.requests]) {
    const existing = requests.get(request.id);
    if (!existing) {
      requests.set(request.id, request);
      continue;
    }
    // A settled request beats a waiting one; otherwise the more recent wins.
    const settled = existing.status !== "waiting" && request.status === "waiting";
    const candidate = settled
      ? existing
      : existing.status === "waiting" && request.status !== "waiting"
        ? request
        : newer(existing.createdAt, request.createdAt)
          ? request
          : existing;
    requests.set(request.id, candidate);
  }

  const sent = new Map<string, SentList>();
  for (const entry of [...remote.sent, ...local.sent]) {
    const existing = sent.get(entry.id);
    if (!existing || newer(existing.at, entry.at)) sent.set(entry.id, entry);
  }

  // The merged blob is as old as whichever side was written last.
  const savedAt = newer(remote.savedAt, local.savedAt) ? local.savedAt : remote.savedAt;

  return {
    version: 1,
    address: local.address || remote.address,
    savedAt,
    contacts: [...contacts.values()],
    requests: [...requests.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    sent: [...sent.values()].sort((a, b) => b.at.localeCompare(a.at)),
  };
}

// ---- Encryption ----

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return typeof btoa === "function"
    ? btoa(binary)
    : Buffer.from(bytes).toString("base64");
}

function fromBase64(value: string): Uint8Array {
  if (typeof atob === "function") {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  }
  return new Uint8Array(Buffer.from(value, "base64"));
}

/** Derive an AES-GCM key from the wallet's signature over the fixed message. */
export async function keyFromSignature(signature: string, address: string): Promise<CryptoKey> {
  const material = new TextEncoder().encode(`${signature.toLowerCase()}:${address.toLowerCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptBlob(key: CryptoKey, blob: CloudBlob): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(blob));
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const out = new Uint8Array(iv.length + sealed.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(sealed), iv.length);
  return toBase64(out);
}

export async function decryptBlob(key: CryptoKey, payload: string): Promise<CloudBlob | null> {
  try {
    const raw = fromBase64(payload);
    const iv = raw.slice(0, 12);
    const body = raw.slice(12);
    const opened = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, body);
    const parsed = JSON.parse(new TextDecoder().decode(opened)) as CloudBlob;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    // Wrong key (a different signature) or a damaged blob — never guessed at.
    return null;
  }
}
