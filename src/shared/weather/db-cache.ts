import { and, gt, inArray, lt, sql } from "drizzle-orm";
import type { Db } from "@/shared/db/client";
import { weatherCache } from "@/shared/db/schema";
import type { ResponseCache } from "./open-meteo";

/** Postgres-backed cache: survives restarts and is shared by every server instance. */
export function dbCache(db: Db): ResponseCache {
  return {
    async get(keys, now) {
      if (!keys.length) return new Map();
      const rows = await db
        .select({ key: weatherCache.key, response: weatherCache.response })
        .from(weatherCache)
        .where(and(inArray(weatherCache.key, keys), gt(weatherCache.expiresAt, now)));
      return new Map(rows.map((r) => [r.key, r.response]));
    },
    async put(entries) {
      if (!entries.length) return;
      await db
        .insert(weatherCache)
        .values(entries)
        .onConflictDoUpdate({
          target: weatherCache.key,
          set: { response: sql`excluded.response`, expiresAt: sql`excluded.expires_at` },
        });
      // Keep the table small: expired rows are never read again.
      await db.delete(weatherCache).where(lt(weatherCache.expiresAt, new Date()));
    },
  };
}
