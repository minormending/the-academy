// OWNER: A10 (art-audio). WebAudio-synthesized SFX + procedural music. No audio assets.
//
// The AudioContext is created/resumed on the first user gesture (pointerdown/keydown/touchstart).
// Before that, SFX calls are no-ops and the last requested music key is remembered and started on unlock.
// Volumes persist in localStorage under `arcana-audio`.
import type { IAudio, MusicKey, SfxKey } from '../core/types';
import { SFX, SFX_GAIN, SFX_LIMIT } from './audio/sfx';
import { SongPlayer } from './audio/music';

const STORE_KEY = 'arcana-audio';
const DEFAULTS = { sfx: 0.7, music: 0.4 };
const CROSSFADE = 1.2;
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

type Ctor = typeof AudioContext;

export class AudioSystem implements IAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private vol = { ...DEFAULTS };
  private wantMusic: MusicKey | null = null;
  private song: SongPlayer | null = null;
  private lastPlay = new Map<SfxKey, number[]>();
  private recent: number[] = [];
  private unlocked = false;
  private readonly onGesture = () => this.unlock();

  constructor() {
    this.loadVolumes();
    if (typeof window !== 'undefined') {
      for (const ev of ['pointerdown', 'keydown', 'touchstart', 'mousedown'] as const) {
        window.addEventListener(ev, this.onGesture, { capture: true, passive: true });
      }
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx || !this.unlocked) return;
        if (document.hidden) this.ctx.suspend().catch(() => {});
        else this.ctx.resume().catch(() => {});
      });
    }
  }

  // ───────────────────────────── lifecycle ─────────────────────────────

  /** Creates/resumes the AudioContext. Called automatically on the first user gesture. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const W = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
        const C = W.AudioContext ?? W.webkitAudioContext;
        if (!C) return;
        const ctx = new C();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5;
        comp.attack.value = 0.004; comp.release.value = 0.2;
        const master = ctx.createGain(); master.gain.value = 0.9;
        const sfxBus = ctx.createGain(); sfxBus.gain.value = this.vol.sfx;
        const musicBus = ctx.createGain(); musicBus.gain.value = this.vol.music * 0.7;
        sfxBus.connect(master); musicBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
        this.ctx = ctx; this.master = master; this.sfxBus = sfxBus; this.musicBus = musicBus;
      }
      const ctx = this.ctx;
      const start = () => {
        if (ctx.state !== 'running') return;
        if (!this.unlocked) {
          this.unlocked = true;
          for (const ev of ['pointerdown', 'keydown', 'touchstart', 'mousedown'] as const) {
            window.removeEventListener(ev, this.onGesture, { capture: true });
          }
        }
        if (this.wantMusic && (!this.song || this.song.key !== this.wantMusic)) this.startSong(this.wantMusic);
      };
      if (ctx.state === 'suspended') ctx.resume().then(start).catch(() => {});
      else start();
    } catch (e) {
      console.warn('[audio] unlock failed', e);
    }
  }

  private ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running' && !!this.sfxBus;
  }

  // ───────────────────────────── SFX ─────────────────────────────

  play(key: SfxKey, opts?: { volume?: number; detune?: number }): void {
    if (!this.ready() || this.vol.sfx <= 0) return;
    const recipe = SFX[key];
    if (!recipe) return;
    const nowMs = performance.now();
    // global voice budget
    this.recent = this.recent.filter(t => nowMs - t < 100);
    if (this.recent.length >= 14) return;
    // per-key rate limit
    const [gap, per100] = SFX_LIMIT[key] ?? [25, 3];
    const hist = (this.lastPlay.get(key) ?? []).filter(t => nowMs - t < 100);
    if (hist.length && nowMs - hist[hist.length - 1] < gap) return;
    if (hist.length >= per100) return;
    hist.push(nowMs);
    this.lastPlay.set(key, hist);
    this.recent.push(nowMs);
    try {
      const ctx = this.ctx!;
      const out = ctx.createGain();
      // the more copies of this key are ringing, the quieter each new one is
      out.gain.value = 1 / Math.sqrt(hist.length);
      out.connect(this.sfxBus!);
      const p = Math.pow(2, (opts?.detune ?? 0) / 1200);
      const v = clamp01(opts?.volume ?? 1) * (SFX_GAIN[key] ?? 0.85);
      recipe({ ctx, out, t0: ctx.currentTime + 0.005 }, p, v);
      setTimeout(() => { try { out.disconnect(); } catch { /* ignore */ } }, 4000);
    } catch (e) {
      console.warn(`[audio] sfx ${key} failed`, e);
    }
  }

  // ───────────────────────────── music ─────────────────────────────

  playMusic(key: MusicKey): void {
    this.wantMusic = key;
    if (!this.ready()) return;           // will start on unlock
    if (this.song && this.song.key === key) return;
    this.startSong(key);
  }

  private startSong(key: MusicKey) {
    if (!this.ctx || !this.musicBus) return;
    try {
      const old = this.song;
      if (old) old.stop(CROSSFADE);
      const next = new SongPlayer(this.ctx, this.musicBus, key);
      next.start(old ? CROSSFADE : 0.8);
      this.song = next;
    } catch (e) {
      console.warn(`[audio] music ${key} failed`, e);
    }
  }

  stopMusic(): void {
    this.wantMusic = null;
    if (this.song) { this.song.stop(CROSSFADE); this.song = null; }
  }

  /** The music key currently playing (or requested before unlock). */
  currentMusic(): MusicKey | null { return this.wantMusic; }

  // ───────────────────────────── volumes ─────────────────────────────

  setVolumes(sfx: number, music: number): void {
    this.vol = { sfx: clamp01(sfx), music: clamp01(music) };
    if (this.ctx && this.sfxBus && this.musicBus) {
      const t = this.ctx.currentTime;
      this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
      this.musicBus.gain.setTargetAtTime(this.vol.music * 0.7, t, 0.05);
    }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.vol)); } catch { /* storage unavailable */ }
  }

  getVolumes() { return { ...this.vol }; }

  private loadVolumes() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const v = JSON.parse(raw) as Partial<{ sfx: number; music: number }>;
      this.vol = {
        sfx: typeof v.sfx === 'number' ? clamp01(v.sfx) : DEFAULTS.sfx,
        music: typeof v.music === 'number' ? clamp01(v.music) : DEFAULTS.music,
      };
    } catch { this.vol = { ...DEFAULTS }; }
  }
}

let inst: AudioSystem | null = null;
/** Singleton shared by Title and Game scenes. */
export function getAudio(): IAudio { return (inst ??= new AudioSystem()); }
