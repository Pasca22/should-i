import type { Db } from "@/shared/db/client";
import { eq } from "drizzle-orm";
import { checks } from "@/shared/db/schema";
import { UserError } from "@/shared/errors";
import { askJev } from "@/shared/jev";
import { fetchForecasts, type ResponseCache } from "@/shared/weather/open-meteo";
import { buildForecast, formatLocalNow, type DuringRun } from "./forecast";
import { buildQuestions } from "./questions";
import { forecastPoints, MAX_WAYPOINTS, type LatLon } from "./route";
import type { CheckResult, Plan, RunAnswers, RunState } from "./types";

export const MAX_DURATION = 12 * 60; // minutes

const pad = (n: number) => String(n).padStart(2, "0");

export type CheckInput = { waypoints: LatLon[]; date: string; startMin?: number; duration?: number };

const validPoint = (p: unknown): p is LatLon => {
  const { lat, lon } = (p ?? {}) as Record<string, unknown>;
  return typeof lat === "number" && typeof lon === "number" && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
};

/**
 * Ask Jev about one run along the given waypoints (one point = a run around that spot) and record the answer in the
 * check reserved for it (see reserveCheck).
 */
export async function runCheck(
  input: CheckInput,
  deps: { cache: ResponseCache; db?: Db; checkId?: string },
): Promise<CheckResult> {
  const { waypoints, date, startMin, duration } = input;
  if (!Array.isArray(waypoints) || !waypoints.length) throw new UserError("Tap the map to put at least one point on your route.");
  if (waypoints.length > MAX_WAYPOINTS) throw new UserError(`A route can have at most ${MAX_WAYPOINTS} points.`);
  if (!waypoints.every(validPoint)) throw new UserError("Every route point needs a valid latitude and longitude.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00Z`))) {
    throw new UserError("date must look like YYYY-MM-DD");
  }
  if (duration !== undefined && !(Number.isInteger(duration) && duration >= 1 && duration <= MAX_DURATION)) {
    throw new UserError(`Run length must be between 1 minute and ${MAX_DURATION / 60} hours.`);
  }
  if (!process.env.TYPESAFE_API_KEY) throw new UserError("TYPESAFE_API_KEY is not set in the server's environment.");

  const points = forecastPoints(waypoints);
  const { weather, air } = await fetchForecasts(points, startMin !== undefined, deps.cache);
  const fetched = points.map((_, i) => buildForecast(weather[i], air?.[i] ?? null, date, { startMin, duration }));
  const { now, fc: first, during: firstDuring } = fetched[0];

  const plan: Plan = {};
  if (startMin !== undefined) plan.start = `${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}`;
  if (duration !== undefined) plan.duration_minutes = duration;
  if (startMin !== undefined) {
    const end = startMin + (duration ?? 60);
    if (duration) {
      plan.ends_around = `${pad(Math.floor(end / 60) % 24)}:${pad(end % 60)}` + (end >= 24 * 60 ? " (next day)" : "");
    } else {
      plan.note = "Run length not given; forecast_during_run covers about one hour from the start.";
    }
    plan.forecast_resolution = (firstDuring as DuringRun).resolution;
    plan.forecast_during_run = Object.fromEntries(points.map((p, i) => [p.label, (fetched[i].during as DuringRun).rows]));
  }

  const state: RunState = {
    runner: "Recreational runner deciding whether to go out for an outdoor run.",
    route: {
      description:
        points.length === 1
          ? "A run around one spot; the runner hasn't drawn the exact route"
          : `A run along a route the runner drew; forecasts sampled at ${points.length} points along it, from start to finish`,
      forecast_points: points.map((p, i) => ({ ...p, elevation_m: Math.round(weather[i].elevation) })),
    },
    current_local_time: formatLocalNow(now),
    timezone: weather[0].timezone,
    forecast: {
      date: first.date,
      weekday: first.weekday,
      days_ahead: first.days_ahead,
      sunrise: first.sunrise,
      sunset: first.sunset,
      ...(first.air_quality ? { air_quality: first.air_quality } : {}),
      hours_by_point: Object.fromEntries(points.map((p, i) => [p.label, fetched[i].fc.hours])),
    },
    notes: "European AQI: 0-20 good, 20-40 fair, 40-60 moderate, 60-80 poor, 80+ very poor.",
  };
  if (Object.keys(plan).length) state.plan = plan;

  const questions = buildQuestions(new Date(now).getUTCHours(), first.days_ahead, plan);
  const result = await askJev<RunAnswers>(state, questions);

  if (deps.db && deps.checkId) {
    // History is secondary: a database hiccup shouldn't cost the user their answer.
    await deps.db
      .update(checks)
      .set({
        route: waypoints, date, startTime: plan.start ?? null, durationMin: duration ?? null,
        state, questions, answers: result.answers, model: result.model,
        inputTokens: result.usage?.input_tokens ?? null, outputTokens: result.usage?.output_tokens ?? null,
      })
      .where(eq(checks.id, deps.checkId))
      .catch((e) => console.error("recording the check failed", e));
  }

  return {
    waypoints,
    date,
    days_ahead: first.days_ahead,
    state,
    questions,
    model: result.model,
    answers: result.answers,
    usage: result.usage,
  };
}
