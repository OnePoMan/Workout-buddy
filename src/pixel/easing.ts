/** Easing helpers from achievement-video/gfx.py. */
export function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/** Progress of t through [a, b], clamped. */
export function prog(t: number, a: number, b: number): number {
  return clamp01((t - a) / (b - a));
}

export function easeOutBack(t: number, s = 1.70158): number {
  const u = t - 1;
  return u * u * ((s + 1) * u + s) + 1;
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function easeInOut(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
}
