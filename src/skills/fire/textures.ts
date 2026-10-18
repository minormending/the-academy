// OWNER: A3 (fire-tree). Procedural white/tintable textures for the fire VFX (prefix `fire_`).
import Phaser from 'phaser';

export const FT = {
  soft: 'fire_soft',       // 64  soft radial blob
  glow: 'fire_glow',       // 128 hot core glow
  ember: 'fire_ember',     // 12  tiny hot dot
  spark: 'fire_spark',     // 24x6 streak, head on the right
  flame: 'fire_flame',     // 48x96 flame tongue pointing up
  comet: 'fire_comet',     // 128x40 comet, head on the right (x ~ 0.875)
  ring: 'fire_ring',       // 128 soft ring
  smoke: 'fire_smoke',     // 64  puffy smoke
  star: 'fire_star',       // 64  4-point star flare
  scorch: 'fire_scorch',   // 128x40 flat ground scorch (tint dark, normal blend)
  rock: 'fire_rock',       // 48  glowing lava rock (coloured, normal blend)
  wing: 'fire_wing',       // 120x100 feather wing, root at (0.333, 0.92), fans upward
  beam: 'fire_beam',       // 128x64 horizontal beam, soft on all edges
} as const;

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: Draw): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  draw(ctx, w, h);
  tex.refresh();
}

function radial(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, stops: [number, number][]): CanvasGradient {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (const [o, a] of stops) g.addColorStop(o, `rgba(255,255,255,${a})`);
  return g;
}

function flamePath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(24, 96);
  ctx.bezierCurveTo(-4, 88, 2, 56, 18, 40);
  ctx.bezierCurveTo(14, 28, 22, 14, 30, 0);
  ctx.bezierCurveTo(32, 16, 40, 26, 38, 42);
  ctx.bezierCurveTo(52, 56, 52, 88, 24, 96);
  ctx.closePath();
}

export function generateFireTextures(scene: Phaser.Scene): void {
  make(scene, FT.soft, 64, 64, (ctx, w, h) => {
    ctx.fillStyle = radial(ctx, w / 2, h / 2, w / 2, [[0, 1], [0.35, 0.55], [0.7, 0.12], [1, 0]]);
    ctx.fillRect(0, 0, w, h);
  });

  make(scene, FT.glow, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = radial(ctx, w / 2, h / 2, w / 2, [[0, 1], [0.12, 0.95], [0.3, 0.5], [0.6, 0.15], [1, 0]]);
    ctx.fillRect(0, 0, w, h);
  });

  make(scene, FT.ember, 12, 12, (ctx, w, h) => {
    ctx.fillStyle = radial(ctx, w / 2, h / 2, w / 2, [[0, 1], [0.5, 0.9], [1, 0]]);
    ctx.fillRect(0, 0, w, h);
  });

  make(scene, FT.spark, 24, 6, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.quadraticCurveTo(w * 0.6, 0, w, h / 2);
    ctx.quadraticCurveTo(w * 0.6, h, 0, h / 2);
    ctx.fill();
  });

  make(scene, FT.flame, 48, 96, (ctx, w, h) => {
    // outer tongue
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    flamePath(ctx);
    ctx.fill();
    // hot inner core
    ctx.save();
    ctx.translate(24, 96);
    ctx.scale(0.5, 0.62);
    ctx.translate(-24, -96);
    const g2 = ctx.createLinearGradient(0, h, 0, 0);
    g2.addColorStop(0, 'rgba(255,255,255,1)');
    g2.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    g2.addColorStop(1, 'rgba(255,255,255,0.2)');
    ctx.fillStyle = g2;
    flamePath(ctx);
    ctx.fill();
    ctx.restore();
  });

  make(scene, FT.comet, 128, 40, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.quadraticCurveTo(60, 2, 112, 5);
    ctx.arc(112, 20, 15, -Math.PI / 2, Math.PI / 2, false);
    ctx.quadraticCurveTo(60, 38, 0, 20);
    ctx.fill();
    ctx.fillStyle = radial(ctx, 112, 20, 20, [[0, 1], [0.5, 0.7], [1, 0]]);
    ctx.fillRect(88, 0, 40, 40);
  });

  make(scene, FT.ring, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = radial(ctx, w / 2, h / 2, w / 2, [[0, 0], [0.68, 0], [0.86, 1], [0.94, 0.35], [1, 0]]);
    ctx.fillRect(0, 0, w, h);
  });

  make(scene, FT.smoke, 64, 64, (ctx) => {
    const pts: [number, number, number][] = [[32, 32, 22], [22, 28, 15], [42, 30, 16], [30, 42, 16], [40, 40, 13], [28, 20, 12]];
    for (const [x, y, r] of pts) {
      ctx.fillStyle = radial(ctx, x, y, r, [[0, 0.5], [0.6, 0.25], [1, 0]]);
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });

  make(scene, FT.star, 64, 64, (ctx, w, h) => {
    ctx.fillStyle = radial(ctx, w / 2, h / 2, w / 2, [[0, 1], [1, 0.1]]);
    ctx.beginPath();
    ctx.moveTo(32, 0);
    ctx.quadraticCurveTo(32, 32, 64, 32);
    ctx.quadraticCurveTo(32, 32, 32, 64);
    ctx.quadraticCurveTo(32, 32, 0, 32);
    ctx.quadraticCurveTo(32, 32, 32, 0);
    ctx.fill();
    ctx.fillStyle = radial(ctx, w / 2, h / 2, 16, [[0, 1], [1, 0]]);
    ctx.fillRect(16, 16, 32, 32);
  });

  make(scene, FT.scorch, 128, 40, (ctx, w, h) => {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, h / w);
    ctx.fillStyle = radial(ctx, 0, 0, w / 2, [[0, 0.9], [0.55, 0.55], [0.85, 0.15], [1, 0]]);
    ctx.fillRect(-w / 2, -w / 2, w, w);
    ctx.restore();
  });

  make(scene, FT.rock, 48, 48, (ctx, w, h) => {
    const c = w / 2;
    ctx.fillStyle = 'rgba(255,120,30,0.35)';
    ctx.beginPath(); ctx.arc(c, c, c - 2, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(c - 6, c - 6, 2, c, c, c - 6);
    g.addColorStop(0, '#6b3018');
    g.addColorStop(1, '#1c0a05');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(c + 18, c);
    for (let i = 1; i <= 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = 17 + ((i * 7) % 5);
      ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ff9a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const cracks = [[-10, -4, 0, 2, 8, 12], [-4, -14, 2, -6, 12, -8], [-12, 8, -4, 8, 2, 16]];
    for (const k of cracks) {
      ctx.beginPath();
      ctx.moveTo(c + k[0], c + k[1]);
      ctx.lineTo(c + k[2], c + k[3]);
      ctx.lineTo(c + k[4], c + k[5]);
      ctx.stroke();
    }
  });

  make(scene, FT.wing, 120, 100, (ctx) => {
    const rx = 40, ry = 92;
    const lens = [58, 72, 82, 88, 80, 64];
    for (let i = 0; i < 6; i++) {
      const a = ((-125 + i * 18) * Math.PI) / 180;
      const L = lens[i];
      const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
      const mx = rx + dx * L * 0.55, my = ry + dy * L * 0.55;
      const wd = 9;
      const tx = rx + dx * L, ty = ry + dy * L;
      const g = ctx.createLinearGradient(rx, ry, tx, ty);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.65)');
      g.addColorStop(1, 'rgba(255,255,255,0.08)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.quadraticCurveTo(mx + nx * wd, my + ny * wd, tx, ty);
      ctx.quadraticCurveTo(mx - nx * wd, my - ny * wd, rx, ry);
      ctx.fill();
    }
    ctx.fillStyle = radial(ctx, rx, ry, 26, [[0, 1], [1, 0]]);
    ctx.fillRect(rx - 26, ry - 26, 52, 52);
  });

  make(scene, FT.beam, 128, 64, (ctx, w, h) => {
    const v = ctx.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(255,255,255,0)');
    v.addColorStop(0.3, 'rgba(255,255,255,0.55)');
    v.addColorStop(0.5, 'rgba(255,255,255,1)');
    v.addColorStop(0.7, 'rgba(255,255,255,0.55)');
    v.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-in';
    const hz = ctx.createLinearGradient(0, 0, w, 0);
    hz.addColorStop(0, 'rgba(255,255,255,0)');
    hz.addColorStop(0.1, 'rgba(255,255,255,1)');
    hz.addColorStop(0.9, 'rgba(255,255,255,1)');
    hz.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  });
}
