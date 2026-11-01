import { and, asc, count, eq, gte, isNull, sql } from "drizzle-orm";
import { getDb, type Db } from "@/shared/db/client";
import { betaInvites, checks } from "@/shared/db/schema";

/** Checks (Jev requests) a tester may make per rolling 24 hours. Admins have no limit. */
export const DAILY_CHECK_LIMIT = 50;
/** Route points a tester may send in one check. Admins get the app's own maximum. */
export const TESTER_MAX_ROUTE_POINTS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Admins come from the ADMIN_EMAILS env variable (comma-separated), so they work from the very first deploy. */
export function isAdmin(email: string | null | undefined) {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map(normalizeEmail).filter(Boolean);
  return admins.includes(normalizeEmail(email));
}

/** Whether this Google account may sign in: an admin, or on the invite list. */
export async function mayUseApp(email: string | null | undefined) {
  if (!email) return false;
  if (isAdmin(email)) return true;
  const [row] = await getDb()
    .select({ email: betaInvites.email })
    .from(betaInvites)
    .where(eq(betaInvites.email, normalizeEmail(email)));
  return Boolean(row);
}

/** Max route points per check for this user; null = no beta limit (the app's own maximum applies). */
export const maxRoutePointsFor = (email: string) => (isAdmin(email) ? null : TESTER_MAX_ROUTE_POINTS);

export type Quota = { used: number; limit: number | null; resetsAt: string | null };

/** How many checks the user made in the last 24 hours, and when the oldest of them stops counting. */
export async function quotaFor(userId: string, email: string, db: Pick<Db, "select"> = getDb()): Promise<Quota> {
  if (isAdmin(email)) return { used: 0, limit: null, resetsAt: null };
  const since = new Date(Date.now() - DAY_MS);
  const where = and(eq(checks.userId, userId), gte(checks.createdAt, since));
  const [{ used }] = await db.select({ used: count() }).from(checks).where(where);
  let resetsAt: string | null = null;
  if (used >= DAILY_CHECK_LIMIT) {
    const [oldest] = await db
      .select({ createdAt: checks.createdAt })
      .from(checks)
      .where(where)
      .orderBy(asc(checks.createdAt))
      .limit(1);
    resetsAt = oldest ? new Date(oldest.createdAt.getTime() + DAY_MS).toISOString() : null;
  }
  return { used, limit: DAILY_CHECK_LIMIT, resetsAt };
}

/**
 * Takes one of the user's daily checks before the slow, paid work starts, by inserting the check's row up front.
 * Counting and inserting happen under a per-user lock, so parallel requests can't all slip under the limit.
 * Returns the reserved row's id (null when the limit is reached) and the quota including this check.
 */
export async function reserveCheck(userId: string, email: string, sport: string) {
  return getDb().transaction(async (tx) => {
    // Released when the transaction ends; only this user's reservations wait for each other.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);
    const quota = await quotaFor(userId, email, tx);
    if (quota.limit !== null && quota.used >= quota.limit) return { id: null, quota };
    const [row] = await tx.insert(checks).values({ userId, sport }).returning({ id: checks.id });
    return { id: row.id, quota: { ...quota, used: quota.used + (quota.limit === null ? 0 : 1) } };
  });
}

/** Gives a reserved check back when it failed before Jev answered, so errors don't use up the daily limit. */
export async function releaseCheck(id: string) {
  await getDb()
    .delete(checks)
    .where(and(eq(checks.id, id), isNull(checks.answers)))
    .catch((e) => console.error("releasing the check failed", e));
}
