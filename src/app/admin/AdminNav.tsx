"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "People" },
  { href: "/admin/feedback", label: "Feedback" },
] as const;

export default function AdminNav() {
  const path = usePathname();
  return (
    <nav className="mb-6 flex w-fit gap-1 rounded-full border border-border bg-card p-1">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            path === t.href ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
