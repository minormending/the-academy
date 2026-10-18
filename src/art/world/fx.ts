// OWNER: A7 (world). Portal art, ambient particle textures, glows (all white-ish where tinting is useful).
import Phaser from 'phaser';
import { type Ctx, circle, css, ellipse, glow, makeTex, poly, star4, vGrad } from './util';

export function generateFxTextures(scene: Phaser.Scene) {
  makeTex(scene, 'w_glow', 128, 128, (c, w) => glow(c, w / 2, w / 2, w / 2, 0xffffff, 1));
  makeTex(scene, 'w_glow_warm', 128, 128, (c, w) => glow(c, w / 2, w / 2, w / 2, 0xffd890, 1));
  makeTex(scene, 'w_portal_swirl', 128, 128, paintSwirl);
  makeTex(scene, 'w_portal_core', 128, 128, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(190,240,255,0.85)'); g.addColorStop(0.7, 'rgba(80,170,255,0.35)'); g.addColorStop(1, 'rgba(40,80,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, w);
  });
  makeTex(scene, 'w_portal_ring', 128, 128, (c, w) => {
    c.strokeStyle = 'rgba(200,245,255,0.95)'; c.lineWidth = 5; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 6, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(120,200,255,0.5)'; c.lineWidth = 10; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 8, 0, Math.PI * 2); c.stroke();
  });
  makeTex(scene, 'w_portal_base', 128, 32, (c, w, h) => {
    ellipse(c, w / 2, h / 2, w / 2 - 2, h / 2 - 2, 'rgba(120,210,255,0.35)');
    ellipse(c, w / 2, h / 2, w / 3, h / 3.2, 'rgba(220,250,255,0.6)');
  });
  makeTex(scene, 'w_hint_arrow', 28, 24, (c, w, h) => {
    poly(c, [[w / 2, 2], [w - 2, h - 4], [2, h - 4]], vGrad(c, 0, h, [[0, 0xffffff], [1, 0xffe27a]]), css(0x7a5a10), 2);
  });
  makeTex(scene, 'w_mote', 16, 16, (c, w) => { glow(c, w / 2, w / 2, w / 2, 0xffffff, 1); circle(c, w / 2, w / 2, 1.6, css(0xffffff)); });
  makeTex(scene, 'w_dot', 6, 6, (c, w) => circle(c, w / 2, w / 2, w / 2, css(0xffffff)));
  makeTex(scene, 'w_spark', 16, 16, (c, w) => { glow(c, w / 2, w / 2, w / 2, 0xffffff, 0.6); star4(c, w / 2, w / 2, w / 2 - 1, css(0xffffff)); });
  makeTex(scene, 'w_leaf', 14, 10, (c, w, h) => {
    c.fillStyle = css(0xffffff); c.beginPath(); c.moveTo(1, h / 2); c.quadraticCurveTo(w / 2, -2, w - 1, h / 2); c.quadraticCurveTo(w / 2, h + 2, 1, h / 2); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(2, h / 2); c.lineTo(w - 2, h / 2); c.stroke();
  });
  makeTex(scene, 'w_petal', 10, 8, (c, w, h) => ellipse(c, w / 2, h / 2, w / 2 - 0.5, h / 2 - 1, css(0xffffff), 0.4));
  makeTex(scene, 'w_snowflake', 12, 12, (c, w) => {
    glow(c, w / 2, w / 2, w / 2, 0xffffff, 0.7); circle(c, w / 2, w / 2, 2.2, css(0xffffff));
  });
  makeTex(scene, 'w_raindrop', 4, 26, (c, w, h) => {
    c.fillStyle = vGrad(c, 0, h, [[0, 0xffffff, 0], [1, 0xffffff, 0.9]]); c.fillRect(1, 0, 2, h);
  });
  makeTex(scene, 'w_ember', 10, 10, (c, w) => { glow(c, w / 2, w / 2, w / 2, 0xffffff, 1); circle(c, w / 2, w / 2, 1.5, css(0xffffff)); });
  makeTex(scene, 'w_smoke', 64, 64, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w);
  });
}

function paintSwirl(ctx: Ctx, w: number, h: number) {
  const cx = w / 2, cy = h / 2;
  ctx.lineCap = 'round';
  for (let arm = 0; arm < 4; arm++) {
    const off = (arm / 4) * Math.PI * 2;
    for (let i = 0; i < 46; i++) {
      const t = i / 46;
      const a = off + t * Math.PI * 2.2;
      const rad = 6 + t * (w / 2 - 10);
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      const s = 1.5 + t * 4.5;
      const alpha = (1 - t) * 0.65 + 0.15;
      circle(ctx, x, y, s, `rgba(${Math.round(140 + 115 * (1 - t))},${Math.round(220 + 35 * (1 - t))},255,${alpha.toFixed(3)})`);
    }
  }
  glow(ctx, cx, cy, 22, 0xffffff, 0.9);
}
