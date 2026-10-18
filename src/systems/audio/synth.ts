// OWNER: A10 (art-audio). Tiny WebAudio synthesis toolkit shared by SFX and the music sequencer.

export interface SynthCtx {
  ctx: AudioContext;
  out: AudioNode;     // destination for this voice group
  t0: number;         // base start time (seconds, AudioContext clock)
}

export interface FilterOpts { type: BiquadFilterType; f: number; f2?: number; q?: number; at?: number }

export interface ToneOpts {
  type?: OscillatorType;
  f: number;            // start frequency
  f2?: number;          // end frequency (glide)
  glide?: number;       // glide time (default = dur)
  lin?: boolean;        // linear glide (default exponential)
  t?: number;           // offset from t0
  dur: number;          // total length incl. decay
  v?: number;           // peak gain
  a?: number;           // attack time
  hold?: number;        // time at peak before decay
  release?: 'exp' | 'lin';
  detune?: number;      // cents
  filter?: FilterOpts;
  vib?: { rate: number; depth: number; delay?: number }; // depth in cents
  dest?: AudioNode;
  pan?: number;
}

export interface NoiseOpts {
  t?: number; dur: number; v?: number; a?: number; hold?: number;
  filter?: FilterOpts; filter2?: FilterOpts; dest?: AudioNode; release?: 'exp' | 'lin'; rate?: number;
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseBuffers.get(ctx);
  if (!b) {
    const len = Math.floor(ctx.sampleRate * 2);
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, b);
  }
  return b;
}

const shaperCurves = new Map<number, Float32Array<ArrayBuffer>>();
export function shaperCurve(amount: number): Float32Array<ArrayBuffer> {
  let c = shaperCurves.get(amount);
  if (!c) {
    const n = 1024; c = new Float32Array(new ArrayBuffer(n * 4));
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x)); }
    shaperCurves.set(amount, c);
  }
  return c;
}

function envelope(g: GainNode, t: number, v: number, a: number, hold: number, dur: number, release: 'exp' | 'lin' = 'exp') {
  const p = g.gain;
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(Math.max(0.0002, v), t + Math.max(0.002, a));
  if (hold > 0) p.setValueAtTime(Math.max(0.0002, v), t + a + hold);
  if (release === 'lin') p.linearRampToValueAtTime(0.0001, t + dur);
  else p.exponentialRampToValueAtTime(0.0001, t + dur);
}

function makeFilter(ctx: BaseAudioContext, f: FilterOpts, t: number, dur: number): BiquadFilterNode {
  const bq = ctx.createBiquadFilter();
  bq.type = f.type;
  bq.frequency.setValueAtTime(Math.max(10, f.f), t);
  if (f.f2 != null) bq.frequency.exponentialRampToValueAtTime(Math.max(10, f.f2), t + (f.at ?? dur));
  if (f.q != null) bq.Q.value = f.q;
  return bq;
}

function chainOut(s: SynthCtx, node: AudioNode, dest: AudioNode | undefined, pan: number | undefined): void {
  const target = dest ?? s.out;
  if (pan && s.ctx.createStereoPanner) {
    const p = s.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p); p.connect(target);
  } else node.connect(target);
}

/** One enveloped oscillator voice. Returns the oscillator (already scheduled). */
export function tone(s: SynthCtx, o: ToneOpts): OscillatorNode {
  const { ctx } = s;
  const t = s.t0 + (o.t ?? 0);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(Math.max(1, o.f), t);
  if (o.f2 != null) {
    const gt = t + (o.glide ?? o.dur);
    if (o.lin) osc.frequency.linearRampToValueAtTime(Math.max(1, o.f2), gt);
    else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), gt);
  }
  if (o.detune) osc.detune.value = o.detune;
  if (o.vib) {
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = o.vib.rate;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(o.vib.depth, t + (o.vib.delay ?? 0) + 0.05);
    lfo.connect(lg); lg.connect(osc.detune);
    lfo.start(t); lfo.stop(t + o.dur + 0.05);
  }
  const g = ctx.createGain();
  envelope(g, t, o.v ?? 0.3, o.a ?? 0.005, o.hold ?? 0, o.dur, o.release);
  let node: AudioNode = osc;
  if (o.filter) { const f = makeFilter(ctx, o.filter, t, o.dur); osc.connect(f); node = f; }
  node.connect(g);
  chainOut(s, g, o.dest, o.pan);
  osc.start(t); osc.stop(t + o.dur + 0.05);
  return osc;
}

/** Filtered white-noise burst. */
export function noise(s: SynthCtx, o: NoiseOpts): void {
  const { ctx } = s;
  const t = s.t0 + (o.t ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  if (o.rate) src.playbackRate.value = o.rate;
  const g = ctx.createGain();
  envelope(g, t, o.v ?? 0.3, o.a ?? 0.003, o.hold ?? 0, o.dur, o.release);
  let node: AudioNode = src;
  if (o.filter) { const f = makeFilter(ctx, o.filter, t, o.dur); node.connect(f); node = f; }
  if (o.filter2) { const f = makeFilter(ctx, o.filter2, t, o.dur); node.connect(f); node = f; }
  node.connect(g);
  chainOut(s, g, o.dest, undefined);
  src.start(t, Math.random() * 1.5);
  src.stop(t + o.dur + 0.05);
}

/** FM bell / chime. */
export function bell(s: SynthCtx, f: number, t: number, dur: number, v: number, ratio = 3.5, index = 2.2, dest?: AudioNode, pan?: number): void {
  const { ctx } = s;
  const st = s.t0 + t;
  const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
  car.frequency.value = f; mod.frequency.value = f * ratio;
  mg.gain.setValueAtTime(f * index, st);
  mg.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.05), st + dur);
  mod.connect(mg); mg.connect(car.frequency);
  envelope(g, st, v, 0.003, 0, dur);
  car.connect(g);
  chainOut(s, g, dest, pan);
  car.start(st); mod.start(st); car.stop(st + dur + 0.05); mod.stop(st + dur + 0.05);
}

/** Note name ("C#5", "Bb3") → frequency. Returns 0 for unparseable. */
const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteFreq(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 0;
  let n = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const oct = parseInt(m[3], 10);
  n += (oct + 1) * 12;   // MIDI number
  return 440 * Math.pow(2, (n - 69) / 12);
}
export function midiFreq(m: number): number { return 440 * Math.pow(2, (m - 69) / 12); }
export function noteMidi(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return -1;
  return SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
}
