// OWNER: A2 (skill-engine). Small shared helpers for the skill engine.
import Phaser from 'phaser';
import type { IMonster } from '../../core/types';

/** Attack origin. `groundY` (feet line) is used by `rain` when no target is found. */
export interface Origin {
  x: number;
  y: number;
  facing: 1 | -1;
  groundY?: number;
  /** Optional aim point (summons): projectiles are aimed at it instead of flying straight. */
  aimAt?: { x: number; y: number };
}

export const FRONT_MAX_DY = 140;

/**
 * Tiny deterministic scheduler driven by the system's `update(delta)` so everything can be
 * cancelled on map change (unlike scene timers). Callbacks never throw out of `update`.
 */
export class Scheduler {
  private now = 0;
  private items: { at: number; fn: () => void }[] = [];

  /** Runs `fn` after `ms`. `ms <= 0` runs immediately. */
  after(ms: number, fn: () => void): void {
    if (!(ms > 0)) { safe(fn); return; }
    this.items.push({ at: this.now + ms, fn });
  }

  update(dt: number): void {
    this.now += dt;
    if (this.items.length === 0) return;
    const due: (() => void)[] = [];
    const keep: { at: number; fn: () => void }[] = [];
    for (const it of this.items) {
      if (it.at <= this.now) due.push(it.fn); else keep.push(it);
    }
    this.items = keep;
    for (const fn of due) safe(fn);
  }

  clear(): void { this.items = []; }
}

export function safe(fn: () => void): void {
  try { fn(); } catch (e) { console.error('[skills]', e); }
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

type Positionable = { x: number; y: number; rotation?: number; scaleX?: number; alpha?: number; scene?: unknown };

/** True if a (possibly user-returned) GameObject is still alive. */
export function goAlive(go: Phaser.GameObjects.GameObject | null | undefined): go is Phaser.GameObjects.GameObject {
  return !!go && !!(go as unknown as Positionable).scene;
}

export function setPos(go: Phaser.GameObjects.GameObject | null | undefined, x: number, y: number, rotation?: number): void {
  if (!goAlive(go)) return;
  const t = go as unknown as Positionable;
  if (typeof t.x === 'number') { t.x = x; t.y = y; }
  if (rotation !== undefined && typeof t.rotation === 'number') t.rotation = rotation;
}

export function setFacing(go: Phaser.GameObjects.GameObject | null | undefined, facing: 1 | -1): void {
  if (!goAlive(go)) return;
  const t = go as unknown as Positionable;
  if (typeof t.scaleX === 'number') t.scaleX = Math.abs(t.scaleX) * facing;
}

export function destroyGo(go: Phaser.GameObjects.GameObject | null | undefined, fadeMs = 0, scene?: Phaser.Scene): void {
  if (!goAlive(go)) return;
  const t = go as unknown as Positionable;
  if (fadeMs > 0 && scene && typeof t.alpha === 'number') {
    try {
      scene.tweens.add({ targets: go, alpha: 0, duration: fadeMs, onComplete: () => { if (goAlive(go)) go.destroy(); } });
      return;
    } catch { /* fall through */ }
  }
  try { go.destroy(); } catch { /* ignore */ }
}

export function monsterCenter(m: IMonster): { x: number; y: number } {
  try { const b = m.getBounds(); return { x: b.centerX, y: b.centerY }; } catch { return { x: m.x, y: m.y - 20 }; }
}

/** Rect centered at (cx, cy). */
export function rectC(cx: number, cy: number, w: number, h: number): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h);
}

export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
