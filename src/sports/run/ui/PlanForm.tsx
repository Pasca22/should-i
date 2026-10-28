"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WheelPicker } from "@/components/ui/wheel-picker";
import { cn } from "@/lib/utils";
import { addDays, AIR_QUALITY_DAYS, daysBetween, MAX_DAYS_AHEAD } from "./format";

export type PlanValues = { date: string; start: string; durH: string; durM: string };

type Props = {
  values: PlanValues;
  minDate: string;
  disabled: boolean;
  onChange: (values: PlanValues) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const HOURS = range(24).map((h) => ({ value: pad(h), label: pad(h) }));
const MINUTES = range(60).map((m) => ({ value: pad(m), label: pad(m) }));
const DUR_HOURS = range(13).map((h) => ({ value: String(h), label: `${h} h` }));
const DUR_MINUTES = range(60).map((m) => ({ value: String(m), label: `${m} min` }));
// Where the length wheels rest while the length is "any".
const SUGGESTED_LENGTH = { h: "0", m: "45" };

const label = "text-xs font-medium text-muted-foreground";

/** The next full hour on this device, where the start wheels rest while the start is "any". */
function suggestedStart() {
  return { h: pad(Math.min(23, new Date().getHours() + 1)), m: "00" };
}

/** A labelled pair of wheels; dimmed while unset ("any"), with a link back to "any" once set. */
function WheelField({ title, isSet, anyText, onReset, disabled, children }: {
  title: string;
  isSet: boolean;
  anyText: string;
  onReset: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className={label}>{title}</span>
        {isSet ? (
          <Button variant="link" size="xs" className="h-auto p-0 text-muted-foreground" disabled={disabled} onClick={onReset}>
            {anyText} ⟲
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{anyText} · scroll to set</span>
        )}
      </div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-xl border border-input bg-background px-1 transition-opacity",
          !isSet && "opacity-55",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Day (today up to 7 days ahead), optional start time (24-hour, any minute) and optional run length. */
export default function PlanForm({ values, minDate, disabled, onChange }: Props) {
  const set = (patch: Partial<PlanValues>) => onChange({ ...values, ...patch });
  const ahead = daysBetween(minDate, values.date);
  const days = range(MAX_DAYS_AHEAD + 1).map((i) => addDays(minDate, i));

  // While "any", the wheels rest on a suggestion; turning either wheel sets the value from both.
  const startSet = Boolean(values.start);
  const suggested = suggestedStart();
  const [startH, startM] = startSet ? values.start.split(":") : [suggested.h, suggested.m];
  const lengthSet = Boolean(Number(values.durH) || Number(values.durM));
  const durH = lengthSet ? values.durH || "0" : SUGGESTED_LENGTH.h;
  const durM = lengthSet ? values.durM || "0" : SUGGESTED_LENGTH.m;
  const hasPlan = startSet || lengthSet;

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <span className={label}>Day</span>
          {ahead > AIR_QUALITY_DAYS && <span className="text-xs text-muted-foreground">No air-quality data this far ahead</span>}
        </div>
        <ToggleGroup
          value={[values.date]}
          onValueChange={(v) => v[0] && set({ date: v[0] })}
          disabled={disabled}
          spacing={6}
          className="-mx-1 w-auto max-w-none overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
        >
          {days.map((d, i) => {
            const date = new Date(`${d}T12:00Z`);
            const top = i === 0 ? "Today" : i === 1 ? "Tmrw" : date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
            return (
              <ToggleGroupItem
                key={d}
                value={d}
                aria-label={date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
                className="h-14 w-12 flex-col gap-0.5 rounded-xl border border-input bg-background px-0 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                <span className="text-[11px] leading-none font-medium opacity-80">{top}</span>
                <span className="text-lg leading-none font-semibold tabular-nums">{date.getUTCDate()}</span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <WheelField
          title="Start at" isSet={startSet} anyText="Any time" disabled={disabled}
          onReset={() => set({ start: "" })}
        >
          <WheelPicker
            items={HOURS} value={startH} aria-label="Start hour" disabled={disabled}
            onChange={(h) => set({ start: `${h}:${startM}` })}
          />
          <span className="text-lg font-semibold text-muted-foreground">:</span>
          <WheelPicker
            items={MINUTES} value={startM} aria-label="Start minute" disabled={disabled}
            onChange={(m) => set({ start: `${startH}:${m}` })}
          />
        </WheelField>
        <WheelField
          title="Run length" isSet={lengthSet} anyText="Any length" disabled={disabled}
          onReset={() => set({ durH: "", durM: "" })}
        >
          <WheelPicker
            items={DUR_HOURS} value={durH} aria-label="Run length hours" disabled={disabled}
            // 12 h is the maximum, so it can't have extra minutes.
            onChange={(h) => set({ durH: h, durM: h === "12" ? "0" : durM })}
          />
          <WheelPicker
            items={DUR_MINUTES} value={durM} aria-label="Run length minutes" disabled={disabled || durH === "12"}
            onChange={(m) => set({ durH: durH, durM: m })}
          />
        </WheelField>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">
        {hasPlan ? "Jev judges your plan." : "Any time and length: Jev picks the best window for you."}
      </p>
    </div>
  );
}
