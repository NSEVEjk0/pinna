import { createClient, type Client } from "@libsql/client";

/**
 * The cloud copy of a wallet's Pinna data.
 *
 * There is no account and no password: the key is the Tempo address itself.
 * The blob that is stored is produced by the browser, and when encryption is
 * on it is opaque here — this server can serve it back but cannot read a
 * single name inside it. No private keys ever reach this code.
 */

let client: Client | null = null;

export function syncConfigured(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL);
}

export function getSyncDb(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("Turso is not configured on this deployment.");
  const authToken = process.env.TURSO_AUTH_TOKEN;
  client = createClient(authToken ? { url, authToken } : { url });
  return client;
}

let schema: Promise<void> | null = null;

export function ensureSyncSchema(): Promise<void> {
  if (schema) return schema;
  const db = getSyncDb();
  schema = (async () => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS pinna_sync (
        address TEXT PRIMARY KEY,
        blob TEXT NOT NULL,
        encrypted INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      )
    `);
  })();
  return schema;
}

export interface SyncRecord {
  address: string;
  blob: string;
  encrypted: boolean;
  updatedAt: string;
}

export function normalizeAddress(input: string): string | null {
  const value = String(input ?? "").trim().toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(value) ? value : null;
}

export async function readSync(address: string): Promise<SyncRecord | null> {
  await ensureSyncSchema();
  const db = getSyncDb();
  const res = await db.execute({
    sql: `SELECT address, blob, encrypted, updated_at FROM pinna_sync WHERE address = ?`,
    args: [address],
  });
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    address: String(row.address),
    blob: String(row.blob),
    encrypted: Number(row.encrypted) === 1,
    updatedAt: String(row.updated_at),
  };
}

export async function writeSync(
  address: string,
  blob: string,
  encrypted: boolean
): Promise<SyncRecord> {
  await ensureSyncSchema();
  const db = getSyncDb();
  const updatedAt = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO pinna_sync (address, blob, encrypted, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(address) DO UPDATE SET
            blob = excluded.blob,
            encrypted = excluded.encrypted,
            updated_at = excluded.updated_at`,
    args: [address, blob, encrypted ? 1 : 0, updatedAt],
  });
  return { address, blob, encrypted, updatedAt };
}
