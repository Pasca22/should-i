export type LatLon = { lat: number; lon: number };
export type ForecastPoint = LatLon & { label: string };

export const MAX_WAYPOINTS = 200;
/** Forecasts are fetched (and sent to Jev) for at most this many points along a route. */
export const MAX_FORECAST_POINTS = 8;
/** Roughly the forecast grid spacing; sampling more densely adds tokens, not information. */
const SPACING_KM = 1.5;
/** Samples closer than this to an earlier one add nothing (e.g. the finish of a loop). */
const MIN_GAP_KM = 0.3;

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLon, b: LatLon) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function routeLengthKm(points: LatLon[]) {
  return points.slice(1).reduce((sum, p, i) => sum + distanceKm(points[i], p), 0);
}

// ~100 m precision: plenty for weather, and nearby routes share cached forecasts.
const round = (x: number) => Math.round(x * 1000) / 1000;

/** The point `km` kilometres along the route (straight lines between waypoints). */
function pointAt(points: LatLon[], km: number): LatLon {
  let left = km;
  for (let i = 1; i < points.length; i++) {
    const seg = distanceKm(points[i - 1], points[i]);
    if (left <= seg || i === points.length - 1) {
      const t = seg === 0 ? 0 : Math.min(left / seg, 1);
      return {
        lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * t,
        lon: points[i - 1].lon + (points[i].lon - points[i - 1].lon) * t,
      };
    }
    left -= seg;
  }
  return points[0];
}

/**
 * Where to fetch forecasts for a route: the start, evenly spaced points about every 1.5 km, and the finish,
 * at most MAX_FORECAST_POINTS, skipping samples that nearly coincide with an earlier one (loops).
 * Labels are unique and readable ("Start", "Point 2", "Finish"); a single spot is "Your spot". They carry no
 * distances: the route is straight lines between taps, so its length would mislead.
 */
export function forecastPoints(waypoints: LatLon[]): ForecastPoint[] {
  const total = routeLengthKm(waypoints);
  if (waypoints.length === 1 || total < MIN_GAP_KM) {
    return [{ label: "Your spot", lat: round(waypoints[0].lat), lon: round(waypoints[0].lon) }];
  }
  const n = Math.min(MAX_FORECAST_POINTS, Math.max(2, Math.round(total / SPACING_KM) + 1));
  const samples: ForecastPoint[] = [];
  for (let i = 0; i < n; i++) {
    const km = (total * i) / (n - 1);
    const p = pointAt(waypoints, km);
    if (samples.some((s) => distanceKm(s, p) < MIN_GAP_KM)) continue;
    const label = i === 0 ? "Start" : i === n - 1 ? "Finish" : `Point ${samples.length + 1}`;
    samples.push({ label, lat: round(p.lat), lon: round(p.lon) });
  }
  return samples;
}
