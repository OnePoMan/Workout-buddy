import type { RewardItem } from '../domain/rewards';
import type { PixelBuffer } from '../pixel/buffer';
import { drawBanner } from './banner';
import { scrim } from './common';
import { drawRankUp } from './rankup';
import { BANNER, RANKUP, SCRIM_FADE, STILL_DUR, TOAST } from './timeline';
import { drawToast } from './toast';

/** Toasts never block input; everything else waits for its time or a tap. */
export function isBlocking(item: RewardItem): boolean {
  return item.kind !== 'toast';
}

/** Seconds the item stays up. The "more" card waits for the user. */
export function rewardDuration(item: RewardItem, still: boolean): number {
  switch (item.kind) {
    case 'toast':
      return still ? STILL_DUR.toast : TOAST.dur;
    case 'banner':
      return still ? STILL_DUR.banner : item.short ? BANNER.short : BANNER.full;
    case 'rankup':
      return still ? STILL_DUR.rankup : RANKUP.dur;
    case 'more':
      return Infinity;
  }
}

function seedFor(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Draws one reward frame onto a cleared overlay buffer. */
export function renderReward(buf: PixelBuffer, item: RewardItem, t: number, still: boolean): void {
  buf.data.fill(0);
  const dur = rewardDuration(item, still);
  if (isBlocking(item)) {
    const fadeIn = still ? 1 : Math.min(1, t / SCRIM_FADE);
    const fadeOut = still || !Number.isFinite(dur) ? 1 : Math.min(1, (dur - t) / SCRIM_FADE);
    scrim(buf, Math.min(fadeIn, fadeOut));
  }
  switch (item.kind) {
    case 'toast':
      drawToast(buf, t, { title: item.title, sub: item.sub, seed: seedFor(item.key) }, dur, still);
      break;
    case 'banner':
      drawBanner(
        buf,
        t,
        { header: item.header, title: item.title, subtitle: item.subtitle, icon: item.icon, seed: seedFor(item.key) },
        dur,
        still,
      );
      break;
    case 'rankup':
      drawRankUp(buf, t, { label: item.label, from: item.from, to: item.to, maxRank: item.maxRank }, dur, still);
      break;
    case 'more':
      break;
  }
}
