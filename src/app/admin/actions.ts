"use server";

import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { getSession } from "@/shared/auth/server";
import { isAdmin, normalizeEmail } from "@/shared/beta";
import { getDb } from "@/shared/db/client";
import { betaInvites, feedback, session, user } from "@/shared/db/schema";
import { sortFeedback } from "@/shared/feedback";

export type InviteState = { ok: boolean; message: string } | null;

/** Server Actions are public endpoints: each one checks for itself that the caller is an admin. */
async function requireAdmin() {
  const s = await getSession();
  if (!s || !isAdmin(s.user.email)) throw new Error("Only beta admins can do this.");
  return s.user;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function addInvite(_prev: InviteState, form: FormData): Promise<InviteState> {
  const admin = await requireAdmin();
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const note = String(form.get("note") ?? "").trim() || null;
  if (!EMAIL.test(email)) return { ok: false, message: "That doesn't look like an email address." };
  if (isAdmin(email)) return { ok: false, message: `${email} is an admin already.` };

  const inserted = await getDb()
    .insert(betaInvites)
    .values({ email, note, invitedBy: admin.email })
    .onConflictDoNothing()
    .returning({ email: betaInvites.email });
  if (!inserted.length) return { ok: false, message: `${email} is invited already.` };
  refresh();
  return { ok: true, message: `Invited ${email}. They can sign in with that Google account now.` };
}

/** Retries Jev on feedback that couldn't be sorted when it was sent. */
export async function sortAgain(id: string) {
  await requireAdmin();
  const [row] = await getDb().select({ text: feedback.text }).from(feedback).where(eq(feedback.id, id));
  if (row) await sortFeedback(id, row.text);
  refresh();
}

/** Marks feedback as dealt with, so it leaves the open list. */
export async function acknowledgeFeedback(id: string) {
  const admin = await requireAdmin();
  await getDb().update(feedback).set({ acknowledgedAt: new Date(), acknowledgedBy: admin.email }).where(eq(feedback.id, id));
  refresh();
}

/** Puts acknowledged feedback back on the open list (e.g. acknowledged by mistake). */
export async function reopenFeedback(id: string) {
  await requireAdmin();
  await getDb().update(feedback).set({ acknowledgedAt: null, acknowledgedBy: null }).where(eq(feedback.id, id));
  refresh();
}

/** Deletes one acknowledged entry for good. Open (unacknowledged) feedback is never deleted. */
export async function deleteFeedback(id: string) {
  await requireAdmin();
  await getDb().delete(feedback).where(and(eq(feedback.id, id), isNotNull(feedback.acknowledgedAt)));
  refresh();
}

/** Deletes every acknowledged entry, so the table doesn't grow forever. */
export async function deleteAcknowledgedFeedback() {
  await requireAdmin();
  await getDb().delete(feedback).where(isNotNull(feedback.acknowledgedAt));
  refresh();
}

/** Takes someone out of the beta: removes the invite and ends all their sessions, so they're out right away. */
export async function removeInvite(email: string) {
  await requireAdmin();
  const db = getDb();
  await db.delete(betaInvites).where(eq(betaInvites.email, email));
  const ids = db.select({ id: user.id }).from(user).where(eq(sql`lower(${user.email})`, email));
  await db.delete(session).where(inArray(session.userId, ids));
  refresh();
}
