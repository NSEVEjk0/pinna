import { createHmac } from "node:crypto";
import { decodePayLink } from "@/lib/paylink";
import { findTransferByReference } from "@/lib/chain";
import { isExpired } from "@/lib/expiry";
import { TEMPO_MAINNET, TEMPO_TESTNET, type TempoNetwork } from "@/lib/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Machine payments for a Pinna request.
 *
 * The same link a person opens also answers an agent, in the shape the
 * Machine Payments Protocol describes: ask without paying and the route
 * replies 402 with what is owed; send the transfer on Tempo and present the
 * hash; the route checks the chain itself and hands back a receipt.
 *
 *   GET  /api/pay/{id}?d={payload}            -> 402 challenge, or 200 if paid
 *   POST /api/pay/{id}?d={payload}  {txHash}  -> 200 receipt, or 402 again
 *
 * Nothing is taken on trust: the reference has to appear in the memo of a
 * transfer to the person who asked.
 */

function networkFromPayload(name: string | undefined): TempoNetwork {
  const target = (process.env.NEXT_PUBLIC_TEMPO_CHAIN || "").toLowerCase();
  if (name?.toLowerCase().includes("mainnet") || target === "mainnet") return TEMPO_MAINNET;
  return TEMPO_TESTNET;
}

function tokenFor(network: TempoNetwork, symbol: string | undefined) {
  const hit = network.tokens.find((t) => t.symbol === symbol);
  return hit ?? network.defaultToken;
}

function priceInUnits(amount: string, decimals: number): bigint {
  const [whole, frac = ""] = String(amount).trim().split(".");
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0");
}

/** A receipt over the verified facts, attested by this instance. */
function makeReceipt(input: {
  reference: string;
  txHash: string;
  amount: string;
  tokenSymbol: string;
  payTo: string;
  paidBy: string;
  at: string;
}) {
  const secret = process.env.HOST_KEY_SECRET || process.env.SESSION_SECRET || "";
  const body = JSON.stringify(input);
  const signature = secret
    ? createHmac("sha256", secret).update(body).digest("hex").slice(0, 32)
    : null;
  const receipt = {
    ...input,
    verifiedOn: "tempo",
    signature,
    note: signature
      ? "Signature is an HMAC by the Pinna instance that read the chain; the transfer itself is the proof."
      : "No receipt secret configured on this instance, so this receipt is unsigned.",
  };
  return {
    json: receipt,
    header: Buffer.from(JSON.stringify(receipt)).toString("base64url"),
  };
}

function challengeFor(payload: ReturnType<typeof decodePayLink>, resource: string) {
  if (!payload) return null;
  const network = networkFromPayload(payload.network);
  const token = tokenFor(network, payload.token);
  return {
    x402Version: 2,
    error: "Payment required. Send the transfer described below, then present its hash.",
    resource: { url: resource, description: payload.reason || "A Pinna request", mimeType: "application/json" },
    accepts: [
      {
        scheme: "erc20-direct",
        network: `eip155:${network.chainId}`,
        networkName: network.name,
        chainId: network.chainId,
        asset: { address: token.address, symbol: token.symbol, decimals: token.decimals },
        amount: priceInUnits(payload.amount, token.decimals).toString(),
        amountHuman: payload.amount,
        payTo: payload.to,
        maxTimeoutSeconds: 300,
        extra: {
          flow: "ERC20_DIRECT",
          tokenSymbol: token.symbol,
          // The reference must be written into the transfer memo, or the
          // request cannot be matched to the payment.
          reference: payload.id,
          amountUnits: priceInUnits(payload.amount, token.decimals).toString(),
        },
      },
    ],
    reference: payload.id,
    expiresAt: payload.expiresAt ?? null,
    party: payload.partyName ?? null,
  };
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const payload = decodePayLink(url.searchParams.get("d") ?? "");
  if (!payload || payload.id !== params.id) {
    return Response.json({ error: "This request link is incomplete." }, { status: 400 });
  }

  const network = networkFromPayload(payload.network);
  const token = tokenFor(network, payload.token);

  try {
    const found = await findTransferByReference(network, token.address, payload.to, payload.id);
    if (found) {
      const receipt = makeReceipt({
        reference: payload.id,
        txHash: found.txHash,
        amount: payload.amount,
        tokenSymbol: token.symbol,
        payTo: payload.to,
        paidBy: found.from,
        at: found.timestamp ? new Date(found.timestamp * 1000).toISOString() : new Date().toISOString(),
      });
      return Response.json(
        { paid: true, ...receipt.json },
        { status: 200, headers: { "Payment-Receipt": receipt.header, "Cache-Control": "no-store" } }
      );
    }
  } catch {
    // fall through to the challenge — an unreadable chain is not a payment
  }

  if (isExpired(payload.expiresAt)) {
    return Response.json(
      { error: "This request has expired and no longer accepts payment.", reference: payload.id },
      { status: 410, headers: { "Cache-Control": "no-store" } }
    );
  }

  return Response.json(challengeFor(payload, url.pathname)!, {
    status: 402,
    headers: { "WWW-Authenticate": "x402", "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const payload = decodePayLink(url.searchParams.get("d") ?? "");
  if (!payload || payload.id !== params.id) {
    return Response.json({ error: "This request link is incomplete." }, { status: 400 });
  }

  let txHash = req.headers.get("x-payment") ?? "";
  if (!txHash) {
    try {
      const body = (await req.json()) as { txHash?: string };
      txHash = String(body?.txHash ?? "");
    } catch {
      txHash = "";
    }
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return Response.json(
      { error: "Present the transfer hash as {\"txHash\":\"0x…\"} or an X-Payment header." },
      { status: 400 }
    );
  }

  const network = networkFromPayload(payload.network);
  const token = tokenFor(network, payload.token);

  try {
    const found = await findTransferByReference(network, token.address, payload.to, payload.id);
    if (!found) {
      return Response.json(
        {
          error:
            "No transfer carrying this reference has been seen on Tempo yet. Transfers must include the reference in the memo.",
          ...challengeFor(payload, url.pathname),
        },
        { status: 402, headers: { "WWW-Authenticate": "x402" } }
      );
    }
    if (found.txHash.toLowerCase() !== txHash.toLowerCase()) {
      return Response.json(
        {
          error: "A transfer for this reference exists on Tempo, but not that one.",
          expectedTxHash: found.txHash,
        },
        { status: 409 }
      );
    }

    const receipt = makeReceipt({
      reference: payload.id,
      txHash: found.txHash,
      amount: payload.amount,
      tokenSymbol: token.symbol,
      payTo: payload.to,
      paidBy: found.from,
      at: found.timestamp ? new Date(found.timestamp * 1000).toISOString() : new Date().toISOString(),
    });
    return Response.json(
      { paid: true, ...receipt.json },
      { status: 200, headers: { "Payment-Receipt": receipt.header, "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return Response.json(
      { error: `Could not read Tempo: ${err instanceof Error ? err.message : "unknown error"}` },
      { status: 502 }
    );
  }
}
