import { normalizeAddress, readSync, syncConfigured, writeSync } from "@/lib/server/syncStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The cloud copy of a wallet's Pinna data, addressed by Tempo address.
 *
 *   GET  /api/sync?address=0x…   -> { blob, encrypted, updatedAt } or 404
 *   POST /api/sync               -> { address, blob, encrypted } stored, returns the record
 *
 * The blob is written by the browser. When the browser encrypts it, this route
 * holds a value it cannot read — it is storage, not a directory of who owes
 * whom.
 */

const MAX_BLOB = 512 * 1024; // 512 KB is far more than a real address book

export async function GET(req: Request) {
  if (!syncConfigured()) {
    return Response.json(
      { error: "Cloud sync is not configured on this deployment (TURSO_DATABASE_URL is unset)." },
      { status: 501 }
    );
  }
  const address = normalizeAddress(new URL(req.url).searchParams.get("address") ?? "");
  if (!address) {
    return Response.json({ error: "A valid 0x address is required." }, { status: 400 });
  }
  try {
    const record = await readSync(address);
    if (!record) return Response.json({ found: false }, { status: 404 });
    return Response.json({ found: true, ...record }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json(
      { error: `Could not read the cloud copy: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 502 }
    );
  }
}

export async function POST(req: Request) {
  if (!syncConfigured()) {
    return Response.json(
      { error: "Cloud sync is not configured on this deployment (TURSO_DATABASE_URL is unset)." },
      { status: 501 }
    );
  }
  let body: { address?: string; blob?: string; encrypted?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const address = normalizeAddress(body.address ?? "");
  if (!address) {
    return Response.json({ error: "A valid 0x address is required." }, { status: 400 });
  }
  const blob = String(body.blob ?? "");
  if (!blob) {
    return Response.json({ error: "A blob is required." }, { status: 400 });
  }
  if (blob.length > MAX_BLOB) {
    return Response.json({ error: "That blob is too large to store." }, { status: 413 });
  }

  try {
    const record = await writeSync(address, blob, Boolean(body.encrypted));
    return Response.json({ ok: true, ...record }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json(
      { error: `Could not write the cloud copy: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 502 }
    );
  }
}
