import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/shared/db/client";
import { feedback, user } from "@/shared/db/schema";
import type { Sentiment } from "@/shared/feedback";
import { requireAdminPage } from "../guard";
import { ago } from "../time";
import { AcknowledgeButton, DeleteAllAcknowledgedButton, DeleteButton, ReopenButton, SortAgainButton } from "./FeedbackButtons";

type Group = Sentiment | "unsorted";

// Bad first: that's what needs acting on.
const GROUPS: { id: Group; title: string; color: string }[] = [
  { id: "bad", title: "Bad", color: "var(--skip)" },
  { id: "neutral", title: "Neutral", color: "var(--maybe)" },
  { id: "good", title: "Good", color: "var(--go)" },
  { id: "unsorted", title: "Not sorted yet", color: "var(--muted-foreground)" },
];
const colorOf = (sentiment: Sentiment | null) => GROUPS.find((g) => g.id === (sentiment ?? "unsorted"))!.color;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function FeedbackContent({ searchParams }: Props) {
  await requireAdminPage();
  const showAcknowledged = (await searchParams).show === "acknowledged";
  const rows = await getDb()
    .select({
      id: feedback.id,
      text: feedback.text,
      email: feedback.email,
      name: user.name,
      sentiment: feedback.sentiment,
      confidence: feedback.confidence,
      createdAt: feedback.createdAt,
      acknowledgedAt: feedback.acknowledgedAt,
      acknowledgedBy: feedback.acknowledgedBy,
    })
    .from(feedback)
    .leftJoin(user, eq(feedback.userId, user.id))
    .orderBy(desc(feedback.createdAt));

  const open = rows.filter((r) => !r.acknowledgedAt);
  const acknowledged = rows.filter((r) => r.acknowledgedAt);

  const card = (r: (typeof rows)[number]) => (
    <li key={r.id} className="rounded-xl border border-border bg-card p-4" style={{ boxShadow: `inset 3px 0 ${colorOf(r.sentiment)}` }}>
      <p className="text-sm whitespace-pre-wrap">{r.text}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {r.name ? `${r.name} · ` : ""}
          {r.email} · {ago(r.createdAt)}
          {r.confidence !== null && ` · Jev ${Math.round(r.confidence * 100)}% sure`}
          {r.acknowledgedAt && ` · acknowledged ${ago(r.acknowledgedAt)}${r.acknowledgedBy ? ` by ${r.acknowledgedBy}` : ""}`}
        </span>
        <div className="flex gap-2">
          {!r.sentiment && !r.acknowledgedAt && <SortAgainButton id={r.id} />}
          {r.acknowledgedAt ? (
            <>
              <ReopenButton id={r.id} />
              <DeleteButton id={r.id} />
            </>
          ) : (
            <AcknowledgeButton id={r.id} />
          )}
        </div>
      </div>
    </li>
  );

  const toggle = (
    <Link
      href={showAcknowledged ? "/admin/feedback" : "/admin/feedback?show=acknowledged"}
      className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {showAcknowledged ? "Back to open feedback" : `Show acknowledged (${acknowledged.length})`}
    </Link>
  );

  if (showAcknowledged) {
    return (
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Acknowledged · {acknowledged.length}</h2>
          <div className="flex items-center gap-3">
            {acknowledged.length > 0 && <DeleteAllAcknowledgedButton count={acknowledged.length} />}
            {toggle}
          </div>
        </div>
        {acknowledged.length ? (
          <ul className="grid gap-2">{acknowledged.map(card)}</ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing acknowledged yet.</p>
        )}
      </div>
    );
  }

  const byGroup = (g: Group) => open.filter((r) => (r.sentiment ?? "unsorted") === g);
  const groups = GROUPS.filter((g) => g.id !== "unsorted" || byGroup("unsorted").length);

  if (!open.length) {
    return (
      <div className="grid gap-3">
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          {rows.length
            ? "All caught up: every piece of feedback is acknowledged."
            : "No feedback yet. Testers find “Send feedback” in the menu under their avatar."}
        </p>
        {acknowledged.length > 0 && toggle}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Open feedback per group, each card jumping to its section. */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
        {groups.map((g) => (
          <a key={g.id} href={`#${g.id}`} className="rounded-2xl border border-border bg-card p-4 transition hover:bg-muted">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <i className="inline-block size-2.5 rounded-full" style={{ background: g.color }} />
              {g.title}
            </div>
            <div className="mt-1 text-3xl font-extrabold tabular-nums">{byGroup(g.id).length}</div>
          </a>
        ))}
      </div>
      <div className="-mt-3 flex justify-end">{toggle}</div>

      {groups.map((g) => {
        const items = byGroup(g.id);
        return (
          <section key={g.id} id={g.id} className="scroll-mt-4">
            <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
              <i className="inline-block size-2.5 rounded-full" style={{ background: g.color }} />
              {g.title} <span className="font-normal text-muted-foreground">· {items.length}</span>
            </h2>
            {items.length ? <ul className="grid gap-2">{items.map(card)}</ul> : <p className="text-sm text-muted-foreground">Nothing open here.</p>}
          </section>
        );
      })}
    </div>
  );
}
