type ScheduledMatch = {
  match_id: number;
  start_time_utc: string;
  schedule_precision?: "time" | "not_before" | "date_only" | "tba";
};

type PreviousResult = { match_id: number };

const GRACE_MS = {
  time: 3 * 60 * 60 * 1000,
  not_before: 3 * 60 * 60 * 1000,
  date_only: 36 * 60 * 60 * 1000,
  tba: 36 * 60 * 60 * 1000,
} as const;

/** A result wins over the schedule; otherwise retain live/delayed matches briefly. */
export function visibleUpcomingMatches<T extends ScheduledMatch>(
  matches: T[],
  previous: PreviousResult[],
  nowMs: number,
): T[] {
  const completedIds = new Set(previous.map(result => result.match_id));
  return matches.filter(match => {
    if (completedIds.has(match.match_id)) return false;
    const startMs = Date.parse(match.start_time_utc);
    if (!Number.isFinite(startMs)) return false;
    const precision = match.schedule_precision ?? "date_only";
    const graceMs = GRACE_MS[precision] ?? GRACE_MS.date_only;
    return nowMs <= startMs + graceMs;
  });
}
