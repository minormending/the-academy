// OWNER: A10 (art-audio). Small color + seeded-random helpers shared by the character/icon painters.

export function rgb(n: number): [number, number, number] {
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function fromRgb(r: number, g: number, b: number): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (c(r) << 16) | (c(g) << 8) | c(b);
}

/** CSS rgba() string for a 0xRRGGBB number. */
export function css(n: number, a = 1): string {
  const [r, g, b] = rgb(n);
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

/** Linear mix a→b by t (0..1). */
export function mix(a: number, b: number, t: number): number {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
  return fromRgb(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** f > 0 lightens toward white, f < 0 darkens toward black. */
export function shade(n: number, f: number): number {
  return f >= 0 ? mix(n, 0xffffff, f) : mix(n, 0x000000, -f);
}

/** Outline color for a fill: a darker, slightly saturated version. */
export function outline(n: number): number {
  return mix(shade(n, -0.6), 0x1a1030, 0.25);
}

export function luminance(n: number): number {
  const [r, g, b] = rgb(n);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** FNV-1a string hash → uint32. */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** mulberry32 seeded PRNG → () => [0,1). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Creates a canvas (DOM). Returns null when no document (e.g. tests) so callers can degrade. */
export function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}
