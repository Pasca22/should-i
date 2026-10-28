import type { JevQuestion } from "@/shared/jev";
import type { Plan } from "./types";

/** (id, start hour, end hour) for the "when should I start?" choice. */
export const WINDOWS = [
  ["early_morning", 6, 9],
  ["late_morning", 9, 12],
  ["afternoon", 12, 17],
  ["evening", 17, 22],
] as const;

export const CONDITION_LEVELS = [
  "Bad: storms, heavy rain, dangerous wind or very poor air; stay inside or use a treadmill",
  "Poor: steady rain, cold wet wind or poor air; only for a very determined runner",
  "Okay: some drawbacks like chilly temps, light drizzle risk or breeze, but runnable with the right gear",
  "Good: mostly dry, comfortable temperature, light wind, acceptable air",
  "Excellent: dry, cool-to-mild temperature, calm, clean air; ideal running weather",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** The Jev questions for one check. `nowHour` is the current local hour at the route. Wording is tuned; change with care. */
export function buildQuestions(nowHour: number, daysAhead: number, plan: Plan): Record<string, JevQuestion> {
  const { start, duration_minutes: duration } = plan;
  const length = duration ? "a run of `plan.duration_minutes` minutes" : "a run";
  let run: string;
  let evidence: string;
  if (start) {
    run = "the planned run starting at `plan.start`" + (duration ? " and lasting `plan.duration_minutes` minutes" : "");
    evidence = "`plan.forecast_during_run`";
  } else {
    run = `${length} at the most runnable time in \`forecast.hours_by_point\``;
    evidence = "`forecast.hours_by_point`";
  }

  // With a planned start, "when" asks whether to keep it or move to another window.
  const startHour = start ? Number(start.slice(0, 2)) : undefined;
  const windows: Record<string, string> = start ? { planned: "Keep the planned start at `plan.start`" } : {};
  for (const [id, s, e] of WINDOWS) {
    if ((daysAhead > 0 || e > nowHour) && !(startHour !== undefined && s <= startHour && startHour < e)) {
      windows[id] = `Start the run between ${pad(s)}:00 and ${pad(e)}:00`;
    }
  }
  windows.none = "No time on `forecast.date` is reasonable for an outdoor run";
  const when = start
    ? `Based on \`forecast.hours_by_point\` and \`forecast.sunset\`, should the runner keep the planned start or move ${length} ` +
      "to a different time on `forecast.date`?"
    : `Based on \`forecast.hours_by_point\` and \`forecast.sunset\`, when is the best time to start ${length} on \`forecast.date\`?`;

  const questions: Record<string, JevQuestion> = {
    go_run: {
      type: "noul",
      instructions:
        `Considering ${evidence} (rain, temperature, wind, air quality, daylight), is it a reasonable ` +
        `idea for this runner to go out for ${run} along the route described in \`route\` on \`forecast.date\`?`,
    },
    conditions: {
      type: "score",
      instructions:
        `How good are the outdoor running conditions along the route described in \`route\` for ${run}, ` +
        `judging by ${evidence}?`,
      criteria: CONDITION_LEVELS,
    },
    when: { type: "choice", instructions: when, criteria: windows },
    rain_gear: { type: "noul", instructions: `For ${run}, should the runner bring a rain or wind jacket?` },
    warm_layers: {
      type: "noul",
      instructions:
        `For ${run}, will the runner need cold-weather layers such as long sleeves, ` +
        "running tights or gloves?",
    },
  };
  if (daysAhead === 0 && !start) {
    questions.right_now = {
      type: "noul",
      instructions:
        "Is `current_local_time` a good moment to head out for a run, judging by the first one " +
        "or two entries of each list in `forecast.hours_by_point`?",
    };
  }
  return questions;
}
