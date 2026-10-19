/**
 * Player-designed appearance (character creation). Pure data — safe to import from saves, art, UI and tests.
 * The School robe/hat colours still come from the job's look; these three choices are the student's own and
 * persist across every Year.
 */
import type { Appearance, CharacterLook } from '../core/types';

export const APPEARANCE_OPTIONS = {
  skin: [0xffe0c4, 0xf5c9a0, 0xd9a47a, 0xb37a52, 0x8a5636, 0x5e3a24],
  hair: [0x2a1c14, 0x5a3a22, 0x9a5a2a, 0xe0b45a, 0xf2efe6, 0xd2463c, 0x3f6fd8, 0x8a4fd0],
  accent: [0x7fe3ff, 0xffd447, 0xff6a4a, 0x7dff5a, 0xb48cff, 0xff8ad8, 0xffffff, 0x4ad8c0],
} as const;

export const DEFAULT_APPEARANCE: Appearance = {
  skin: APPEARANCE_OPTIONS.skin[0],
  hair: APPEARANCE_OPTIONS.hair[1],
  accent: APPEARANCE_OPTIONS.accent[0],
};

const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
export function randomAppearance(): Appearance {
  return { skin: pick(APPEARANCE_OPTIONS.skin), hair: pick(APPEARANCE_OPTIONS.hair), accent: pick(APPEARANCE_OPTIONS.accent) };
}

/** A job look with the student's own skin, hair and accent (staff gem + robe trim highlight) applied. */
export function applyAppearance(look: CharacterLook, a?: Appearance | null): CharacterLook {
  if (!a) return look;
  return { ...look, skin: a.skin, hair: a.hair, staffGem: a.accent };
}

/** Stable short key for texture caching, e.g. "ffe0c4-5a3a22-7fe3ff". */
export function appearanceKey(a?: Appearance | null): string {
  if (!a) return 'default';
  const h = (n: number) => (n >>> 0).toString(16).padStart(6, '0').slice(-6);
  return `${h(a.skin)}-${h(a.hair)}-${h(a.accent)}`;
}

/** Repair untrusted save data into a valid appearance (null if absent). */
export function repairAppearance(v: unknown): Appearance | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const col = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 0xffffff ? Math.floor(x) : d);
  return { skin: col(o.skin, DEFAULT_APPEARANCE.skin), hair: col(o.hair, DEFAULT_APPEARANCE.hair), accent: col(o.accent, DEFAULT_APPEARANCE.accent) };
}
