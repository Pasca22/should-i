/** "3 h ago": relative, because the server's time zone isn't the viewer's. */
export function ago(date: Date | null | undefined) {
  if (!date) return "–";
  const min = Math.round((Date.now() - date.getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  if (min < 48 * 60) return `${Math.round(min / 60)} h ago`;
  return `${Math.round(min / 1440)} days ago`;
}
