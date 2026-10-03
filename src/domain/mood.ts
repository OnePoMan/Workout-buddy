import { COUNTERS, counterTotal } from './counters';
import { exerciseFor, inSeason } from './schedule';
import { isComplete, pendingMakeups } from './sessions';
import type { LogicalDay, SaveFile } from './types';

export type Pose = 'stand' | 'sit';
export type Face = 'normal' | 'happy' | 'sideeye' | 'look' | 'smile';

export interface Mood {
  pose: Pose;
  face: Face;
  /** Today's counter totals, shown as props in the room. */
  cans: number;
  wrappers: number;
}

/**
 * The character's pose and face for today (SPEC §6.1). Face priority:
 * over a cap > completed a session today > make-ups pending > rest day > idle.
 */
export function characterMood(save: SaveFile, today: LogicalDay): Mood {
  const { settings, sessions, counters } = save;
  const season = inSeason(today, settings);
  const rest = !season || exerciseFor(today) === null;
  const overCap = COUNTERS.some((c) => counterTotal(counters, c.id, today) > (settings.caps[c.id] ?? c.defaultCap));
  const completedToday = sessions.some((s) => s.loggedOn === today && isComplete(s));
  const pending = season && pendingMakeups(today, settings, sessions).length > 0;

  let face: Face = 'normal';
  if (overCap) face = 'sideeye';
  else if (completedToday) face = 'happy';
  else if (pending) face = 'look';
  else if (rest) face = 'smile';
  return {
    pose: rest ? 'sit' : 'stand',
    face,
    cans: counterTotal(counters, 'dr_pepper', today),
    wrappers: counterTotal(counters, 'snacks', today),
  };
}

export function describeMood(mood: Mood): string {
  const props = [
    mood.cans ? `${mood.cans} can${mood.cans === 1 ? '' : 's'} of Diet Dr Pepper on the counter` : '',
    mood.wrappers ? `${mood.wrappers} snack wrapper${mood.wrappers === 1 ? '' : 's'} on the table` : '',
  ].filter(Boolean);
  const where = mood.pose === 'sit' ? 'relaxing at the table' : 'standing in the apartment';
  const faces: Record<Face, string> = {
    normal: 'ready to go',
    happy: 'happy about today’s workout',
    sideeye: 'giving you a side-eye about the counters',
    look: 'looking at you about a make-up session',
    smile: 'smiling',
  };
  const scene = `Your character is ${where}, ${faces[mood.face]}.`;
  return props.length ? `${scene} Today: ${props.join(' and ')}.` : scene;
}
