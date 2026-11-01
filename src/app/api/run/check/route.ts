import { getSession } from "@/shared/auth/server";
import { DAILY_CHECK_LIMIT, maxRoutePointsFor, releaseCheck, reserveCheck } from "@/shared/beta";
import { getDb } from "@/shared/db/client";
import { errorResponse, UserError, type ErrorBody } from "@/shared/errors";
import { dbCache } from "@/shared/weather/db-cache";
import { runCheck } from "@/sports/run/check";
import { parseTime } from "@/sports/run/params";

/** "2 h 10 min" from now; relative, because the server's time zone isn't the user's. */
function fromNow(iso: string) {
  const min = Math.max(1, Math.ceil((Date.parse(iso) - Date.now()) / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;
}

// POST /api/run/check  { waypoints: [{ lat, lon }, ...], date: "YYYY-MM-DD", start?: "HH:MM", duration?: minutes }
export async function POST(request: Request) {
  // Every check spends Jev tokens, so only signed-in users may ask, within their daily limit.
  const session = await getSession();
  if (!session) return Response.json({ error: "Please sign in again." }, { status: 401 });
  let checkId: string | null = null;
  try {
    const body = await request.json().catch(() => {
      throw new UserError("The request body must be JSON.");
    });
    const maxPoints = maxRoutePointsFor(session.user.email);
    if (maxPoints !== null && Array.isArray(body.waypoints) && body.waypoints.length > maxPoints) {
      throw new UserError(`During the beta a route can have at most ${maxPoints} points. Remove a few and try again.`);
    }

    const reserved = await reserveCheck(session.user.id, session.user.email, "run");
    const { quota } = reserved;
    if (!reserved.id) {
      const limitReached: ErrorBody = {
        title: "Daily limit reached",
        error:
          `You've used all ${DAILY_CHECK_LIMIT} checks for the last 24 hours. ` +
          (quota.resetsAt ? `Your next check frees up in about ${fromNow(quota.resetsAt)}.` : "Try again later."),
        retryable: false,
      };
      return Response.json(limitReached, { status: 429 });
    }
    checkId = reserved.id;

    const db = getDb();
    const result = await runCheck(
      {
        waypoints: body.waypoints,
        date: String(body.date ?? ""),
        startMin: parseTime(body.start || null, "start"),
        duration: body.duration === undefined || body.duration === "" ? undefined : Number(body.duration),
      },
      { cache: dbCache(db), db, checkId },
    );
    // The quota already counts this check.
    return Response.json({ ...result, quota });
  } catch (e) {
    if (checkId) await releaseCheck(checkId);
    return errorResponse(e);
  }
}
