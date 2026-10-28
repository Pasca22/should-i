"use client";

import { Loader2, UserPlus } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addInvite, removeInvite, type InviteState } from "./actions";

export function InviteForm() {
  // React resets the form's inputs after the action, so a successful invite leaves it empty for the next one.
  const [state, action, pending] = useActionState<InviteState, FormData>(addInvite, null);
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
        <Input name="email" type="email" required placeholder="friend@gmail.com" aria-label="Google account email" className="h-10" />
        <Input name="note" placeholder="Note (optional)" aria-label="Note" className="h-10" />
        <Button type="submit" size="lg" className="h-10" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <UserPlus />} Invite
        </Button>
      </div>
      {state && (
        <p role="status" className={cn("text-sm", state.ok ? "text-primary" : "text-destructive")}>
          {state.message}
        </p>
      )}
    </form>
  );
}

function RemoveSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : null} Remove
    </Button>
  );
}

export function RemoveInviteButton({ email }: { email: string }) {
  return (
    <form
      action={removeInvite.bind(null, email)}
      onSubmit={(e) => {
        if (!window.confirm(`Remove ${email} from the beta? They're signed out right away.`)) e.preventDefault();
      }}
    >
      <RemoveSubmit />
    </form>
  );
}
