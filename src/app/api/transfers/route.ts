import { readTransfersViaApi, toTransferJson } from "@/lib/tempoApi";
import { TEMPO_MAINNET, TEMPO_TESTNET, type TempoNetwork } from "@/lib/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read a wallet's transfers from the Tempo API, on the server.
 *
 * The API is a backend service, so it is reached from here rather than from the
 * browser — that keeps the page same-origin and the API key (when one is
 * needed) off the client. This is the indexed read the Tempo docs recommend
 * over the public RPC, which they mark best-effort.
 *
 *   GET /api/transfers?address=0x…&token=0x…&chain=42431
 *
 * Amounts are returned as base-unit strings, never as JS numbers.
 */

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function networkForChainId(chainId: number): TempoNetwork | null {
  if (chainId === TEMPO_MAINNET.chainId) return TEMPO_MAINNET;
  if (chainId === TEMPO_TESTNET.chainId) return TEMPO_TESTNET;
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = url.searchParams.get("address") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const network = networkForChainId(Number(url.searchParams.get("chain")));

  if (!ADDRESS.test(address) || !ADDRESS.test(token)) {
    return Response.json(
      { error: "A valid 0x address and token are required." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!network) {
    return Response.json(
      { error: "A known Tempo chain id is required." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const transfers = await readTransfersViaApi(
      network,
      token as `0x${string}`,
      address as `0x${string}`
    );
    return Response.json(
      { transfers: transfers.map(toTransferJson) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    // The caller falls back to reading the RPC directly; say why we could not.
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not read the Tempo API." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
