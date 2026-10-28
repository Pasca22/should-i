import { date, index, integer, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

/** Raw Open-Meteo responses, one row per (endpoint, params, location), reused until they expire. */
export const weatherCache = pgTable("weather_cache", {
  key: text("key").primaryKey(),
  response: jsonb("response").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** Every successful Jev check, with the exact state and answers. */
export const checks = pgTable(
  "checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Who asked; null for checks from before sign-in existed. Kept (unlinked) if the user is deleted.
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    sport: text("sport").notNull(), // validated against SPORTS in code, not a Postgres enum
    route: jsonb("route").$type<{ lat: number; lon: number }[]>().notNull(), // the waypoints, as sent
    date: date("date", { mode: "string" }).notNull(),
    startTime: text("start_time"),
    durationMin: integer("duration_min"),
    state: jsonb("state").notNull(),
    questions: jsonb("questions").notNull(),
    answers: jsonb("answers").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("checks_created_idx").on(t.createdAt),
    index("checks_user_created_idx").on(t.userId, t.createdAt), // the daily limit's lookup
  ],
);

/** Testers' feedback, sorted by Jev into bad / neutral / good (null = not sorted yet, e.g. Jev was down). */
export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    email: text("email").notNull(), // kept even if the user row goes away
    text: text("text").notNull(),
    sentiment: text("sentiment", { enum: ["bad", "neutral", "good"] }),
    confidence: real("confidence"),
    probabilities: jsonb("probabilities").$type<Record<string, number>>(),
    model: text("model"),
    // Set when an admin has dealt with it; acknowledged feedback leaves the open list.
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedBy: text("acknowledged_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("feedback_user_created_idx").on(t.userId, t.createdAt)],
);

/** The closed beta: Google accounts allowed to sign in, besides the admins in ADMIN_EMAILS. */
export const betaInvites = pgTable("beta_invites", {
  email: text("email").primaryKey(), // lowercased
  note: text("note"),
  invitedBy: text("invited_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
