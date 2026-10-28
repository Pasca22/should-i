"use client";

import { Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { authClient } from "@/shared/auth/client";
import type { ErrorBody } from "@/shared/errors";
import AppFrame from "@/shared/ui/AppFrame";
import ErrorCard from "@/shared/ui/ErrorCard";
import { MAX_WAYPOINTS, type LatLon } from "../route";
import type { CheckResult } from "../types";
import { COLORS, dayLabel, daysBetween, localToday, pct, planText, verdict } from "./format";
import PlanForm, { type PlanValues } from "./PlanForm";
import ResultView from "./ResultView";
import RunMapLayers from "./RunMapLayers";

/** What the phone's bottom sheet shows. On wider screens everything is visible in the sidebar. */
type Mode = "peek" | "plan" | "results";

/** Run length in minutes from the h/min fields, or "" when both are empty or zero (= any length). */
function durationTotal(p: PlanValues) {
  const total = (Number(p.durH) || 0) * 60 + (Number(p.durM) || 0);
  return total > 0 ? String(total) : "";
}

// Results depend on the date, the optional run plan and the route, so cache them per combination.
const resultKey = (p: PlanValues, route: LatLon[]) =>
  `${p.date}|${p.start}|${durationTotal(p)}|${route.map((w) => `${w.lat.toFixed(5)},${w.lon.toFixed(5)}`).join(";")}`;

/** A failed check, with the server's explanation (or ours, when the server itself couldn't be reached). */
class CheckError extends Error {
  constructor(readonly body: ErrorBody) {
    super(body.error);
  }
}

async function fetchCheck(p: PlanValues, waypoints: LatLon[]): Promise<CheckResult> {
  let res: Response;
  try {
    res = await fetch("/api/run/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waypoints, date: p.date, start: p.start, duration: durationTotal(p) }),
    });
  } catch {
    throw new CheckError({
      title: "You seem to be offline",
      error: "The app couldn't reach its server. Check your internet connection and try again.",
      retryable: true,
    });
  }
  if (res.status === 401) {
    // The session ended (signed out elsewhere or expired). A full page load on purpose: it drops all client
    // state and goes through the proxy's session check.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
    throw new Error("Please sign in again.");
  }
  const data = await res.json().catch(() => null);
  if (!data) {
    throw new CheckError({
      title: "Something went wrong",
      error: `The server sent an unexpected response (HTTP ${res.status}). Try again in a moment.`,
      retryable: true,
    });
  }
  if (!res.ok) {
    throw new CheckError({
      title: data.title ?? "Something went wrong",
      error: data.error ?? "The check failed.",
      retryable: data.retryable ?? true,
      detail: data.detail,
    });
  }
  return data;
}

export default function RunApp() {
  const [minDate] = useState(localToday);
  const [plan, setPlan] = useState<PlanValues>({ date: minDate, start: "", durH: "", durM: "" });
  const [route, setRoute] = useState<LatLon[]>([]);
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [mode, setMode] = useState<Mode>("peek");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<ErrorBody | null>(null);
  const [busy, setBusy] = useState(false);
  // Beta limits from the session; after a check, its response has the freshest count.
  const { data: session } = authClient.useSession();
  const [latestQuota, setLatestQuota] = useState<CheckResult["quota"]>();
  const quota = latestQuota ?? session?.quota;
  const maxPoints = session?.maxRoutePoints ?? MAX_WAYPOINTS;
  const checksLeft = quota && quota.limit !== null ? Math.max(0, quota.limit - quota.used) : null;

  const current = route.length ? results[resultKey(plan, route)] : undefined;
  const planActive = Boolean(plan.start || durationTotal(plan));
  const ahead = daysBetween(minDate, plan.date);
  const routeSummary = !route.length
    ? "Tap the map where you'll run"
    : route.length === 1
      ? "1 point · a run around this spot"
      : `${route.length} points${maxPoints < MAX_WAYPOINTS ? ` of ${maxPoints}` : ""}`;

  const addPoint = (p: LatLon) => {
    if (route.length >= maxPoints) {
      return setError({
        title: "Your route is full",
        error: `${maxPoints < MAX_WAYPOINTS ? "During the beta, a" : "A"} route can have at most ${maxPoints} points. Undo a few, or tap points to remove them.`,
        retryable: false,
      });
    }
    setRoute([...route, p]);
  };

  async function askRoute() {
    if (!route.length) return;
    const waypoints = [...route];
    setBusy(true);
    setError(null);
    setProgress("Fetching the forecast along your route and asking Jev…");
    try {
      const data = await fetchCheck(plan, waypoints);
      setResults((r) => ({ ...r, [resultKey(plan, waypoints)]: data }));
      if (data.quota) setLatestQuota(data.quota);
      setMode("results");
    } catch (e) {
      setError(e instanceof CheckError ? e.body : { title: "Something went wrong", error: (e as Error).message, retryable: true });
    } finally {
      setProgress("");
      setBusy(false);
    }
  }

  // On a phone only the current mode's sections show; from md up, everything does.
  const onPhone = (m: Mode | Mode[]) => ([] as Mode[]).concat(m).includes(mode) ? "" : "hidden md:block";

  const panel = (
    // min-w-0: wide forecast tables scroll inside their own box instead of widening the panel.
    <div className="grid gap-4 [&>*]:min-w-0">
      {/* Route */}
      <section className={onPhone(["peek", "plan"])}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-medium text-muted-foreground">Where you&apos;ll run</div>
            <div className="text-lg font-semibold tabular-nums">{routeSummary}</div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline" size="icon-lg" aria-label="Undo last point" title="Undo last point"
              disabled={busy || !route.length} onClick={() => setRoute(route.slice(0, -1))}
            >
              <Undo2 />
            </Button>
            <Button
              variant="outline" size="icon-lg" aria-label="Clear route" title="Clear route"
              disabled={busy || !route.length} onClick={() => setRoute([])}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          The points don&apos;t have to be your exact path. They just show Jev the area you&apos;ll run through, so it
          checks the weather there.
          <span className="mt-1 block">Tap to add a point · drag to move it · tap a point to remove it</span>
        </p>
      </section>

      {/* Phone, collapsed: the current verdict and a way into the plan */}
      {mode === "peek" && (
        <section className="grid gap-2 md:hidden">
          {current && (
            <button type="button" className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-left" onClick={() => setMode("results")}>
              <span className="text-lg font-bold" style={{ color: COLORS[verdict(current.answers.go_run.noul).kind] }}>
                {verdict(current.answers.go_run.noul).text}
              </span>
              <span className="text-sm text-muted-foreground">{pct(current.answers.go_run.noul)} · details ↑</span>
            </button>
          )}
          <Button size="lg" className="h-11 text-base" disabled={!route.length} onClick={() => setMode("plan")}>
            Plan this run
          </Button>
        </section>
      )}

      {/* Plan */}
      <section className={cn("grid gap-3", onPhone("plan"))}>
        <PlanForm values={plan} minDate={minDate} disabled={busy} onChange={setPlan} />
        <Button
          size="lg" className="mt-1 h-11 w-full text-base font-semibold"
          disabled={busy || !route.length || checksLeft === 0} onClick={askRoute}
        >
          Ask Jev
        </Button>
        {checksLeft !== null && (
          <p className={cn("text-center text-xs", checksLeft === 0 ? "text-destructive" : "text-muted-foreground")}>
            {checksLeft === 0
              ? "You've used today's checks. They free up 24 hours after each one."
              : `${checksLeft} of ${quota!.limit} checks left today · up to ${maxPoints} points per route`}
          </p>
        )}
      </section>

      {progress && <p role="status" className="text-sm text-muted-foreground">{progress}</p>}
      {error && <ErrorCard error={error} onRetry={askRoute} onDismiss={() => setError(null)} />}

      {/* Results */}
      <section className={onPhone("results")}>
        <div className="mb-3 flex items-center justify-between gap-2 md:hidden">
          <span className="truncate text-sm text-muted-foreground">
            {dayLabel(ahead, plan.date)}{planActive ? ` · ${planText(current?.state.plan) || "custom plan"}` : ""}
          </span>
          <Button variant="outline" size="sm" onClick={() => setMode("plan")}>Edit plan</Button>
        </div>
        {current ? (
          <ResultView data={current} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {route.length
              ? `Ask Jev about this route ${dayLabel(ahead, plan.date)}.`
              : "Tap the map where you want to run: one point for a run around a spot, or a few across the area you'll cover. They don't need to follow your exact path."}
          </p>
        )}
      </section>
    </div>
  );

  return (
    <AppFrame
      sport="run"
      mapLayers={
        <RunMapLayers
          waypoints={route}
          color={current ? COLORS[verdict(current.answers.go_run.noul).kind] : COLORS.accent}
          disabled={busy}
          onAdd={addPoint}
          onMove={(i, p) => setRoute(route.map((w, j) => (j === i ? p : w)))}
          onRemove={(i) => setRoute(route.filter((_, j) => j !== i))}
        />
      }
      panel={panel}
      expanded={mode !== "peek"}
      onExpandedChange={(open) => setMode(open ? (current ? "results" : "plan") : "peek")}
    />
  );
}
