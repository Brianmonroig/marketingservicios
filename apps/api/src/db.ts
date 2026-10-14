import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema.js";

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export function createDatabase(connectionString: string): { db: Database; pool: pg.Pool } {
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export async function withTenant<T>(db: Database, tenantId: string, run: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    await tx.execute(sql`select set_config('app.auth_email', '', true)`);
    return run(tx);
  });
}

export type IngestScope = {
  tenantId?: string;
  provider?: string;
  account?: string;
};

// Contexto para los webhooks de Meta, que llegan sin sesión de agencia.
// Con app.ingest = 'on' se pueden leer y marcar los eventos sin agencia.
// provider y account abren la lectura de una sola integración.
export async function withIngest<T>(db: Database, scope: IngestScope, run: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.ingest', 'on', true)`);
    await tx.execute(sql`select set_config('app.tenant_id', ${scope.tenantId ?? ""}, true)`);
    await tx.execute(sql`select set_config('app.ingest_provider', ${scope.provider ?? ""}, true)`);
    await tx.execute(sql`select set_config('app.ingest_account', ${scope.account ?? ""}, true)`);
    await tx.execute(sql`select set_config('app.auth_email', '', true)`);
    return run(tx);
  });
}
