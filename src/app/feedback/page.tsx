import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import FeedbackForm from "./FeedbackForm";

export const metadata: Metadata = { title: "Feedback · Should I?" };

export default function FeedbackPage() {
  return (
    // The root layout locks page scrolling for the full-screen map; this page scrolls itself.
    <main className="h-dvh overflow-y-auto">
      <div className="mx-auto max-w-xl px-4 py-8">
        <Link href="/run" className="mb-6 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to the app
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">How is Should I? working for you?</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">
          You&apos;re one of the first people trying it. Anything helps: what felt good, what was confusing, what you
          wish it did. Up to 1000 characters.
        </p>
        <FeedbackForm />
      </div>
    </main>
  );
}
