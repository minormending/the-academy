/**
 * Player settings (P7b), persisted in localStorage (`academy-settings-v1`).
 * - shake: camera shake/flash strength, applied once by GameScene (patches the main camera).
 * - damageSize: damage-number scale (DamageNumbers).
 * - familiar: show Pip (PetSystem.setEnabled).
 * Volumes stay with the audio system (`applySavedVolumes`); the Settings tab only hosts their sliders.
 */
export type ShakeMode = 'on' | 'reduced' | 'off';
export type DamageSize = 'small' | 'normal' | 'large';

export interface Settings {
  shake: ShakeMode;
  damageSize: DamageSize;
  familiar: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({ shake: 'on', damageSize: 'normal', familiar: true });

const STORE_KEY = 'academy-settings-v1';
const SHAKES: readonly ShakeMode[] = ['on', 'reduced', 'off'];
const SIZES: readonly DamageSize[] = ['small', 'normal', 'large'];

function load(): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS };
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE_KEY) : null;
    if (!raw) return s;
    const d = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>> | null;
    if (!d || typeof d !== 'object') return s;
    if (SHAKES.includes(d.shake as ShakeMode)) s.shake = d.shake as ShakeMode;
    if (SIZES.includes(d.damageSize as DamageSize)) s.damageSize = d.damageSize as DamageSize;
    if (typeof d.familiar === 'boolean') s.familiar = d.familiar;
  } catch { /* storage unavailable / corrupt → defaults */ }
  return s;
}

let current: Settings = load();
const listeners = new Set<(s: Readonly<Settings>, key: keyof Settings) => void>();

export function getSettings(): Readonly<Settings> { return current; }

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  if (current[key] === value) return;
  current = { ...current, [key]: value };
  try { localStorage.setItem(STORE_KEY, JSON.stringify(current)); } catch { /* storage unavailable */ }
  for (const cb of [...listeners]) {
    try { cb(current, key); } catch (e) { console.warn('[settings] listener failed', e); }
  }
}

/** Subscribe to setting changes; returns an unsubscribe function. */
export function onSettingsChanged(cb: (s: Readonly<Settings>, key: keyof Settings) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Multiplier for camera shake intensity (1 / 0.35 / 0). */
export function shakeScale(): number { return current.shake === 'off' ? 0 : current.shake === 'reduced' ? 0.35 : 1; }

/** Peak alpha of camera flashes (1 / 0.4 / 0). */
export function flashAlpha(): number { return current.shake === 'off' ? 0 : current.shake === 'reduced' ? 0.4 : 1; }

/** Damage-number scale: 2/3 and 4/3 keep the 3× pixel digits on whole pixels. */
export function damageNumberScale(): number {
  return current.damageSize === 'small' ? 2 / 3 : current.damageSize === 'large' ? 4 / 3 : 1;
}
