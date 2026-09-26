import { subscribe, type WatchKey } from "@/lib/server/watchHub";
import { toTransferJson } from "@/lib/tempoApi";
import { TEMPO_MAINNET, TEMPO_TESTNET } from "@/lib/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A live feed of transfers for one address.
 *
 * The receiver's app holds this open and a request flips to paid the moment the
 * transfer shows up — no waiting on the next manual sync. The polling happens
 * once, on the server, shared by every listener watching the same address; the
 * browser is only told about transfers it has not seen.
 *
 *   GET /api/watch?address=0x…&token=0x…&chain=42431&role=recipient
 *
 * Server-sent events, so a dropped connection is retried by the browser itself.
 */

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEARTBEAT_MS = 15_000;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const address = url.searchParams.get("address") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const chainId = Number(url.searchParams.get("chain"));
  const role: WatchKey["role"] =
    url.searchParams.get("role") === "sender" ? "sender" : "recipient";

  if (!ADDRESS.test(address) || !ADDRESS.test(token)) {
    return Response.json(
      { error: "A valid 0x address and token are required." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (chainId !== TEMPO_MAINNET.chainId && chainId !== TEMPO_TESTNET.chainId) {
    return Response.json(
      { error: "A known Tempo chain id is required." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stop = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    unsubscribe?.();
  };

  const stream = new ReadableStream({
    start(controller) {
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      // How long the browser should wait before reconnecting if we drop.
      write("retry: 3000\n\n");
      write(`event: ready\ndata: ${JSON.stringify({ poll: 2000 })}\n\n`);

      unsubscribe = subscribe({ chainId, token, address, role }, (transfers) => {
        write(`event: transfers\ndata: ${JSON.stringify(transfers.map(toTransferJson))}\n\n`);
      });

      heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);

      request.signal.addEventListener("abort", () => {
        stop();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      // Stops reverse proxies buffering the stream into uselessness.
      "x-accel-buffering": "no",
    },
  });
}
