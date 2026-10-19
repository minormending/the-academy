/**
 * Player settings (P7b), persisted in localStorage (`academy-settings-v1`).
 * - shake: camera shake/flash strength, applied once by GameScene (patches the main camera).
 * - damageSize: damage-number scale (DamageNumbers).
 * - familiar: show Pip (PetSystem.setEnabled).
 * - touch: on-screen touch controls (ui/touchControls): auto = shown on touch devices / after the first touch.
 * - textSize: accessibility text size; 'large' toggles `ax-large-text` on <html> (ui.css bumps UI text ~20%).
 * Volumes stay with the audio system (`applySavedVolumes`); the Settings tab only hosts their sliders.
 */
export type ShakeMode = 'on' | 'reduced' | 'off';
export type DamageSize = 'small' | 'normal' | 'large';
export type TouchMode = 'auto' | 'on' | 'off';
export type TextSize = 'normal' | 'large';

export interface Settings {
  shake: ShakeMode;
  damageSize: DamageSize;
  familiar: boolean;
  touch: TouchMode;
  textSize: TextSize;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({ shake: 'on', damageSize: 'normal', familiar: true, touch: 'auto', textSize: 'normal' });

const STORE_KEY = 'academy-settings-v1';
const SHAKES: readonly ShakeMode[] = ['on', 'reduced', 'off'];
const SIZES: readonly DamageSize[] = ['small', 'normal', 'large'];
const TOUCH_MODES: readonly TouchMode[] = ['auto', 'on', 'off'];
const TEXT_SIZES: readonly TextSize[] = ['normal', 'large'];

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
    if (TOUCH_MODES.includes(d.touch as TouchMode)) s.touch = d.touch as TouchMode;
    if (TEXT_SIZES.includes(d.textSize as TextSize)) s.textSize = d.textSize as TextSize;
  } catch { /* storage unavailable / corrupt → defaults */ }
  return s;
}

let current: Settings = load();

/** Mirror the text-size setting onto <html> (`ax-large-text`). Safe without a DOM. */
function applyTextSize(s: Readonly<Settings>) {
  try { if (typeof document !== 'undefined') document.documentElement.classList.toggle('ax-large-text', s.textSize === 'large'); } catch { /* no DOM */ }
}
applyTextSize(current);
const listeners = new Set<(s: Readonly<Settings>, key: keyof Settings) => void>();

export function getSettings(): Readonly<Settings> { return current; }

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  if (current[key] === value) return;
  current = { ...current, [key]: value };
  try { localStorage.setItem(STORE_KEY, JSON.stringify(current)); } catch { /* storage unavailable */ }
  if (key === 'textSize') applyTextSize(current);
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
