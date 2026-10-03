import { useEffect, useRef, useState } from 'react';
import { describeMood, type Mood } from '../../domain/mood';
import { PixelBuffer } from '../../pixel/buffer';
import { present } from '../../pixel/present';
import { computeScale, cropX, type PixelScale } from '../../pixel/scale';
import { characterX, renderScene } from '../../pixel/scene';
import type { Outfit } from '../../pixel/sprites/character';
import { ROOM_H, ROOM_W, type RoomExtras } from '../../pixel/sprites/room';

const FPS = 12;
/** Frame used when motion is reduced: eyes open, no hop. */
const STILL_T = 1;

interface Props {
  mood: Mood;
  extras: RoomExtras;
  outfit: Omit<Outfit, 'sway'>;
  reduceMotion: boolean;
}

export function RoomView({ mood, extras, outfit, reduceMotion }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState<PixelScale | null>(null);
  const { pose, face, cans, wrappers } = mood;
  // Stable keys so the render loop restarts only when what is drawn changes.
  const extrasKey = JSON.stringify(extras);
  const outfitKey = JSON.stringify(outfit);

  // Track container width and DPR.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const next = computeScale(el.clientWidth, window.devicePixelRatio || 1, ROOM_W, ROOM_H);
      setScale((prev) =>
        prev && prev.nativeW === next.nativeW && prev.cssW === next.cssW && prev.cssH === next.cssH ? prev : next,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // DPR changes on zoom or when moving between screens.
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !scale) return;
    const state = {
      pose,
      face,
      props: { cans, wrappers },
      extras: JSON.parse(extrasKey) as RoomExtras,
      outfit: JSON.parse(outfitKey) as Omit<Outfit, 'sway'>,
    };
    const frame = new PixelBuffer(ROOM_W, ROOM_H);
    const view = new PixelBuffer(scale.nativeW, ROOM_H);
    const x0 = cropX(ROOM_W, scale.nativeW, characterX(state));
    const draw = (t: number) => {
      renderScene(state, t, frame);
      view.copyRegion(frame, x0, 0);
      present(view, ctx);
    };

    if (reduceMotion) {
      draw(STILL_T);
      return;
    }
    let raf = 0;
    let last = -Infinity;
    const start = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // Small tolerance so 60 Hz displays land on every 5th frame.
      if (now - last < 1000 / FPS - 4) return;
      last = now;
      draw((now - start) / 1000);
    };
    raf = requestAnimationFrame(tick);
    // rAF already stops in background tabs; this also stops it for hidden-but-open pages.
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [scale, pose, face, cans, wrappers, extrasKey, outfitKey, reduceMotion]);

  return (
    <div ref={wrapRef} className="room">
      {scale && (
        <canvas
          ref={canvasRef}
          className="room-canvas"
          width={scale.nativeW}
          height={ROOM_H}
          style={{ width: `${scale.cssW}px`, height: `${scale.cssH}px` }}
          role="img"
          aria-label={describeMood(mood)}
        />
      )}
    </div>
  );
}
