import { readTransfersViaApi } from "../tempoApi";
import { TEMPO_MAINNET, TEMPO_TESTNET, type TempoNetwork } from "../tempo";
import type { IncomingTransfer } from "../requests";

/**
 * Watching for payments as they land.
 *
 * Tempo's public RPC has no websocket and refuses `eth_subscribe`, so there is
 * no push channel from the chain itself. What there is, is the indexed Tempo
 * API, which carries a transfer as soon as it is included — and Tempo finalises
 * in well under a second, so the delay a receiver sees is the poll, not the
 * chain.
 *
 * One poller runs per (chain, token, address, role) and every subscriber shares
 * it, so one open app or a hundred cost the same number of API calls. A Tempo
 * API key plus webhooks would remove the poll entirely; until then this is the
 * fastest honest option.
 */

const POLL_MS = 2000;

type Listener = (transfers: IncomingTransfer[]) => void;

export interface WatchKey {
  chainId: number;
  token: string;
  address: string;
  role: "recipient" | "sender";
}

interface Watcher {
  network: TempoNetwork;
  listeners: Set<Listener>;
  timer: ReturnType<typeof setInterval> | null;
  seen: Set<string>;
  /** The first poll only records what is already there, so it is not replayed. */
  seeded: boolean;
  polling: boolean;
}

const watchers = new Map<string, Watcher>();

function keyOf(key: WatchKey): string {
  return [
    key.chainId,
    key.token.toLowerCase(),
    key.address.toLowerCase(),
    key.role,
  ].join(":");
}

/** One transfer's identity: the log when we have it, else what we can infer. */
function idOf(transfer: IncomingTransfer): string {
  return transfer.logId ?? `${transfer.txHash}:${transfer.amountUnits}:${transfer.from}`;
}

async function poll(key: WatchKey, watcher: Watcher): Promise<void> {
  if (watcher.polling) return;
  watcher.polling = true;
  try {
    const transfers = await readTransfersViaApi(
      watcher.network,
      key.token as `0x${string}`,
      key.address as `0x${string}`,
      { pages: 1, limit: 50, role: key.role }
    );

    const fresh: IncomingTransfer[] = [];
    for (const transfer of transfers) {
      const id = idOf(transfer);
      if (watcher.seen.has(id)) continue;
      watcher.seen.add(id);
      if (watcher.seeded) fresh.push(transfer);
    }
    watcher.seeded = true;

    if (fresh.length > 0) {
      for (const listener of watcher.listeners) {
        try {
          listener(fresh);
        } catch {
          // one broken subscriber must not stop the others
        }
      }
    }
  } catch {
    // an unreadable index is a delay, never a lost payment — try again next tick
  } finally {
    watcher.polling = false;
  }
}

/** Watch an address for transfers. Returns the unsubscribe function. */
export function subscribe(key: WatchKey, listener: Listener): () => void {
  const id = keyOf(key);
  let watcher = watchers.get(id);
  if (!watcher) {
    watcher = {
      network: key.chainId === TEMPO_MAINNET.chainId ? TEMPO_MAINNET : TEMPO_TESTNET,
      listeners: new Set(),
      timer: null,
      seen: new Set(),
      seeded: false,
      polling: false,
    };
    watchers.set(id, watcher);
  }

  watcher.listeners.add(listener);
  if (!watcher.timer) {
    void poll(key, watcher);
    watcher.timer = setInterval(() => void poll(key, watcher), POLL_MS);
  }

  return () => {
    const current = watchers.get(id);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      if (current.timer) clearInterval(current.timer);
      watchers.delete(id);
    }
  };
}
