import { describe, expect, it } from 'vitest';
import { alpha, hex } from '../src/pixel/color';
import { characterX, hopOffset, isBlinking, poseAt, renderScene } from '../src/pixel/scene';
import { BY, CH, CW, head, headRows, renderCharacter, sit, stand, type Expression } from '../src/pixel/sprites/character';
import { FLOOR_Y, ROOM_H, ROOM_W, SIT_X, STAND_X, WINDOW, roomLayers } from '../src/pixel/sprites/room';
import { C, P } from '../src/pixel/palette';
import type { PixelBuffer } from '../src/pixel/buffer';

function lowestOpaqueRow(b: PixelBuffer): number {
  for (let y = b.height - 1; y >= 0; y--) {
    for (let x = 0; x < b.width; x++) if (alpha(b.get(x, y)) > 0) return y;
  }
  return -1;
}

function topOpaqueRow(b: PixelBuffer): number {
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) if (alpha(b.get(x, y)) > 0) return y;
  }
  return -1;
}

describe('character', () => {
  const EXPRS: Expression[] = ['normal', 'blink', 'happy', 'look', 'open', 'smile', 'sideeye'];

  it('keeps every head row the same width', () => {
    for (const e of EXPRS) {
      const rows = headRows(e);
      expect(new Set(rows.map((r) => r.length)).size).toBe(1);
      expect(rows).toHaveLength(26);
    }
  });

  it('gives each expression a distinct face', () => {
    const keys = EXPRS.map((e) => [...head(e).data].join(','));
    expect(new Set(keys).size).toBe(EXPRS.length);
  });

  it('stands on the baseline and sits lower', () => {
    const standing = renderCharacter(stand(0, 'normal'));
    expect(standing.width).toBe(CW);
    expect(standing.height).toBe(CH);
    // Feet end on the baseline; the leg outline may reach 1px below, as in the original.
    expect(lowestOpaqueRow(standing)).toBeGreaterThanOrEqual(BY);
    expect(lowestOpaqueRow(standing)).toBeLessThanOrEqual(BY + 1);
    const seated = renderCharacter(sit('normal'));
    expect(topOpaqueRow(seated) - topOpaqueRow(standing)).toBe(7);
  });

  it('mirrors when facing left', () => {
    const right = renderCharacter(stand(0, 'normal'));
    const left = renderCharacter(stand(0, 'normal', { facing: -1 }));
    for (let y = 0; y < CH; y += 7) {
      for (let x = 0; x < CW; x += 3) expect(left.get(CW - 1 - x, y)).toBe(right.get(x, y));
    }
  });
});

describe('room', () => {
  it('builds 240x160 layers once', () => {
    const a = roomLayers();
    expect(a.back.width).toBe(ROOM_W);
    expect(a.back.height).toBe(ROOM_H);
    expect(roomLayers()).toBe(a);
  });

  it('puts landmarks where the layout says', () => {
    const { back } = roomLayers();
    expect(back.get(WINDOW.x0 + 20, WINDOW.y1 + 5)).toBe(P.frame); // sill
    expect(back.get(170, 100)).toBe(P.counter_l);
    expect(back.get(220, 120)).toBe(P.fridge);
    expect(back.get(2, 150)).not.toBe(P.wall);
  });

  it('is fully opaque', () => {
    const frame = renderScene({ pose: 'stand', face: 'normal' }, 1);
    for (let i = 0; i < frame.data.length; i += 37) expect(alpha(frame.data[i]!)).toBe(255);
  });
});

describe('scene animation', () => {
  it('blinks briefly, with a double blink every third cycle', () => {
    expect(isBlinking(0)).toBe(true);
    expect(isBlinking(0.2)).toBe(false);
    expect(isBlinking(1)).toBe(false);
    expect(isBlinking(4.2 * 2 + 0.35)).toBe(true);
    expect(isBlinking(4.2 + 0.35)).toBe(false);
  });

  it('never blinks the happy face', () => {
    expect(poseAt({ pose: 'stand', face: 'happy' }, 0).head).toBe('happy');
    expect(poseAt({ pose: 'stand', face: 'normal' }, 0).head).toBe('blink');
  });

  it('hops for a moment each cycle', () => {
    expect(hopOffset(0)).toBe(0);
    expect(hopOffset(0.15)).toBe(3);
    expect(hopOffset(1)).toBe(0);
  });

  it('places the character standing or seated', () => {
    expect(characterX({ pose: 'stand', face: 'normal' })).toBe(STAND_X);
    expect(characterX({ pose: 'sit', face: 'smile' })).toBe(SIT_X);
    expect(poseAt({ pose: 'sit', face: 'smile' }, 1).facing).toBe(-1);
  });

  it('is deterministic and changes with state', () => {
    const a = renderScene({ pose: 'stand', face: 'normal' }, 1);
    const b = renderScene({ pose: 'stand', face: 'normal' }, 1);
    expect([...a.data]).toEqual([...b.data]);
    const c = renderScene({ pose: 'stand', face: 'sideeye' }, 1);
    expect([...a.data]).not.toEqual([...c.data]);
  });

  it('lifts the happy character off the floor mid-hop', () => {
    const footY = FLOOR_Y;
    const grounded = renderScene({ pose: 'stand', face: 'happy' }, 1);
    const hopping = renderScene({ pose: 'stand', face: 'happy' }, 0.15);
    // The sock row at the baseline is only drawn while grounded.
    const sockAt = (b: PixelBuffer) =>
      Array.from({ length: 12 }, (_, i) => b.get(STAND_X - 6 + i, footY - 2)).includes(C.sock);
    expect(sockAt(grounded)).toBe(true);
    expect(sockAt(hopping)).toBe(false);
  });
});

describe('region redraw', () => {
  it('matches drawing every layer in full', async () => {
    const { PixelBuffer } = await import('../src/pixel/buffer');
    const { placeCharacter } = await import('../src/pixel/sprites/character');
    const { TABLE_X, TABLE_Y } = await import('../src/pixel/sprites/room');
    for (const [state, t] of [
      [{ pose: 'stand', face: 'happy' }, 0.15],
      [{ pose: 'sit', face: 'smile' }, 1],
      [{ pose: 'stand', face: 'normal' }, 0.5],
      [{ pose: 'stand', face: 'normal' }, 0], // neon flicker frame
    ] as const) {
      const layers = roomLayers();
      const full = new PixelBuffer(ROOM_W, ROOM_H);
      full.data.set(layers.base.data);
      if (Math.floor(t * 7) % 9 === 0) full.line(27, 69, 33, 69, hex('6a2a6a'));
      const lift = state.pose === 'stand' && state.face === 'happy' ? hopOffset(t) : 0;
      placeCharacter(full, poseAt(state, t), characterX(state), FLOOR_Y - lift);
      full.blit(layers.table, TABLE_X, TABLE_Y);
      full.blit(layers.glow, 0, 0);
      expect([...renderScene(state, t).data]).toEqual([...full.data]);
    }
  });
});

describe('counter props', () => {
  it('stacks cans as a 4-3-2-1 pyramid on the counter, capped at 10', async () => {
    const { canPositions, COUNTER_SLOT } = await import('../src/pixel/sprites/room');
    expect(canPositions(0)).toEqual([]);
    const all = canPositions(25);
    expect(all).toHaveLength(10);
    expect(all.filter(([, y]) => y === COUNTER_SLOT.y)).toHaveLength(4);
    for (const [x] of all) {
      expect(x).toBeGreaterThanOrEqual(COUNTER_SLOT.x0);
      expect(x + 4).toBeLessThanOrEqual(COUNTER_SLOT.x1);
    }
  });

  it('draws props into the layers and caches each combination', async () => {
    const { roomLayers, COUNTER_SLOT } = await import('../src/pixel/sprites/room');
    const none = roomLayers({ cans: 0, fries: 0 });
    const some = roomLayers({ cans: 3, fries: 2 });
    expect(roomLayers({ cans: 3, fries: 2 })).toBe(some);
    expect(roomLayers({ cans: 30, fries: 2 })).toBe(roomLayers({ cans: 10, fries: 2 }));
    expect(none.back.get(COUNTER_SLOT.x0 + 2, COUNTER_SLOT.y - 3)).not.toBe(some.back.get(COUNTER_SLOT.x0 + 2, COUNTER_SLOT.y - 3));
    expect(none.back.get(30, 80)).not.toBe(some.back.get(30, 80));
    // The table no longer carries props.
    expect(some.table).toBe(none.table);
  });
});
