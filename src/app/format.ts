import { formatDuration } from '../domain/dates';
import { totalReps } from '../domain/sessions';
import type { Exercise, SessionLog } from '../domain/types';

/** "18 / 30" or "0.75 / 1 MI". */
export function progressText(exercise: Exercise, session: SessionLog | undefined, target: number): string {
  if (exercise === 'run') return `${session?.distance ?? 0} / ${target} MI`;
  return `${totalReps(session?.sets)} / ${target}`;
}

export function sessionDetail(session: SessionLog): string {
  const parts: string[] = [];
  if (session.exercise === 'run') {
    parts.push(`${session.distance ?? 0} MI`);
  } else {
    const sets = session.sets ?? [];
    parts.push(`${totalReps(sets)} REPS`);
    if (sets.length > 1) parts.push(`(${sets.join('+')})`);
  }
  if (session.durationSec !== undefined) parts.push(formatDuration(session.durationSec));
  return parts.join(' ');
}
