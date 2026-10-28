/** A problem with the request itself; shown to the user as-is (HTTP 400). */
export class UserError extends Error {}

export type Service = "weather" | "air" | "jev";
export type FailureKind = "timeout" | "network" | "http";

/** An upstream service failed or was unreachable (HTTP 502). The message is technical; see describeUpstream. */
export class UpstreamError extends Error {
  constructor(
    readonly service: Service,
    readonly kind: FailureKind,
    message: string,
    readonly status?: number,
    readonly detail?: string,
  ) {
    super(message);
  }
}

/** What the browser gets for any failed request. */
export type ErrorBody = {
  title: string;
  error: string;
  /** Whether trying the same thing again later can help. */
  retryable: boolean;
  /** Technical details, for the collapsible part of the error card. */
  detail?: string;
};

const NAMES: Record<Service, string> = { weather: "Open-Meteo (the weather service)", air: "the air-quality service", jev: "Jev" };

/** A friendly title and message for an upstream failure, by service and what went wrong. */
export function describeUpstream(e: UpstreamError): Omit<ErrorBody, "detail"> {
  const name = NAMES[e.service];
  const isJev = e.service === "jev";
  if (e.kind === "timeout") {
    return {
      title: isJev ? "Jev is taking too long" : "The forecast is taking too long",
      error: `${name[0].toUpperCase()}${name.slice(1)} didn't answer in time. It's usually temporary, so try again in a moment.`,
      retryable: true,
    };
  }
  if (e.kind === "network") {
    return {
      title: isJev ? "Can't reach Jev" : "Can't reach the weather service",
      error: `The server couldn't connect to ${name}. Check that the server has internet access, then try again.`,
      retryable: true,
    };
  }
  const s = e.status ?? 0;
  if (s === 429) {
    return {
      title: isJev ? "Jev is busy" : "Too many forecast requests",
      error: isJev
        ? "Jev is limiting requests right now. Wait a minute and try again."
        : "The free weather service is limiting requests right now. Wait a minute and try again.",
      retryable: true,
    };
  }
  if (isJev && (s === 401 || s === 403)) {
    return {
      title: "Jev rejected the API key",
      error: "TypeSafe didn't accept the server's API key. Check TYPESAFE_API_KEY in the server's environment.",
      retryable: false,
    };
  }
  if (isJev && s === 402) {
    return {
      title: "Jev's usage limit is reached",
      error: "The TypeSafe account has run out of credit or hit its plan limit. Check the account, then try again.",
      retryable: false,
    };
  }
  if (s >= 500) {
    return {
      title: isJev ? "Jev is having trouble" : "The weather service is having trouble",
      error: `${name[0].toUpperCase()}${name.slice(1)} is down or overloaded at the moment. Try again in a few minutes.`,
      retryable: true,
    };
  }
  return {
    title: isJev ? "Jev couldn't handle this request" : "No forecast for this route",
    error: isJev
      ? "Jev rejected the request. That's a bug on our side, not something you did; the details below help fix it."
      : "The weather service couldn't give a forecast for these points or this date. Try moving the route or picking another day.",
    retryable: false,
  };
}

export function errorResponse(e: unknown): Response {
  if (e instanceof UserError) {
    return Response.json({ title: "Check your plan", error: e.message, retryable: false } satisfies ErrorBody, { status: 400 });
  }
  if (e instanceof UpstreamError) {
    console.error(`[${e.service}] ${e.message}`, e.detail ?? "");
    const detail = [e.message, e.detail?.slice(0, 500)].filter(Boolean).join("\n");
    return Response.json({ ...describeUpstream(e), detail } satisfies ErrorBody, { status: 502 });
  }
  console.error(e);
  return Response.json(
    {
      title: "Something went wrong",
      error: "The server hit an unexpected error. Try again; if it keeps happening, the details below help find the cause.",
      retryable: true,
      detail: e instanceof Error ? e.message : String(e),
    } satisfies ErrorBody,
    { status: 500 },
  );
}

/** Fetch a JSON URL from `service`, turning HTTP, network and timeout failures into UpstreamError. */
export async function fetchJson<T>(service: Service, url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = 30_000, ...rest } = init;
  const endpoint = url.split("?")[0];
  let res: Response;
  try {
    res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new UpstreamError(
      service,
      timedOut ? "timeout" : "network",
      timedOut ? `${endpoint} timed out after ${timeoutMs / 1000}s` : `${endpoint} unreachable: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (!res.ok) throw new UpstreamError(service, "http", `${endpoint} returned ${res.status}`, res.status, await res.text());
  try {
    return (await res.json()) as T;
  } catch {
    throw new UpstreamError(service, "http", `${endpoint} returned invalid JSON`, 502);
  }
}
