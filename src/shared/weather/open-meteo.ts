import { fetchJson, type Service } from "@/shared/errors";

export const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
export const AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
// Times come back in each location's own time zone, with its UTC offset in the response.
export const TZ = "auto";
export const CACHE_SECONDS = 10 * 60; // Open-Meteo updates its forecasts about hourly
export const FORECAST_DAYS = 10; // the 7-day date range plus two days for runs past midnight, plus today
export const AIR_FORECAST_DAYS = 7; // the air-quality API's maximum; its data usually ends after 4-5 days

export const HOURLY = [
  "temperature_2m", "apparent_temperature", "relative_humidity_2m",
  "precipitation_probability", "precipitation", "weather_code",
  "wind_speed_10m", "wind_gusts_10m", "uv_index", "is_day",
] as const;

/** Hourly or 15-minute series: `time` plus one array per variable. */
export type Series = { time: string[] } & Record<string, (number | null)[] | string[]>;

export type WeatherResponse = {
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  utc_offset_seconds: number;
  hourly: Series;
  minutely_15?: Series;
  daily: { time: string[]; sunrise: string[]; sunset: string[] };
};

export type AirResponse = {
  hourly: { time: string[]; european_aqi: (number | null)[]; pm2_5: (number | null)[] };
};

export type Location = { lat: number; lon: number };

/** Where cached Open-Meteo responses live (Postgres in the app, a Map in tests). */
export interface ResponseCache {
  get(keys: string[], now: Date): Promise<Map<string, unknown>>;
  put(entries: { key: string; response: unknown; expiresAt: Date }[]): Promise<void>;
}

type Params = Record<string, string | number>;

const cacheKey = (url: string, params: Params, loc: Location) =>
  [url, ...Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`), loc.lat, loc.lon].join("|");

/**
 * One response per location, in order. Locations missing from the cache are fetched in a single request:
 * Open-Meteo accepts comma-separated coordinates and then returns a list instead of one object.
 * A cache failure never fails the request; it only costs an extra fetch.
 */
export async function fetchBatched<T>(
  service: Service, url: string, params: Params, locations: Location[], cache: ResponseCache, now = new Date(),
): Promise<T[]> {
  const keys = locations.map((loc) => cacheKey(url, params, loc));
  const found = await cache.get(keys, now).catch((e) => {
    console.error("weather cache read failed", e);
    return new Map<string, unknown>();
  });
  const missing = locations.map((loc, i) => ({ loc, key: keys[i] })).filter(({ key }) => !found.has(key));
  if (missing.length) {
    const query = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      latitude: missing.map(({ loc }) => loc.lat).join(","),
      longitude: missing.map(({ loc }) => loc.lon).join(","),
    });
    const data = await fetchJson<T | T[]>(service, `${url}?${query}`);
    const responses = Array.isArray(data) ? data : [data];
    const expiresAt = new Date(now.getTime() + CACHE_SECONDS * 1000);
    missing.forEach(({ key }, i) => found.set(key, responses[i]));
    await cache
      .put(missing.map(({ key }, i) => ({ key, response: responses[i], expiresAt })))
      .catch((e) => console.error("weather cache write failed", e));
  }
  return keys.map((k) => found.get(k) as T);
}

/**
 * Weather and air quality for every location: at most two Open-Meteo requests, sent in parallel.
 * Air quality is a nice-to-have: if that service fails, `air` is null and the check goes on without it.
 */
export async function fetchForecasts(locations: Location[], withMinutely: boolean, cache: ResponseCache) {
  const weather: Params = { timezone: TZ, forecast_days: FORECAST_DAYS, hourly: HOURLY.join(","), daily: "sunrise,sunset" };
  if (withMinutely) weather.minutely_15 = HOURLY.filter((v) => v !== "uv_index").join(",");
  const air: Params = { timezone: TZ, forecast_days: AIR_FORECAST_DAYS, hourly: "european_aqi,pm2_5" };
  const [wx, aq] = await Promise.all([
    fetchBatched<WeatherResponse>("weather", WEATHER_URL, weather, locations, cache),
    fetchBatched<AirResponse>("air", AIR_URL, air, locations, cache).catch((e) => {
      console.error("air-quality forecast unavailable; continuing without it", e);
      return null;
    }),
  ]);
  return { weather: wx, air: aq };
}
