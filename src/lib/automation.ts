/**
 * Scheduled payments.
 *
 * Pinna has no server and no key of its own, so a schedule cannot sign by
 * itself. A rule describes what to send and when it is next due; when the app
 * is open and a run is due, Pinna puts it in front of you ready to sign.
 * Nothing is ever sent without your wallet.
 */

export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export interface AutomationRule {
  id: string;
  title: string;
  /** Who gets paid. */
  name: string;
  address: `0x${string}`;
  amount: string;
  /** The note written into each transfer's memo. */
  memo: string;
  frequency: Frequency;
  /** Time of day the run is due, "HH:MM" in local time. */
  timeOfDay: string;
  /** First day the rule may run, as YYYY-MM-DD. */
  startsOn: string;
  enabled: boolean;
  createdAt: string;
  /** The last run that was signed, so the next one can be worked out. */
  lastRunAt?: string;
  lastRunTxHash?: string;
  runCount: number;
}

export const FREQUENCIES: Frequency[] = ["daily", "weekly", "monthly", "yearly"];

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: "Every day",
  weekly: "Every week",
  monthly: "Every month",
  yearly: "Every year",
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimeOfDay(value: string): boolean {
  return TIME_RE.test(String(value ?? "").trim());
}

/** Local date parts for a date, so times are compared in the user's own zone. */
function parts(date: Date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
  };
}

function at(date: Date, hours: number, minutes: number): Date {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

/**
 * The next moment a rule is due, as a local Date.
 *
 * The start date fixes the rhythm: daily runs every day at the chosen time,
 * weekly on the weekday the rule started, monthly on that day of the month
 * (clamped for short months), yearly on that date. The next run is the first
 * occurrence after both now and the last time the rule was signed.
 */
export function nextRunAt(rule: AutomationRule, from: Date = new Date()): Date {
  const [h, m] = (isValidTimeOfDay(rule.timeOfDay) ? rule.timeOfDay : "09:00")
    .split(":")
    .map((n) => parseInt(n, 10));

  const start = rule.startsOn ? new Date(`${rule.startsOn}T00:00:00`) : new Date(rule.createdAt);
  const anchor = Number.isNaN(start.getTime()) ? new Date(rule.createdAt) : start;

  // The floor is whichever is later: right now, or the last run.
  let floor = from;
  if (rule.lastRunAt) {
    const last = new Date(rule.lastRunAt);
    if (!Number.isNaN(last.getTime()) && last > floor) floor = last;
  }

  let candidate = at(anchor, h, m);
  let guard = 0;
  while (candidate <= floor && guard < 5000) {
    candidate = advance(candidate, rule.frequency, anchor);
    guard += 1;
  }
  return candidate;
}

function advance(date: Date, frequency: Frequency, anchor: Date): Date {
  const next = new Date(date);
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      return next;
    case "weekly":
      next.setDate(next.getDate() + 7);
      return next;
    case "monthly": {
      const day = anchor.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(day, daysInMonth(next.getFullYear(), next.getMonth())));
      return next;
    }
    case "yearly": {
      const month = anchor.getMonth();
      const day = anchor.getDate();
      next.setDate(1);
      next.setFullYear(next.getFullYear() + 1);
      next.setMonth(month);
      next.setDate(Math.min(day, daysInMonth(next.getFullYear(), month)));
      return next;
    }
  }
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * The most recent occurrence at or before `now`, or null when the rule has
 * not started yet. This is the run that may be waiting to be signed.
 */
export function previousRunAt(rule: AutomationRule, now: Date = new Date()): Date | null {
  const [h, m] = (isValidTimeOfDay(rule.timeOfDay) ? rule.timeOfDay : "09:00")
    .split(":")
    .map((n) => parseInt(n, 10));

  const start = rule.startsOn ? new Date(`${rule.startsOn}T00:00:00`) : new Date(rule.createdAt);
  const anchor = Number.isNaN(start.getTime()) ? new Date(rule.createdAt) : start;

  let candidate = at(anchor, h, m);
  if (candidate > now) return null;

  let guard = 0;
  for (;;) {
    const next = advance(candidate, rule.frequency, anchor);
    if (next > now || guard > 5000) return candidate;
    candidate = next;
    guard += 1;
  }
}

/**
 * A rule is due when its most recent occurrence has not been signed yet —
 * either it has never run, or the last run was before that occurrence.
 */
export function isDue(rule: AutomationRule, now: Date = new Date()): boolean {
  if (!rule.enabled) return false;
  const previous = previousRunAt(rule, now);
  if (!previous) return false;
  if (!rule.lastRunAt) return true;
  const last = new Date(rule.lastRunAt);
  if (Number.isNaN(last.getTime())) return true;
  return last < previous;
}

export function dueRules(rules: AutomationRule[], now: Date = new Date()): AutomationRule[] {
  return rules.filter((rule) => isDue(rule, now));
}

/** How many times a rule would have come round between two moments. */
export function occurrencesBetween(
  rule: AutomationRule,
  from: Date,
  to: Date
): number {
  let count = 0;
  let cursor = new Date(from);
  let guard = 0;
  while (guard < 5000) {
    const next = nextRunAt({ ...rule, lastRunAt: cursor.toISOString() }, cursor);
    if (next > to) break;
    count += 1;
    cursor = next;
    guard += 1;
  }
  return count;
}

export function describeRule(rule: AutomationRule): string {
  const when = `${FREQUENCY_LABEL[rule.frequency]} at ${rule.timeOfDay}`;
  return rule.enabled ? when : `${when} · paused`;
}
