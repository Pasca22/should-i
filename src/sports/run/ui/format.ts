import type { CheckResult, Plan } from "../types";

// "Go run" thresholds on Jev's go_run probability; a UI choice, tune to taste.
export const GO = 0.65;
export const SKIP = 0.35;
export const MAX_DAYS_AHEAD = 7;
// Open-Meteo's air-quality forecast usually ends after 4-5 days.
export const AIR_QUALITY_DAYS = 4;

export const WINDOW_LABELS: Record<string, string> = {
  early_morning: "Early morning · 06–09",
  late_morning: "Late morning · 09–12",
  afternoon: "Afternoon · 12–17",
  evening: "Evening · 17–22",
  none: "No good time that day",
};
export const CONDITION_LABELS = ["Bad", "Poor", "Okay", "Good", "Excellent"];

/** Map/verdict colours; the same values as the CSS tokens, for Leaflet which needs plain strings. */
export const COLORS = { go: "#5eead4", maybe: "#e0b450", skip: "#ef7b6b", accent: "#3fd1b4" };

export type VerdictKind = "go" | "maybe" | "skip";

export function verdict(p: number): { kind: VerdictKind; text: string } {
  if (p >= GO) return { kind: "go", text: "Go run" };
  if (p < SKIP) return { kind: "skip", text: "Skip it" };
  return { kind: "maybe", text: "Your call" };
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const fmtDuration = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}`);

export function planText(plan?: Plan) {
  if (!plan) return "";
  const parts: string[] = [];
  if (plan.start) parts.push(plan.ends_around ? `${plan.start}–${plan.ends_around}` : `from ${plan.start}`);
  if (plan.duration_minutes) parts.push(fmtDuration(plan.duration_minutes));
  return parts.join(" · ");
}

export function whenLabel(choice: string, data: CheckResult) {
  if (choice === "planned") return `Your plan · ${data.state.plan?.start}`;
  return WINDOW_LABELS[choice] ?? choice;
}

// ---- Dates ----

/** Today's date on this device as YYYY-MM-DD (the runner is usually where the route is). */
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00Z`) - Date.parse(`${from}T12:00Z`)) / 864e5);

/** "today", "tomorrow", or e.g. "on Friday". */
export function dayLabel(daysAhead: number, date: string) {
  if (daysAhead === 0) return "today";
  if (daysAhead === 1) return "tomorrow";
  return `on ${new Date(`${date}T12:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })}`;
}

/** e.g. "Tue 28 Oct 2026". */
export const longDate = (iso: string) =>
  new Date(`${iso}T12:00Z`).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });

/** Normalize typed times like "1730", "7", "7:5" or "17.30" to "HH:MM"; null if not a valid 24-hour time. */
export function normalizeTime(text: string): string | null {
  const t = text.trim();
  const m = /^(\d{1,2})(?:[:.\s]?(\d{1,2}))?$/.exec(t.length === 4 && /^\d{4}$/.test(t) ? `${t.slice(0, 2)}:${t.slice(2)}` : t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
