import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

export type DatabaseContext = {
  pool: Pool;
  db: Database;
};

export function createDatabase(databaseUrl: string): DatabaseContext {
  const ca = process.env.DATABASE_CA_CERT?.trim();
  const url = ca ? new URL(databaseUrl) : undefined;
  if (url) {
    for (const key of ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
  }
  const pool = new Pool({
    connectionString: url?.toString() ?? databaseUrl,
    ...(ca && { ssl: { ca, rejectUnauthorized: true } })
  });
  return { pool, db: drizzle({ client: pool, schema }) };
}
