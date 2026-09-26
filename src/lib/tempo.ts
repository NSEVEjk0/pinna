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

/**
 * Where a recorded transaction lives. A payment made on mainnet keeps pointing
 * at the mainnet explorer even if the wallet later switches to the testnet, so
 * a hash never leads to a page that cannot find it.
 */
export function explorerForRecord(
  record: { explorerUrl?: string; chainId?: number },
  fallback: TempoNetwork,
  hash: string
): string {
  if (record.explorerUrl) {
    return `${record.explorerUrl.replace(/\/+$/, "")}/tx/${hash}`;
  }
  if (record.chainId) {
    const known =
      record.chainId === TEMPO_MAINNET.chainId
        ? TEMPO_MAINNET
        : record.chainId === TEMPO_TESTNET.chainId
          ? TEMPO_TESTNET
          : null;
    if (known) return explorerTxUrl(known, hash);
  }
  return explorerTxUrl(fallback, hash);
}

export function explorerAddressUrl(network: TempoNetwork, address: string): string {
  return `${network.explorerUrl.replace(/\/+$/, "")}/address/${address}`;
}

/**
 * The network a pay link names. A link carries the network it was written on,
 * so a request made on mainnet is still read on mainnet even when this
 * deployment points somewhere else — unless the deployment overrides it.
 */
export function networkForName(name: string | undefined): TempoNetwork {
  const named = String(name ?? "").toLowerCase();
  const override = (process.env.NEXT_PUBLIC_TEMPO_CHAIN || "").toLowerCase();
  if (named.includes("mainnet") || override === "mainnet") return TEMPO_MAINNET;
  return TEMPO_TESTNET;
}

/** A token on a network by symbol, falling back to the network's default. */
export function tokenFor(network: TempoNetwork, symbol: string | undefined): TempoToken {
  return network.tokens.find((t) => t.symbol === symbol) ?? network.defaultToken;
}

/**
 * Fee sponsorship.
 *
 * Tempo fees are paid in a stablecoin, and a sponsor can pay them on the
 * payer's behalf — so someone holding only the token being sent needs nothing
 * else to spend it. `NEXT_PUBLIC_FEE_PAYER_URL` names the sponsor (a
 * self-hosted Relay handler, or Tempo's hosted Fee Payer API). The Moderato
 * testnet runs a public, keyless sponsor, which is used unless sponsorship is
 * turned off with `NEXT_PUBLIC_SPONSOR_FEES=false` or a URL is given. Mainnet
 * has no public sponsor, so sponsorship there is off until one is configured.
 */
export function feePayerUrl(network: TempoNetwork): string | null {
  const configured = process.env.NEXT_PUBLIC_FEE_PAYER_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NEXT_PUBLIC_SPONSOR_FEES === "false") return null;
  return network.key === "testnet" ? "https://sponsor.moderato.tempo.xyz" : null;
}

export function sponsorsFees(network: TempoNetwork): boolean {
  return feePayerUrl(network) !== null;
}

/** The Tempo transaction fields that ask the sponsor to pay the fee. */
export function sponsorFields(network: TempoNetwork): Record<string, never> | { feePayer: true } {
  return sponsorsFees(network) ? { feePayer: true } : {};
}
