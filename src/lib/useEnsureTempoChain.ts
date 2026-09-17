"use client";

import { useCallback, useState } from "react";
import { useConnection } from "wagmi";
import { currentNetwork, walletChainParams } from "./wagmi";

/**
 * Wallets do not know Tempo until they are told. This switches to the right
 * chain, and adds it when the wallet has never seen it — the one piece of
 * setup a payer has to get through before their first payment.
 */
interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

export function useEnsureTempoChain() {
  const { chainId, connector } = useConnection();
  const network = currentNetwork();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRightChain = chainId === network.chainId;

  const ensure = useCallback(async () => {
    setError(null);
    const provider = (await connector?.getProvider?.()) as Eip1193Provider | undefined;
    if (!provider || typeof provider.request !== "function") {
      setError("No browser wallet found. Install one, or open this in a wallet browser.");
      return false;
    }
    setPending(true);
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${network.chainId.toString(16)}` }],
      });
      return true;
    } catch (switchError) {
      // 4902 means the wallet has never seen this chain — add it, then retry.
      const code = (switchError as { code?: number })?.code;
      if (code === 4902 || code === -32603) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [walletChainParams(network)],
          });
          return true;
        } catch (addError) {
          setError(
            addError instanceof Error ? addError.message : "The wallet refused to add Tempo."
          );
          return false;
        }
      }
      setError(switchError instanceof Error ? switchError.message : "Could not switch chain.");
      return false;
    } finally {
      setPending(false);
    }
  }, [connector, network]);

  return { ensure, onRightChain, pending, error, network };
}
