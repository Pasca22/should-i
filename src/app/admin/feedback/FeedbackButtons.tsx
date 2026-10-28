"use client";

import { Check, Loader2, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { acknowledgeFeedback, deleteAcknowledgedFeedback, deleteFeedback, reopenFeedback, sortAgain } from "../actions";

function Submit({ icon, children, variant = "outline" }: {
  icon: ReactNode;
  children: ReactNode;
  variant?: "outline" | "ghost" | "destructive";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="sm" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : icon} {children}
    </Button>
  );
}

export function SortAgainButton({ id }: { id: string }) {
  return (
    <form action={sortAgain.bind(null, id)}>
      <Submit icon={<Sparkles />}>Sort with Jev</Submit>
    </form>
  );
}

export function AcknowledgeButton({ id }: { id: string }) {
  return (
    <form action={acknowledgeFeedback.bind(null, id)}>
      <Submit icon={<Check />}>Acknowledge</Submit>
    </form>
  );
}

export function ReopenButton({ id }: { id: string }) {
  return (
    <form action={reopenFeedback.bind(null, id)}>
      <Submit icon={<RotateCcw />} variant="ghost">Reopen</Submit>
    </form>
  );
}

/** Asks before a delete; there's no undo. */
const confirmSubmit = (question: string) => (e: React.FormEvent) => {
  if (!window.confirm(question)) e.preventDefault();
};

export function DeleteButton({ id }: { id: string }) {
  return (
    <form action={deleteFeedback.bind(null, id)} onSubmit={confirmSubmit("Delete this feedback for good?")}>
      <Submit icon={<Trash2 />} variant="destructive">Delete</Submit>
    </form>
  );
}

export function DeleteAllAcknowledgedButton({ count }: { count: number }) {
  return (
    <form action={deleteAcknowledgedFeedback} onSubmit={confirmSubmit(`Delete all ${count} acknowledged entries for good?`)}>
      <Submit icon={<Trash2 />} variant="destructive">Delete all acknowledged</Submit>
    </form>
  );
}
