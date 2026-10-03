/**
 * Pixel-puppet character, ported from achievement-video/character.py:
 * hand-drawn head and torso sprites, procedurally drawn jointed limbs.
 */
import { PixelBuffer, sprite, type Point } from '../buffer';
import type { Color } from '../color';
import { C } from '../palette';

const PAL: Record<string, Color> = {
  o: C.ink, h: C.hair, H: C.hair_d, l: C.hair_l, L: C.hair_ll,
  s: C.skin, S: C.skin_d, D: C.skin_dd, b: C.blush,
  r: C.glass, R: C.glass_d, w: C.lens, e: C.eye, m: C.mouth,
  t: C.top, T: C.top_d, U: C.top_dd, y: C.top_l,
  p: C.pants, P: C.pants_d, k: C.sock, K: C.sock_d,
  W: C.white, z: C.zip, g: C.gold, n: C.shoe, d: C.sole,
};

// Head facing right (3/4). Chin at row 18; neck pivot col 10.
// {} = upper eye row, [] = lower eye row, <> = mouth (2 chars each).
const HEAD_BASE = [
  '........oooooo.......',
  '......oohhhhhhoo.....',
  '.....ohhhhlllhhhoo...',
  '....ohhhhllLLllhhho..',
  '...ohhhhhhllllhhhhho.',
  '...ohhhhhhhhhhhhhhho.',
  '..ohhhhhhhhhhhhhhhhho',
  '..ohhhhhhhhhhhhHhhhho',
  '..ohhhhhhHHhhhHHhhhho',
  '.ohhhhhhHsshhHsssshho',
  '.ohhhhhHsssssHssssshho',
  '.ohhhhhSrrrrsrrrrsHho',
  '.ohhhhhSr{}rrr{}rsHho',
  '.ohhhhhSr[]rsr[]rsHho',
  '.oHhhhhSsrrssssrrsHho',
  '.oHhhhhhSbsssssbssHho',
  'ohHhhhhhSsss<>sssShho',
  'ohHhHhhhhSsssssssShHo',
  'ohHhHhhhhHSSssssSohho',
  'ohhHhHhhHhoSSSSSo.oHo',
  'ohHlhHhlho..SSS...oho',
  'ohhHhHhhHo........oHo',
  '.ohHlhHlHo........oHo',
  'ohHhoHhHo.........oo.',
  '.oHo.oHo.............',
  '..o...o..............',
];

export type Expression = 'normal' | 'blink' | 'happy' | 'look' | 'open' | 'smile' | 'sideeye';

/** [upper eye row, lower eye row, mouth]. */
const EYES: Record<Expression, [string, string, string]> = {
  normal: ['se', 'se', 'DD'],
  blink: ['ss', 'ee', 'ss'],
  happy: ['ss', 'ee', 'mm'],
  look: ['es', 'es', 'sm'], // looking toward the camera
  open: ['se', 'se', 'mm'],
  smile: ['se', 'se', 'mm'],
  // New for Workout Buddy: heavy lids, eyes on the camera, flat mouth.
  sideeye: ['DD', 'es', 'sD'],
};

const BLUSHING: ReadonlySet<Expression> = new Set(['happy', 'smile']);

export function headRows(expr: Expression): string[] {
  const [up, lo, mouth] = EYES[expr];
  const rows = HEAD_BASE.map((r) => r.replaceAll('{}', up).replaceAll('[]', lo).replaceAll('<>', mouth));
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(w, '.'));
}

const headCache = new Map<Expression, PixelBuffer>();

export function head(expr: Expression = 'normal'): PixelBuffer {
  let im = headCache.get(expr);
  if (!im) {
    im = sprite(headRows(expr), PAL);
    if (BLUSHING.has(expr)) for (const bx of [8, 9, 15, 16]) im.set(bx, 15, C.blush);
    headCache.set(expr, im);
  }
  return im;
}

// Track jacket open at the neck over a pink tank (k), centre zip (z) with a
// gold pull (g), elastic hem, then jogger waistband with drawstrings (W).
const TORSO = [
  '......oSSo......',
  '....otykkyTo....',
  '..ootyykkytTTo..',
  '.otyytttgttTTTo.',
  '.otyttttzttTTTo.',
  '.otyttttzttTTTo.',
  '.otyttttzttTTTo.',
  '.otyttttzttTTTo.',
  '.otyttttzttTTUo.',
  '.otyttttzttTTUo.',
  '..otttttzTTTUo..',
  '..otttttzTTTUo..',
  '..oTTTTTzTTTUo..',
  '..oooooooooooo..',
  '..oppppWpWppPo..',
  '..opppppppPPPo..',
];

let torsoCache: PixelBuffer | null = null;
export function torso(): PixelBuffer {
  torsoCache ??= sprite(TORSO, PAL);
  return torsoCache;
}

function limb(b: PixelBuffer, pts: Point[], fill: Color, shade: Color | null, width: number): void {
  b.polyline(pts, C.ink, width + 2);
  b.polyline(pts, fill, width);
  if (shade !== null) {
    // 1px shade along the lower/back edge, then re-fill the core.
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i]!;
      const [x1, y1] = pts[i + 1]!;
      b.line(x0 - 1, y0 + 1, x1 - 1, y1 + 1, shade);
    }
    b.polyline(pts, fill, Math.max(width - 2, 1));
  }
}

/** Sleeve pushed up to the elbow: jacket on the upper arm, bare forearm. */
function arm(b: PixelBuffer, pts: Point[], sleeve: Color, forearm: Color, shade: Color | null): void {
  const [sh, el, ha] = pts as [Point, Point, Point];
  b.polyline(pts, C.ink, 5);
  b.line(el[0], el[1], ha[0], ha[1], forearm, 3);
  b.line(sh[0], sh[1], el[0], el[1], sleeve, 3);
  if (shade !== null) {
    b.line(sh[0] - 1, sh[1] + 1, el[0] - 1, el[1] + 1, shade);
    b.line(sh[0], sh[1], el[0], el[1], sleeve);
  }
}

/** Joggers: side stripe down the near leg and a ribbed cuff at the ankle. */
function joggerDetails(b: PixelBuffer, pts: Point[], stripe: boolean): void {
  const ankle = pts[pts.length - 1]!;
  if (stripe) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i]!;
      const [x1, y1] = pts[i + 1]!;
      // Stop the stripe short of the cuff.
      const end = i + 2 === pts.length ? 0.7 : 1;
      b.line(x0, y0 + 1, x0 + (x1 - x0) * end, y0 + (y1 - y0) * end, C.stripe);
    }
  }
  b.line(ankle[0], ankle[1] - 1, ankle[0], ankle[1], C.pants_d, 5);
}

function hand(b: PixelBuffer, x: number, y: number, r = 1): void {
  x = Math.round(x);
  y = Math.round(y);
  b.ellipse(x - r - 1, y - r - 1, x + r + 1, y + r + 1, C.ink);
  b.ellipse(x - r, y - r, x + r, y + r, C.skin);
  b.set(x - 1, y + 1, C.skin_d);
}

// White sneaker pointing right, pink sock at the heel and a pink side accent.
const SNEAKER = [
  '..oooo...',
  '.okWnno..',
  'oknnnnnoo',
  'onnnkkkno',
  'odddddddo',
  '.ooooooo.',
];

let sneakerCache: PixelBuffer | null = null;

/** Sneaker with its sole on y and heel at x - 3. */
function foot(b: PixelBuffer, x: number, y: number): void {
  sneakerCache ??= sprite(SNEAKER, PAL);
  b.blit(sneakerCache, Math.round(x) - 3, Math.round(y) - 5);
}

// Local frame: 60x80 canvas, feet baseline at y=76, body centre x=28.
export const CW = 60;
export const CH = 80;
export const BX = 28;
export const BY = 76;

export type Item = (b: PixelBuffer, ox: number, oy: number) => void;

export interface Pose {
  head: Expression;
  bodyDy?: number;
  headDx?: number;
  headDy?: number;
  torsoDx?: number;
  /** [shoulder, elbow, hand] relative to (BX, BY). */
  armNear: Point[];
  armFar: Point[];
  /** [hip, knee, ankle]. */
  legNear: Point[];
  legFar: Point[];
  facing?: 1 | -1;
  itemsBack?: Item[];
  itemsMid?: Item[];
  itemsFront?: Item[];
}

export function renderCharacter(pose: Pose): PixelBuffer {
  const b = new PixelBuffer(CW, CH);
  const ox = BX;
  const oy = BY;
  const bdy = pose.bodyDy ?? 0;
  const P = (pts: Point[], dy = 0): Point[] => pts.map(([x, y]) => [ox + x, oy + y + dy] as const);
  const end = (pts: Point[]) => pts[pts.length - 1]!;

  for (const it of pose.itemsBack ?? []) it(b, ox, oy + bdy);
  limb(b, P(pose.legFar), C.pants_d, null, 5);
  joggerDetails(b, P(pose.legFar), false);
  foot(b, ox + end(pose.legFar)[0], oy + end(pose.legFar)[1] + 2);
  arm(b, P(pose.armFar, bdy), C.top_d, C.skin_d, null);
  hand(b, ox + end(pose.armFar)[0], oy + end(pose.armFar)[1] + bdy);
  limb(b, P(pose.legNear), C.pants, C.pants_d, 5);
  joggerDetails(b, P(pose.legNear), true);
  foot(b, ox + end(pose.legNear)[0], oy + end(pose.legNear)[1] + 2);
  b.blit(torso(), ox - 8 + (pose.torsoDx ?? 0), oy - 39 + bdy);
  b.blit(head(pose.head), ox - 11 + (pose.headDx ?? 0), oy - 58 + bdy + (pose.headDy ?? 0));
  for (const it of pose.itemsMid ?? []) it(b, ox, oy + bdy);
  arm(b, P(pose.armNear, bdy), C.top, C.skin, C.top_d);
  hand(b, ox + end(pose.armNear)[0], oy + end(pose.armNear)[1] + bdy);
  for (const it of pose.itemsFront ?? []) it(b, ox, oy + bdy);
  return (pose.facing ?? 1) < 0 ? b.flipX() : b;
}

// ------------------------------------------------------------ pose library
export const SH_N: Point = [-5, -34];
export const SH_F: Point = [5, -34];
export const HIP_N: Point = [-2, -21];
export const HIP_F: Point = [3, -21];

/** `breath` is a phase in [0, 1). */
export function stand(breath = 0, expr: Expression = 'normal', over: Partial<Pose> = {}): Pose {
  const b = Math.round(Math.sin(breath * 2 * Math.PI) * 0.6);
  return {
    bodyDy: b,
    head: expr,
    armNear: [SH_N, [-6, -26], [-5, -19]],
    armFar: [SH_F, [7, -26], [7, -19]],
    legNear: [HIP_N, [-2, -11], [-2, -2]],
    legFar: [HIP_F, [3, -11], [3, -2]],
    ...over,
  };
}

/** Seated; hips on a seat at y=-15. */
export function sit(expr: Expression = 'normal', over: Partial<Pose> = {}): Pose {
  return {
    bodyDy: 7,
    head: expr,
    armNear: [SH_N, [-3, -21], [5, -20]],
    armFar: [SH_F, [9, -22], [12, -22]],
    legNear: [[-1, -14], [10, -14], [10, -2]],
    legFar: [[4, -14], [14, -14], [13, -2]],
    ...over,
  };
}

/** Top-left of the character canvas so its feet centre lands on (cx, floorY). */
export function characterOrigin(pose: Pose, cx: number, floorY: number): [number, number] {
  return [(pose.facing ?? 1) > 0 ? cx - BX : cx - (CW - 1 - BX), floorY - BY];
}

export function placeCharacter(dst: PixelBuffer, pose: Pose, cx: number, floorY: number): void {
  const [x, y] = characterOrigin(pose, cx, floorY);
  dst.blit(renderCharacter(pose), x, y);
}
