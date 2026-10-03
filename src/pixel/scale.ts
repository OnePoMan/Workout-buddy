/** Narrowest native width the layout is designed for (SPEC §9.1). */
export const MIN_NATIVE_W = 180;

export interface PixelScale {
  /** Device pixels per art pixel (always an integer, so pixels stay square and even). */
  devicePerPixel: number;
  /** Native canvas width in art pixels. */
  nativeW: number;
  /** CSS size of the canvas. */
  cssW: number;
  cssH: number;
}

/**
 * Picks the largest integer device-pixel scale that still shows at least
 * MIN_NATIVE_W art pixels across `containerCssW`, capped at the art width.
 * Working in device pixels keeps pixels exact on fractional DPRs (e.g. 2.625).
 */
export function computeScale(containerCssW: number, dpr: number, artW: number, artH: number): PixelScale {
  const deviceW = Math.max(1, Math.floor(containerCssW * dpr));
  const devicePerPixel = Math.max(1, Math.floor(deviceW / MIN_NATIVE_W));
  const nativeW = Math.min(artW, Math.floor(deviceW / devicePerPixel));
  return {
    devicePerPixel,
    nativeW,
    cssW: (nativeW * devicePerPixel) / dpr,
    cssH: (artH * devicePerPixel) / dpr,
  };
}

/** Left edge of a `viewW`-wide window into `artW`, centred on `focusX` and clamped. */
export function cropX(artW: number, viewW: number, focusX: number): number {
  return Math.max(0, Math.min(artW - viewW, Math.round(focusX - viewW / 2)));
}
