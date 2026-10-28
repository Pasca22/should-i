"use client";

import dynamic from "next/dynamic";

const AppFrame = dynamic(() => import("@/shared/ui/AppFrame"), {
  ssr: false,
  loading: () => <div className="grid h-dvh place-items-center text-sm text-muted-foreground">Loading map…</div>,
});

/** Hiking has no features yet: just the map. */
export default function HikeClient() {
  return <AppFrame sport="hike" />;
}
