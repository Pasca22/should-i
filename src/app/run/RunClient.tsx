"use client";

import dynamic from "next/dynamic";

// Leaflet, geolocation and "today" only make sense in the browser, so the screen isn't prerendered.
const RunApp = dynamic(() => import("@/sports/run/ui/RunApp"), {
  ssr: false,
  loading: () => <div className="grid h-dvh place-items-center text-sm text-muted-foreground">Loading map…</div>,
});

export default function RunClient() {
  return <RunApp />;
}
