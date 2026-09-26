import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { decodePayLink, encodePayLink } from "@/lib/paylink";
import { paymentTarget } from "@/lib/mpp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pinna as an MCP tool.
 *
 * An agent that speaks the Model Context Protocol can read a Pinna request
 * without knowing anything about Tempo: hand it a pay link and it gets back
 * what is owed, in which TIP-20, on which chain, to whom, and the Machine
 * Payments Protocol endpoint that settles it. That endpoint is the same one a
 * person's pay page uses, so an agent and a human pay the identical way.
 *
 *   POST /api/mcp   (MCP Streamable HTTP, JSON-RPC)
 *
 * Stateless: a fresh server and transport per request, so nothing is held
 * between calls and the endpoint can scale horizontally.
 */

/** Accept either a whole pay link or the bare `?d=` payload from one. */
function payloadFrom(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/[?&]d=([^&\s]+)/);
  return match ? decodeURIComponent(match[1]) : trimmed;
}

function buildServer(origin: string): McpServer {
  const server = new McpServer({ name: "pinna", version: "0.1.0" });

  server.registerTool(
    "pinna_payment_request",
    {
      title: "Read a Pinna payment request",
      description:
        "Read what a Pinna pay link asks for: the amount, the TIP-20 stablecoin, the Tempo chain, the recipient and the reference. Returns the Machine Payments Protocol endpoint that settles it — ask that endpoint without paying and it replies 402 with a challenge; pay on Tempo and present the credential for a signed receipt. Pinna holds no funds and never signs anything itself.",
      inputSchema: {
        url: z.string().describe("A Pinna pay link, or the `?d=` payload from one"),
      },
    },
    async ({ url }) => {
      const payload = decodePayLink(payloadFrom(url));
      if (!payload) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "That is not a Pinna pay link — the details travel inside the link's `d` parameter.",
            },
          ],
        };
      }

      const { network, token } = paymentTarget(payload);
      const answer = {
        reference: payload.id,
        amount: { value: payload.amount, token: token.symbol, decimals: token.decimals, address: token.address },
        chain: { id: network.chainId, name: network.name },
        payTo: payload.to,
        requestedBy: payload.hostName,
        owedBy: payload.partyName ?? null,
        reason: payload.reason,
        expiresAt: payload.expiresAt ?? null,
        // The reference that must travel in the transfer's memo for the
        // payment to be matched to this request.
        memo: `PINNA:${payload.id}`,
        payEndpoint: `${origin}/api/pay/${payload.id}?d=${encodePayLink(payload)}`,
        protocol: "Machine Payments Protocol — https://mpp.dev/protocol",
      };

      return {
        structuredContent: answer,
        content: [{ type: "text" as const, text: JSON.stringify(answer, null, 2) }],
      };
    }
  );

  return server;
}

export async function POST(request: Request): Promise<Response> {
  const server = buildServer(new URL(request.url).origin);
  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless: no session id, nothing retained between requests.
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

/** A GET on this endpoint is not a stream we keep open; say so plainly. */
export async function GET(): Promise<Response> {
  return Response.json(
    {
      error:
        "This is an MCP endpoint. POST JSON-RPC to it (initialize, tools/list, tools/call).",
    },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } }
  );
}
