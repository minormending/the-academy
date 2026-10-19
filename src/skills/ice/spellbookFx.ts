/** Phase 9 silhouettes: whole source pixels, nearest-filtered at exactly x2.
 * Every sheet accent is optional; procedural silhouettes are always present.
 */
import Phaser from 'phaser';
import { ensureOnce } from '../../art/lazy';
import { pxFx } from '../../art/particles';
import { DEPTH } from '../../core/constants';
import type { VfxFn, VfxOptions } from '../../core/types';
import { bindLife } from './fx';

const INK = 0x163452, BLUE = 0x377bac, CYAN = 0x76cce5, PALE = 0xc4eff5, WHITE = 0xf4fcff;
type Group = Phaser.GameObjects.Container;
type Pen = (x: number, y: number, w: number, h: number, color: number) => void;

function gem(p: Pen, x: number, y: number, r: number, color = CYAN): void {
  for (let row = -r; row <= r; row++) {
    const half = r - Math.abs(row);
    p(x - half, y + row, 2 * half + 1, 1, INK);
    if (half > 0) p(x - half + 1, y + row, 2 * half - 1, 1, color);
    if (half > 1) p(x, y + row, 1, 1, WHITE);
  }
}

/** No boot work: these tiny canvases are generated only on the first new effect. */
function textures(scene: Phaser.Scene): void {
  const glyphs: Record<string, (p: Pen) => void> = {
    snare: p => {
      for (let x = 2; x < 31; x += 4) { p(x, 26, 3, 2, INK); p(x, 25, 3, 1, CYAN); }
      for (const x of [5, 15, 25]) { gem(p, x, 17, 5); p(x, 9, 1, 5, WHITE); }
      p(3, 29, 26, 1, BLUE);
    },
    brand: p => {
      gem(p, 16, 13, 10, BLUE); gem(p, 16, 13, 6, PALE);
      for (const x of [8, 16, 24]) { p(x - 2, 27, 5, 4, INK); p(x - 1, 28, 3, 2, CYAN); }
    },
    anchor: p => {
      p(2, 29, 28, 2, INK); p(4, 28, 24, 1, PALE);
      gem(p, 16, 12, 10, PALE); p(15, 18, 3, 10, BLUE);
      p(5, 22, 6, 1, CYAN); p(21, 22, 6, 1, CYAN);
    },
    cup: p => {
      p(5, 18, 23, 9, INK); p(7, 19, 19, 5, BLUE); p(8, 20, 17, 2, PALE);
      p(14, 27, 5, 3, CYAN); p(10, 30, 13, 1, WHITE);
      for (const x of [8, 16, 24]) gem(p, x, 9 - Math.abs(x - 16) / 2, 3, PALE);
    },
  };
  for (const [name, paint] of Object.entries(glyphs)) {
    const key = `ice_book_${name}_px`;
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, 32, 32);
    if (!tex) continue;
    const c = tex.getContext();
    c.imageSmoothingEnabled = false;
    paint((x, y, w, h, color) => {
      c.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      c.fillRect(Math.round(x), Math.round(y), w, h);
    });
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    tex.refresh();
  }
}

function group(scene: Phaser.Scene, o: VfxOptions): Group {
  ensureOnce(scene, 'ice_spellbook', textures);
  return scene.add.container(Math.round(o.x), Math.round(o.y)).setDepth(DEPTH.VFX);
}

function draw(scene: Phaser.Scene, owner: Group, x = 0, y = 0): Pen {
  const g = scene.add.graphics({ x, y }).setScale(2);
  owner.add(g);
  return (px, py, w, h, color) => g.fillStyle(color).fillRect(Math.round(px), Math.round(py), Math.round(w), Math.round(h));
}

function glyph(scene: Phaser.Scene, owner: Group, name: string, x = 0, y = 0): void {
  const key = `ice_book_${name}_px`;
  if (scene.textures.exists(key)) owner.add(scene.add.image(x, y, key).setScale(2));
  else gem(draw(scene, owner, x, y), 0, 0, 8, PALE);
}

function tween(scene: Phaser.Scene, owner: Group, target: Phaser.GameObjects.GameObject,
  config: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>): void {
  const tw = scene.tweens.add({ ...config, targets: target });
  bindLife(owner, () => tw.remove());
}

function finish(scene: Phaser.Scene, owner: Group, hold = 160, fade = 200): void {
  tween(scene, owner, owner, { alpha: 0, delay: hold, duration: fade, onComplete: () => owner.destroy() });
}

function sheet(scene: Phaser.Scene, owner: Group, id: string, x = 0, y = 0, ice = false): void {
  const s = pxFx(scene, id, x, y, { v: ice ? 'ice' : undefined, scale: 2, dur: 320 });
  if (s) owner.add(s);
}

export const rimeSnareBody: VfxFn = (scene, o) => {
  const c = group(scene, o), p = draw(scene, c);
  // The rectangle is exactly the trigger zone, not a decorative oversized ring.
  for (const y of [-30, 30]) for (let x = -45; x < 45; x += 6) p(x, y, 3, 1, BLUE);
  for (const x of [-45, 44]) p(x, -30, 1, 61, BLUE);
  glyph(scene, c, 'snare', 0, 4);
  tween(scene, c, c, { alpha: 0.65, duration: 600, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });
  return c; // Unmirrored +x; custom cast owns the one-use mine's lifetime.
};

export const rimeSnareBurst: VfxFn = (scene, o) => {
  const c = group(scene, o), p = draw(scene, c);
  for (let i = -2; i <= 2; i++) {
    const x = i * 16;
    p(x - 4, -22, 9, 49, INK); p(x - 2, -22, 5, 47, BLUE);
    gem(p, x, -22 + Math.abs(i) * 4, 7, PALE);
  }
  sheet(scene, c, 'sf_shatter');
  finish(scene, c, 160, 260);
};

export const coldSnapArea: VfxFn = (scene, o) => {
  const c = group(scene, o);
  // Two serrated jaws snap inward at the 100ms damage point.
  for (const sign of [-1, 1]) {
    const jaw = scene.add.container(sign * 40, 0); c.add(jaw);
    const p = draw(scene, jaw);
    for (let i = -2; i <= 2; i++) gem(p, sign * Math.abs(i) * 3, i * 12, 6, i % 2 ? CYAN : PALE);
    tween(scene, c, jaw, { x: sign * 4, duration: 100, ease: 'Stepped', easeParams: [5] });
  }
  finish(scene, c, 140, 180);
};

export const rimeBrandCast: VfxFn = (scene, o) => {
  const c = group(scene, o), p = draw(scene, c);
  gem(p, 0, 0, 9, BLUE);
  for (let i = -1; i <= 1; i++) p(i * 7 - 1, 14, 3, 3, PALE);
  finish(scene, c, 80, 200);
};

export const rimeBrandMark: VfxFn = (scene, o) => {
  const c = group(scene, o);
  glyph(scene, c, 'brand');
  tween(scene, c, c, { alpha: 0.6, duration: 500, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });
  return c;
};

export const rimeBrandBloom: VfxFn = (scene, o) => {
  const c = group(scene, o), p = draw(scene, c);
  for (let i = -2; i <= 2; i++) { gem(p, i * 9, -Math.abs(i) * 6, 8, PALE); p(i * 9, 5, 1, 12, CYAN); }
  sheet(scene, c, 'cm_shield', 0, 0, true);
  finish(scene, c, 160, 240);
};

export const fractureRouteTrail: VfxFn = (scene, o) => {
  const c = group(scene, o), p = draw(scene, c), half = Math.round((o.w ?? 268) / 4);
  p(-half, 2, half * 2, 5, INK); p(-half, 2, half * 2, 2, PALE);
  for (let x = -half + 4; x < half; x += 13) {
    gem(p, x, x % 2 ? -5 : 10, 5, CYAN);
    p(x - 4, -13, 9, 1, BLUE);
  }
  for (const x of [-half, half]) gem(p, x, 0, 9, WHITE);
  finish(scene, c, 160, 280);
};

export const coldExchangeCast: VfxFn = (scene, o) => {
  const c = group(scene, o);
  glyph(scene, c, 'cup', 0, -36);
  tween(scene, c, c, { y: o.y - 16, duration: 400, ease: 'Stepped', easeParams: [8] });
  finish(scene, c, 320, 240);
};

export const coldExchangeDrain: VfxFn = (scene, o) => {
  const c = group(scene, o), p = draw(scene, c);
  gem(p, 0, 0, 7, PALE);
  p(-8, -1, 16, 2, INK); // Split crystal becoming a resource, not another hit flash.
  tween(scene, c, c, { x: Math.round(o.targetX ?? o.x), y: Math.round(o.targetY ?? o.y), duration: 360,
    ease: 'Stepped', easeParams: [12] });
  finish(scene, c, 300, 160);
};

export const hailLoomBeam: VfxFn = (scene, o) => {
  const c = group(scene, o), p = draw(scene, c);
  c.setScale(o.facing, 1);
  const n = Math.round(Math.abs((o.targetX ?? o.x + o.facing * 480) - o.x) / 2);
  for (const y of [-11, 0, 11]) { p(0, y - 1, n, 3, INK); p(0, y, n, 1, PALE); }
  for (let x = 12; x < n; x += 24) gem(p, x, 0, 5, BLUE);
  const shuttle = scene.add.container(0, 0); c.add(shuttle);
  const sp = draw(scene, shuttle);
  for (const y of [-11, 0, 11]) gem(sp, 0, y, 4, WHITE);
  tween(scene, c, shuttle, { x: n * 2, duration: 750, ease: 'Stepped', easeParams: [30] });
  tween(scene, c, c, { alpha: 0.35, duration: 75, yoyo: true, repeat: 5 });
  finish(scene, c, 820, 100);
};

export const rimeRecallAnchor: VfxFn = (scene, o) => {
  const c = group(scene, o), p = draw(scene, c);
  glyph(scene, c, 'anchor', 0, -30);
  for (const x of [-24, 24]) { p(x, -3, 7, 2, BLUE); p(x, -3, 1, 5, PALE); }
  tween(scene, c, c, { alpha: 0.6, duration: 750, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });
  return c;
};

export const rimeRecallDepart: VfxFn = (scene, o) => {
  const c = group(scene, o), p = draw(scene, c);
  for (let i = -3; i <= 3; i++) {
    gem(p, i * 17, 10 - Math.abs(i) * 5, 10, PALE);
    p(i * 17 - 1, -20, 2, 18, CYAN);
  }
  sheet(scene, c, 'cm_ring', 0, 0, true);
  finish(scene, c, 180, 260);
};

export const rimeRecallArrive: VfxFn = (scene, o) => {
  const c = group(scene, o), p = draw(scene, c);
  for (const x of [-17, 17]) {
    p(x, -38, 2, 35, INK); p(x, -38, 1, 35, PALE);
    for (let y = -34; y < 0; y += 10) gem(p, x, y, 4, CYAN);
  }
  p(-20, -2, 40, 2, WHITE);
  finish(scene, c, 140, 220);
};

export const diamondReckoningBeam: VfxFn = (scene, o) => {
  const c = group(scene, o), p = draw(scene, c);
  c.setScale(o.facing, 1);
  const n = Math.round(Math.abs((o.targetX ?? o.x + o.facing * 600) - o.x) / 2);
  p(0, -5, n, 11, INK); p(0, -3, n, 7, BLUE); p(0, -1, n, 3, WHITE);
  for (let x = 0; x < n; x += 30) {
    gem(p, x + 12, -12, 10, PALE); gem(p, x + 12, 12, 10, CYAN);
  }
  // Three discrete armor plates unfold into the line. Root scaleY is never animated.
  tween(scene, c, c, { alpha: 0.3, duration: 50, yoyo: true, repeat: 2 });
  finish(scene, c, 320, 200);
};
