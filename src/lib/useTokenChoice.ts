"use client";

import { useCallback, useSyncExternalStore } from "react";
import { activeToken, type TempoNetwork, type TempoToken } from "./tempo";
import {
  addCustomToken,
  getTokenSnapshot,
  removeCustomToken,
  setTokenSymbol,
  subscribeTokens,
  tokensOnNetwork,
  type CustomToken,
} from "./tokenStore";

/**
 * Which stablecoin Pinna pays in, shared by every screen. Tempo settles the
 * fee in the token being sent, so switching the token is all that is needed —
 * there is no gas token to swap first. Tokens the built-in list does not know
 * about can be added by contract address.
 */
export function useTokenChoice(network: TempoNetwork) {
  const snapshot = useSyncExternalStore(subscribeTokens, getTokenSnapshot, getTokenSnapshot);

  const options = tokensOnNetwork(network.tokens, snapshot.custom, network.chainId);
  const selected: TempoToken | CustomToken =
    options.find((t) => t.symbol === snapshot.symbol) ?? activeToken(network, undefined);

  const choose = useCallback((next: TempoToken) => {
    setTokenSymbol(next.symbol);
  }, []);

  const addToken = useCallback(
    (token: Omit<CustomToken, "custom">) => {
      addCustomToken(token);
      setTokenSymbol(token.symbol);
    },
    []
  );

  const removeToken = useCallback((address: string) => {
    removeCustomToken(address);
  }, []);

  return { token: selected, options, choose, addToken, removeToken };
}
