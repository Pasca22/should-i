import { count, desc, max, sql, sum } from "drizzle-orm";
import Link from "next/link";
import { DAILY_CHECK_LIMIT, normalizeEmail, TESTER_MAX_ROUTE_POINTS } from "@/shared/beta";
import { getDb } from "@/shared/db/client";
import { betaInvites, checks, user } from "@/shared/db/schema";
import { requireAdminPage } from "./guard";
import { InviteForm, RemoveInviteButton } from "./InviteForm";
import { ago } from "./time";

const nf = new Intl.NumberFormat("en-GB");

type Row = {
  email: string;
  role: "admin" | "tester";
  note: string | null;
  invitedAt: Date | null;
  name: string | null;
  checks24h: number;
  checksTotal: number;
  tokens: number;
  lastCheck: Date | null;
};

async function loadRows(): Promise<Row[]> {
  const db = getDb();
  const [invites, users, stats] = await Promise.all([
    db.select().from(betaInvites).orderBy(desc(betaInvites.createdAt)),
    db.select({ id: user.id, email: user.email, name: user.name }).from(user),
    db
      .select({
        userId: checks.userId,
        total: count(),
        last24h: sql<number>`count(*) filter (where ${checks.createdAt} > now() - interval '24 hours')`.mapWith(Number),
        tokens: sum(checks.inputTokens).mapWith(Number),
        last: max(checks.createdAt),
      })
      .from(checks)
      .groupBy(checks.userId),
  ]);
  const userByEmail = new Map(users.map((u) => [normalizeEmail(u.email), u]));
  const statsByUser = new Map(stats.map((s) => [s.userId, s]));
  const row = (email: string, role: Row["role"], note: string | null, invitedAt: Date | null): Row => {
    const u = userByEmail.get(email);
    const s = u ? statsByUser.get(u.id) : undefined;
    return {
      email, role, note, invitedAt, name: u?.name ?? null,
      checks24h: s?.last24h ?? 0, checksTotal: s?.total ?? 0, tokens: s?.tokens ?? 0, lastCheck: s?.last ?? null,
    };
  };
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map(normalizeEmail).filter(Boolean);
  return [
    ...admins.map((e) => row(e, "admin", null, null)),
    ...invites.map((i) => row(i.email, "tester", i.note, i.createdAt)),
  ];
}

function Status({ r }: { r: Row }) {
  if (r.role === "admin") {
    return <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">Admin</span>;
  }
  if (r.name) return <span className="text-xs">Joined</span>;
  return <span className="text-xs text-muted-foreground">Invited {ago(r.invitedAt)} · not signed in yet</span>;
}

function Account({ r }: { r: Row }) {
  return (
    <>
      <div className="font-medium break-words">{r.name ?? r.email}</div>
      {r.name && <div className="text-xs break-all text-muted-foreground">{r.email}</div>}
      {r.note && <div className="text-xs text-muted-foreground italic">{r.note}</div>}
    </>
  );
}

const checks24h = (r: Row) => (r.role === "admin" ? String(r.checks24h) : `${r.checks24h} / ${DAILY_CHECK_LIMIT}`);

export default async function AdminContent() {
  await requireAdminPage();
  const rows = await loadRows();
  const testers = rows.filter((r) => r.role === "tester");

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold">Invite a tester</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Add the Google account they sign in with. Testers get {DAILY_CHECK_LIMIT} checks per 24 hours and up to{" "}
          {TESTER_MAX_ROUTE_POINTS} route points per check; admins have no limits.
        </p>
        <InviteForm />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold">People in the beta</h2>
          <span className="text-xs text-muted-foreground">{testers.length} testers</span>
        </div>
        {/* Phones: one card per person. */}
        <ul className="grid gap-2 md:hidden">
          {rows.map((r) => (
            <li key={`${r.role}-${r.email}`} className="rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Account r={r} />
                </div>
                {r.role === "tester" && <RemoveInviteButton email={r.email} />}
              </div>
              <div className="mt-1.5">
                <Status r={r} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                {[
                  ["Checks (24 h)", checks24h(r)],
                  ["All checks", String(r.checksTotal)],
                  ["Jev tokens", nf.format(r.tokens)],
                  ["Last check", ago(r.lastCheck)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>

        {/* Wider screens: a table. */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                {["Account", "Status", "Checks (24 h)", "All checks", "Jev tokens", "Last check", ""].map((h) => (
                  <th key={h} className="border-b border-border px-2 py-2 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.role}-${r.email}`} className="align-top">
                  <td className="border-b border-border px-2 py-2.5">
                    <Account r={r} />
                  </td>
                  <td className="border-b border-border px-2 py-2.5 whitespace-nowrap">
                    <Status r={r} />
                  </td>
                  <td className="border-b border-border px-2 py-2.5 whitespace-nowrap tabular-nums">{checks24h(r)}</td>
                  <td className="border-b border-border px-2 py-2.5 tabular-nums">{r.checksTotal}</td>
                  <td className="border-b border-border px-2 py-2.5 tabular-nums">{nf.format(r.tokens)}</td>
                  <td className="border-b border-border px-2 py-2.5 whitespace-nowrap text-muted-foreground">{ago(r.lastCheck)}</td>
                  <td className="border-b border-border px-2 py-2.5 text-right">
                    {r.role === "tester" && <RemoveInviteButton email={r.email} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!testers.length && <p className="mt-3 text-sm text-muted-foreground">No testers yet. Invite someone above.</p>}
      </section>

      <p className="text-xs text-muted-foreground">
        Admins come from <code>ADMIN_EMAILS</code> in the server&apos;s environment. <Link href="/run" className="underline">Back to the app</Link>
      </p>
    </div>
  );
}
