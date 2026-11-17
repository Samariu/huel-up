import type { ThemeId } from '../db/types';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(c: AudioContext, type: OscillatorType, from: number, to: number, start: number, dur: number, gain = 0.12) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, c.currentTime + start);
  o.frequency.exponentialRampToValueAtTime(to, c.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.02);
}

/** short synth "power-up" blip, voiced per theme */
export function blip(theme: ThemeId) {
  const c = audio();
  if (!c) return;
  if (theme === 'neon') {
    tone(c, 'sawtooth', 220, 880, 0, 0.12, 0.08);
    tone(c, 'square', 880, 1320, 0.1, 0.12, 0.06);
  } else if (theme === 'acid') {
    tone(c, 'square', 140, 90, 0, 0.09, 0.1);
    tone(c, 'square', 420, 420, 0.09, 0.08, 0.07);
  } else {
    tone(c, 'square', 1200, 1200, 0, 0.04, 0.05);
    tone(c, 'square', 1600, 1600, 0.06, 0.04, 0.05);
    tone(c, 'square', 2000, 2000, 0.12, 0.05, 0.05);
  }
}

export function click() {
  const c = audio();
  if (c) tone(c, 'triangle', 600, 300, 0, 0.05, 0.05);
}
