// OWNER: A3 (fire-tree). Level-scaling + burn/icon helpers shared by the Phase 9 fire spells (same maths as fire.ts).
import type { IconSpec, StatusSpec } from '../../core/types';

/** Linear interpolation across levels 1..max (clamped). */
export const L = (a: number, b: number, max: number) => (lv: number) => a + ((b - a) * (Math.min(Math.max(lv, 1), max) - 1)) / (max - 1);
/** Same, rounded. */
export const Li = (a: number, b: number, max: number) => { const f = L(a, b, max); return (lv: number) => Math.round(f(lv)); };
export const K = (n: number) => () => n;

export const icon = (glyph: IconSpec['glyph'], color = 0xffd84a, color2 = 0xff5a14): IconSpec => ({ glyph, color, color2, bg: 0x4a1208 });

/** Burn DoT helper (potency = % of the hit per 500ms tick). */
export const burn = (max: number, chance: [number, number], dur: [number, number], pot: [number, number]): StatusSpec => ({
  kind: 'burn', chance: L(chance[0], chance[1], max), durationMs: L(dur[0], dur[1], max), potency: L(pot[0], pot[1], max),
});
