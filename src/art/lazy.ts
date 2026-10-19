/**
 * Lazy art generation. Boot used to build every per-School VFX texture/sheet and every job's player sheet up front
 * (~250ms of synchronous canvas work before the Title scene). Now each unit is generated
 *   1. on demand — the first time any of its VFX plays (`lazyRegister`), a job's sheet is asked for, a monster of
 *      that type spawns — so there is never a missing-texture pop-in, and
 *   2. opportunistically — `scheduleIdle` drains a queue one unit per timer tick while the player is still on the
 *      Title screen, so the first cast in a School normally has nothing left to build.
 * Every unit is idempotent and keyed per texture manager (so a second Phaser.Game would start clean).
 */
import type Phaser from 'phaser';
import { registerVfx } from '../core/vfx';
import type { VfxFn } from '../core/types';
import { timed } from './perf';

type Gen = (scene: Phaser.Scene) => void;

const doneByManager = new WeakMap<object, Set<string>>();

/** Run `gen` once per texture manager. Never throws. */
export function ensureOnce(scene: Phaser.Scene, name: string, gen: Gen): void {
  const key = scene.textures;
  let done = doneByManager.get(key);
  if (!done) { done = new Set(); doneByManager.set(key, done); }
  if (done.has(name)) return;
  done.add(name);
  try { timed(name, () => gen(scene)); } catch (e) { console.warn(`[lazy] ${name} failed`, e); }
}

/** Per-School generators, so a job's School can be warmed the moment that job is selected / advanced to. */
const schools = new Map<string, Gen>();

/** Declare a School's texture generator (idempotent; `lazyRegister` / `scheduleIdle` share it via `ensureOnce`). */
export function defineSchool(name: string, gen: Gen): void { schools.set(name, gen); }

/** Move a School to the front of the background queue (its job was just selected); never builds synchronously. */
export function warmSchoolSoon(scene: Phaser.Scene, name: string | undefined): void {
  const gen = name ? schools.get(name) : undefined;
  if (name && gen) scheduleIdle(scene, name, gen, true);
}

interface Job { scene: Phaser.Scene; name: string; gen: Gen }
const queue: Job[] = [];
const queued = new Set<string>();
let pumping = false;
const IDLE_START_MS = 250;
const IDLE_GAP_MS = 30;

/** Queue `gen` to run in the background (one unit per tick). Demand-driven `ensureOnce` calls win the race. */
export function scheduleIdle(scene: Phaser.Scene, name: string, gen: Gen, front = false): void {
  if (doneByManager.get(scene.textures)?.has(name)) return;
  const at = queued.has(name) ? queue.findIndex(j => j.name === name && j.scene === scene) : -1;
  if (at >= 0) {
    if (front && at > 0) queue.unshift(...queue.splice(at, 1));
  } else {
    if (front) queue.unshift({ scene, name, gen }); else queue.push({ scene, name, gen });
    queued.add(name);
  }
  if (pumping) return;
  pumping = true;
  const step = () => {
    const j = queue.shift();
    if (!j) { pumping = false; return; }
    queued.delete(j.name);
    ensureOnce(j.scene, j.name, j.gen);
    setTimeout(step, IDLE_GAP_MS);
  };
  setTimeout(step, front ? IDLE_GAP_MS : IDLE_START_MS);
}

/**
 * Wrap `registerVfx` so the first play of any registered key builds the School's textures first.
 * (Idempotent with the idle pre-warm; after the first call it costs one boolean check.)
 */
export function lazyRegister(name: string, gen: Gen): (key: string, fn: VfxFn) => void {
  let ready = false;
  return (key, fn) => registerVfx(key, (scene, o) => {
    if (!ready) { ensureOnce(scene, name, gen); ready = true; }
    return fn(scene, o);
  });
}
