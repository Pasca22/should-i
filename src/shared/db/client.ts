import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

export function createDb(url: string) {
  // prepare: false — production connects through Neon's pooler (transaction mode), where prepared statements
  // can break; the cost of not preparing is negligible here.
  return drizzle(postgres(url, { max: 5, prepare: false }), { schema });
}

// One pool per server process; kept on globalThis so dev hot reloads don't open new pools.
const globalForDb = globalThis as unknown as { db?: Db };

export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return (globalForDb.db ??= createDb(url));
}
