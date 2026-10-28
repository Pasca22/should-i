"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SPORTS, type SportId } from "@/shared/sports";
import MapView from "./MapView";
import UserMenu from "./UserMenu";

type Props = {
  sport: SportId;
  /** Leaflet layers drawn on the map. */
  mapLayers?: ReactNode;
  /** Small overlay under the top bar, e.g. a legend. */
  overlay?: ReactNode;
  /** The sport's panel: a bottom sheet on phones, a right-hand sidebar on wider screens. None = map only. */
  panel?: ReactNode;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

/** The shared screen: full map, "Should I?" with the sport switch on top, and the sport's panel. */
export default function AppFrame({ sport, mapLayers, overlay, panel, expanded = false, onExpandedChange }: Props) {
  const dragStart = useRef<number | null>(null);

  return (
    <div className="flex h-dvh w-full">
      {/* `isolate` keeps Leaflet's own z-indexes (up to 1000) inside the map, below the panel and popups. */}
      <div className="relative isolate min-w-0 flex-1">
        <MapView>{mapLayers}</MapView>

        <header className="pointer-events-none absolute inset-x-0 top-0 z-[1100] flex items-start justify-between gap-2 p-3">
          <div className="pointer-events-auto rounded-xl bg-background/85 px-3 py-1.5 backdrop-blur">
            <span className="text-lg font-bold">Should I?</span>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <nav className="flex gap-1 rounded-full border border-border bg-card/90 p-1 backdrop-blur">
              {SPORTS.map((s) => (
                <Link
                  key={s.id}
                  href={`/${s.id}`}
                  className={cn(
                    "rounded-full px-4 py-1 text-sm font-medium transition-colors",
                    s.id === sport ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </Link>
              ))}
            </nav>
            <UserMenu />
          </div>
        </header>

        {overlay && <div className="pointer-events-none absolute left-3 top-16 z-[1100]">{overlay}</div>}
      </div>

      {panel && (
        <aside
          className={cn(
            // Phone: a bottom sheet over the map.
            "fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-2xl border-t border-border bg-card shadow-[0_-8px_30px_rgba(0,0,0,.4)] transition-[height] duration-200",
            expanded ? "max-h-[88dvh]" : "max-h-[45dvh]",
            // Wider screens: a sidebar next to the map, taking a good share of the width.
            "md:static md:h-full md:max-h-none md:w-[460px] md:shrink-0 md:rounded-none md:border-t-0 md:border-l md:shadow-none lg:w-[44vw] lg:max-w-[720px]",
          )}
        >
          <button
            type="button"
            aria-label={expanded ? "Collapse panel" : "Expand panel"}
            className="flex w-full touch-none justify-center py-2.5 md:hidden"
            // Keyboard activation; taps and swipes are handled by the pointer events below.
            onClick={(e) => e.detail === 0 && onExpandedChange?.(!expanded)}
            onPointerDown={(e) => (dragStart.current = e.clientY)}
            onPointerUp={(e) => {
              if (dragStart.current === null) return;
              const dy = e.clientY - dragStart.current;
              dragStart.current = null;
              if (dy > 30) onExpandedChange?.(false);
              else if (dy < -30) onExpandedChange?.(true);
              else onExpandedChange?.(!expanded);
            }}
          >
            <span className="h-1 w-10 rounded-full bg-input" />
          </button>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:pt-4">{panel}</div>
        </aside>
      )}
    </div>
  );
}
