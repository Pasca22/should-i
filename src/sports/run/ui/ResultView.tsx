"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { CheckResult, ForecastRow } from "../types";
import { COLORS, CONDITION_LABELS, dayLabel, fmtDuration, GO, pct, planText, SKIP, verdict, whenLabel } from "./format";

function Meter({ value, color }: { value: number; color: string }) {
  return (
    <span className="block h-2 overflow-hidden rounded bg-muted">
      <i className="block h-full rounded" style={{ width: pct(value), background: color }} />
    </span>
  );
}

function Bars({ probabilities, labelFor, top }: { probabilities: Record<string, number>; labelFor: (k: string) => string; top: string }) {
  return (
    <div className="grid gap-2">
      {Object.entries(probabilities).map(([k, p]) => (
        <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 text-[13px]">
          <span className={cn("truncate", k === top && "font-semibold")} title={labelFor(k)}>{labelFor(k)}</span>
          <span className="tabular-nums text-muted-foreground">{pct(p)}</span>
          <span className="col-span-2"><Meter value={p} color="var(--bar)" /></span>
        </div>
      ))}
    </div>
  );
}

function NoulRow({ label, p }: { label: string; p: number }) {
  return (
    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 text-[13px]">
      <span>{label}</span>
      <span className="tabular-nums">{pct(p)}</span>
      <span className="col-span-2"><Meter value={p} color={COLORS[verdict(p).kind]} /></span>
    </div>
  );
}

function Tile({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </div>
  );
}

function HourTable({ hours, runTimes }: { hours: ForecastRow[]; runTimes: Set<string> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-muted-foreground">
            {["Hour", "Sky", "Temp", "Feels", "Rain", "mm", "Wind / gust km/h", "AQI"].map((h) => (
              <th key={h} className="border-b border-border px-2 py-1.5 font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((h) => (
            <tr
              key={h.time}
              className={cn(
                !h.daylight && "text-muted-foreground",
                runTimes.has(h.time) && "bg-muted font-semibold [&>td:first-child]:shadow-[inset_3px_0_var(--primary)]",
              )}
            >
              {[
                `${h.time}${h.daylight ? "" : " ☾"}`,
                h.conditions,
                `${h.temp_c}°`,
                `${h.feels_like_c}°`,
                `${h.rain_chance_pct ?? "–"}%`,
                h.precip_mm,
                `${h.wind_kmh} / ${h.gusts_kmh}`,
                h.european_aqi ?? "–",
              ].map((v, i) => (
                <td
                  key={i}
                  className={cn(
                    "border-b border-border px-2 py-1.5 whitespace-nowrap tabular-nums",
                    i === 4 && (h.rain_chance_pct ?? 0) >= 40 && "font-semibold text-bar",
                  )}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const sectionTitle = "mt-5 mb-2 text-base font-semibold";

export default function ResultView({ data }: { data: CheckResult }) {
  const a = data.answers;
  const v = verdict(a.go_run.noul);
  const fc = data.state.forecast;
  const level = Math.round(a.conditions.score);
  const plan = data.state.plan;
  const route = data.state.route;
  const isRoute = route.forecast_points.length > 1;
  const duringRun = Object.values(plan?.forecast_during_run ?? {})[0] ?? [];
  // Highlight the hourly rows the run overlaps; steps past midnight carry a date and aren't in the day's table.
  const runTimes = new Set(duringRun.filter((h) => h.time.length === 5).map((h) => `${h.time.slice(0, 2)}:00`));
  const subject = plan?.start
    ? `your run (${planText(plan)})`
    : `${plan?.duration_minutes ? `a ${fmtDuration(plan.duration_minutes)}` : "a"} run ${dayLabel(data.days_ahead, data.date)}`;

  const perPoint = (byLabel: Record<string, ForecastRow[]>, highlight: Set<string>) =>
    Object.entries(byLabel).map(([name, rows], i) =>
      isRoute ? (
        <details key={name} open={i === 0} className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold">{name}</summary>
          <HourTable hours={rows} runTimes={highlight} />
        </details>
      ) : (
        <HourTable key={name} hours={rows} runTimes={highlight} />
      ),
    );

  return (
    <div className="min-w-0 [&_details]:min-w-0">
      <h2 className="text-lg font-semibold">{isRoute ? "Your route" : "Around your spot"}</h2>
      {isRoute && (
        <p className="mt-1 text-xs text-muted-foreground">
          Forecasts from {route.forecast_points.length} points along the route, judged by Jev together.
        </p>
      )}
      {fc.air_quality && (
        <p className="mt-1 text-xs text-muted-foreground">
          {fc.air_quality.includes("unavailable")
            ? "The air-quality service was unavailable, so Jev judged without air quality."
            : "No air-quality forecast this far ahead, so Jev judged without it."}
        </p>
      )}

      <div className="my-4 rounded-xl bg-muted p-4">
        <div className="text-3xl font-extrabold" style={{ color: COLORS[v.kind] }}>{v.text}</div>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          Jev&apos;s probability that {subject} is a reasonable idea: <strong className="text-foreground">{pct(a.go_run.noul)}</strong>
        </p>
        <Meter value={a.go_run.noul} color={COLORS[v.kind]} />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3 [&>*]:min-w-0">
        <Tile title="Conditions">
          <div className="text-lg font-semibold">{CONDITION_LABELS[level]} · {a.conditions.score.toFixed(2)} / 4</div>
          <div className="mb-2 text-xs text-muted-foreground">Confidence {pct(a.conditions.confidence)}</div>
          <Bars probabilities={a.conditions.probabilities} labelFor={(k) => `${k} · ${CONDITION_LABELS[Number(k)]}`} top={String(level)} />
        </Tile>
        <Tile title={plan?.start ? "Keep your plan?" : "Best time to start"}>
          <div className="text-lg font-semibold">{whenLabel(a.when.choice, data)}</div>
          <div className="mb-2 text-xs text-muted-foreground">Confidence {pct(a.when.confidence)} · sunset {fc.sunset}</div>
          <Bars probabilities={a.when.probabilities} labelFor={(k) => whenLabel(k, data)} top={a.when.choice} />
        </Tile>
        {a.right_now && (
          <Tile title="Right now">
            <div className="text-lg font-semibold">
              {a.right_now.noul >= GO ? "Head out now" : a.right_now.noul < SKIP ? "Wait" : "Could go"}
            </div>
            <div className="text-xs text-muted-foreground">
              Jev: {pct(a.right_now.noul)} yes for {data.state.current_local_time.slice(-5)}
            </div>
            <NoulRow label="Good moment to go" p={a.right_now.noul} />
          </Tile>
        )}
        <Tile title="Gear">
          <div className="text-xs text-muted-foreground">Probability Jev says yes</div>
          <NoulRow label="Rain / wind jacket" p={a.rain_gear.noul} />
          <NoulRow label="Warm layers" p={a.warm_layers.noul} />
        </Tile>
      </div>

      {plan?.forecast_during_run && (
        <>
          <h2 className={sectionTitle}>
            During your run{" "}
            <span className="text-xs font-normal text-muted-foreground">· {plan.forecast_resolution} forecast, what Jev judged</span>
          </h2>
          {perPoint(plan.forecast_during_run, new Set())}
        </>
      )}

      <h2 className={sectionTitle}>
        Hourly forecast
        {runTimes.size > 0 && <span className="text-xs font-normal text-muted-foreground"> · highlighted rows overlap your run</span>}
      </h2>
      {perPoint(fc.hours_by_point, runTimes)}

    </div>
  );
}
