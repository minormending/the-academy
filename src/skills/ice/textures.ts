/** Procedural ice textures (all prefixed `ice_`). Drawn near-white/cyan so they also tint well. */
import Phaser from 'phaser';
import { pixelizeTexture } from '../../art/particles';

type Ctx = CanvasRenderingContext2D;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
  // 16-bit pivot: chunky stepped pixels with a posterised (stepped) palette.
  pixelizeTexture(tex, key === 'ice_rune' ? 4 : undefined, { posterize: 6 });
}

function radial(ctx: Ctx, cx: number, cy: number, r: number, stops: [number, string][]): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

function poly(ctx: Ctx, pts: number[][], fill: string | CanvasGradient, stroke?: string, lw = 1): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}

function lin(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** Deterministic pseudo random so textures are stable. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function generateIceTextures(scene: Phaser.Scene): void {
  // soft dot
  make(scene, 'ice_dot', 16, 16, (c, w, h) => radial(c, w / 2, h / 2, w / 2, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]));

  // big glow
  make(scene, 'ice_glow', 64, 64, (c, w, h) => radial(c, w / 2, h / 2, w / 2, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(210,244,255,0.65)'], [0.6, 'rgba(120,200,255,0.2)'], [1, 'rgba(80,160,255,0)']]));

  // frost mist puff (several soft blobs)
  make(scene, 'ice_mist', 64, 64, (c) => {
    const r = rng(7);
    for (let i = 0; i < 7; i++) {
      const x = 20 + r() * 24, y = 22 + r() * 20, rad = 12 + r() * 10;
      radial(c, x, y, rad, [[0, 'rgba(235,250,255,0.55)'], [0.6, 'rgba(190,230,255,0.22)'], [1, 'rgba(180,225,255,0)']]);
    }
  });

  // snowflake
  make(scene, 'ice_flake', 32, 32, (c, w, h) => {
    c.translate(w / 2, h / 2);
    c.strokeStyle = 'rgba(255,255,255,0.95)';
    c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      c.save();
      c.rotate((i * Math.PI) / 3);
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -13); c.stroke();
      c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(0, -6); c.lineTo(-4, -10); c.moveTo(0, -6); c.lineTo(4, -10); c.stroke();
      c.beginPath(); c.moveTo(0, -10); c.lineTo(-2.5, -12.5); c.moveTo(0, -10); c.lineTo(2.5, -12.5); c.stroke();
      c.restore();
    }
    radial(c, 0, 0, 5, [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
  });

  // 4-point sparkle
  make(scene, 'ice_star', 32, 32, (c, w, h) => {
    const cx = w / 2, cy = h / 2;
    radial(c, cx, cy, 10, [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(180,230,255,0)']]);
    poly(c, [[cx, 1], [cx + 2.2, cy - 2.2], [w - 1, cy], [cx + 2.2, cy + 2.2], [cx, h - 1], [cx - 2.2, cy + 2.2], [1, cy], [cx - 2.2, cy - 2.2]], 'rgba(255,255,255,0.98)');
  });

  // small ice shard (points up) -- faceted diamond
  make(scene, 'ice_shard', 16, 32, (c, w, h) => {
    const cx = w / 2;
    poly(c, [[cx, 1], [w - 2, h * 0.42], [cx + 1, h - 2], [2, h * 0.5]], lin(c, 0, 0, w, h, [[0, '#ffffff'], [0.5, '#bfeaff'], [1, '#5aa8f0']]), 'rgba(235,250,255,0.95)', 1);
    poly(c, [[cx, 1], [cx, h - 2], [2, h * 0.5]], 'rgba(120,190,255,0.35)');
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(cx, 3); c.lineTo(cx + 1, h * 0.72); c.stroke();
  });

  // bolt head, points +x
  make(scene, 'ice_bolt', 48, 24, (c, w, h) => {
    const cy = h / 2;
    radial(c, 24, cy, 20, [[0, 'rgba(180,235,255,0.5)'], [1, 'rgba(120,200,255,0)']]);
    poly(c, [[w - 1, cy], [26, cy - 8], [8, cy - 3], [1, cy], [8, cy + 3], [26, cy + 8]], lin(c, 0, 0, w, 0, [[0, '#4aa0f0'], [0.55, '#bfeaff'], [1, '#ffffff']]), 'rgba(240,252,255,0.95)', 1);
    poly(c, [[w - 1, cy], [26, cy - 8], [8, cy - 3], [1, cy]], 'rgba(255,255,255,0.35)');
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(10, cy); c.lineTo(w - 4, cy); c.stroke();
  });

  // long spear, points +x
  make(scene, 'ice_spear', 96, 20, (c, w, h) => {
    const cy = h / 2;
    radial(c, 60, cy, 22, [[0, 'rgba(180,235,255,0.35)'], [1, 'rgba(120,200,255,0)']]);
    poly(c, [[w - 1, cy], [64, cy - 6], [20, cy - 4], [2, cy - 1], [2, cy + 1], [20, cy + 4], [64, cy + 6]], lin(c, 0, 0, w, 0, [[0, 'rgba(70,150,235,0.1)'], [0.3, '#5eb0f5'], [0.75, '#cdf0ff'], [1, '#ffffff']]), 'rgba(235,250,255,0.9)', 1);
    poly(c, [[w - 1, cy], [64, cy - 6], [20, cy - 4], [2, cy - 1], [2, cy]], 'rgba(255,255,255,0.28)');
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(14, cy); c.lineTo(w - 3, cy); c.stroke();
    // facet notches
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1;
    for (const x of [30, 46, 62]) { c.beginPath(); c.moveTo(x, cy - 5); c.lineTo(x + 4, cy); c.lineTo(x, cy + 5); c.stroke(); }
  });

  // tall crystal prism, base at bottom
  make(scene, 'ice_crystal', 40, 80, (c, w, h) => {
    const cx = w / 2;
    poly(c, [[cx, 1], [w - 6, h * 0.3], [w - 4, h - 2], [4, h - 2], [6, h * 0.3]], lin(c, 0, 0, w, h, [[0, '#ffffff'], [0.4, '#aee4ff'], [1, '#3f8fe0']]), 'rgba(235,250,255,0.95)', 1.5);
    poly(c, [[cx, 1], [cx + 2, h - 2], [4, h - 2], [6, h * 0.3]], 'rgba(60,140,235,0.35)');
    poly(c, [[cx, 1], [w - 6, h * 0.3], [w - 4, h - 2], [cx + 2, h - 2]], 'rgba(255,255,255,0.22)');
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(cx, 4); c.lineTo(cx + 1, h - 4); c.moveTo(6, h * 0.3); c.lineTo(w - 6, h * 0.3); c.stroke();
  });

  // ring (soft outer glow, crisp inner line)
  make(scene, 'ice_ring', 128, 128, (c, w, h) => {
    const cx = w / 2, cy = h / 2;
    c.strokeStyle = 'rgba(120,200,255,0.25)'; c.lineWidth = 10;
    c.beginPath(); c.arc(cx, cy, 52, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(210,244,255,0.7)'; c.lineWidth = 5;
    c.beginPath(); c.arc(cx, cy, 56, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,1)'; c.lineWidth = 2;
    c.beginPath(); c.arc(cx, cy, 58, 0, Math.PI * 2); c.stroke();
  });

  // cracks radiating from the centre
  make(scene, 'ice_crack', 96, 96, (c, w, h) => {
    const r = rng(23), cx = w / 2, cy = h / 2;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const branch = (x: number, y: number, a: number, len: number, depth: number): void => {
      let px = x, py = y;
      const segs = 4 + Math.floor(r() * 2);
      for (let i = 0; i < segs; i++) {
        const na = a + (r() - 0.5) * 0.9;
        const nx = px + Math.cos(na) * (len / segs), ny = py + Math.sin(na) * (len / segs);
        c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = depth === 0 ? 2.2 : 1.3;
        c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
        c.strokeStyle = 'rgba(120,200,255,0.4)'; c.lineWidth = depth === 0 ? 5 : 3;
        c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
        if (depth < 1 && r() < 0.5) branch(nx, ny, na + (r() < 0.5 ? 0.8 : -0.8), len * 0.45, depth + 1);
        px = nx; py = ny; a = na;
      }
    };
    for (let i = 0; i < 7; i++) branch(cx, cy, (i / 7) * Math.PI * 2 + r() * 0.4, 40, 0);
    radial(c, cx, cy, 10, [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
  });

  // translucent ice block shell (frozen body), 56x72
  make(scene, 'ice_block', 64, 80, (c, w, h) => {
    poly(c, [[10, 14], [24, 4], [44, 3], [56, 16], [58, 62], [48, 76], [18, 77], [7, 62]], lin(c, 0, 0, w, h, [[0, 'rgba(235,250,255,0.75)'], [0.5, 'rgba(150,210,255,0.5)'], [1, 'rgba(80,150,235,0.6)']]), 'rgba(240,252,255,0.95)', 2);
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(24, 4); c.lineTo(30, 40); c.lineTo(18, 77); c.moveTo(44, 3); c.lineTo(36, 36); c.lineTo(58, 62); c.moveTo(7, 62); c.lineTo(30, 40); c.stroke();
    poly(c, [[12, 18], [24, 8], [28, 20], [14, 28]], 'rgba(255,255,255,0.4)');
  });

  // magic circle / rune
  make(scene, 'ice_rune', 192, 192, (c, w, h) => {
    const cx = w / 2, cy = h / 2;
    c.strokeStyle = 'rgba(200,240,255,0.95)'; c.lineWidth = 3;
    c.beginPath(); c.arc(cx, cy, 90, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 1.5; c.strokeStyle = 'rgba(160,220,255,0.85)';
    c.beginPath(); c.arc(cx, cy, 80, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(cx, cy, 50, 0, Math.PI * 2); c.stroke();
    // two interlocked triangles (hexagram)
    for (const off of [0, Math.PI]) {
      c.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = off + (i * 2 * Math.PI) / 3 - Math.PI / 2;
        const x = cx + Math.cos(a) * 80, y = cy + Math.sin(a) * 80;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath(); c.lineWidth = 2; c.strokeStyle = 'rgba(230,248,255,0.95)'; c.stroke();
    }
    // tick marks + tiny flakes at the six points
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      c.lineWidth = 2; c.strokeStyle = 'rgba(210,244,255,0.9)';
      c.beginPath(); c.moveTo(cx + Math.cos(a) * 84, cy + Math.sin(a) * 84); c.lineTo(cx + Math.cos(a) * 92, cy + Math.sin(a) * 92); c.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      radial(c, cx + Math.cos(a) * 70, cy + Math.sin(a) * 70, 7, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
    }
    radial(c, cx, cy, 24, [[0, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]);
  });

  // frozen orb sphere
  make(scene, 'ice_orb', 96, 96, (c, w, h) => {
    const cx = w / 2, cy = h / 2;
    radial(c, cx, cy, 46, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(190,236,255,0.95)'], [0.8, 'rgba(70,150,235,0.95)'], [1, 'rgba(30,90,200,0)']]);
    c.save();
    c.beginPath(); c.arc(cx, cy, 34, 0, Math.PI * 2); c.clip();
    c.strokeStyle = 'rgba(255,255,255,0.65)'; c.lineWidth = 1.5;
    const r = rng(41);
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      c.moveTo(cx + (r() - 0.5) * 20, cy + (r() - 0.5) * 20);
      c.lineTo(cx + (r() - 0.5) * 80, cy + (r() - 0.5) * 80);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = 'rgba(240,252,255,0.95)'; c.lineWidth = 2;
    c.beginPath(); c.arc(cx, cy, 34, 0, Math.PI * 2); c.stroke();
    radial(c, cx - 11, cy - 12, 12, [[0, 'rgba(255,255,255,0.95)'], [1, 'rgba(255,255,255,0)']]);
  });

  // frost elemental torso (faceted, tapering to a spike), 64x88
  make(scene, 'ice_elem_body', 64, 88, (c, w, h) => {
    const cx = w / 2;
    // tapered lower spike
    poly(c, [[cx - 12, 44], [cx + 12, 44], [cx + 4, h - 3], [cx, h - 1], [cx - 4, h - 3]], lin(c, 0, 44, 0, h, [[0, 'rgba(120,195,250,0.95)'], [1, 'rgba(60,130,225,0.15)']]), 'rgba(220,246,255,0.7)', 1);
    // shoulders / chest
    poly(c, [[cx - 24, 28], [cx - 12, 20], [cx + 12, 20], [cx + 24, 28], [cx + 17, 48], [cx - 17, 48]], lin(c, 0, 20, w, 50, [[0, '#f4fdff'], [0.45, '#a9e0ff'], [1, '#4c98e8']]), 'rgba(240,252,255,0.95)', 1.5);
    poly(c, [[cx, 20], [cx + 12, 20], [cx + 24, 28], [cx + 17, 48], [cx + 3, 46]], 'rgba(255,255,255,0.22)');
    poly(c, [[cx - 24, 28], [cx - 12, 20], [cx, 20], [cx - 3, 46], [cx - 17, 48]], 'rgba(50,120,225,0.28)');
    // shoulder spikes
    poly(c, [[cx - 24, 28], [cx - 31, 14], [cx - 17, 22]], '#d4f3ff', 'rgba(240,252,255,0.9)', 1);
    poly(c, [[cx + 24, 28], [cx + 31, 14], [cx + 17, 22]], '#d4f3ff', 'rgba(240,252,255,0.9)', 1);
    // head
    poly(c, [[cx - 9, 19], [cx - 7, 7], [cx, 2], [cx + 7, 7], [cx + 9, 19], [cx, 23]], lin(c, 0, 2, w, 22, [[0, '#ffffff'], [0.6, '#b8e8ff'], [1, '#5ca8f0']]), 'rgba(245,253,255,0.95)', 1.2);
    // crown
    poly(c, [[cx - 8, 8], [cx - 11, -1 + 2], [cx - 4, 5]], '#e6f8ff');
    poly(c, [[cx + 8, 8], [cx + 11, -1 + 2], [cx + 4, 5]], '#e6f8ff');
    // chest facet lines
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(cx, 24); c.lineTo(cx, 46); c.moveTo(cx - 17, 48); c.lineTo(cx, 36); c.lineTo(cx + 17, 48); c.stroke();
  });
}
