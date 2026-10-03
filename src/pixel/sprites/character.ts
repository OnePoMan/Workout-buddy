/**
 * Pixel-puppet character, ported from achievement-video/character.py:
 * hand-drawn head and torso sprites, procedurally drawn jointed limbs.
 */
import { PixelBuffer, sprite, type Point } from '../buffer';
import { TRANSPARENT, type Color } from '../color';
import { C } from '../palette';

const PAL: Record<string, Color> = {
  o: C.ink, h: C.hair, H: C.hair_d, l: C.hair_l, L: C.hair_ll,
  s: C.skin, S: C.skin_d, D: C.skin_dd, b: C.blush,
  r: C.glass, R: C.glass_d, w: C.lens, e: C.eye, m: C.mouth,
  t: C.top, T: C.top_d, U: C.top_dd, y: C.top_l,
  p: C.pants, P: C.pants_d, k: C.sock, K: C.sock_d,
  W: C.white,
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

const TORSO = [
  '......oSSo......',
  '....ootWWtTo....',
  '..ootyyyttTTTo..',
  '.otyyttttttTTTo.',
  '.otytttttttTTTo.',
  '.otytttttttTTTo.',
  '.otyttttttttTTo.',
  '.otyttttttttTTo.',
  '.otytttttttTTUo.',
  '.otytttttttTTUo.',
  '..otttttttTTUo..',
  '..otttttttTTUo..',
  '..oytytytyTyUo..',
  '..oooooooooooo..',
  '..oppppppppPPo..',
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

function hand(b: PixelBuffer, x: number, y: number, r = 1): void {
  x = Math.round(x);
  y = Math.round(y);
  b.ellipse(x - r - 1, y - r - 1, x + r + 1, y + r + 1, C.ink);
  b.ellipse(x - r, y - r, x + r, y + r, C.skin);
  b.set(x - 1, y + 1, C.skin_d);
}

function foot(b: PixelBuffer, x: number, y: number): void {
  x = Math.round(x);
  y = Math.round(y);
  b.rect(x - 3, y - 3, x + 4, y, C.ink);
  b.rect(x - 2, y - 2, x + 4, y - 1, C.sock);
  b.set(x + 4, y, TRANSPARENT);
  b.line(x - 2, y - 1, x + 3, y - 1, C.sock_d);
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
  foot(b, ox + end(pose.legFar)[0], oy + end(pose.legFar)[1] + 2);
  limb(b, P(pose.armFar, bdy), C.top_d, null, 3);
  hand(b, ox + end(pose.armFar)[0], oy + end(pose.armFar)[1] + bdy);
  limb(b, P(pose.legNear), C.pants, C.pants_d, 5);
  foot(b, ox + end(pose.legNear)[0], oy + end(pose.legNear)[1] + 2);
  b.blit(torso(), ox - 8 + (pose.torsoDx ?? 0), oy - 39 + bdy);
  b.blit(head(pose.head), ox - 11 + (pose.headDx ?? 0), oy - 58 + bdy + (pose.headDy ?? 0));
  for (const it of pose.itemsMid ?? []) it(b, ox, oy + bdy);
  limb(b, P(pose.armNear, bdy), C.top, C.top_d, 3);
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
