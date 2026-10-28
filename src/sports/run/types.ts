import type { ChoiceAnswer, JevQuestion, JevUsage, NoulAnswer, ScoreAnswer } from "@/shared/jev";
import type { ForecastPoint, LatLon } from "./route";

/** One forecast step (hourly or 15-minute) as sent to Jev and shown in the tables. */
export type ForecastRow = {
  time: string;
  conditions: string;
  temp_c: number;
  feels_like_c: number;
  humidity_pct: number;
  rain_chance_pct: number | null;
  precip_mm: number;
  wind_kmh: number;
  gusts_kmh: number;
  uv_index?: number;
  daylight: boolean;
  european_aqi?: number;
  pm2_5?: number;
};

export type Plan = {
  start?: string;
  duration_minutes?: number;
  ends_around?: string;
  note?: string;
  forecast_resolution?: string;
  forecast_during_run?: Record<string, ForecastRow[]>;
};

export type RunState = {
  runner: string;
  route: {
    description: string;
    /** Where the forecasts below come from, in route order. */
    forecast_points: (ForecastPoint & { elevation_m: number })[];
  };
  current_local_time: string;
  timezone: string;
  forecast: {
    date: string;
    weekday: string;
    days_ahead: number;
    sunrise: string;
    sunset: string;
    air_quality?: string;
    /** Keyed by forecast point label. */
    hours_by_point: Record<string, ForecastRow[]>;
  };
  notes: string;
  plan?: Plan;
};

export type RunAnswers = {
  go_run: NoulAnswer;
  conditions: ScoreAnswer;
  when: ChoiceAnswer;
  rain_gear: NoulAnswer;
  warm_layers: NoulAnswer;
  right_now?: NoulAnswer;
};

/** What GET /api/run/check returns. */
export type CheckResult = {
  /** The waypoints that were checked, as sent. */
  waypoints: LatLon[];
  date: string;
  days_ahead: number;
  state: RunState;
  questions: Record<string, JevQuestion>;
  model: string;
  answers: RunAnswers;
  usage?: JevUsage;
  /** The user's checks in the last 24 hours, including this one; limit null = unlimited (admin). */
  quota?: { used: number; limit: number | null };
};
