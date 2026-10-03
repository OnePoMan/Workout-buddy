/**
 * The apartment, recomposed at 240x160 for a portrait phone from
 * achievement-video/background.py: window and curtains, pendant lamp,
 * bistro table and chairs, poster, kitchen corner and fridge.
 */
import { PixelBuffer, sprite, type Point } from '../buffer';
import { hex } from '../color';
import { ditherVGrad, glowLayer } from '../dither';
import { C, P } from '../palette';
import { mulberry32 } from '../rng';

export const ROOM_W = 240;
export const ROOM_H = 160;
/** Feet baseline for characters standing on the floor. */
export const FLOOR_Y = 142;
const FLOOR_TOP = 118;

export const TABLE_X = 56;
export const TABLE_Y = 120;
export const CHAIR_L_X = 30;
export const CHAIR_R_X = 108;
export const CHAIR_Y = 110;
/** Where the character stands, and sits (right chair, facing the table). */
export const STAND_X = 140;
export const SIT_X = CHAIR_R_X + 14;
/** Clear counter space for props (Dr Pepper cans in M5): x range and surface y. */
export const COUNTER_SLOT = { x0: 160, x1: 184, y: 99 } as const;

function star(cx: number, cy: number, rOut: number, rIn: number): Point[] {
  return Array.from({ length: 10 }, (_, k) => {
    const r = k % 2 === 0 ? rOut : rIn;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
}

function wallAndFloor(d: PixelBuffer): void {
  for (let x = 0; x < ROOM_W; x += 12) d.rect(x, 0, x + 5, FLOOR_TOP - 6, P.wall_d);
  for (let x = 0; x < ROOM_W; x += 12) {
    for (let y = 8; y < FLOOR_TOP - 6; y += 14) {
      d.set(x + 8, y, P.wall_l);
      d.set(x + 2, y + 7, P.wall_l);
    }
  }
  d.rect(0, 0, ROOM_W, 3, P.trim);
  d.rect(0, 4, ROOM_W, 4, P.wall_l);

  d.rect(0, FLOOR_TOP, ROOM_W, ROOM_H, P.floor);
  let i = 0;
  for (let y = FLOOR_TOP + 4; y < ROOM_H; y += 7, i++) {
    d.line(0, y, ROOM_W, y, P.floor_seam);
    d.line(0, y + 1, ROOM_W, y + 1, P.floor_l);
    for (let x = (i * 23) % 40; x < ROOM_W; x += 40 + (i % 3) * 6) d.line(x, y + 1, x, y + 6, P.floor_seam);
  }
  d.rect(0, FLOOR_TOP - 6, ROOM_W, FLOOR_TOP - 1, P.base);
  d.line(0, FLOOR_TOP - 6, ROOM_W, FLOOR_TOP - 6, P.cab_l);
  d.line(0, FLOOR_TOP - 1, ROOM_W, FLOOR_TOP - 1, P.base_d);
  d.line(0, FLOOR_TOP, ROOM_W, FLOOR_TOP, P.floor_d);
}

function rug(d: PixelBuffer): void {
  d.ellipse(30, 136, 118, 152, P.rug_d);
  d.ellipse(33, 137, 115, 151, P.rug);
  d.ellipse(48, 140, 100, 148, P.rug_c);
  d.ellipse(62, 143, 86, 145, P.rug);
  for (let a = 0; a < 360; a += 24) {
    d.set(74 + 42 * Math.cos((a * Math.PI) / 180), 144 + 7 * Math.sin((a * Math.PI) / 180), P.floor_l);
  }
}

export const WINDOW = { x0: 14, y0: 24, x1: 62, y1: 78 } as const;
/** Neon sign pixels in the window (they flicker). */
export const NEON = { x0: 27, x1: 33, y: 69 } as const;

function windowView(d: PixelBuffer, rnd: () => number): void {
  const { x0, y0, x1, y1 } = WINDOW;
  d.rect(x0 - 4, y0 - 4, x1 + 4, y1 + 4, P.frame_d);
  d.rect(x0 - 3, y0 - 3, x1 + 3, y1 + 3, P.frame);
  ditherVGrad(d, [x0, y0, x1 + 1, y1 + 1], [
    [0, P.sky0],
    [0.3, P.sky1],
    [0.55, P.sky2],
    [0.78, P.sky3],
    [1, P.sky4],
  ]);
  for (let k = 0; k < 9; k++) {
    const x = x0 + 2 + Math.floor(rnd() * (x1 - x0 - 3));
    const y = y0 + 2 + Math.floor(rnd() * 16);
    d.set(x, y, rnd() < 0.5 ? C.white : P.sky2);
  }
  d.ellipse(48, 29, 56, 37, P.moon);
  d.ellipse(50, 27, 58, 35, P.sky0);
  // far skyline
  for (let x = x0; x < x1; ) {
    const bw = 5 + Math.floor(rnd() * 6);
    const bh = 12 + Math.floor(rnd() * 16);
    d.rect(x, y1 - bh, Math.min(x + bw, x1), y1, P.city_l);
    x += bw + 1;
  }
  // near skyline with lit windows
  for (let x = x0; x < x1; ) {
    const bw = 7 + Math.floor(rnd() * 7);
    const bh = 9 + Math.floor(rnd() * 13);
    const xe = Math.min(x + bw, x1);
    d.rect(x, y1 - bh, xe, y1, P.city);
    d.line(x, y1 - bh, xe, y1 - bh, P.city_l);
    for (let yy = y1 - bh + 3; yy < y1 - 1; yy += 4) {
      for (let xx = x + 2; xx < xe - 1; xx += 3) {
        if (rnd() < 0.38) d.set(xx, yy, rnd() < 0.75 ? P.win_lit : P.win_cy);
      }
    }
    x += bw + 1;
  }
  d.rect(NEON.x0 - 1, NEON.y - 2, NEON.x1 + 1, NEON.y + 3, P.city_d);
  d.line(NEON.x0, NEON.y, NEON.x1, NEON.y, P.neon_pink);
  d.line(NEON.x0, NEON.y + 2, NEON.x1, NEON.y + 2, P.win_cy);
  // mullions
  const mx = Math.floor((x0 + x1) / 2);
  d.rect(mx - 1, y0, mx + 1, y1, P.frame);
  d.rect(x0, 50, x1, 51, P.frame);
  // sill + cactus
  d.rect(x0 - 5, y1 + 4, x1 + 5, y1 + 7, P.frame);
  d.line(x0 - 5, y1 + 7, x1 + 5, y1 + 7, P.frame_d);
  d.rect(18, y1 - 2, 24, y1 + 3, P.pot_t);
  d.rect(19, y1 - 10, 23, y1 - 2, P.plant);
  d.line(19, y1 - 10, 19, y1 - 2, P.plant_d);
  d.rect(17, y1 - 7, 18, y1 - 4, P.plant);
  d.rect(24, y1 - 8, 25, y1 - 5, P.plant);
  // curtains
  for (const side of [0, 1]) {
    const cx0 = side === 0 ? x0 - 10 : x1 - 1;
    for (let i = 0; i < 9; i++) {
      let col = Math.floor(i / 3) % 2 === 0 ? P.curt : P.curt_d;
      if (i % 3 === 0) col = side === 0 ? P.curt_l : P.curt_d;
      const sway = Math.trunc(2 * Math.sin(i * 0.9));
      d.line(cx0 + i, y0 - 6, cx0 + i + sway, y1 + 10, col);
    }
    d.rect(cx0 + 1, 62, cx0 + 8, 63, C.gold);
  }
  d.rect(x0 - 12, y0 - 8, x1 + 12, y0 - 7, C.gold_d);
  d.ellipse(x0 - 14, y0 - 9, x0 - 11, y0 - 6, C.gold);
  d.ellipse(x1 + 11, y0 - 9, x1 + 14, y0 - 6, C.gold);
}

function poster(d: PixelBuffer): void {
  const px = 110;
  const py = 28;
  d.rect(px, py, px + 20, py + 28, C.black);
  d.rect(px + 1, py + 1, px + 19, py + 27, C.red);
  d.polygon(
    [
      [px + 1, py + 20],
      [px + 19, py + 10],
      [px + 19, py + 15],
      [px + 1, py + 25],
    ],
    C.black,
  );
  d.polygon(star(px + 10, py + 11, 6, 2.6), C.white);
  d.rect(px + 3, py + 22, px + 11, py + 22, C.white);
}

function kitchen(d: PixelBuffer): void {
  const kx0 = 146;
  const kx1 = 200;
  // backsplash tiles
  d.rect(kx0, 64, kx1, 100, P.tile);
  for (let y = 64; y < 100; y += 6) d.line(kx0, y, kx1, y, P.tile_g);
  for (let j = 0, y = 64; y < 100; y += 6, j++) {
    for (let x = kx0 + (j % 2 ? 3 : 0); x < kx1; x += 6) d.line(x, y, x, y + 6, P.tile_g);
  }
  // upper cabinets
  d.rect(kx0, 14, kx1, 50, P.cab_d);
  [kx0, kx0 + 27].forEach((cx, i) => {
    d.rect(cx + 1, 15, cx + 26, 48, P.cab);
    d.rect(cx + 3, 17, cx + 24, 46, P.cab_l);
    d.rect(cx + 4, 18, cx + 23, 45, P.cab);
    const hxp = i === 0 ? cx + 22 : cx + 5;
    d.rect(hxp - 1, 38, hxp, 43, C.gold);
  });
  d.rect(kx0 - 2, 50, kx1 + 2, 52, P.cab_d);
  d.line(kx0 + 4, 53, kx1 - 4, 53, hex('ffe7a6')); // under-cabinet light
  // utensil rail + tools
  d.line(150, 58, 178, 58, P.steel_dd);
  for (const [tx, kind] of [
    [154, 'ladle'],
    [162, 'spat'],
    [170, 'whisk'],
  ] as const) {
    d.line(tx, 58, tx, 70, P.steel_d);
    if (kind === 'ladle') d.ellipse(tx - 3, 69, tx + 3, 74, P.steel);
    else if (kind === 'spat') d.rect(tx - 2, 68, tx + 2, 75, hex('ff9f43'));
    else d.ellipse(tx - 2, 66, tx + 2, 75, P.steel, true);
  }
  // counter
  d.rect(kx0 - 2, 100, kx1 + 2, 105, P.counter);
  d.line(kx0 - 2, 100, kx1 + 2, 100, P.counter_l);
  d.line(kx0 - 2, 105, kx1 + 2, 105, P.counter_d);
  // lower cabinets
  d.rect(kx0, 106, kx1, 128, P.cab_d);
  for (const cx of [kx0, kx0 + 27]) {
    d.rect(cx + 1, 107, cx + 26, 125, P.cab);
    d.rect(cx + 3, 109, cx + 24, 123, P.cab_l);
    d.rect(cx + 4, 110, cx + 23, 122, P.cab);
    d.rect(cx + 10, 111, cx + 17, 112, C.gold);
  }
  d.rect(kx0, 126, kx1, 128, P.wood_dd);
  // utensil crock (left of the counter slot) and kettle (right of it)
  d.rect(149, 88, 156, 99, P.crock);
  d.rect(150, 89, 155, 98, P.crock_l);
  [151, 153, 155].forEach((tx, i) => d.line(tx, 80 + i * 2, tx, 88, i === 1 ? P.steel : P.wood));
  d.ellipse(186, 88, 198, 99, C.red);
  d.rect(186, 94, 198, 99, C.red);
  d.line(188, 90, 191, 89, C.red_l);
  d.rect(190, 85, 194, 87, C.black);
  d.line(183, 92, 186, 94, C.red_d);
}

function fridge(d: PixelBuffer): void {
  const fx0 = 204;
  const fx1 = 236;
  d.rect(fx0, 46, fx1, 128, P.fridge_d);
  d.rect(fx0 + 1, 47, fx1 - 1, 80, P.fridge);
  d.rect(fx0 + 1, 82, fx1 - 1, 127, P.fridge);
  d.line(fx0 + 2, 48, fx0 + 2, 78, P.fridge_l);
  d.line(fx0 + 2, 83, fx0 + 2, 125, P.fridge_l);
  d.rect(fx0 + 4, 68, fx0 + 5, 77, P.steel);
  d.rect(fx0 + 4, 86, fx0 + 5, 98, P.steel);
  // note + magnets
  d.rect(fx0 + 12, 90, fx0 + 24, 102, C.white);
  for (const yy of [93, 96, 99]) d.line(fx0 + 14, yy, fx0 + 22, yy, P.note_line);
  d.ellipse(fx0 + 16, 88, fx0 + 19, 91, C.red);
  d.ellipse(fx0 + 24, 56, fx0 + 28, 60, P.win_cy);
  d.rect(fx0 + 10, 62, fx0 + 14, 66, P.magnet_g);
  // plant on top
  d.rect(fx0 + 9, 37, fx0 + 21, 46, P.pot_t);
  d.line(fx0 + 9, 37, fx0 + 21, 37, P.pot_l);
  [
    [-7, -12],
    [-3, -15],
    [3, -14],
    [8, -10],
    [10, -5],
    [-9, -5],
  ].forEach(([ax, ay], i) => d.line(fx0 + 15, 37, fx0 + 15 + ax!, 37 + ay!, i % 2 ? P.plant : P.plant_d, 2));
}

/** Bistro chair (24x32). Backrest on the left; flip for the right-hand chair. */
export function chair(): PixelBuffer {
  const back = '.oyYo...................';
  const leg = '..oYo..............oYo..';
  const rows = [
    '..ooo...................',
    '.oyyo...................',
    ...Array.from({ length: 13 }, () => back),
    '.oyYoooooooooooooooooo..',
    '.oyYyyyyyyyyyyyyyyyyyyo.',
    '.oyYYYYYYYYYYYYYYYYYYYo.',
    '.oooooooooooooooooooooo.',
    ...Array.from({ length: 12 }, () => leg),
    '.ooYoo............ooYoo.',
  ];
  const im = sprite(rows, { o: C.ink, y: C.gold, Y: C.gold_d });
  im.rect(5, 13, 21, 15, hex('ff3d6e'));
  im.line(5, 13, 21, 13, hex('ff8aa6'));
  return im;
}

/** Round pedestal table, side view (52x22). */
export function table(): PixelBuffer {
  const d = new PixelBuffer(52, 22);
  d.ellipse(0, 0, 51, 8, C.ink);
  d.ellipse(1, 0, 50, 6, P.cloth);
  d.ellipse(4, 1, 47, 5, P.cloth_l);
  d.rect(1, 4, 50, 7, P.cloth_d);
  d.line(2, 8, 49, 8, C.ink);
  for (let x = 4; x < 48; x += 6) d.line(x, 8, x + 2, 10, C.red);
  d.rect(23, 9, 28, 18, C.ink);
  d.rect(24, 9, 27, 18, C.gold_d);
  d.line(24, 9, 24, 18, C.gold);
  d.ellipse(12, 17, 39, 21, C.ink);
  d.ellipse(13, 17, 38, 20, C.gold_d);
  d.line(16, 17, 35, 17, C.gold);
  return d;
}

/** Pendant lamp (26x70): cord from the top, shade at the bottom. */
export function lamp(): PixelBuffer {
  const d = new PixelBuffer(26, 70);
  d.line(13, 0, 13, 52, C.ink);
  d.polygon(
    [
      [7, 52],
      [19, 52],
      [25, 64],
      [1, 64],
    ],
    P.lamp_d,
  );
  d.polygon(
    [
      [8, 52],
      [18, 52],
      [23, 63],
      [3, 63],
    ],
    P.lamp,
  );
  d.line(9, 53, 5, 62, P.shade_l);
  d.rect(1, 64, 25, 65, P.shade_rim);
  d.ellipse(9, 63, 17, 69, P.bulb);
  return d;
}

export const LAMP_X = 69;
export const LAMP_Y = -26;

/** Today's counter props: Diet Dr Pepper cans on the counter, snack wrappers on the table. */
export interface RoomProps {
  cans: number;
  wrappers: number;
}

export const NO_PROPS: RoomProps = { cans: 0, wrappers: 0 };
export const MAX_VISIBLE_CANS = 10;
export const MAX_VISIBLE_WRAPPERS = 10;
/** The table layer starts this far above the tabletop so wrappers can sit on it. */
export const TABLE_PAD = 6;
export const TABLE_LAYER_Y = TABLE_Y - TABLE_PAD;

// Diet Dr Pepper: silver can with a maroon band.
const CAN = ['.sss.', 'oWWWo', 'oMMMo', 'oMWMo', 'oMMMo', 'oWWWo', 'oSSSo', '.ooo.'];
const CAN_PAL = { o: C.ink, s: P.steel, S: P.steel_d, W: P.steel_l, M: hex('8a1a3a') };

const WRAPPER = ['.o.ooo.', 'oaabbao', 'oabaabo', '.ooooo.'];
const WRAPPER_COLOURS: readonly [string, string][] = [
  ['ff8a3d', 'ffd23f'], // chips
  ['9a4cff', 'ff8aa6'], // candy
  ['3ddc84', 'f8f4f0'], // granola
];

/** Can bottoms on the counter: a pyramid of 4-3-2-1, filled bottom row first. */
export function canPositions(n: number): [number, number][] {
  const out: [number, number][] = [];
  const rows = [4, 3, 2, 1];
  rows.forEach((count, r) => {
    for (let i = 0; i < count; i++) out.push([COUNTER_SLOT.x0 + r * 3 + i * 6, COUNTER_SLOT.y - r * 8]);
  });
  return out.slice(0, Math.min(n, MAX_VISIBLE_CANS));
}

/** Wrapper bottoms in table-layer coordinates: a row on the cloth, then a second layer on top. */
export function wrapperPositions(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 5; i++) out.push([5 + i * 8, TABLE_PAD + 2 + (i % 2)]);
  for (let i = 0; i < 5; i++) out.push([9 + i * 8, TABLE_PAD - 1 + (i % 2)]);
  return out.slice(0, Math.min(n, MAX_VISIBLE_WRAPPERS));
}

function drawCans(d: PixelBuffer, n: number): void {
  const can = sprite(CAN, CAN_PAL);
  for (const [x, y] of canPositions(n)) d.blit(can, x, y - can.height + 1);
}

function drawWrappers(d: PixelBuffer, n: number): void {
  wrapperPositions(n).forEach(([x, y], i) => {
    const [a, b] = WRAPPER_COLOURS[i % WRAPPER_COLOURS.length]!;
    const w = sprite(WRAPPER, { o: C.ink, a: hex(a), b: hex(b) });
    d.blit(w, x, y - w.height + 1);
  });
}

export interface RoomLayers {
  /** Everything behind the character (includes the left chair and the cans). */
  back: PixelBuffer;
  /** `back` plus the right-hand chair: what sits behind the character. */
  base: PixelBuffer;
  chairRight: PixelBuffer;
  /** Table plus wrappers; drawn at (TABLE_X, TABLE_LAYER_Y). */
  table: PixelBuffer;
  /** Warm light, composited last. */
  glow: PixelBuffer;
  /** The whole static scene with no character: base, table and glow. */
  lit: PixelBuffer;
}

interface StaticParts {
  back: PixelBuffer;
  glow: PixelBuffer;
  chairRight: PixelBuffer;
  table: PixelBuffer;
}

let parts: StaticParts | null = null;

function staticParts(): StaticParts {
  if (parts) return parts;
  const rnd = mulberry32(7);
  const back = new PixelBuffer(ROOM_W, ROOM_H, P.wall);
  wallAndFloor(back);
  rug(back);
  windowView(back, rnd);
  poster(back);
  kitchen(back);
  fridge(back);
  back.blit(lamp(), LAMP_X, LAMP_Y);
  back.blit(chair(), CHAIR_L_X, CHAIR_Y);

  const glow = new PixelBuffer(ROOM_W, ROOM_H);
  glow.blit(glowLayer(ROOM_W, ROOM_H, LAMP_X + 13, LAMP_Y + 66, 70, hex('ffd27a', 70)), 0, 0);
  glow.blit(glowLayer(ROOM_W, ROOM_H, 173, 58, 40, hex('fff0b0', 50)), 0, 0);
  glow.blit(glowLayer(ROOM_W, ROOM_H, 38, 50, 50, hex('ff7ad0', 40)), 0, 0);

  parts = { back, glow, chairRight: chair().flipX(), table: table() };
  return parts;
}

const layerCache = new Map<string, RoomLayers>();
const LAYER_CACHE_SIZE = 4;

/** Room layers for today's props; rebuilt only when the visible counts change. */
export function roomLayers(props: RoomProps = NO_PROPS): RoomLayers {
  const cans = Math.max(0, Math.min(props.cans, MAX_VISIBLE_CANS));
  const wrappers = Math.max(0, Math.min(props.wrappers, MAX_VISIBLE_WRAPPERS));
  const key = `${cans}:${wrappers}`;
  const hit = layerCache.get(key);
  if (hit) return hit;

  const sp = staticParts();
  const back = sp.back.clone();
  drawCans(back, cans);
  const tbl = new PixelBuffer(sp.table.width, sp.table.height + TABLE_PAD);
  tbl.blit(sp.table, 0, TABLE_PAD);
  drawWrappers(tbl, wrappers);

  const base = back.clone();
  base.blit(sp.chairRight, CHAIR_R_X, CHAIR_Y);
  const lit = base.clone();
  lit.blit(tbl, TABLE_X, TABLE_LAYER_Y);
  lit.blit(sp.glow, 0, 0);

  const layers = { back, base, chairRight: sp.chairRight, table: tbl, glow: sp.glow, lit };
  if (layerCache.size >= LAYER_CACHE_SIZE) layerCache.delete(layerCache.keys().next().value!);
  layerCache.set(key, layers);
  return layers;
}
