"use client";

import { useState } from "react";
import { useConnection } from "wagmi";
import { usePinna } from "@/lib/usePinna";
import {
  SYNC_MESSAGE,
  decryptBlob,
  emptyBlob,
  encryptBlob,
  keyFromSignature,
  mergeBlobs,
  type CloudBlob,
} from "@/lib/cloud";
import type { Contact } from "@/lib/storage";

interface Eip1193 {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

/**
 * Sync across devices, keyed by the Tempo address alone — no password, no
 * account, and no private key anywhere near the server. Encryption is done in
 * the browser with a key derived from a wallet signature, so what the server
 * stores is a value it cannot read.
 */
export default function SyncPage() {
  const {
    address,
    isConnected,
    contacts,
    requests,
    sent,
    network,
    saveContact,
    saveRequest,
    recordSent,
  } = usePinna();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [encrypt, setEncrypt] = useState(true);
  const [hasCloud, setHasCloud] = useState<boolean | null>(null);

  async function signSyncKey(): Promise<CryptoKey | null> {
    if (!address) return null;
    const provider = (await (window as unknown as { ethereum?: Eip1193 }).ethereum) as
      | Eip1193
      | undefined;
    if (!provider?.request) {
      setError("No wallet found in this browser to sign with.");
      return null;
    }
    const signature = (await provider.request({
      method: "personal_sign",
      params: [SYNC_MESSAGE(address), address],
    })) as string;
    return keyFromSignature(signature, address);
  }

  function localBlob(): CloudBlob {
    return {
      version: 1,
      address: (address ?? "").toLowerCase(),
      savedAt: new Date().toISOString(),
      contacts,
      requests,
      sent,
    };
  }

  async function push() {
    if (!address) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      let body: string;
      let encrypted = false;
      if (encrypt) {
        const key = await signSyncKey();
        if (!key) return;
        body = await encryptBlob(key, localBlob());
        encrypted = true;
      } else {
        body = JSON.stringify(localBlob());
      }
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, blob: body, encrypted }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? `Could not save (${res.status}).`);
        return;
      }
      setStatus(
        encrypted
          ? "Saved. The copy in the cloud is encrypted — only your wallet can open it."
          : "Saved without encryption. Anyone who knows your address could read the names."
      );
      setLastSync(json.updatedAt ?? new Date().toISOString());
      setHasCloud(true);
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("rejected")
          ? "The signature was declined, so nothing was saved."
          : err instanceof Error
            ? err.message
            : "Could not save."
      );
    } finally {
      setBusy(false);
    }
  }

  async function pull() {
    if (!address) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/sync?address=${address}`);
      if (res.status === 404) {
        setHasCloud(false);
        setStatus("There is no cloud copy for this address yet. Save one first.");
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? `Could not read (${res.status}).`);
        return;
      }

      let remote: CloudBlob | null = null;
      if (json.encrypted) {
        const key = await signSyncKey();
        if (!key) return;
        remote = await decryptBlob(key, json.blob);
        if (!remote) {
          setError(
            "The cloud copy could not be opened. That happens when the wallet signs a different value than it did before — try saving from the device that created it."
          );
          return;
        }
      } else {
        remote = JSON.parse(json.blob) as CloudBlob;
      }

      const merged = mergeBlobs(localBlob(), remote);
      for (const contact of merged.contacts as Contact[]) {
        saveContact({ address: contact.address, name: contact.name, avatar: contact.avatar });
      }
      merged.requests.forEach((r) => saveRequest(r));
      merged.sent.forEach((entry) => recordSent(entry));

      setStatus(
        `Merged. ${merged.contacts.length} contacts, ${merged.requests.length} requests, ${merged.sent.length} lists.`
      );
      setLastSync(json.updatedAt ?? null);
      setHasCloud(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the cloud copy.");
    } finally {
      setBusy(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="shell fade-in" style={{ paddingTop: 40 }}>
        <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4.2vw, 2.8rem)", margin: "0 0 14px" }}>
          Connect a wallet to sync
        </h1>
        <p className="muted" style={{ maxWidth: "48ch" }}>
          The wallet address is the key to your data.
        </p>
      </div>
    );
  }

  return (
    <div className="shell fade-in" style={{ paddingTop: 8, paddingBottom: 40 }}>
      <p className="eyebrow" style={{ margin: "0 0 14px" }}>
        Sync
      </p>
      <h1 className="display" style={{ fontSize: "clamp(2rem, 4.6vw, 3rem)", margin: "0 0 12px" }}>
        The same list everywhere.
      </h1>
      <p className="muted" style={{ maxWidth: "62ch", margin: "0 0 26px" }}>
        Contacts, requests and lists live in this browser. Turn sync on and they are also kept in a
        small database on the server, addressed by your Tempo wallet — so the same list opens on
        your phone and your laptop. No password: connecting the wallet is what claims the data.
      </p>

      <div className="detail-grid" style={{ marginBottom: 26 }}>
        <div className="panel" style={{ padding: 20 }}>
          <p className="eyebrow" style={{ margin: "0 0 8px" }}>
            No keys leave your wallet
          </p>
          <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
            The server never sees a private key and cannot sign anything. It stores a blob and
            hands it back.
          </p>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <p className="eyebrow" style={{ margin: "0 0 8px" }}>
            Encrypted in the browser
          </p>
          <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
            With encryption on, the blob is sealed using a key derived from a wallet signature — so
            the server keeps something it cannot read, names included.
          </p>
        </div>
      </div>

      <div className="panel" style={{ padding: 22 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={encrypt}
            onChange={(e) => setEncrypt(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span>
            Encrypt the cloud copy
            <span className="faint" style={{ display: "block", fontSize: "0.82rem" }}>
              Costs one signature (no transaction, no fee) each time you save or read. Without it,
              the names are stored as plain text.
            </span>
          </span>
        </label>

        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <button className="button" onClick={push} disabled={busy}>
            {busy ? "Working…" : "Save to cloud"}
          </button>
          <button className="button button-quiet" onClick={pull} disabled={busy}>
            Load and merge
          </button>
        </div>

        <p className="faint" style={{ marginTop: 16, fontSize: "0.82rem" }}>
          Saving keeps the newest of each contact, request and list — nothing is deleted by a
          merge. {network.name}. {lastSync ? `Last cloud write ${lastSync.slice(0, 16).replace("T", " ")}.` : ""}
        </p>

        {status ? <p className="muted" style={{ marginTop: 12 }}>{status}</p> : null}
        {error ? <p style={{ color: "#c98b7f", marginTop: 12 }}>{error}</p> : null}
        {hasCloud === false ? (
          <p className="faint" style={{ marginTop: 10, fontSize: "0.85rem" }}>
            Nothing stored for this address yet.
          </p>
        ) : null}
      </div>

      <p className="faint" style={{ marginTop: 22, fontSize: "0.82rem", maxWidth: "62ch" }}>
        A request carries the whole thing in its link, so a payer never needs the cloud copy — this
        is for your own devices, not for the person paying you.
      </p>
    </div>
  );
}
