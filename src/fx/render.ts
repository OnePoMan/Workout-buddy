import { unlockNote, type RewardItem } from '../domain/rewards';
import type { PixelBuffer } from '../pixel/buffer';
import type { Outfit } from '../pixel/sprites/character';
import { drawBanner } from './banner';
import { drawRankUp } from './rankup';
import { drawFinale } from './finale';
import { drawPerfectWeek } from './perfectWeek';
import { BANNER, FINALE, PERFECT, RANKUP, STILL_DUR, TOAST } from './timeline';
import { drawToast } from './toast';

/** Toasts never block input; everything else waits for its time or a tap. */
export function isBlocking(item: RewardItem): boolean {
  return item.kind !== 'toast';
}

/** Items drawn as DOM cards rather than on the canvas. */
export function isCard(item: RewardItem): boolean {
  return item.kind === 'more' || item.kind === 'summary';
}

/** Seconds the item stays up. Cards wait for the user. */
export function rewardDuration(item: RewardItem, still: boolean): number {
  switch (item.kind) {
    case 'toast':
      return still ? STILL_DUR.toast : TOAST.dur;
    case 'banner':
      return still ? STILL_DUR.banner : item.short ? BANNER.short : BANNER.full;
    case 'rankup':
      return still ? STILL_DUR.rankup : RANKUP.dur;
    case 'perfectWeek':
      return still ? STILL_DUR.perfectWeek : PERFECT.dur;
    case 'finale':
      return still ? STILL_DUR.finale : FINALE.dur;
    case 'more':
    case 'summary':
      return Infinity;
  }
}

function seedFor(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface RenderContext {
  /** The character's current look, for cut-ins and the finale. */
  outfit: Omit<Outfit, 'sway'>;
}

/** Draws one reward frame onto a cleared overlay buffer. */
export function renderReward(buf: PixelBuffer, item: RewardItem, t: number, still: boolean, ctx: RenderContext): void {
  // The dim behind blocking items is a CSS background on the overlay, so DOM
  // text underneath stays smooth instead of being dithered.
  buf.data.fill(0);
  const dur = rewardDuration(item, still);
  const seed = seedFor(item.key);
  const footer = unlockNote(item);
  switch (item.kind) {
    case 'toast':
      drawToast(buf, t, { title: item.title, sub: item.sub, seed }, dur, still);
      break;
    case 'banner':
      drawBanner(
        buf,
        t,
        {
          header: item.header,
          title: item.title,
          subtitle: footer ? [...item.subtitle.slice(0, 1), footer] : item.subtitle,
          icon: item.icon,
          seed,
        },
        dur,
        still,
      );
      break;
    case 'rankup':
      drawRankUp(buf, t, { label: item.label, from: item.from, to: item.to, maxRank: item.maxRank, footer }, dur, still);
      break;
    case 'perfectWeek':
      drawPerfectWeek(
        buf,
        t,
        { count: item.count, weekPoints: item.weekPoints, freezeEarned: item.freezeEarned, outfit: ctx.outfit, seed, footer },
        still,
      );
      break;
    case 'finale':
      drawFinale(buf, t, { recap: item.recap, outfit: ctx.outfit, seed }, still);
      break;
    case 'more':
    case 'summary':
      break;
  }
}
