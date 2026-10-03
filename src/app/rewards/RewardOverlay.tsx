import { useEffect, useRef, useState } from 'react';
import { announce, type RewardItem } from '../../domain/rewards';
import { isBlocking, renderReward, rewardDuration } from '../../fx/render';
import { PixelBuffer } from '../../pixel/buffer';
import { present } from '../../pixel/present';
import { MIN_NATIVE_W } from '../../pixel/scale';

/** The overlay spans the app column, like the screens beneath it. */
const MAX_CSS_W = 560;
const FPS = 30;

interface OverlaySize {
  w: number;
  h: number;
  cssW: number;
  cssH: number;
}

function measure(): OverlaySize {
  const dpr = window.devicePixelRatio || 1;
  const devW = Math.floor(Math.min(window.innerWidth, MAX_CSS_W) * dpr);
  const devH = Math.floor(window.innerHeight * dpr);
  const s = Math.max(1, Math.floor(devW / MIN_NATIVE_W));
  const w = Math.floor(devW / s);
  const h = Math.floor(devH / s);
  return { w, h, cssW: (w * s) / dpr, cssH: (h * s) / dpr };
}

interface Props {
  current: RewardItem | null;
  reduceMotion: boolean;
  onFinish(key: string): void;
  onOpenAchievements(): void;
}

export function RewardOverlay({ current, reduceMotion, onFinish, onOpenAchievements }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<OverlaySize>(() => measure());

  useEffect(() => {
    const onResize = () => setSize(measure());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Play the current item; finish when its time is up.
  useEffect(() => {
    if (!current || current.kind === 'more') return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const buf = new PixelBuffer(size.w, size.h);
    const dur = rewardDuration(current, reduceMotion);
    const key = current.key;

    if (reduceMotion) {
      renderReward(buf, current, 0, true);
      present(buf, ctx);
      const id = window.setTimeout(() => onFinish(key), dur * 1000);
      return () => window.clearTimeout(id);
    }

    let raf = 0;
    let last = -Infinity;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      if (t >= dur) {
        onFinish(key);
        return;
      }
      raf = requestAnimationFrame(tick);
      if (now - last < 1000 / FPS - 4) return;
      last = now;
      renderReward(buf, current, t, false);
      present(buf, ctx);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [current, reduceMotion, size, onFinish]);

  // Keyboard skip for blocking items.
  useEffect(() => {
    if (!current || !isBlocking(current) || current.kind === 'more') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onFinish(current.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, onFinish]);

  const blocking = current !== null && isBlocking(current);

  return (
    <>
      <div className="sr-only" aria-live="polite" role="status">
        {current ? announce(current) : ''}
      </div>
      {current && current.kind !== 'more' && (
        <div
          className={`reward-layer${blocking ? ' is-blocking' : ''}`}
          onPointerDown={blocking ? () => onFinish(current.key) : undefined}
        >
          <canvas
            ref={canvasRef}
            className="reward-canvas"
            width={size.w}
            height={size.h}
            style={{ width: `${size.cssW}px`, height: `${size.cssH}px` }}
            aria-hidden="true"
          />
          {blocking && (
            <button type="button" className="sr-only" onClick={() => onFinish(current.key)}>
              Continue
            </button>
          )}
        </div>
      )}
      {current?.kind === 'more' && (
        <div className="reward-layer is-blocking reward-more-scrim" onPointerDown={() => onFinish(current.key)}>
          <div
            className="card reward-more"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reward-more-title"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <p className="card-kicker">AND THERE'S MORE</p>
            <h2 id="reward-more-title" className="card-title">
              +{current.count} MORE
            </h2>
            <p className="hint">Achievements you unlocked are listed on the Stats screen.</p>
            <div className="card-row">
              <button type="button" className="btn" onClick={() => onFinish(current.key)}>
                CLOSE
              </button>
              <button
                type="button"
                className="btn btn-primary btn-grow"
                autoFocus
                onClick={() => {
                  onFinish(current.key);
                  onOpenAchievements();
                }}
              >
                VIEW ALL
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
