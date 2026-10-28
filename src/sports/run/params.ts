import { UserError } from "@/shared/errors";

/** Parse an HH:MM query parameter into minutes after midnight; empty means "not set". */
export function parseTime(value: string | null, name: string): number | undefined {
  if (!value) return undefined;
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(value);
  if (!m) throw new UserError(`${name} must look like HH:MM`);
  const [hour, minute] = [Number(m[1]), Number(m[2])];
  if (hour > 23 || minute > 59) throw new UserError(`${name} must be a time between 00:00 and 23:59`);
  return hour * 60 + minute;
}

