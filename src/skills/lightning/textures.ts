// OWNER: A5 (lightning-tree). Procedural textures (all prefixed `ltn_`), drawn white/neutral so they tint.
import Phaser from 'phaser';

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  try {
    const t = scene.textures.createCanvas(key, w, h);
    if (!t) return;
    draw(t.getContext());
    t.refresh();
  } catch {
    /* degrade gracefully: effects fall back to the engine's missing texture */
  }
}

export function generateTextures(scene: Phaser.Scene): void {
  // Soft radial glow (64px) — used for flashes, orbs, columns.
  canvasTex(scene, 'ltn_glow', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,252,225,0.6)');
    g.addColorStop(0.55, 'rgba(255,240,170,0.16)');
    g.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });

  // Tiny hard dot.
  canvasTex(scene, 'ltn_dot', 8, 8, (ctx) => {
    const g = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 8);
  });

  // Spark streak (head on the right so rotation 0 == travelling +x).
  canvasTex(scene, 'ltn_spark', 22, 6, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 22, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.lineTo(19, 0.4);
    ctx.lineTo(22, 3);
    ctx.lineTo(19, 5.6);
    ctx.closePath();
    ctx.fill();
  });

  // Four-point star (32px).
  canvasTex(scene, 'ltn_star', 32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.quadraticCurveTo(17.5, 14.5, 32, 16);
    ctx.quadraticCurveTo(17.5, 17.5, 16, 32);
    ctx.quadraticCurveTo(14.5, 17.5, 0, 16);
    ctx.quadraticCurveTo(14.5, 14.5, 16, 0);
    ctx.fill();
  });

  // Electric ring (96px, circle radius ~42).
  canvasTex(scene, 'ltn_ring', 96, 96, (ctx) => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 11;
    ctx.beginPath(); ctx.arc(48, 48, 40, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(48, 48, 40, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(48, 48, 40, 0, Math.PI * 2); ctx.stroke();
  });

  // Horizontal lens flare (128x24).
  canvasTex(scene, 'ltn_flare', 128, 24, (ctx) => {
    ctx.save();
    ctx.translate(64, 12);
    ctx.scale(1, 12 / 64);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,250,210,0.5)');
    g.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-64, -64, 128, 128);
    ctx.restore();
  });

  // Storm cloud (160x80): dark underside, lit violet rim.
  canvasTex(scene, 'ltn_cloud', 160, 80, (ctx) => {
    const puffs: [number, number, number][] = [
      [30, 50, 24], [58, 40, 30], [88, 36, 32], [118, 42, 28], [140, 52, 20],
      [48, 56, 22], [78, 54, 26], [106, 56, 24], [66, 28, 20], [100, 26, 18],
    ];
    for (const [x, y, r] of puffs) {
      const g = ctx.createRadialGradient(x, y - r * 0.25, r * 0.1, x, y, r);
      g.addColorStop(0, 'rgba(118,104,186,0.95)');
      g.addColorStop(0.55, 'rgba(66,56,120,0.9)');
      g.addColorStop(1, 'rgba(40,34,84,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // darker belly
    const b = ctx.createLinearGradient(0, 40, 0, 80);
    b.addColorStop(0, 'rgba(20,16,50,0)');
    b.addColorStop(1, 'rgba(20,16,50,0.55)');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = b;
    ctx.fillRect(0, 40, 160, 40);
    ctx.globalCompositeOperation = 'source-over';
  });
}
