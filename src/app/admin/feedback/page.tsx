import { Suspense } from "react";
import FeedbackContent from "./FeedbackContent";

export default function AdminFeedbackPage({ searchParams }: PageProps<"/admin/feedback">) {
  // Read per request (session, latest feedback, ?show=acknowledged), so it streams in after the static shell.
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading feedback…</p>}>
      <FeedbackContent searchParams={searchParams} />
    </Suspense>
  );
}
