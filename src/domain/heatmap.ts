import { addDays, weekStart, weekday } from './dates';
import type { Snapshot, SlotState } from './progress';
import { exerciseFor, inSeason } from './schedule';
import type { Exercise, LogicalDay, Settings } from './types';

/** 0 = nothing, 1 = under 50%, 2 = 50–99%, 3 = complete. */
export type HeatLevel = 0 | 1 | 2 | 3;

export type HeatState = SlotState | 'rest' | 'outside';

export interface HeatCell {
  day: LogicalDay;
  exercise: Exercise | null;
  fraction: number;
  state: HeatState;
  level: HeatLevel;
  isToday: boolean;
}

export interface HeatWeek {
  start: LogicalDay;
  /** Month label for the column ("OCT"), set where a new month starts. */
  month: string | null;
  cells: HeatCell[];
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

export function heatLevel(fraction: number): HeatLevel {
  if (fraction <= 0) return 0;
  if (fraction < 0.5) return 1;
  if (fraction < 1) return 2;
  return 3;
}

function monthOf(day: LogicalDay): string {
  return MONTHS[Number(day.slice(5, 7)) - 1]!;
}

/** The whole season as week columns (Mon–Sun rows), using the snapshot's slot states. */
export function buildHeatmap(snapshot: Snapshot, settings: Settings, today: LogicalDay): HeatWeek[] {
  const known = new Map(snapshot.weeks.flatMap((w) => w.slots.map((s) => [s.day, s] as const)));
  const weeks: HeatWeek[] = [];
  let lastMonth: string | null = null;
  for (let w = weekStart(settings.seasonStart); w <= settings.seasonEnd; w = addDays(w, 7)) {
    const cells: HeatCell[] = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(w, i);
      const base = { day, isToday: day === today };
      if (!inSeason(day, settings)) {
        cells.push({ ...base, exercise: null, fraction: 0, state: 'outside', level: 0 });
      } else if (weekday(day) === 6) {
        cells.push({ ...base, exercise: null, fraction: 0, state: 'rest', level: 0 });
      } else {
        const slot = known.get(day);
        const fraction = slot?.fraction ?? 0;
        cells.push({
          ...base,
          exercise: exerciseFor(day),
          fraction,
          state: slot?.state ?? 'future',
          level: heatLevel(fraction),
        });
      }
    }
    const firstIn = cells.find((c) => c.state !== 'outside')?.day ?? w;
    const month = monthOf(firstIn);
    weeks.push({ start: w, month: month !== lastMonth ? month : null, cells });
    lastMonth = month;
  }
  return weeks;
}

export const STATE_LABEL: Record<HeatState, string> = {
  done: 'Done',
  pending: 'Open this week',
  missed: 'Missed',
  frozen: 'Covered by a freeze',
  future: 'Upcoming',
  rest: 'Rest day',
  outside: 'Outside the season',
};
