"use server";

import { getSession } from "@/shared/auth/server";
import { getDb } from "@/shared/db/client";
import { feedback } from "@/shared/db/schema";
import { FEEDBACK_MAX_CHARS, FEEDBACK_PER_DAY, feedbackLeft, sortFeedback } from "@/shared/feedback";

export type FeedbackState = { ok: boolean; message: string } | null;

/** Saves a tester's feedback, then has Jev sort it (bad / neutral / good) for the admin page. */
export async function sendFeedback(_prev: FeedbackState, form: FormData): Promise<FeedbackState> {
  const s = await getSession();
  if (!s) return { ok: false, message: "Your session ended. Sign in again to send feedback." };
  const text = String(form.get("text") ?? "").trim();
  if (!text) return { ok: false, message: "Write a few words first." };
  if (text.length > FEEDBACK_MAX_CHARS) {
    return { ok: false, message: `Keep it to ${FEEDBACK_MAX_CHARS} characters (it's ${text.length} now).` };
  }
  if ((await feedbackLeft(s.user.id, s.user.email)) === 0) {
    return { ok: false, message: `You've sent ${FEEDBACK_PER_DAY} pieces of feedback today, thank you! Try again tomorrow.` };
  }

  const [row] = await getDb()
    .insert(feedback)
    .values({ userId: s.user.id, email: s.user.email, text })
    .returning({ id: feedback.id });
  // Sorting is best-effort: if Jev is down the feedback is saved anyway and can be sorted later from /admin/feedback.
  await sortFeedback(row.id, text);
  return { ok: true, message: "Thanks! Your feedback was sent." };
}
