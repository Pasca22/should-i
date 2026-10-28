import { and, count, eq, gte } from "drizzle-orm";
import { isAdmin } from "@/shared/beta";
import { getDb } from "@/shared/db/client";
import { feedback } from "@/shared/db/schema";
import { askJev, type ChoiceAnswer } from "@/shared/jev";

export const FEEDBACK_MAX_CHARS = 1000;
/** Feedback entries a tester may send per rolling 24 hours (admins: unlimited). */
export const FEEDBACK_PER_DAY = 5;
export const SENTIMENTS = ["bad", "neutral", "good"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

/** Asks Jev whether one piece of feedback is bad, neutral or good. */
export async function classifyFeedback(text: string) {
  const state = {
    app: "Should I?, a beta web app that asks an AI whether the weather is right for a run along a route the user draws on a map",
    feedback: { text },
  };
  const result = await askJev<{ sentiment: ChoiceAnswer }>(state, {
    sentiment: {
      type: "choice",
      instructions: "Overall, how does this beta tester feel about the app, judging by `feedback.text`?",
      criteria: {
        bad: "Negative: mainly complaints, bugs, frustration, confusion or disappointment",
        neutral:
          "Neutral or mixed: suggestions, questions or feature requests without clear praise or frustration, " +
          "or praise and complaints in roughly equal measure",
        good: "Positive: mainly praise, enjoyment or satisfaction, even if it includes a small suggestion",
      },
    },
  });
  const a = result.answers.sentiment;
  return {
    sentiment: a.choice as Sentiment,
    confidence: a.confidence,
    probabilities: a.probabilities,
    model: result.model,
  };
}

/** Sorts a stored entry with Jev. A Jev failure leaves it unsorted (null) instead of losing the feedback. */
export async function sortFeedback(id: string, text: string) {
  try {
    const sorted = await classifyFeedback(text);
    await getDb().update(feedback).set(sorted).where(eq(feedback.id, id));
    return true;
  } catch (e) {
    console.error("sorting feedback with Jev failed; left unsorted", e);
    return false;
  }
}

/** How many more entries this user may send in the current 24 hours; null = unlimited. */
export async function feedbackLeft(userId: string, email: string) {
  if (isAdmin(email)) return null;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ sent }] = await getDb()
    .select({ sent: count() })
    .from(feedback)
    .where(and(eq(feedback.userId, userId), gte(feedback.createdAt, since)));
  return Math.max(0, FEEDBACK_PER_DAY - sent);
}
