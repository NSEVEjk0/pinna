import { createPublicClient, http, parseAbiItem, decodeEventLog } from "viem";
import { tempo, tempoModerato } from "viem/chains";
import type { TempoNetwork } from "./tempo";
import type { IncomingTransfer } from "./requests";

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
  /** Only look back this many blocks (default ~a day of Tempo blocks). */
  lookbackBlocks?: bigint;
  /** Cap on returned transfers. */
  limit?: number;
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
  const lookback = options.lookbackBlocks ?? 50_000n;
  const fromBlock = head > lookback ? head - lookback : 0n;

  const logs = await client.getLogs({
    address: token,
    event: TRANSFER_WITH_MEMO,
    args: { to },
    fromBlock,
    toBlock: head,
  });

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
        const block = await client.getBlock({ blockNumber: log.blockNumber });
        timestamp = Number(block.timestamp);
      } catch {
        timestamp = undefined;
      }
      transfers.push({
        from: args.from,
        to: args.to,
        amountUnits: args.value,
        memo: args.memo,
        txHash: log.transactionHash,
        timestamp,
      });
    } catch {
      // a log that does not decode is skipped, never guessed at
    }
  }
  return transfers;
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
