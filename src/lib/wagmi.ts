"use client";

import { createConfig, http, injected } from "wagmi";
import { tempo } from "viem/chains";
import { activeNetwork, networkWithOverrides, type TempoNetwork } from "./tempo";
import { viemChainFor } from "./chain";

/**
 * Wallet connection. Pinna never sees a private key: the wallet lives in the
 * browser and signs each Tempo batch. Chain and transport follow the active
 * network (Moderato unless NEXT_PUBLIC_TEMPO_CHAIN=mainnet).
 *
 * Any EIP-1193 browser wallet works — MetaMask, Tempo Wallet, or anything
 * else that injects a provider. Tempo is added to the wallet on first use.
 */

export function currentNetwork(): TempoNetwork {
  return networkWithOverrides(activeNetwork());
}

export function createPinnaConfig(network: TempoNetwork = currentNetwork()) {
  // The two Tempo chains share a shape; pin the type so the transport map
  // matches whichever one this build targets.
  const chain = viemChainFor(network) as typeof tempo;
  return createConfig({
    chains: [chain],
    connectors: [injected()],
    multiInjectedProviderDiscovery: true,
    transports: {
      [chain.id]: http(network.rpcUrl),
    },
    ssr: true,
  });
}

export const pinnaConfig = createPinnaConfig();

/** The chain parameters a wallet needs to add Tempo itself. */
export function walletChainParams(network: TempoNetwork) {
  return {
    chainId: `0x${network.chainId.toString(16)}`,
    chainName: network.name,
    nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
    rpcUrls: [network.rpcUrl],
    blockExplorerUrls: [network.explorerUrl],
  };
}
