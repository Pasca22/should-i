import type { Metadata } from "next";
import { Suspense } from "react";
import LoginCard, { LoginCardWithParams } from "./LoginCard";

export const metadata: Metadata = { title: "Log in · Should I?" };

export default function LoginPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      {/* Soft glow and a faint contour-line pattern, echoing the map behind the app. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 40rem at 20% 10%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 60%)," +
            "radial-gradient(50rem 35rem at 90% 100%, color-mix(in oklab, var(--go) 10%, transparent), transparent 60%)",
        }}
      />
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]">
        <defs>
          <pattern id="contours" width="220" height="220" patternUnits="userSpaceOnUse">
            <path d="M0 110c40-30 70-30 110 0s70 30 110 0M0 60c40-30 70-30 110 0s70 30 110 0M0 160c40-30 70-30 110 0s70 30 110 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#contours)" className="text-primary" />
      </svg>
      {/* The query string is only known in the browser; the plain card is the prerendered fallback. */}
      <Suspense fallback={<LoginCard />}>
        <LoginCardWithParams />
      </Suspense>
    </main>
  );
}
