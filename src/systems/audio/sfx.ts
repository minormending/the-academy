// OWNER: A10 (art-audio). Synthesized sound effects, one recipe per SfxKey.
import type { SfxKey } from '../../core/types';
import { bell, noise, noteFreq, shaperCurve, tone, type SynthCtx } from './synth';

/** p = pitch multiplier (from detune), v = volume multiplier. */
export type SfxRecipe = (s: SynthCtx, p: number, v: number) => void;

const N = noteFreq;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Routes through a soft-clipping waveshaper (grit for explosions/roars). */
function gritty(s: SynthCtx, amount: number): SynthCtx {
  const ws = s.ctx.createWaveShaper();
  ws.curve = shaperCurve(amount);
  ws.oversample = '2x';
  ws.connect(s.out);
  return { ...s, out: ws };
}

/** Random tiny highpassed ticks — fire crackle / ice crackle. */
function crackles(s: SynthCtx, n: number, from: number, to: number, f: number, v: number) {
  for (let i = 0; i < n; i++) {
    noise(s, { t: rnd(from, to), dur: rnd(0.008, 0.025), v: v * rnd(0.5, 1), filter: { type: 'highpass', f: f * rnd(0.8, 1.4) } });
  }
}

export const SFX: Record<SfxKey, SfxRecipe> = {
  // ── movement / world ──
  jump: (s, p, v) => {
    tone(s, { type: 'triangle', f: 320 * p, f2: 760 * p, dur: 0.13, v: 0.22 * v, glide: 0.1 });
    tone(s, { type: 'square', f: 640 * p, f2: 1500 * p, dur: 0.08, v: 0.04 * v, glide: 0.07, filter: { type: 'lowpass', f: 3000 } });
  },
  land: (s, p, v) => {
    tone(s, { f: 150 * p, f2: 55, dur: 0.1, v: 0.35 * v });
    noise(s, { dur: 0.07, v: 0.12 * v, filter: { type: 'lowpass', f: 900 } });
  },
  portal: (s, p, v) => {
    noise(s, { dur: 0.6, v: 0.18 * v, a: 0.15, filter: { type: 'bandpass', f: 300, f2: 3200, q: 4 } });
    ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => {
      tone(s, { type: 'sine', f: N(n) * p, t: i * 0.06, dur: 0.4, v: 0.11 * v, vib: { rate: 7, depth: 20 } });
      tone(s, { type: 'triangle', f: N(n) * p * 2, t: i * 0.06, dur: 0.25, v: 0.03 * v, detune: 8 });
    });
  },
  pickup: (s, p, v) => {
    tone(s, { type: 'triangle', f: N('A5') * p, dur: 0.08, v: 0.2 * v });
    tone(s, { type: 'triangle', f: N('E6') * p, t: 0.06, dur: 0.14, v: 0.2 * v });
    tone(s, { type: 'sine', f: N('E7') * p, t: 0.06, dur: 0.12, v: 0.05 * v });
  },
  mesos: (s, p, v) => {
    // coin "ching": two bright metallic partials
    tone(s, { type: 'square', f: N('B6') * p, dur: 0.07, v: 0.07 * v, filter: { type: 'lowpass', f: 6000 } });
    tone(s, { type: 'square', f: N('E7') * p, t: 0.065, dur: 0.38, v: 0.07 * v, filter: { type: 'lowpass', f: 7000 } });
    tone(s, { type: 'sine', f: N('E7') * p * 2.01, t: 0.065, dur: 0.3, v: 0.05 * v });
    tone(s, { type: 'sine', f: N('B6') * p * 2.76, dur: 0.12, v: 0.03 * v });
  },
  levelup: (s, p, v) => {
    const arp = ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'];
    arp.forEach((n, i) => {
      tone(s, { type: 'square', f: N(n) * p, t: i * 0.07, dur: 0.18, v: 0.07 * v, filter: { type: 'lowpass', f: 4000 } });
      tone(s, { type: 'triangle', f: N(n) * p, t: i * 0.07, dur: 0.3, v: 0.12 * v });
    });
    const t = arp.length * 0.07;
    ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => {
      tone(s, { type: 'sawtooth', f: N(n) * p, t, dur: 1.1, v: 0.05 * v, a: 0.02, hold: 0.3, detune: (i - 1.5) * 6, filter: { type: 'lowpass', f: 3200, f2: 1200 } });
      tone(s, { type: 'triangle', f: N(n) * p * 2, t, dur: 1.0, v: 0.05 * v, a: 0.01, hold: 0.25, vib: { rate: 6, depth: 12, delay: 0.2 } });
    });
    for (let i = 0; i < 6; i++) bell(s, N('C7') * p * [1, 1.25, 1.5, 2, 1.5, 2.5][i], t + 0.05 + i * 0.09, 0.4, 0.03 * v, 3.5, 1.2);
    noise(s, { t, dur: 0.9, v: 0.05 * v, a: 0.05, filter: { type: 'highpass', f: 7000 } });
  },
  job_advance: (s, p, v) => {
    // chord swell with opening filter + bell arpeggio + cymbal swell
    const chord = ['C3', 'G3', 'C4', 'E4', 'G4', 'B4', 'D5'];
    chord.forEach((n, i) => {
      for (const d of [-7, 7]) {
        tone(s, { type: 'sawtooth', f: N(n) * p, dur: 2.4, v: 0.035 * v, a: 1.0, hold: 0.6, detune: d + i, filter: { type: 'lowpass', f: 300, f2: 5000, at: 1.3, q: 3 } });
      }
    });
    noise(s, { dur: 1.6, v: 0.09 * v, a: 1.2, filter: { type: 'highpass', f: 5000 } });
    ['C5', 'E5', 'G5', 'B5', 'D6', 'G6', 'C7'].forEach((n, i) => bell(s, N(n) * p, 1.0 + i * 0.08, 0.9, 0.05 * v, 3.01, 1.6));
    tone(s, { f: 65 * p, f2: 40, t: 1.25, dur: 1, v: 0.35 * v });
    noise(s, { t: 1.25, dur: 1.4, v: 0.08 * v, filter: { type: 'bandpass', f: 6000, q: 0.6 } });
  },
  death: (s, p, v) => {
    ['G4', 'E4', 'C4', 'B3'].forEach((n, i) => {
      tone(s, { type: 'triangle', f: N(n) * p, f2: i === 3 ? N('G3') * p : undefined, glide: 0.5, t: i * 0.22, dur: i === 3 ? 0.9 : 0.3, v: 0.2 * v, vib: { rate: 5, depth: 15 } });
      tone(s, { type: 'sine', f: N(n) * p / 2, t: i * 0.22, dur: i === 3 ? 0.9 : 0.3, v: 0.1 * v });
    });
  },
  player_hurt: (s, p, v) => {
    tone(s, { type: 'square', f: 260 * p, f2: 110 * p, dur: 0.18, v: 0.1 * v, filter: { type: 'lowpass', f: 2000 } });
    noise(s, { dur: 0.1, v: 0.18 * v, filter: { type: 'bandpass', f: 1100, q: 1 } });
  },
  monster_hit: (s, p, v) => {
    const q = p * rnd(0.92, 1.08);
    noise(s, { dur: 0.07, v: 0.32 * v, filter: { type: 'bandpass', f: 1900 * q, q: 1.1 } });
    tone(s, { f: 190 * q, f2: 70, dur: 0.08, v: 0.32 * v });
    tone(s, { type: 'triangle', f: 900 * q, f2: 500 * q, dur: 0.04, v: 0.06 * v });
  },
  monster_crit: (s, p, v) => {
    const q = p * rnd(0.95, 1.05);
    noise(s, { dur: 0.12, v: 0.35 * v, filter: { type: 'bandpass', f: 1500 * q, q: 0.8 } });
    tone(s, { f: 220 * q, f2: 55, dur: 0.14, v: 0.4 * v });
    tone(s, { type: 'triangle', f: 1480 * q, dur: 0.25, v: 0.1 * v, t: 0.01 });
    tone(s, { type: 'sine', f: 2960 * q, dur: 0.18, v: 0.05 * v, t: 0.01 });
  },
  monster_die: (s, p, v) => {
    const q = p * rnd(0.95, 1.05);
    noise(s, { dur: 0.32, v: 0.22 * v, filter: { type: 'lowpass', f: 2600, f2: 250, q: 2 } });
    tone(s, { type: 'triangle', f: 520 * q, f2: 110 * q, dur: 0.28, v: 0.16 * v });
    tone(s, { type: 'sine', f: 1040 * q, f2: 1560 * q, t: 0.12, dur: 0.12, v: 0.05 * v });
  },
  boss_roar: (s, p, v) => {
    const g = gritty(s, 12);
    tone(g, { type: 'sawtooth', f: 85 * p, f2: 48 * p, dur: 1.5, v: 0.22 * v, a: 0.12, hold: 0.4, vib: { rate: 9, depth: 80 }, filter: { type: 'lowpass', f: 900, f2: 300, q: 4 } });
    tone(g, { type: 'square', f: 62 * p, f2: 40 * p, dur: 1.5, v: 0.12 * v, a: 0.15, hold: 0.4, vib: { rate: 13, depth: 60 }, filter: { type: 'lowpass', f: 500 } });
    noise(g, { dur: 1.4, v: 0.25 * v, a: 0.1, hold: 0.3, filter: { type: 'lowpass', f: 700, f2: 200 } });
  },
  // ── casting ──
  cast_arcane: (s, p, v) => {
    tone(s, { type: 'sine', f: 600 * p, f2: 1250 * p, dur: 0.3, v: 0.14 * v, glide: 0.2, vib: { rate: 18, depth: 30 } });
    tone(s, { type: 'triangle', f: 900 * p, f2: 1870 * p, dur: 0.24, v: 0.06 * v, glide: 0.2 });
    for (let i = 0; i < 4; i++) tone(s, { type: 'sine', f: rnd(2400, 4200) * p, t: 0.04 + i * 0.05, dur: 0.07, v: 0.03 * v });
  },
  cast_fire: (s, p, v) => {
    noise(s, { dur: 0.45, v: 0.28 * v, a: 0.05, filter: { type: 'bandpass', f: 320, f2: 1600, at: 0.2, q: 1.2 } });
    noise(s, { t: 0.18, dur: 0.3, v: 0.14 * v, filter: { type: 'lowpass', f: 1400, f2: 400 } });
    tone(s, { f: 95 * p, f2: 60, dur: 0.35, v: 0.18 * v, a: 0.04 });
    crackles(s, 9, 0.02, 0.4, 3500, 0.12 * v);
  },
  cast_ice: (s, p, v) => {
    ['E6', 'B6', 'G#6', 'E7', 'B7'].forEach((n, i) => bell(s, N(n) * p * rnd(0.995, 1.005), i * 0.045, 0.45, 0.085 * v, 3.99, 1.1, undefined, (i % 2 ? 0.3 : -0.3)));
    noise(s, { dur: 0.25, v: 0.07 * v, a: 0.03, filter: { type: 'highpass', f: 6000 } });
  },
  cast_lightning: (s, p, v) => {
    tone(s, { type: 'sawtooth', f: 1300 * p, f2: 180 * p, dur: 0.14, v: 0.12 * v, glide: 0.12, filter: { type: 'bandpass', f: 1800, q: 1.5 } });
    tone(s, { type: 'square', f: 70 * p, dur: 0.14, v: 0.08 * v, vib: { rate: 60, depth: 900 }, filter: { type: 'lowpass', f: 2500 } });
    noise(s, { dur: 0.16, v: 0.2 * v, filter: { type: 'highpass', f: 2500 } });
    crackles(s, 5, 0, 0.15, 5000, 0.12 * v);
  },
  buff: (s, p, v) => {
    noise(s, { dur: 0.4, v: 0.1 * v, a: 0.15, filter: { type: 'bandpass', f: 600, f2: 3000, q: 3 } });
    tone(s, { type: 'triangle', f: N('C5') * p, f2: N('G5') * p, dur: 0.35, v: 0.16 * v, glide: 0.25 });
    ['C6', 'E6', 'G6'].forEach((n, i) => tone(s, { type: 'sine', f: N(n) * p, t: 0.15 + i * 0.05, dur: 0.55, v: 0.07 * v, vib: { rate: 6, depth: 10 } }));
  },
  explosion: (s, p, v) => {
    const g = gritty(s, 6);
    noise(g, { dur: 0.75, v: 0.45 * v, filter: { type: 'lowpass', f: 1800, f2: 90, q: 1 } });
    tone(g, { f: 110 * p, f2: 32, dur: 0.6, v: 0.5 * v });
    noise(s, { dur: 0.06, v: 0.25 * v, filter: { type: 'highpass', f: 2000 } });
    crackles(s, 6, 0.08, 0.5, 2500, 0.06 * v);
  },
  freeze: (s, p, v) => {
    noise(s, { dur: 0.5, v: 0.1 * v, a: 0.05, filter: { type: 'highpass', f: 3000, f2: 7000 } });
    crackles(s, 12, 0, 0.45, 6000, 0.1 * v);
    tone(s, { type: 'sine', f: 2100 * p, f2: 1250 * p, dur: 0.5, v: 0.05 * v, vib: { rate: 22, depth: 25 } });
    bell(s, N('B6') * p, 0.0, 0.5, 0.04 * v, 5.4, 1.4);
  },
  shatter: (s, p, v) => {
    noise(s, { dur: 0.18, v: 0.25 * v, filter: { type: 'highpass', f: 3500 } });
    for (let i = 0; i < 9; i++) {
      tone(s, { type: i % 2 ? 'triangle' : 'sine', f: rnd(2200, 5200) * p, t: rnd(0, 0.18), dur: rnd(0.06, 0.18), v: 0.05 * v });
    }
    tone(s, { f: 300 * p, f2: 120, dur: 0.08, v: 0.15 * v });
  },
  thunder: (s, p, v) => {
    noise(s, { dur: 0.08, v: 0.4 * v, filter: { type: 'highpass', f: 1800 } });
    const g = gritty(s, 4);
    noise(g, { t: 0.03, dur: 1.7, v: 0.42 * v, a: 0.04, filter: { type: 'lowpass', f: 600, f2: 120, q: 0.7 } });
    // rumble pulses
    for (let i = 0; i < 5; i++) noise(g, { t: 0.15 + i * rnd(0.15, 0.25), dur: 0.35, v: 0.15 * v * (1 - i * 0.15), a: 0.04, filter: { type: 'lowpass', f: 260 } });
    tone(g, { f: 55 * p, f2: 35, dur: 1.2, v: 0.25 * v, a: 0.03 });
  },
  zap: (s, p, v) => {
    tone(s, { type: 'square', f: 1900 * p * rnd(0.9, 1.1), f2: 380 * p, dur: 0.07, v: 0.07 * v, filter: { type: 'lowpass', f: 5000 } });
    noise(s, { dur: 0.05, v: 0.13 * v, filter: { type: 'highpass', f: 4000 } });
  },
  whoosh: (s, p, v) => {
    noise(s, { dur: 0.32, v: 0.5 * v, a: 0.08, filter: { type: 'bandpass', f: 450 * p, f2: 2200 * p, at: 0.16, q: 1.6 } });
    noise(s, { dur: 0.25, v: 0.12 * v, a: 0.06, filter: { type: 'lowpass', f: 700 } });
  },
  blink: (s, p, v) => {
    tone(s, { type: 'sine', f: 1600 * p, f2: 300 * p, dur: 0.12, v: 0.1 * v, glide: 0.1 });
    tone(s, { type: 'sine', f: 300 * p, f2: 1800 * p, t: 0.1, dur: 0.14, v: 0.1 * v, glide: 0.12 });
    noise(s, { dur: 0.22, v: 0.08 * v, filter: { type: 'bandpass', f: 2500, f2: 6000, q: 3 } });
  },
  heal: (s, p, v) => {
    ['G5', 'B5', 'D6', 'G6'].forEach((n, i) => {
      tone(s, { type: 'sine', f: N(n) * p, t: i * 0.08, dur: 0.6, v: 0.09 * v, a: 0.03, vib: { rate: 5, depth: 8 } });
      tone(s, { type: 'triangle', f: N(n) * p * 2, t: i * 0.08, dur: 0.3, v: 0.02 * v });
    });
  },
  // ── UI ──
  ui_click: (s, p, v) => {
    tone(s, { type: 'sine', f: 1500 * p, dur: 0.035, v: 0.12 * v });
    tone(s, { type: 'triangle', f: 2400 * p, dur: 0.02, v: 0.04 * v });
  },
  ui_open: (s, p, v) => {
    tone(s, { type: 'sine', f: N('E6') * p, dur: 0.07, v: 0.1 * v });
    tone(s, { type: 'sine', f: N('A6') * p, t: 0.05, dur: 0.1, v: 0.1 * v });
    noise(s, { dur: 0.08, v: 0.03 * v, filter: { type: 'bandpass', f: 4000, q: 2 } });
  },
  ui_close: (s, p, v) => {
    tone(s, { type: 'sine', f: N('A6') * p, dur: 0.07, v: 0.09 * v });
    tone(s, { type: 'sine', f: N('E6') * p, t: 0.05, dur: 0.1, v: 0.09 * v });
  },
  ui_error: (s, p, v) => {
    for (let i = 0; i < 2; i++) tone(s, { type: 'square', f: 170 * p, t: i * 0.1, dur: 0.08, v: 0.08 * v, filter: { type: 'lowpass', f: 1500 } });
  },
  quest_complete: (s, p, v) => {
    const seq: [string, number, number][] = [['C5', 0, 0.12], ['E5', 0.1, 0.12], ['G5', 0.2, 0.12], ['C6', 0.32, 0.6]];
    seq.forEach(([n, t, d]) => {
      tone(s, { type: 'triangle', f: N(n) * p, t, dur: d + 0.2, v: 0.16 * v, vib: { rate: 6, depth: 10, delay: 0.1 } });
      tone(s, { type: 'square', f: N(n) * p, t, dur: d, v: 0.035 * v, filter: { type: 'lowpass', f: 3000 } });
    });
    ['E6', 'G6', 'C7'].forEach((n, i) => bell(s, N(n) * p, 0.34 + i * 0.07, 0.5, 0.035 * v, 3.5, 1.2));
  },
  cast_holy: (s, p, v) => {
    // Soft choir triad with octave air and quiet, harmonic bell shimmer.
    ['C5', 'E5', 'G5'].forEach((n, i) => {
      const f = N(n) * p;
      tone(s, { type: 'sine', f, t: i * 0.015, dur: 0.5 - i * 0.015, v: 0.055 * v, a: 0.07, hold: 0.04, detune: (i - 1) * 4, vib: { rate: 5, depth: 7, delay: 0.06 } });
      tone(s, { type: 'sine', f: f * 2, t: i * 0.015, dur: 0.46 - i * 0.015, v: 0.015 * v, a: 0.09, detune: (1 - i) * 5 });
      bell(s, f * 2, 0.06 + i * 0.025, 0.4 - i * 0.025, 0.018 * v, 2, 0.45);
    });
    noise(s, { dur: 0.5, v: 0.025 * v, a: 0.09, filter: { type: 'highpass', f: 5500 * p } });
  },
  cast_shadow: (s, p, v) => {
    // Breathy falling sweep over a detuned, lightly clipped minor-second growl.
    const g = gritty(s, 1);
    for (const detune of [-9, 9]) {
      tone(g, { type: 'sawtooth', f: N('D3') * p, f2: N('Db3') * p, dur: 0.45, glide: 0.33, v: 0.045 * v, a: 0.045, hold: 0.035, detune, filter: { type: 'lowpass', f: 700 * p, f2: 240 * p, q: 0.8 } });
    }
    noise(s, { dur: 0.45, v: 0.16 * v, a: 0.08, filter: { type: 'bandpass', f: 900 * p, f2: 220 * p, q: 0.7 }, filter2: { type: 'lowpass', f: 2000 * p } });
  },
  curse: (s, p, v) => {
    // A descending tritone with uneasy pitch wobble and a fading hiss.
    tone(s, { type: 'sine', f: N('B4') * p, f2: N('F4') * p, dur: 0.6, glide: 0.5, v: 0.11 * v, a: 0.035, vib: { rate: 7.5, depth: 45 } });
    tone(s, { type: 'triangle', f: N('B3') * p, f2: N('F3') * p, dur: 0.6, glide: 0.5, v: 0.055 * v, a: 0.05, detune: -7, vib: { rate: 6.5, depth: 30 }, filter: { type: 'lowpass', f: 1500 * p, f2: 500 * p } });
    noise(s, { dur: 0.6, v: 0.11 * v, a: 0.06, filter: { type: 'bandpass', f: 3200 * p, f2: 1100 * p, q: 1.2 }, filter2: { type: 'highpass', f: 800 * p } });
  },
  potion: (s, p, v) => {
    for (let i = 0; i < 3; i++) tone(s, { type: 'sine', f: 260 * p, f2: 520 * p, t: i * 0.08, dur: 0.07, v: 0.16 * v, filter: { type: 'lowpass', f: 1200 } });
    bell(s, N('A6') * p, 0.26, 0.35, 0.04 * v, 2, 1);
    tone(s, { type: 'sine', f: N('E6') * p, t: 0.26, dur: 0.3, v: 0.06 * v });
  },
};

/** Per-key base gain (before user SFX volume). */
export const SFX_GAIN: Partial<Record<SfxKey, number>> = {
  ui_click: 0.6, ui_open: 0.7, ui_close: 0.7, monster_hit: 0.75, zap: 0.8, land: 0.6, jump: 0.7,
  boss_roar: 1.1, thunder: 1.0, explosion: 0.95, levelup: 1.0, job_advance: 1.0,
  cast_holy: 0.95, cast_shadow: 0.85, curse: 0.85,
};

/** Rate limits: [minimum gap ms between two plays, max plays per 100ms]. */
export const SFX_LIMIT: Partial<Record<SfxKey, [number, number]>> = {
  monster_hit: [28, 4], monster_crit: [40, 3], monster_die: [45, 3], zap: [30, 3], shatter: [60, 2],
  explosion: [70, 2], thunder: [140, 1], freeze: [60, 2], mesos: [55, 2], pickup: [55, 2],
  ui_click: [35, 2], land: [80, 1], jump: [80, 1], player_hurt: [120, 1], levelup: [400, 1], job_advance: [1000, 1],
  boss_roar: [600, 1], cast_fire: [50, 2], cast_ice: [50, 2], cast_lightning: [50, 2], cast_arcane: [50, 2],
};
