// OWNER: A5 (lightning-tree). Constants shared by lightning.ts (data) and lightningVfx.ts (visuals).

/** Thunderstorm geometry. The VFX uses the same numbers to size/time the storm clouds. */
export const STORM = {
  /** Number of lightning impacts at skill level `lv`. */
  count: (lv: number): number => 14 + lv,
  spreadX: 560,
  intervalMs: 120,
  fallHeight: 520,
  /** Horizontal offset (px, mirrored by facing) of the rain area's center from the caster. */
  offsetX: 300,
};

/** Linear interpolation across levels 1..max. */
export function lerpLv(a: number, b: number, lv: number, max: number): number {
  if (max <= 1) return b;
  const t = Math.min(1, Math.max(0, (lv - 1) / (max - 1)));
  return a + (b - a) * t;
}
