"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ErrorBody } from "@/shared/errors";

type Props = { error: ErrorBody; onRetry?: () => void; onDismiss?: () => void };

/** A failed request, explained: what happened, what to do, and the technical details tucked away. */
export default function ErrorCard({ error, onRetry, onDismiss }: Props) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
      <div className="flex gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{error.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{error.error}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {error.retryable && onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RotateCw /> Try again
              </Button>
            )}
            {onDismiss && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onDismiss}>
                Dismiss
              </Button>
            )}
          </div>
          {error.detail && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted-foreground">Technical details</summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-background/60 p-2 text-xs whitespace-pre-wrap">{error.detail}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
