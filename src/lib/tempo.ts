/**
 * Tempo networks and tokens.
 *
 * Values are taken from the Tempo developer documentation
 * (connection details): mainnet chain id 4217 with rpc.tempo.xyz, and the
 * Moderato testnet chain id 42431 with rpc.moderato.tempo.xyz. pathUSD is the
 * documented mainnet TIP-20 at 0x20c0…0000; the testnet faucet issues the
 * test tokens at 0x20c0…0000 and 0x20c0…0001.
 *
 * There is no native gas token on Tempo: fees are paid in a TIP-20 stablecoin.
 */

export type TempoNetworkKey = "mainnet" | "testnet";

export interface TempoToken {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
}

export interface TempoNetwork {
  key: TempoNetworkKey;
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  faucet?: string;
  /** The token Pinna sends by default on this network. */
  defaultToken: TempoToken;
  /** Other selectable tokens. */
  tokens: TempoToken[];
}

const PATH_USD_MAINNET: TempoToken = {
  symbol: "pathUSD",
  name: "pathUSD",
  address: "0x20c0000000000000000000000000000000000000",
  decimals: 6,
};

const PATH_USD_TESTNET: TempoToken = {
  symbol: "pathUSD",
  name: "pathUSD (test)",
  address: "0x20c0000000000000000000000000000000000000",
  decimals: 6,
};

const ALPHA_USD_TESTNET: TempoToken = {
  symbol: "AlphaUSD",
  name: "AlphaUSD (test)",
  address: "0x20c0000000000000000000000000000000000001",
  decimals: 6,
};

export const TEMPO_MAINNET: TempoNetwork = {
  key: "mainnet",
  name: "Tempo Mainnet",
  chainId: 4217,
  rpcUrl: "https://rpc.tempo.xyz",
  explorerUrl: "https://explore.tempo.xyz",
  defaultToken: PATH_USD_MAINNET,
  tokens: [PATH_USD_MAINNET],
};

export const TEMPO_TESTNET: TempoNetwork = {
  key: "testnet",
  name: "Tempo Testnet (Moderato)",
  chainId: 42431,
  rpcUrl: "https://rpc.moderato.tempo.xyz",
  explorerUrl: "https://explore.testnet.tempo.xyz",
  faucet: "https://tempo.xyz/developers/docs/guide/getting-funds",
  defaultToken: PATH_USD_TESTNET,
  tokens: [PATH_USD_TESTNET, ALPHA_USD_TESTNET],
};

/**
 * The network the app runs against. Moderato by default; mainnet only when
 * NEXT_PUBLIC_TEMPO_CHAIN is explicitly "mainnet".
 */
export function activeNetwork(
  chainEnv: string | undefined = process.env.NEXT_PUBLIC_TEMPO_CHAIN
): TempoNetwork {
  return chainEnv === "mainnet" ? TEMPO_MAINNET : TEMPO_TESTNET;
}

export function activeToken(
  network: TempoNetwork,
  tokenSymbolEnv: string | undefined = process.env.NEXT_PUBLIC_TIP20_SYMBOL
): TempoToken {
  if (tokenSymbolEnv) {
    const hit = network.tokens.find((t) => t.symbol === tokenSymbolEnv);
    if (hit) return hit;
  }
  return network.defaultToken;
}

/** Environment overrides let a deployment point elsewhere without a code change. */
export function networkWithOverrides(network: TempoNetwork): TempoNetwork {
  const rpcOverride = process.env.NEXT_PUBLIC_TEMPO_RPC;
  const explorerOverride = process.env.NEXT_PUBLIC_TEMPO_EXPLORER;
  const tokenOverride = process.env.NEXT_PUBLIC_TIP20;
  return {
    ...network,
    rpcUrl: rpcOverride || network.rpcUrl,
    explorerUrl: explorerOverride || network.explorerUrl,
    defaultToken: tokenOverride
      ? { ...network.defaultToken, address: tokenOverride as `0x${string}` }
      : network.defaultToken,
  };
}

export function explorerTxUrl(network: TempoNetwork, hash: string): string {
  return `${network.explorerUrl.replace(/\/+$/, "")}/tx/${hash}`;
}

export function explorerAddressUrl(network: TempoNetwork, address: string): string {
  return `${network.explorerUrl.replace(/\/+$/, "")}/address/${address}`;
}
