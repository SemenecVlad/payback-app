/** "just now", "12 s ago", "3 min ago", "2 h ago". Clock skew (future times) reads as "just now". */
export function formatAge(isoTime: string, nowMs: number): string {
  const time = Date.parse(isoTime);
  if (Number.isNaN(time)) return 'unknown';
  const seconds = Math.floor((nowMs - time) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}
