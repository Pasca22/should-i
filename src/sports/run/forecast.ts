import { UserError } from "@/shared/errors";
import type { AirResponse, Series, WeatherResponse } from "@/shared/weather/open-meteo";
import type { ForecastRow } from "./types";

export const MAX_DAYS_AHEAD = 7;

const WMO: Record<number, string> = {
  0: "clear", 1: "mainly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "rime fog",
  51: "light drizzle", 53: "drizzle", 55: "dense drizzle", 56: "freezing drizzle", 57: "freezing drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain",
  71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains", 80: "light showers",
  81: "showers", 82: "violent showers", 85: "snow showers", 86: "heavy snow showers",
  95: "thunderstorm", 96: "thunderstorm with hail", 99: "thunderstorm with heavy hail",
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Local wall-clock times (in the route's time zone) are handled as milliseconds on a UTC timeline: "2026-10-28T17:00"
// becomes Date.parse("2026-10-28T17:00Z"). Open-Meteo returns local times without an offset, so
// this keeps all arithmetic exact without a time-zone library.
export const wallClock = (localIso: string) => Date.parse(`${localIso.length === 10 ? `${localIso}T00:00` : localIso}Z`);
const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16);
export const weekday = (date: string) =>
  new Date(`${date}T12:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

/** e.g. "Tuesday 2026-10-27 21:45", as in the Python app's current_local_time. */
export const formatLocalNow = (nowMs: number) => `${weekday(isoDate(nowMs))} ${isoDate(nowMs)} ${hhmm(nowMs)}`;

type AirIndex = AirResponse["hourly"] & { index: Map<string, number> };

const num = (series: Series, name: string, i: number) => (series[name] as (number | null)[])[i];

/** One forecast step (hourly or 15-minute). Air quality is only hourly, so use the step's hour. */
export function weatherRow(src: Series, i: number, air: AirIndex, label: string): ForecastRow {
  const code = num(src, "weather_code", i) as number;
  // `daylight` is set below, after the optional uv_index, to keep the key order Jev saw from the Python app.
  const row = {
    time: label,
    conditions: WMO[code] ?? `code ${code}`,
    temp_c: num(src, "temperature_2m", i) as number,
    feels_like_c: num(src, "apparent_temperature", i) as number,
    humidity_pct: num(src, "relative_humidity_2m", i) as number,
    rain_chance_pct: num(src, "precipitation_probability", i),
    precip_mm: num(src, "precipitation", i) as number,
    wind_kmh: num(src, "wind_speed_10m", i) as number,
    gusts_kmh: num(src, "wind_gusts_10m", i) as number,
  } as ForecastRow;
  if ("uv_index" in src) row.uv_index = num(src, "uv_index", i) as number;
  row.daylight = Boolean(num(src, "is_day", i));
  // The air-quality forecast ends a few days out; leave the fields out rather than send nulls.
  const j = air.index.get(`${src.time[i].slice(0, 13)}:00`);
  if (j !== undefined && air.european_aqi[j] !== null) {
    row.european_aqi = air.european_aqi[j] as number;
    row.pm2_5 = air.pm2_5[j] as number;
  }
  return row;
}

export type DayForecast = {
  date: string;
  weekday: string;
  days_ahead: number;
  sunrise: string;
  sunset: string;
  hours: ForecastRow[];
  air_quality?: string;
};

export type DuringRun = { resolution: "15-minute" | "hourly"; rows: ForecastRow[] };

/**
 * Forecast for `date` (YYYY-MM-DD) from one forecast point's Open-Meteo responses, plus the steps overlapping
 * the planned run when a start time (minutes after midnight) is given. `nowUtc` is injectable for tests.
 */
export function buildForecast(
  wx: WeatherResponse, aq: AirResponse | null, date: string,
  opts: { startMin?: number; duration?: number; nowUtc?: Date } = {},
): { now: number; fc: DayForecast; during?: DuringRun } {
  const { startMin, duration, nowUtc = new Date() } = opts;
  // No air-quality response (that service failed): every row simply goes without AQI.
  const airHourly = aq?.hourly ?? { time: [], european_aqi: [], pm2_5: [] };
  const air: AirIndex = { ...airHourly, index: new Map(airHourly.time.map((t, i) => [t, i])) };

  const now = nowUtc.getTime() + wx.utc_offset_seconds * 1000;
  const daysAhead = Math.round((wallClock(date) - wallClock(isoDate(now))) / DAY);
  if (!(daysAhead >= 0 && daysAhead <= MAX_DAYS_AHEAD)) {
    throw new UserError(`Pick a date from today up to ${MAX_DAYS_AHEAD} days ahead.`);
  }
  // Steps on another date (a run past midnight) carry their date in the label.
  const label = (t: string) => (t.startsWith(date) ? t.slice(11, 16) : `${t.slice(0, 10)} ${t.slice(11, 16)}`);

  let firstHour = daysAhead === 0 ? new Date(now).getUTCHours() : 5;
  if (startMin !== undefined) firstHour = Math.min(firstHour, Math.floor(startMin / 60));
  const h = wx.hourly;
  const hours = h.time.flatMap((t, i) =>
    t.startsWith(date) && Number(t.slice(11, 13)) >= firstHour ? [weatherRow(h, i, air, label(t))] : [],
  );
  if (!hours.length) throw new UserError("No forecast hours left today. Pick a later date.");

  let during: DuringRun | undefined;
  if (startMin !== undefined) {
    const start = wallClock(date) + startMin * MINUTE;
    if (start < Math.floor(now / MINUTE) * MINUTE) {
      throw new UserError(`${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)} has already passed today.`);
    }
    const end = start + (duration ?? 60) * MINUTE;
    // 15-minute steps for runs up to 3 h; longer runs use hourly steps to keep the request small.
    const short = end - start <= 3 * HOUR && wx.minutely_15;
    const src = short ? wx.minutely_15! : h;
    const step = short ? 15 * MINUTE : HOUR;
    during = {
      resolution: short ? "15-minute" : "hourly",
      rows: src.time.flatMap((t, i) =>
        wallClock(t) < end && wallClock(t) + step > start ? [weatherRow(src, i, air, label(t))] : [],
      ),
    };
  }

  const d = wx.daily.time.indexOf(date);
  const fc: DayForecast = {
    date,
    weekday: weekday(date),
    days_ahead: daysAhead,
    sunrise: wx.daily.sunrise[d].slice(11),
    sunset: wx.daily.sunset[d].slice(11),
    hours,
  };
  if (!hours.some((row) => "european_aqi" in row)) {
    fc.air_quality = aq
      ? "No air-quality forecast is available this far ahead; judge without it."
      : "The air-quality service is unavailable right now; judge without it.";
  }
  return { now, fc, during };
}
