import { createPublicClient, http, parseAbiItem, decodeEventLog } from "viem";
import { tempo, tempoModerato } from "viem/chains";
import type { TempoNetwork } from "./tempo";
import type { IncomingTransfer } from "./requests";
import { encodeMemo } from "./memo";

/**
 * Reads from Tempo. Pinna holds no keys: the browser wallet signs, and this
 * module only reads public chain data so the app can notice when a request
 * has been paid.
 */

/** The memo-bearing transfer event; the memo is indexed, so it can be filtered. */
export const TRANSFER_WITH_MEMO = parseAbiItem(
  "event TransferWithMemo(address indexed from, address indexed to, uint256 value, bytes32 indexed memo)"
);

export function viemChainFor(network: TempoNetwork) {
  return network.chainId === tempo.id ? tempo : tempoModerato;
}

export function publicClientFor(network: TempoNetwork) {
  return createPublicClient({
    chain: viemChainFor(network),
    transport: http(network.rpcUrl),
  });
}

export interface ReadTransfersOptions {
  /** Only look back this many blocks (default: as far as the RPC allows). */
  lookbackBlocks?: bigint;
  /** Cap on returned transfers. */
  limit?: number;
}

/**
 * Tempo's public RPC rejects a log query spanning more than a fixed number of
 * blocks (100,000 on the testnet). Large windows are therefore read in chunks,
 * and a chunk that is still too big is halved until it fits.
 */
const MAX_BLOCK_SPAN = 90_000n;

async function getLogsChunked(
  client: ReturnType<typeof publicClientFor>,
  params: {
    address: `0x${string}`;
    event: typeof TRANSFER_WITH_MEMO;
    args?: Record<string, unknown>;
  },
  fromBlock: bigint,
  toBlock: bigint
): Promise<Awaited<ReturnType<typeof client.getLogs>>> {
  const out: Awaited<ReturnType<typeof client.getLogs>> = [];
  let span = MAX_BLOCK_SPAN;
  let cursor = fromBlock;

  while (cursor <= toBlock) {
    const end = cursor + span - 1n > toBlock ? toBlock : cursor + span - 1n;
    try {
      const logs = await client.getLogs({
        address: params.address,
        event: params.event,
        args: params.args as never,
        fromBlock: cursor,
        toBlock: end,
      });
      out.push(...logs);
      cursor = end + 1n;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/range|too (many|large)|limit|exceed/i.test(message) && span > 1_000n) {
        span = span / 2n;
        continue; // retry the same window with a smaller chunk
      }
      throw err;
    }
  }
  return out;
}

/**
 * How far back a read should look. Tempo produces blocks quickly, so a window
 * is measured in blocks rather than days: one million blocks is roughly a
 * week. Callers that run on their own pass their own window.
 */
export const DEFAULT_LOOKBACK = 1_000_000n;

/** What the explicit "Sync from Tempo" reaches back to — roughly a month. */
export const DEEP_LOOKBACK = 5_000_000n;

function lookbackWindow(head: bigint, lookback?: bigint): bigint {
  const window = lookback ?? DEFAULT_LOOKBACK;
  return head > window ? head - window : 0n;
}

/**
 * Incoming transfers to an address, newest last. Reads the memo-bearing event
 * only, since that is the one Pinna writes and the only one it can match to a
 * request.
 */
export async function readIncomingTransfers(
  network: TempoNetwork,
  token: `0x${string}`,
  to: `0x${string}`,
  options: ReadTransfersOptions = {}
): Promise<IncomingTransfer[]> {
  const client = publicClientFor(network);
  const head = await client.getBlockNumber();
  const fromBlock = lookbackWindow(head, options.lookbackBlocks);

  const logs = await getLogsChunked(
    client,
    { address: token, event: TRANSFER_WITH_MEMO, args: { to } },
    fromBlock,
    head
  );

  const limit = options.limit ?? 200;
  const slice = logs.slice(Math.max(0, logs.length - limit));

  const transfers: IncomingTransfer[] = [];
  for (const log of slice) {
    try {
      const decoded = decodeEventLog({
        abi: [TRANSFER_WITH_MEMO],
        data: log.data,
        topics: log.topics,
      });
      const args = decoded.args as unknown as {
        from: `0x${string}`;
        to: `0x${string}`;
        value: bigint;
        memo: string;
      };
      let timestamp: number | undefined;
      try {
        if (log.blockNumber != null) {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          timestamp = Number(block.timestamp);
        }
      } catch {
        timestamp = undefined;
      }
      transfers.push({
        from: args.from,
        to: args.to,
        amountUnits: args.value,
        memo: args.memo,
        txHash: log.transactionHash ?? "",
        timestamp,
      });
    } catch {
      // a log that does not decode is skipped, never guessed at
    }
  }
  return transfers;
}

/**
 * Everything this wallet has done on Tempo, in and out, read straight from the
 * chain. This is what lets Pinna show past transactions as they really are —
 * sent ones as paid, received ones as received — with their hashes, instead of
 * relying on what this browser happens to remember.
 */
export async function readWalletTransfers(
  network: TempoNetwork,
  token: `0x${string}`,
  address: `0x${string}`,
  options: ReadTransfersOptions = {}
): Promise<IncomingTransfer[]> {
  const client = publicClientFor(network);
  const head = await client.getBlockNumber();
  const fromBlock = lookbackWindow(head, options.lookbackBlocks);

  const [outgoing, incoming] = await Promise.all([
    getLogsChunked(
      client,
      { address: token, event: TRANSFER_WITH_MEMO, args: { from: address } },
      fromBlock,
      head
    ),
    getLogsChunked(
      client,
      { address: token, event: TRANSFER_WITH_MEMO, args: { to: address } },
      fromBlock,
      head
    ),
  ]);

  const logs = [...outgoing, ...incoming];
  const limit = options.limit ?? 500;
  const slice = logs.slice(Math.max(0, logs.length - limit));

  // Block times are fetched once each, not once per log.
  const blocks = [
    ...new Set(slice.map((l) => l.blockNumber).filter((bn): bn is bigint => bn != null)),
  ];
  const times = new Map<bigint, number>();
  await Promise.all(
    blocks.slice(0, 120).map(async (bn) => {
      try {
        const block = await client.getBlock({ blockNumber: bn });
        times.set(bn, Number(block.timestamp));
      } catch {
        // a missing timestamp is not fatal; the row simply shows no time
      }
    })
  );

  const transfers: IncomingTransfer[] = [];
  for (const log of slice) {
    try {
      const decoded = decodeEventLog({
        abi: [TRANSFER_WITH_MEMO],
        data: log.data,
        topics: log.topics,
      });
      const args = decoded.args as unknown as {
        from: `0x${string}`;
        to: `0x${string}`;
        value: bigint;
        memo: string;
      };
      transfers.push({
        from: args.from,
        to: args.to,
        amountUnits: args.value,
        memo: args.memo,
        txHash: log.transactionHash ?? "",
        timestamp: log.blockNumber != null ? times.get(log.blockNumber) : undefined,
      });
    } catch {
      // a log that does not decode is skipped, never guessed at
    }
  }

  return transfers.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
}

/**
 * Read a token's own description from the chain, so adding a stablecoin only
 * needs its contract address. Returns null when the address is not a TIP-20.
 */
export async function readTokenMetadata(
  network: TempoNetwork,
  address: `0x${string}`
): Promise<{ symbol: string; name: string; decimals: number } | null> {
  const client = publicClientFor(network);
  const abi = [
    {
      type: "function",
      name: "symbol",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "string" }],
    },
    {
      type: "function",
      name: "name",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "string" }],
    },
    {
      type: "function",
      name: "decimals",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "uint8" }],
    },
  ] as const;

  try {
    const [symbol, name, decimals] = await Promise.all([
      client.readContract({ address, abi, functionName: "symbol" }),
      client.readContract({ address, abi, functionName: "name" }).catch(() => ""),
      client.readContract({ address, abi, functionName: "decimals" }),
    ]);
    const decimalsNumber = Number(decimals);
    if (!symbol || !Number.isFinite(decimalsNumber) || decimalsNumber > 36) return null;
    return { symbol: String(symbol), name: String(name || symbol), decimals: decimalsNumber };
  } catch {
    // not a token, or the chain could not be read — never guessed at
    return null;
  }
}

/** Read the token balance for an address, in base units. */
export async function readTokenBalance(
  network: TempoNetwork,
  token: `0x${string}`,
  address: `0x${string}`
): Promise<bigint> {
  const client = publicClientFor(network);
  return client.readContract({
    address: token,
    abi: [
      {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ type: "uint256" }],
      },
    ],
    functionName: "balanceOf",
    args: [address],
  });
}

/**
 * Has this reference already been paid? The memo is indexed, so Tempo can
 * answer that directly — which is what lets a pay link say "already paid" on
 * a device that has never seen it before.
 */
export async function findTransferByReference(
  network: TempoNetwork,
  token: `0x${string}`,
  to: `0x${string}`,
  reference: string,
  options: ReadTransfersOptions = {}
): Promise<IncomingTransfer | null> {
  const client = publicClientFor(network);
  const head = await client.getBlockNumber();
  const fromBlock = lookbackWindow(head, options.lookbackBlocks);

  const memo = encodeMemo(reference);
  const logs = await getLogsChunked(
    client,
    { address: token, event: TRANSFER_WITH_MEMO, args: { to, memo } },
    fromBlock,
    head
  );
  if (logs.length === 0) return null;

  const log = logs[logs.length - 1];
  const decoded = decodeEventLog({
    abi: [TRANSFER_WITH_MEMO],
    data: log.data,
    topics: log.topics,
  });
  const args = decoded.args as unknown as {
    from: `0x${string}`;
    to: `0x${string}`;
    value: bigint;
    memo: string;
  };

  let timestamp: number | undefined;
  try {
    if (log.blockNumber != null) {
      const block = await client.getBlock({ blockNumber: log.blockNumber });
      timestamp = Number(block.timestamp);
    }
  } catch {
    timestamp = undefined;
  }

  return {
    from: args.from,
    to: args.to,
    amountUnits: args.value,
    memo: args.memo,
    txHash: log.transactionHash ?? "",
    timestamp,
  };
}
