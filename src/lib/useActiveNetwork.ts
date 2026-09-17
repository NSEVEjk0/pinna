"use client";

import { useCallback, useMemo, useState } from "react";
import { useConnection, useSwitchChain } from "wagmi";
import { networkForChainId, walletChainParams } from "./wagmi";
import type { TempoNetwork } from "./tempo";

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

/**
 * Which Tempo network the app is working on, taken from the wallet. When the
 * wallet has not been told about the chain yet, Pinna offers to add it.
 */
export function useActiveNetwork() {
  const { chainId, connector } = useConnection();
  const network = useMemo(() => networkForChainId(chainId), [chainId]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { switchChainAsync } = useSwitchChain();

  /** True when the wallet is on the network the app is showing. */
  const onRightChain = chainId === network.chainId;

  const switchTo = useCallback(
    async (target: TempoNetwork) => {
      setError(null);
      setPending(true);
      try {
        await switchChainAsync({ chainId: target.chainId as never });
        return true;
      } catch (switchError) {
        const code = (switchError as { code?: number })?.code;
        if (code === 4902 || code === -32603) {
          try {
            const provider = (await connector?.getProvider?.()) as Eip1193Provider | undefined;
            await provider?.request?.({
              method: "wallet_addEthereumChain",
              params: [walletChainParams(target)],
            });
            await switchChainAsync({ chainId: target.chainId as never });
            return true;
          } catch (addError) {
            setError(addError instanceof Error ? addError.message : "The wallet refused to add Tempo.");
            return false;
          }
        }
        setError(switchError instanceof Error ? switchError.message : "Could not switch network.");
        return false;
      } finally {
        setPending(false);
      }
    },
    [connector, switchChainAsync]
  );

  /** Add or move to the current network — used before a first payment. */
  const ensure = useCallback(() => switchTo(network), [switchTo, network]);

  return { network, chainId, onRightChain, ensure, switchTo, pending, error };
}
