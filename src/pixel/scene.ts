import { PixelBuffer } from './buffer';
import { hex } from './color';
import { CH, CW, characterOrigin, renderCharacter, sit, stand, type Expression, type Pose } from './sprites/character';
import { FLOOR_Y, NEON, ROOM_H, ROOM_W, SIT_X, STAND_X, TABLE_X, TABLE_Y, roomLayers } from './sprites/room';

export type ScenePose = 'stand' | 'sit';
export type SceneFace = 'normal' | 'happy' | 'sideeye' | 'look' | 'smile';

export interface SceneState {
  pose: ScenePose;
  face: SceneFace;
}

/** Animation clock constants (seconds). */
const BLINK_PERIOD = 4.2;
const BLINK_LEN = 0.12;
const BREATH_PERIOD = 2.4;
const HOP_PERIOD = 2.6;
const HOP_LEN = 0.3;
const HOP_HEIGHT = 3;

export function isBlinking(t: number): boolean {
  const cycle = Math.floor(t / BLINK_PERIOD);
  const p = t - cycle * BLINK_PERIOD;
  // Every third cycle blinks twice.
  return p < BLINK_LEN || (cycle % 3 === 2 && p >= 0.3 && p < 0.3 + BLINK_LEN);
}

/** Pixels the character is lifted by the happy hop at time t. */
export function hopOffset(t: number): number {
  const p = (t % HOP_PERIOD) / HOP_LEN;
  return p < 1 ? Math.round(HOP_HEIGHT * Math.sin(Math.PI * p)) : 0;
}

export function characterX(state: SceneState): number {
  return state.pose === 'sit' ? SIT_X : STAND_X;
}

function expressionAt(face: SceneFace, t: number): Expression {
  // Happy eyes are already closed, so they never blink.
  if (face !== 'happy' && isBlinking(t)) return 'blink';
  return face;
}

export function poseAt(state: SceneState, t: number): Pose {
  const expr = expressionAt(state.face, t);
  if (state.pose === 'sit') return sit(expr, { facing: -1 });
  return stand((t % BREATH_PERIOD) / BREATH_PERIOD, expr);
}

const scratchCache = new Map<string, PixelBuffer>();
function scratch(w: number, h: number): PixelBuffer {
  const key = `${w}x${h}`;
  let b = scratchCache.get(key);
  if (!b) scratchCache.set(key, (b = new PixelBuffer(w, h)));
  return b;
}

/**
 * Renders the full 240x160 room at time `t` (seconds) into `out`.
 * Layer order follows render.py (room, chair, character, table, glow). The
 * static scene is pre-lit once; each frame only the character's box is
 * rebuilt from the unlit layers and re-lit.
 */
export function renderScene(state: SceneState, t: number, out = new PixelBuffer(ROOM_W, ROOM_H)): PixelBuffer {
  const layers = roomLayers();
  out.data.set(layers.lit.data);
  if (Math.floor(t * 7) % 9 === 0) {
    // Neon flicker: dim the sign, then re-apply the light over those pixels.
    for (let x = NEON.x0; x <= NEON.x1; x++) {
      out.set(x, NEON.y, hex('6a2a6a'));
      out.blend(x, NEON.y, layers.glow.get(x, NEON.y));
    }
  }

  const pose = poseAt(state, t);
  const lift = state.pose === 'stand' && state.face === 'happy' ? hopOffset(t) : 0;
  const [cx, cy] = characterOrigin(pose, characterX(state), FLOOR_Y - lift);
  const x0 = Math.max(0, cx);
  const y0 = Math.max(0, cy);
  const x1 = Math.min(ROOM_W, cx + CW);
  const y1 = Math.min(ROOM_H, cy + CH);
  if (x1 <= x0 || y1 <= y0) return out;

  const box = scratch(x1 - x0, y1 - y0);
  box.copyRegion(layers.base, x0, y0);
  box.blit(renderCharacter(pose), cx - x0, cy - y0);
  box.blit(layers.table, TABLE_X - x0, TABLE_Y - y0);
  box.blit(layers.glow, -x0, -y0);
  out.place(box, x0, y0);
  return out;
}
