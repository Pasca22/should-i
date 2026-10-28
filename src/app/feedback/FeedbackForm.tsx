"use client";

import { CheckCircle2, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sendFeedback, type FeedbackState } from "./actions";

const MAX = 1000; // FEEDBACK_MAX_CHARS; the server checks it too

export default function FeedbackForm() {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(sendFeedback, null);
  const [text, setText] = useState("");

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-primary" />
        <p className="mt-3 text-lg font-semibold">{state.message}</p>
        <p className="mt-1 text-sm text-muted-foreground">It goes straight to the person running the beta.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>Send more</Button>
          <Link href="/run" className={buttonVariants()}>Back to the app</Link>
        </div>
      </div>
    );
  }

  const left = MAX - text.length;
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-border bg-card p-5">
      <label htmlFor="feedback-text" className="text-sm font-medium">
        What works, what&apos;s confusing, what&apos;s missing?
      </label>
      <textarea
        id="feedback-text"
        name="text"
        required
        maxLength={MAX}
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Drawing the route was easy, but I wasn't sure what “Your call” means…"
        className="w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      <div className="flex items-center justify-between gap-3">
        <span className={cn("text-xs tabular-nums", left < 50 ? "text-maybe" : "text-muted-foreground")}>
          {text.length} / {MAX}
        </span>
        <Button type="submit" size="lg" disabled={pending || !text.trim()}>
          {pending ? <Loader2 className="animate-spin" /> : <Send />} Send feedback
        </Button>
      </div>
      {state && !state.ok && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
    </form>
  );
}
