"use client";

import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/shared/auth/client";

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

type LoginError = { title?: string; text: string };

/** Better Auth sends failed sign-ins back to /login?error=<code>&error_description=... */
export function LoginCardWithParams() {
  const params = useSearchParams();
  const code = params.get("error");
  const error: LoginError | null = !code
    ? null
    : code === "NOT_INVITED"
      ? {
          title: "This beta is invite-only",
          text: `${params.get("error_description") ?? "This Google account isn't on the beta list yet."} Ask the person who shared the app to invite this Google account, then try again.`,
        }
      : { text: "Google sign-in didn't go through. Please try again." };
  return <LoginCard initialError={error} />;
}

export default function LoginCard({ initialError = null }: { initialError?: LoginError | null }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<LoginError | null>(initialError);

  async function login() {
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/run",
      // Better Auth adds ?error=<code> (e.g. NOT_INVITED) to this.
      errorCallbackURL: "/login",
    });
    // On success the browser is already on its way to Google; we only get here on failure.
    if (error) {
      setError({ text: error.message || "Couldn't start Google sign-in." });
      setPending(false);
    }
  }

  return (
    <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card/80 p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,.45)] backdrop-blur-xl">
      <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-primary/15 text-4xl ring-1 ring-primary/30">
        🏃
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight">Should I?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Draw your route on the map and ask Jev whether the weather is right for your run, wherever you are.
      </p>

      <button
        type="button"
        onClick={login}
        disabled={pending}
        className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white px-4 text-[15px] font-semibold text-[#1f1f1f] shadow-sm transition hover:bg-white/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:translate-y-px disabled:opacity-70"
      >
        {pending ? <Loader2 className="size-5 animate-spin text-[#1f1f1f]" /> : <GoogleLogo />}
        {pending ? "Opening Google…" : "Login with Google"}
      </button>

      {error && (
        <div role="alert" className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-left text-sm">
          {error.title && <p className="font-semibold text-destructive">{error.title}</p>}
          <p className={error.title ? "mt-0.5 text-muted-foreground" : "text-destructive"}>{error.text}</p>
        </div>
      )}
    </div>
  );
}
