/** Sound cues per reward, timed against the fx timelines. Pure data, so it is testable. */
import type { RewardItem } from '../domain/rewards';
import { BANNER, FINALE, PERFECT, RANKUP, TOAST } from '../fx/timeline';

export type Cue =
  | { t: number; sound: 'tick'; m: number }
  | { t: number; sound: 'blip'; m0: number; m1: number; dur: number }
  | { t: number; sound: 'bell'; m: number; dur: number }
  | { t: number; sound: 'stab'; notes: number[]; dur: number }
  | { t: number; sound: 'whoosh'; dur: number; up: boolean }
  | { t: number; sound: 'slam' }
  | { t: number; sound: 'glint' };

/** Achievement arpeggio from the video (Gmaj9 up the keyboard), one note per letter. */
const ARP = [67, 69, 71, 74, 78, 79, 81, 83, 86, 90, 91, 93, 95, 98];
const GMAJ9 = [55, 59, 62, 66, 69];
const B7S9 = [59, 63, 69, 74];
const D69 = [74, 78, 81, 83, 88];

function letters(text: string, start: number, gap: number, max = ARP.length): Cue[] {
  return [...text.replace(/ /g, '')].slice(0, max).map((_, i) => ({ t: start + i * gap, sound: 'tick', m: ARP[i % ARP.length]! }));
}

function bannerCues(title: string, offset: number, dur: number, short: boolean): Cue[] {
  const c: Cue[] = [
    { t: offset, sound: 'whoosh', dur: 0.2, up: true },
    { t: offset + BANNER.enter, sound: 'stab', notes: GMAJ9, dur: short ? 0.15 : 0.28 },
    ...letters(title, offset + BANNER.lettersAt, BANNER.letterGap),
    { t: offset + BANNER.shineAt, sound: 'glint' },
    { t: offset + dur - 0.2, sound: 'whoosh', dur: 0.25, up: false },
  ];
  if (!short) c.splice(1, 0, { t: offset + BANNER.enter, sound: 'slam' });
  return c;
}

function chime(notes: number[], at: number, gap = 0.06): Cue[] {
  return notes.map((m, i) => ({ t: at + i * gap, sound: 'bell', m, dur: 0.9 }));
}

export function cuesFor(item: RewardItem, still: boolean): Cue[] {
  if (still) {
    // Reduced motion: one soft chime instead of a sequence.
    return item.kind === 'toast' ? [{ t: 0, sound: 'blip', m0: 84, m1: 91, dur: 0.12 }] : chime([79, 86], 0);
  }
  let cues: Cue[] = [];
  switch (item.kind) {
    case 'toast':
      cues = [
        { t: 0.05, sound: 'blip', m0: 84, m1: 96, dur: 0.12 },
        { t: 0.15, sound: 'bell', m: 91, dur: 0.8 },
        { t: TOAST.dur - TOAST.leave, sound: 'whoosh', dur: 0.15, up: false },
      ];
      break;
    case 'banner':
      cues = bannerCues(item.title, 0, item.short ? BANNER.short : BANNER.full, item.short);
      break;
    case 'rankup':
      cues = [
        { t: 0, sound: 'whoosh', dur: 0.2, up: true },
        ...chime(D69, RANKUP.fillAt),
        { t: RANKUP.fillAt, sound: 'blip', m0: 72, m1: 84, dur: 0.15 },
      ];
      break;
    case 'perfectWeek': {
      const s = PERFECT.stats[0];
      cues = [
        { t: 0, sound: 'whoosh', dur: 0.6, up: true },
        { t: PERFECT.raysAt, sound: 'slam' },
        { t: PERFECT.cutIn[0], sound: 'stab', notes: B7S9, dur: 0.3 },
        { t: PERFECT.cutIn[0] + 0.55, sound: 'glint' },
        ...bannerCues('PERFECT WEEK', PERFECT.banner[0], PERFECT.banner[1] - PERFECT.banner[0], false),
        ...[0, 1, 2, 3, 4].map((i): Cue => ({ t: s + 0.2 + i * PERFECT.rowGap, sound: 'blip', m0: 72 + i * 2, m1: 79 + i * 2, dur: 0.12 })),
        ...(item.freezeEarned ? chime([91, 95, 98], s + PERFECT.freezeAt) : []),
      ];
      break;
    }
    case 'finale': {
      cues = [
        { t: 0, sound: 'stab', notes: GMAJ9, dur: 0.4 },
        ...letters('FALL 2026', 0.2, 0.07),
        ...letters('SEASON COMPLETE', 1.0, 0.05),
        { t: FINALE.shards[0], sound: 'whoosh', dur: 0.6, up: true },
        { t: FINALE.hero[0], sound: 'slam' },
        ...bannerCues('FALL 2026 CLEAR', FINALE.bannerAt, FINALE.hero[1] - FINALE.bannerAt, false),
        ...[0, 1, 2, 3, 4].flatMap((i) => chime([74 + i * 2], FINALE.ranks[0] + 0.3 + i * FINALE.rankGap)),
        ...[0, 1, 2, 3].map((i): Cue => ({ t: FINALE.numbers[0] + 0.2 + i * FINALE.numberGap, sound: 'stab', notes: [67 + i * 2, 74 + i * 2], dur: 0.15 })),
        { t: FINALE.iris[0], sound: 'whoosh', dur: 0.8, up: false },
        ...chime([67, 71, 74, 78, 81, 86], FINALE.iris[0] + 0.6, 0.12),
      ];
      break;
    }
    case 'more':
    case 'summary':
      cues = [{ t: 0, sound: 'blip', m0: 79, m1: 86, dur: 0.1 }];
      break;
  }
  return cues.sort((a, b) => a.t - b.t);
}
