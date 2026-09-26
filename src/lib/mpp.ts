import { createHash, randomBytes } from "node:crypto";
import { Receipt } from "mppx";
import { Mppx, tempo } from "mppx/server";
import type { PayLinkPayload } from "./paylink";
import {
  activeNetwork,
  networkForName,
  tokenFor,
  type TempoNetwork,
  type TempoToken,
} from "./tempo";

/**
 * Machine Payments Protocol (MPP).
 *
 * The same request a person opens on a pay page also answers a machine, in the
 * shape Tempo's MPP describes: ask without paying and the route replies 402
 * with a `WWW-Authenticate: Payment` challenge naming the amount, the TIP-20
 * token and the recipient; present a credential and the route verifies the
 * transfer on Tempo and returns a `Payment-Receipt`.
 *
 * The protocol objects — challenge, credential, receipt, problem details —
 * come from `mppx` rather than being hand-rolled, so the wire format is the
 * one the specification defines (`https://mpp.dev/protocol`). A person and an
 * agent pay identically: one TIP-20 transfer to the wallet that asked,
 * carrying the request reference in the memo.
 */

function buildServer() {
  return Mppx.create({
    secretKey: mppSecret(),
    realm: process.env.MPP_REALM,
    methods: [tempo.charge({ testnet: activeNetwork().key === "testnet" })],
  });
}

let fallbackSecret: string | null = null;

/**
 * MPP binds each challenge to its contents with an HMAC, so it needs a secret
 * of at least 32 bytes. `MPP_SECRET_KEY` is the intended one; any other
 * deployment secret is hashed to length so it can stand in. With nothing
 * configured a secret is generated per process, which keeps a single instance
 * working but means outstanding challenges do not survive a restart — set
 * `MPP_SECRET_KEY` for anything long-lived or replicated.
 */
function mppSecret(): string {
  const configured =
    process.env.MPP_SECRET_KEY || process.env.HOST_KEY_SECRET || process.env.SESSION_SECRET;
  if (configured) return createHash("sha256").update(configured).digest("hex");
  if (!fallbackSecret) fallbackSecret = randomBytes(32).toString("hex");
  return fallbackSecret;
}

type PaymentServer = ReturnType<typeof buildServer>;

let cached: PaymentServer | null = null;

/** The MPP server, built once per process. */
function paymentServer(): PaymentServer {
  if (!cached) cached = buildServer();
  return cached;
}

export interface PaymentTarget {
  network: TempoNetwork;
  token: TempoToken;
}

/** The network and token a link asks to be paid in. */
export function paymentTarget(payload: PayLinkPayload): PaymentTarget {
  const network = networkForName(payload.network);
  return { network, token: tokenFor(network, payload.token) };
}

/**
 * The charge the challenge names: what is owed, in which TIP-20, to whom, and
 * the reference the transfer must carry.
 */
function chargeOptions(payload: PayLinkPayload, target: PaymentTarget) {
  return {
    amount: payload.amount,
    currency: target.token.address,
    recipient: payload.to,
    decimals: target.token.decimals,
    chainId: target.network.chainId,
    description: payload.reason || "A Pinna request",
    // The reference is what the host matches the payment on, and what the
    // credential is bound to.
    externalId: payload.id,
  };
}

/**
 * Issue a challenge, or verify the credential the caller presented. Which one
 * happens is decided by the request's `Authorization` header, so a GET and a
 * POST differ only in what they carry.
 */
export async function handlePayment(request: Request, payload: PayLinkPayload) {
  const target = paymentTarget(payload);
  return paymentServer().compose(["tempo/charge", chargeOptions(payload, target)])(request);
}

/** The `Payment-Receipt` header for a request already settled on chain. */
export function receiptHeader(input: {
  reference: string;
  txHash: string;
  paidBy: string;
}): string {
  const receipt: Receipt.Receipt = {
    method: "tempo",
    reference: input.txHash,
    externalId: input.reference,
    status: "success",
    timestamp: new Date().toISOString(),
  };
  return Receipt.serialize(receipt);
}

/** An RFC 9457 problem body, the shape MPP uses for its errors. */
export function problem(
  status: number,
  title: string,
  detail: string,
  type: string
): Response {
  return Response.json(
    { type: `https://paymentauth.org/problems/${type}`, title, status, detail },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}
