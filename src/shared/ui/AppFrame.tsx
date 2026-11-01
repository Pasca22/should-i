"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, type ReactNode } from "react";
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

/** Finger travel (px) before a touch counts as a drag, and the distance or speed (px/ms) that switches the sheet. */
const DRAG_SLOP = 8;
const SWITCH_DISTANCE = 60;
const FLING_SPEED = 0.5;

/** Whether the touch started inside a scrollable box of its own (e.g. a wheel picker) below `stop`. */
function inNestedScroller(target: EventTarget | null, stop: HTMLElement) {
  for (let n = target instanceof HTMLElement ? target : null; n && n !== stop; n = n.parentElement) {
    const { overflowY } = getComputedStyle(n);
    if ((overflowY === "auto" || overflowY === "scroll") && n.scrollHeight > n.clientHeight) return true;
  }
  return false;
}

/**
 * Lets the phone's bottom sheet be dragged: from the handle in either direction, up from anywhere while collapsed,
 * and down from the content while expanded and scrolled to the top. The sheet follows the finger, then snaps.
 */
function useSheetDrag(enabled: boolean, expanded: boolean, onExpandedChange?: (expanded: boolean) => void) {
  const sheet = useRef<HTMLElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const isExpanded = useEffectEvent(() => expanded);
  const setExpanded = useEffectEvent((open: boolean) => open !== expanded && onExpandedChange?.(open));

  useEffect(() => {
    const el = sheet.current;
    if (!enabled || !el) return;
    let touch: { y: number; height: number; target: EventTarget | null; dragging: boolean; lastY: number; lastT: number; speed: number } | null = null;

    const reset = () => {
      el.style.removeProperty("height");
      el.style.removeProperty("max-height");
    };
    const start = (e: TouchEvent) => {
      // From md up the panel is a sidebar.
      if (e.touches.length !== 1 || matchMedia("(min-width: 768px)").matches) return;
      const y = e.touches[0].clientY;
      touch = { y, height: el.getBoundingClientRect().height, target: e.target, dragging: false, lastY: y, lastT: e.timeStamp, speed: 0 };
    };
    const move = (e: TouchEvent) => {
      if (!touch) return;
      const y = e.touches[0].clientY;
      const dy = y - touch.y;
      if (!touch.dragging) {
        if (Math.abs(dy) < DRAG_SLOP) return;
        const fromHandle = handle.current?.contains(touch.target as Node) ?? false;
        const fromContent = content.current && !inNestedScroller(touch.target, content.current);
        const drag =
          fromHandle ||
          (fromContent && (dy < 0 ? !isExpanded() : isExpanded() && content.current!.scrollTop <= 0));
        // Anything else is a normal scroll of the content (or of a wheel picker inside it).
        if (!drag) return void (touch = null);
        touch.dragging = true;
      }
      e.preventDefault();
      const max = window.innerHeight * 0.88;
      el.style.maxHeight = "none";
      el.style.height = `${Math.min(max, Math.max(64, touch.height - dy))}px`;
      if (e.timeStamp > touch.lastT) touch.speed = (y - touch.lastY) / (e.timeStamp - touch.lastT);
      touch.lastY = y;
      touch.lastT = e.timeStamp;
    };
    const end = (e: TouchEvent) => {
      if (!touch?.dragging) return void (touch = null);
      // A drag isn't a tap: keep the browser from clicking whatever the finger started on.
      e.preventDefault();
      const dy = touch.lastY - touch.y;
      reset();
      if (touch.speed < -FLING_SPEED || dy < -SWITCH_DISTANCE) setExpanded(true);
      else if (touch.speed > FLING_SPEED || dy > SWITCH_DISTANCE) setExpanded(false);
      touch = null;
    };
    const cancel = () => {
      reset();
      touch = null;
    };

    el.addEventListener("touchstart", start, { passive: true });
    // Not passive: once the sheet is being dragged, the content mustn't scroll.
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", cancel);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", cancel);
    };
  }, [enabled]);

  return { sheet, handle, content };
}

/** The shared screen: full map, "Should I?" with the sport switch on top, and the sport's panel. */
export default function AppFrame({ sport, mapLayers, overlay, panel, expanded = false, onExpandedChange }: Props) {
  const { sheet, handle, content } = useSheetDrag(Boolean(panel), expanded, onExpandedChange);

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
          ref={sheet}
          className={cn(
            // Phone: a bottom sheet over the map.
            "fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-2xl border-t border-border bg-card shadow-[0_-8px_30px_rgba(0,0,0,.4)]",
            expanded ? "max-h-[88dvh]" : "max-h-[45dvh]",
            // Wider screens: a sidebar next to the map, taking a good share of the width.
            "md:static md:h-full md:max-h-none md:w-[460px] md:shrink-0 md:rounded-none md:border-t-0 md:border-l md:shadow-none lg:w-[44vw] lg:max-w-[720px]",
          )}
        >
          <button
            ref={handle}
            type="button"
            aria-label={expanded ? "Collapse panel" : "Expand panel"}
            className="flex w-full touch-none justify-center pt-3 pb-2.5 md:hidden"
            // Taps and keys; drags are handled by useSheetDrag.
            onClick={() => onExpandedChange?.(!expanded)}
          >
            <span className="h-1.5 w-12 rounded-full bg-input" />
          </button>
          <div
            ref={content}
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:pt-4"
          >
            {panel}
          </div>
        </aside>
      )}
    </div>
  );
}
