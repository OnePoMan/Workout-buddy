import type { LogicalDay } from './types';

const DAY_MS = 86_400_000;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const WEEKDAY_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fromParts(y: number, m: number, d: number): LogicalDay {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** UTC midnight for a day. Day arithmetic is done in UTC so DST never shifts it. */
function toUtcMs(day: LogicalDay): number {
  const m = DAY_RE.exec(day);
  if (!m) throw new Error(`Invalid day: ${day}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUtcMs(ms: number): LogicalDay {
  const d = new Date(ms);
  return fromParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function isValidDay(s: unknown): s is LogicalDay {
  if (typeof s !== 'string' || !DAY_RE.test(s)) return false;
  return fromUtcMs(toUtcMs(s)) === s;
}

/** The logical day for a wall-clock moment: before `rolloverHour` it is still the previous day. */
export function logicalDay(now: Date, rolloverHour: number): LogicalDay {
  const day = fromParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return now.getHours() < rolloverHour ? addDays(day, -1) : day;
}

export function addDays(day: LogicalDay, n: number): LogicalDay {
  return fromUtcMs(toUtcMs(day) + n * DAY_MS);
}

/** b - a, in days. */
export function diffDays(a: LogicalDay, b: LogicalDay): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(day: LogicalDay): number {
  return (new Date(toUtcMs(day)).getUTCDay() + 6) % 7;
}

/** Monday of the day's week. */
export function weekStart(day: LogicalDay): LogicalDay {
  return addDays(day, -weekday(day));
}

export function sameWeek(a: LogicalDay, b: LogicalDay): boolean {
  return weekStart(a) === weekStart(b);
}

export function weekdayLabel(day: LogicalDay): string {
  return WEEKDAY_SHORT[weekday(day)]!;
}

/** "SAT • OCT 3" */
export function dayLabel(day: LogicalDay): string {
  const d = new Date(toUtcMs(day));
  return `${weekdayLabel(day)} • ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "1:05.3" style stopwatch text from seconds. */
export function formatDuration(sec: number, tenths = false): string {
  const total = Math.max(0, sec);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const base = `${m}:${pad(s)}`;
  return tenths ? `${base}.${Math.floor((total * 10) % 10)}` : base;
}
