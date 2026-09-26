"use client";

import { createConfig, injected } from "wagmi";
import { http as tempoHttp, withRelay } from "viem/tempo";
import { tempo, tempoModerato } from "viem/chains";
import {
  activeNetwork,
  feePayerUrl,
  networkWithOverrides,
  TEMPO_MAINNET,
  TEMPO_TESTNET,
  type TempoNetwork,
} from "./tempo";

/**
 * Wallet connection. Pinna never sees a private key: the wallet lives in the
 * browser and signs each Tempo batch.
 *
 * Both Tempo networks are configured up front, so switching between the
 * testnet and mainnet is a chain switch in the wallet rather than a reload.
 * The default comes from NEXT_PUBLIC_TEMPO_CHAIN (Moderato unless "mainnet").
 *
 * When a fee payer is configured the transport is wrapped with `withRelay`, so
 * a sponsored send is filled and paid by the sponsor instead of the payer. The
 * transaction still has to ask for it (`feePayer: true`), which the send paths
 * add via `sponsorFields`.
 */

export function defaultNetwork(): TempoNetwork {
  return networkWithOverrides(activeNetwork());
}

export function networkForChainId(chainId: number | undefined): TempoNetwork {
  return chainId === TEMPO_MAINNET.chainId ? TEMPO_MAINNET : TEMPO_TESTNET;
}

/** The RPC transport for a network, routed through a fee payer when there is one. */
function transportFor(network: TempoNetwork) {
  const base = tempoHttp(network.rpcUrl);
  const sponsor = feePayerUrl(network);
  return sponsor ? withRelay(base, tempoHttp(sponsor)) : base;
}

export function createPinnaConfig() {
  return createConfig({
    chains: [tempo, tempoModerato],
    connectors: [injected()],
    multiInjectedProviderDiscovery: true,
    transports: {
      [tempo.id]: transportFor(TEMPO_MAINNET),
      [tempoModerato.id]: transportFor(TEMPO_TESTNET),
    },
    ssr: true,
  });
}

export const pinnaConfig = createPinnaConfig();

/** The chain parameters a wallet needs to add a Tempo network itself. */
export function walletChainParams(network: TempoNetwork) {
  return {
    chainId: `0x${network.chainId.toString(16)}`,
    chainName: network.name,
    nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
    rpcUrls: [network.rpcUrl],
    blockExplorerUrls: [network.explorerUrl],
  };
}

export { TEMPO_MAINNET, TEMPO_TESTNET };
