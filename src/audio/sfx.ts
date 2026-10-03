/**
 * Web Audio synth for reward cues, modelled on achievement-video/audio.py:
 * square-wave ticks and blips, FM-ish bells, detuned-saw brass stabs, noise
 * whooshes, a sub "slam" and a rising glint. No sample files.
 */
import type { Cue } from './cues';

const MASTER = 0.32;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

function context(): AudioContext | null {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  master = ctx.createGain();
  master.gain.value = MASTER;
  master.connect(comp).connect(ctx.destination);
  return ctx;
}

/** Call from a user gesture: browsers only start audio after one. */
export function unlockAudio(): void {
  const c = context();
  if (c && c.state === 'suspended') void c.resume();
}

function noise(c: BaseAudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const b = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = b;
  return b;
}

function env(c: BaseAudioContext, out: AudioNode, at: number, peak: number, decay: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  g.connect(out);
  return g;
}

function osc(c: BaseAudioContext, type: OscillatorType, freq: number, at: number, len: number, out: AudioNode): OscillatorNode {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  o.connect(out);
  o.start(at);
  o.stop(at + len);
  return o;
}

/** Schedules one cue on any audio context (also used with OfflineAudioContext in tests). */
export function scheduleCue(c: BaseAudioContext, out: AudioNode, cue: Cue, at: number): void {
  switch (cue.sound) {
    case 'tick':
      osc(c, 'square', mtof(cue.m), at, 0.06, env(c, out, at, 0.18, 0.05));
      break;
    case 'blip': {
      const o = osc(c, 'square', mtof(cue.m0), at, cue.dur + 0.02, env(c, out, at, 0.2, cue.dur));
      o.frequency.linearRampToValueAtTime(mtof(cue.m1), at + cue.dur);
      break;
    }
    case 'bell': {
      const f = mtof(cue.m);
      osc(c, 'sine', f, at, cue.dur, env(c, out, at, 0.35, cue.dur));
      osc(c, 'sine', f * 2.76, at, 0.4, env(c, out, at, 0.12, 0.25));
      osc(c, 'sine', f * 5.4, at, 0.2, env(c, out, at, 0.06, 0.1));
      break;
    }
    case 'stab': {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(5000, at);
      lp.frequency.exponentialRampToValueAtTime(700, at + 0.15);
      const g = c.createGain();
      const level = 0.5 / cue.notes.length;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(level, at + 0.006);
      g.gain.setValueAtTime(level * 0.6, at + cue.dur);
      g.gain.exponentialRampToValueAtTime(0.0001, at + cue.dur + 0.15);
      lp.connect(g).connect(out);
      for (const m of cue.notes) {
        for (const cents of [-8, 8]) {
          const o = osc(c, 'sawtooth', mtof(m), at, cue.dur + 0.2, lp);
          o.detune.setValueAtTime(cents, at);
        }
      }
      break;
    }
    case 'whoosh': {
      const src = c.createBufferSource();
      src.buffer = noise(c);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.8;
      bp.frequency.setValueAtTime(cue.up ? 300 : 5000, at);
      bp.frequency.exponentialRampToValueAtTime(cue.up ? 5000 : 300, at + cue.dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.5, at + cue.dur / 2);
      g.gain.linearRampToValueAtTime(0.0001, at + cue.dur);
      src.connect(bp).connect(g).connect(out);
      src.start(at);
      src.stop(at + cue.dur + 0.05);
      break;
    }
    case 'slam': {
      const o = osc(c, 'sine', 128, at, 0.45, env(c, out, at, 0.7, 0.4));
      o.frequency.exponentialRampToValueAtTime(38, at + 0.15);
      const src = c.createBufferSource();
      src.buffer = noise(c);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3000;
      src.connect(lp).connect(env(c, out, at, 0.4, 0.08));
      src.start(at);
      src.stop(at + 0.1);
      break;
    }
    case 'glint': {
      const o = osc(c, 'sine', 2000, at, 0.6, env(c, out, at, 0.15, 0.5));
      o.frequency.exponentialRampToValueAtTime(8000, at + 0.6);
      [96, 100, 103, 108].forEach((m, k) => scheduleCue(c, out, { t: 0, sound: 'bell', m, dur: 0.5 }, at + k * 0.04));
      break;
    }
  }
}

/** Plays a cue list now. Returns a stop function that fades it out (for skips). */
export function playCues(cues: readonly Cue[]): () => void {
  const c = context();
  if (!c || !master || c.state !== 'running') return () => {};
  const bus = c.createGain();
  bus.connect(master);
  const t0 = c.currentTime + 0.02;
  for (const cue of cues) scheduleCue(c, bus, cue, t0 + cue.t);
  return () => {
    bus.gain.setTargetAtTime(0, c.currentTime, 0.02);
    window.setTimeout(() => bus.disconnect(), 300);
  };
}
