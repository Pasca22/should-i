import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import AdminNav from "./AdminNav";

export const metadata: Metadata = { title: "Beta admin · Should I?" };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    // The root layout locks page scrolling for the full-screen map; these pages scroll themselves.
    <main className="h-dvh overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Beta admin</h1>
            <p className="text-sm text-muted-foreground">Who can use Should I?, how much, and what they think.</p>
          </div>
          <Link href="/run" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to the app
          </Link>
        </header>
        <AdminNav />
        {children}
      </div>
    </main>
  );
}
