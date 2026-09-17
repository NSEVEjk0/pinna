"use client";

import { createConfig, http, injected } from "wagmi";
import { tempo, tempoModerato } from "viem/chains";
import { activeNetwork, networkWithOverrides, TEMPO_MAINNET, TEMPO_TESTNET, type TempoNetwork } from "./tempo";

/**
 * Wallet connection. Pinna never sees a private key: the wallet lives in the
 * browser and signs each Tempo batch.
 *
 * Both Tempo networks are configured up front, so switching between the
 * testnet and mainnet is a chain switch in the wallet rather than a reload.
 * The default comes from NEXT_PUBLIC_TEMPO_CHAIN (Moderato unless "mainnet").
 */

export function defaultNetwork(): TempoNetwork {
  return networkWithOverrides(activeNetwork());
}

export function networkForChainId(chainId: number | undefined): TempoNetwork {
  return chainId === TEMPO_MAINNET.chainId ? TEMPO_MAINNET : TEMPO_TESTNET;
}

export function createPinnaConfig() {
  return createConfig({
    chains: [tempo, tempoModerato],
    connectors: [injected()],
    multiInjectedProviderDiscovery: true,
    transports: {
      [tempo.id]: http(TEMPO_MAINNET.rpcUrl),
      [tempoModerato.id]: http(TEMPO_TESTNET.rpcUrl),
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
