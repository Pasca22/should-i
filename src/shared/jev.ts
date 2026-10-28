import { fetchJson, UserError } from "@/shared/errors";

const JEV_URL = "https://api.typesafe.ai/v1/systemone";

export type NoulAnswer = { noul: number };
export type ChoiceAnswer = { choice: string; confidence: number; probabilities: Record<string, number> };
export type ScoreAnswer = { score: number; confidence: number; probabilities: Record<string, number>; legend?: unknown };

export type JevQuestion =
  | { type: "noul"; instructions: string }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] };

export type JevUsage = { input_tokens: number; output_tokens: number };

export type JevResult<A> = { model: string; answers: A; usage?: JevUsage };

/**
 * One System One request. Plain fetch rather than the SDK: each check stores the model and token usage,
 * which the HTTP response carries and the SDK docs don't cover.
 */
export async function askJev<A>(state: unknown, questions: Record<string, JevQuestion>): Promise<JevResult<A>> {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) throw new UserError("TYPESAFE_API_KEY is not set in the server's environment.");
  return fetchJson<JevResult<A>>("jev", JEV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.JEV_MODEL || "jev-latest", state, questions }),
    timeoutMs: 60_000,
  });
}
