import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { APIError, betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { customSession } from "better-auth/plugins/custom-session";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { isAdmin, maxRoutePointsFor, mayUseApp, quotaFor } from "@/shared/beta";
import { getDb } from "@/shared/db/client";
import * as schema from "@/shared/db/schema";

/** Thrown during Google sign-in for accounts not in the beta; the login page shows it as "invite-only". */
const notInvited = (email: string) =>
  new APIError("FORBIDDEN", { code: "NOT_INVITED", message: `${email} isn't on the beta list yet.` });

/** Server-side auth: Google sign-in, users and sessions stored in Postgres through Drizzle. */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(getDb(), { provider: "pg", schema }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      // Always show Google's account picker, so switching accounts is easy.
      prompt: "select_account",
    },
  },
  // The closed beta, enforced where accounts and sessions are created: uninvited people get neither a user row
  // nor a session, and someone removed from the list can't sign in again.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!(await mayUseApp(user.email))) throw notInvited(user.email);
          return { data: user };
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const [row] = await getDb()
            .select({ email: schema.user.email })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId));
          if (!row || !(await mayUseApp(row.email))) throw notInvited(row?.email ?? "This account");
          return { data: session };
        },
      },
    },
  },
  plugins: [
    // Tells the UI whether to show admin links (admins come from ADMIN_EMAILS, not the database) and how many
    // checks are left today, before the first check of the visit.
    customSession(async ({ user, session }) => ({
      user: { ...user, isAdmin: isAdmin(user.email) },
      session,
      quota: await quotaFor(user.id, user.email),
      maxRoutePoints: maxRoutePointsFor(user.email),
    })),
    nextCookies(), // must stay last
  ],
});

/** The signed-in user's session for the current request, or null. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
