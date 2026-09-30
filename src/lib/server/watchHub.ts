import { readIncomingTransfers, RECENT_LOOKBACK } from "../chain";
import { readTransfersViaApi } from "../tempoApi";
import { TEMPO_MAINNET, TEMPO_TESTNET, type TempoNetwork } from "../tempo";
import type { IncomingTransfer } from "../requests";

/**
 * Watching for payments as they land.
 *
 * Tempo's public RPC has no websocket and refuses `eth_subscribe`, so there is
 * no push channel from the chain itself — a short poll is the fastest honest
 * option. The poll reads the chain directly rather than the indexed API: the
 * index is a step behind the chain, and a watcher exists precisely to catch
 * what has just happened. The API is the fallback, not the path.
 *
 * The window is small (a few hours) so a poll is a single round trip, and
 * block times are skipped entirely — settling a payment needs the recipient,
 * the amount and the reference, not the clock.
 *
 * One poller runs per (chain, token, address, role) and every subscriber shares
 * it, so one open app or a hundred cost the same number of calls.
 */

/** How often a watched address is re-read. */
export const POLL_MS = 1000;

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
  return [key.chainId, key.token.toLowerCase(), key.address.toLowerCase(), key.role].join(":");
}

/** One transfer's identity: the log when we have it, else what we can infer. */
function idOf(transfer: IncomingTransfer): string {
  return transfer.logId ?? `${transfer.txHash}:${transfer.amountUnits}:${transfer.from}`;
}

/** The freshest view of what has arrived, chain first and index as backup. */
async function readTransfers(key: WatchKey, network: TempoNetwork): Promise<IncomingTransfer[]> {
  if (key.role === "recipient") {
    try {
      return await readIncomingTransfers(
        network,
        key.token as `0x${string}`,
        key.address as `0x${string}`,
        { lookbackBlocks: RECENT_LOOKBACK, limit: 100, timestamps: false }
      );
    } catch {
      // the chain could not be read — fall through to the index below
    }
  }
  return readTransfersViaApi(network, key.token as `0x${string}`, key.address as `0x${string}`, {
    pages: 1,
    limit: 50,
    role: key.role,
  });
}

async function poll(key: WatchKey, watcher: Watcher): Promise<void> {
  if (watcher.polling) return;
  watcher.polling = true;
  try {
    const transfers = await readTransfers(key, watcher.network);

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
    // an unreadable chain is a delay, never a lost payment — try again next tick
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
