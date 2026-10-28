"use client"

import * as React from "react"
import { cn } from "cn"

const ITEM_HEIGHT = 32
const VISIBLE_ITEMS = 5 // odd, so one item sits in the middle

export type WheelItem = { value: string; label: string }

type WheelPickerProps = {
  items: WheelItem[]
  value: string
  onChange: (value: string) => void
  "aria-label": string
  disabled?: boolean
  className?: string
}

// Trackpads send many small wheel deltas; this many pixels of them move the wheel by one item.
const TRACKPAD_STEP_PX = 30

/**
 * An iOS-style scroll wheel: swipe on touch screens; mouse wheel, trackpad or click-and-drag on laptops;
 * click an item, or use the arrow keys. Built on CSS scroll-snap, so touch momentum and snapping are the browser's own.
 */
function WheelPicker({ items, value, onChange, disabled, className, ...props }: WheelPickerProps) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const settleTimer = React.useRef<number | undefined>(undefined)
  const scrolledOnce = React.useRef(false)
  const drag = React.useRef<{ pointerId: number; startY: number; startTop: number; moved: boolean } | null>(null)
  const index = Math.max(0, items.findIndex((item) => item.value === value))
  const clamp = (i: number) => Math.min(items.length - 1, Math.max(0, i))

  // Keep the wheel on the current value when it changes (wheel steps, reset, linked wheels).
  // The first positioning is instant; later ones glide.
  React.useLayoutEffect(() => {
    const list = listRef.current
    if (list && !drag.current && Math.round(list.scrollTop / ITEM_HEIGHT) !== index) {
      list.scrollTo({ top: index * ITEM_HEIGHT, behavior: scrolledOnce.current ? "smooth" : "instant" })
    }
    scrolledOnce.current = true
  }, [index])

  React.useEffect(() => () => window.clearTimeout(settleTimer.current), [])

  // Report the centred item once scrolling (including snap) has come to rest.
  const settle = () => {
    const list = listRef.current
    if (!list || drag.current) return
    const i = clamp(Math.round(list.scrollTop / ITEM_HEIGHT))
    if (items[i].value !== value) onChange(items[i].value)
  }

  const step = (delta: number) => onChange(items[clamp(index + delta)].value)
  const onWheelStep = React.useEffectEvent((delta: number) => {
    if (!disabled) step(delta)
  })

  // Mouse wheel: exactly one item per notch, instead of the browser's ~3-item jumps; trackpads move one item
  // per TRACKPAD_STEP_PX of scrolling. A native listener, because React's wheel events can't preventDefault.
  React.useEffect(() => {
    const list = listRef.current
    if (!list) return
    let pending = 0
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const px = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY
      if (Math.abs(px) >= 50) return onWheelStep(Math.sign(px)) // a mouse-wheel notch
      pending += px
      if (Math.abs(pending) >= TRACKPAD_STEP_PX) {
        onWheelStep(Math.sign(pending))
        pending = 0
      }
    }
    list.addEventListener("wheel", onWheel, { passive: false })
    return () => list.removeEventListener("wheel", onWheel)
  }, [])

  // Click-and-drag with a mouse, like a swipe on a phone (touch already scrolls natively).
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || disabled) return
    drag.current = { pointerId: e.pointerId, startY: e.clientY, startTop: e.currentTarget.scrollTop, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const list = e.currentTarget
    const dy = e.clientY - d.startY
    if (!d.moved) {
      if (Math.abs(dy) <= 3) return
      // Only now is it a drag. Capturing earlier would steal a plain click from the item under the mouse.
      d.moved = true
      list.setPointerCapture(e.pointerId)
      list.style.scrollSnapType = "none" // snapping would fight the drag
    }
    list.scrollTop = d.startTop - dy
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const list = e.currentTarget
    drag.current = null
    list.style.scrollSnapType = ""
    if (!d.moved) return // a plain click: the item's own onClick handles it
    const i = clamp(Math.round(list.scrollTop / ITEM_HEIGHT))
    list.scrollTo({ top: i * ITEM_HEIGHT, behavior: "smooth" })
    if (items[i].value !== value) onChange(items[i].value)
  }

  return (
    <div
      data-slot="wheel-picker"
      className={cn("relative w-full select-none", disabled && "pointer-events-none opacity-50", className)}
      style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}
    >
      {/* The selection band behind the middle item. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-lg border border-primary/35 bg-primary/12"
        style={{ height: ITEM_HEIGHT }}
      />
      <div
        ref={listRef}
        role="listbox"
        tabIndex={disabled ? -1 : 0}
        aria-activedescendant={`${props["aria-label"]}-${index}`}
        {...props}
        onScroll={() => {
          window.clearTimeout(settleTimer.current)
          settleTimer.current = window.setTimeout(settle, 120)
        }}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
          e.preventDefault()
          step(e.key === "ArrowDown" ? 1 : -1)
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative h-full cursor-grab snap-y snap-mandatory overflow-y-scroll overscroll-contain rounded-lg outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
        style={{
          paddingBlock: ITEM_HEIGHT * ((VISIBLE_ITEMS - 1) / 2),
          maskImage: "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
        }}
      >
        {items.map((item, i) => (
          <div
            key={item.value}
            id={`${props["aria-label"]}-${i}`}
            role="option"
            aria-selected={i === index}
            onClick={() => {
              listRef.current?.scrollTo({ top: i * ITEM_HEIGHT, behavior: "smooth" })
              onChange(item.value)
            }}
            className={cn(
              "grid cursor-pointer snap-center place-items-center tabular-nums transition-[color,font-size]",
              i === index ? "text-lg font-semibold text-foreground" : "text-sm text-muted-foreground",
            )}
            style={{ height: ITEM_HEIGHT }}
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export { WheelPicker }
