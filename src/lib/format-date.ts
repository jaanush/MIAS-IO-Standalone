import { format, formatDistanceToNow } from "date-fns";

/** Format a date as "25 Mar 2026" */
export function formatDate(date: Date | string): string {
  return format(new Date(date), "d MMM yyyy");
}

/** Format a date as "25 Mar 2026, 14:30" */
export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "d MMM yyyy, HH:mm");
}

/** Format as relative time: "3 hours ago", "2 days ago" */
export function formatRelative(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}
