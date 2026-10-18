// OWNER: Holy tree agent. Hard-edged white (tintable) pixel textures for the holy VFX (prefix `holy_`).
import Phaser from 'phaser';

export const HT = {
  glow: 'holy_glow',     // 64  stepped radial glow (4px grid)
  cross: 'holy_cross',   // 16  pixel holy cross (2px grid)
  mote: 'holy_mote',     // 6   tiny diamond mote
  shaft: 'holy_shaft',   // 16×128 vertical light shaft, bright at the bottom (ground), fading up
  beam: 'holy_beam',     // 128×32 horizontal beam band, solid core, stepped edges
  halo: 'holy_halo',     // 32×12 flat halo ring
  ray: 'holy_ray',       // 8×64 thin ray, head at the bottom
  sigil: 'holy_sigil',   // 64  ring sigil with a cross + 8 rays (2px grid)
} as const;

/** Paint a white texture cell by cell: fn → alpha (0..1) or [alpha, grey]. */
function grid(scene: Phaser.Scene, key: string, w: number, h: number, cell: number,
  fn: (x: number, y: number, gw: number, gh: number) => number | [number, number]): void {
  if (scene.textures.exists(key) || typeof document === 'undefined') return;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const gw = Math.floor(w / cell), gh = Math.floor(h / cell);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const v = fn(x, y, gw, gh);
      const [a, g] = Array.isArray(v) ? v : [v, 255];
      if (!(a > 0)) continue;
      ctx.fillStyle = `rgba(${g},${g},${g},${Math.min(1, a)})`;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  try { scene.textures.addCanvas(key, c); } catch (e) { console.warn(`[holy] texture ${key} failed`, e); }
}

const step = (v: number, n = 4) => (v <= 0 ? 0 : Math.max(1 / n, Math.round(v * n) / n));

export function generateHolyProceduralTextures(scene: Phaser.Scene): void {
  grid(scene, HT.glow, 64, 64, 4, (x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5) / 8;
    return d < 0.2 ? 1 : d < 0.4 ? 0.7 : d < 0.62 ? 0.4 : d < 0.82 ? 0.18 : d < 1 ? 0.07 : 0;
  });
  grid(scene, HT.cross, 16, 16, 2, (x, y) => {
    const vert = x >= 3 && x <= 4 && y >= 0 && y <= 7;
    const hor = y >= 2 && y <= 3 && x >= 1 && x <= 6;
    if (!vert && !hor) return 0;
    return (x === 3 && y <= 6) || (y === 2 && x >= 2) ? 1 : [1, 225];
  });
  grid(scene, HT.mote, 6, 6, 2, (x, y) => (x === 1 || y === 1 ? 1 : 0));
  grid(scene, HT.shaft, 16, 128, 4, (x, y, gw, gh) => {
    const hz = [0.3, 0.8, 0.8, 0.3][x] ?? 0;
    const t = y / (gh - 1); // 0 top → 1 bottom
    return step(hz * (t < 0.12 ? 0.15 : t < 0.3 ? 0.4 : t < 0.55 ? 0.7 : 1));
  });
  grid(scene, HT.beam, 128, 32, 4, (x, y, gw) => {
    const v = [0.15, 0.35, 0.7, 1, 1, 0.7, 0.35, 0.15][y] ?? 0;
    const e = x < 1 || x > gw - 2 ? 0.4 : x < 2 || x > gw - 3 ? 0.75 : 1;
    return step(v * e);
  });
  grid(scene, HT.halo, 32, 12, 2, (x, y) => {
    const d = Math.hypot((x - 7.5) / 7.5, (y - 2.5) / 2.5);
    return d >= 0.62 && d <= 1.05 ? (y <= 2 ? 1 : [1, 220]) : 0;
  });
  grid(scene, HT.ray, 8, 64, 2, (x, y, gw, gh) => {
    const hz = x === 1 || x === 2 ? 1 : 0.45;
    const t = y / (gh - 1);
    return step(hz * (t < 0.25 ? 0.25 : t < 0.55 ? 0.5 : t < 0.85 ? 0.8 : 1));
  });
  grid(scene, HT.sigil, 64, 64, 2, (x, y) => {
    const dx = x - 15.5, dy = y - 15.5, r = Math.hypot(dx, dy);
    if (r >= 13 && r <= 14.6) return 1;                       // outer ring
    if (r >= 9.2 && r <= 10.2) return 0.75;                   // inner ring
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if ((ax < 1 && r < 9) || (ay < 1 && dy < -1 && r < 9) || (ay < 1 && r < 6)) return 1; // cross
    // 8 short rays between the rings
    const m = Math.atan2(dy, dx) / (Math.PI / 4);
    if (r > 10.6 && r < 12.8 && Math.abs(m - Math.round(m)) < 0.14) return 0.9;
    return 0;
  });
}
