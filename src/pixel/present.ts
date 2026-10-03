import type { PixelBuffer } from './buffer';

/**
 * Copies a buffer to a canvas. The packed colour format matches ImageData's
 * byte order on little-endian hardware, which covers every current browser
 * platform, so the pixels are shared without conversion.
 */
export function present(buf: PixelBuffer, ctx: CanvasRenderingContext2D): void {
  const bytes = new Uint8ClampedArray(buf.data.buffer as ArrayBuffer, buf.data.byteOffset, buf.data.byteLength);
  ctx.putImageData(new ImageData(bytes, buf.width, buf.height), 0, 0);
}
