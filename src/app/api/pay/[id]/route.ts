import { decodePayLink } from "@/lib/paylink";
import { findTransferByReference } from "@/lib/chain";
import { isExpired } from "@/lib/expiry";
import {
  handlePayment,
  paymentTarget,
  problem,
  receiptHeader,
} from "@/lib/mpp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The machine-facing half of a Pinna request, spoken in the Machine Payments
 * Protocol.
 *
 *   GET  /api/pay/{id}?d={payload}
 *        -> 200 with a Payment-Receipt if it is already paid
 *        -> 410 if the link has closed
 *        -> 402 with a `WWW-Authenticate: Payment` challenge otherwise
 *
 *   POST /api/pay/{id}?d={payload}
 *        -> identical, and verifies an `Authorization: Payment` credential,
 *           returning 200 with the receipt once the transfer is on Tempo
 *
 * Nothing is taken on trust: the reference has to appear in the memo of a
 * transfer to the wallet that asked, and a credential is verified against the
 * chain rather than believed.
 */

export async function GET(request: Request, { params }: { params: { id: string } }) {
  return pay(request, params.id);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return pay(request, params.id);
}

async function pay(request: Request, id: string): Promise<Response> {
  const url = new URL(request.url);
  const payload = decodePayLink(url.searchParams.get("d") ?? "");
  if (!payload || payload.id !== id) {
    return problem(
      400,
      "Payment link incomplete",
      "This request link is incomplete — the details travel inside it.",
      "malformed-link"
    );
  }

  const { network, token } = paymentTarget(payload);

  // Already settled on chain? Then there is nothing left to pay, whoever asks.
  try {
    const found = await findTransferByReference(network, token.address, payload.to, payload.id);
    if (found) {
      return Response.json(
        {
          paid: true,
          reference: payload.id,
          amount: payload.amount,
          token: token.symbol,
          payTo: payload.to,
          paidBy: found.from,
          txHash: found.txHash,
          network: network.name,
          explorer: `${network.explorerUrl.replace(/\/+$/, "")}/tx/${found.txHash}`,
        },
        {
          status: 200,
          headers: {
            "Payment-Receipt": receiptHeader({
              reference: payload.id,
              txHash: found.txHash,
              paidBy: found.from,
            }),
            "Cache-Control": "no-store",
          },
        }
      );
    }
  } catch {
    // an unreadable chain is not a payment — fall through to the challenge
  }

  if (isExpired(payload.expiresAt)) {
    return problem(
      410,
      "Payment link closed",
      "This request has expired and no longer accepts payment.",
      "payment-expired"
    );
  }

  const result = await handlePayment(request, payload);
  if (result.status === 402) return result.challenge;

  return result.withReceipt(
    Response.json({
      paid: true,
      reference: payload.id,
      amount: payload.amount,
      token: token.symbol,
      payTo: payload.to,
      network: network.name,
    })
  );
}
