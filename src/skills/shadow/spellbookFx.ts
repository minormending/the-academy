import Phaser from 'phaser';
import { ensureOnce } from '../../art/lazy';
import { pixelizeCanvas } from '../../art/particles';
import type { VfxOptions } from '../../core/types';
import { DEPTH } from '../../core/constants';
import { C, ST } from './textures';
import { fade, image, loop, root, sheet } from './fx';

const T = {
  mine: 'shd_tex_grave_mine', harvest: 'shd_tex_bitter_harvest', tithe: 'shd_tex_blood_tithe',
  passage: 'shd_tex_umbra_passage', dirge: 'shd_tex_dirge_wraith', doom: 'shd_tex_doom_seal',
  relay: 'shd_tex_hex_relay', ward: 'shd_tex_soul_ward',
} as const;
type Glyph = keyof typeof T;
const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** All new silhouettes are hard 1× pixels, uploaded lazily and displayed at exactly 2×. */
export function generateSpellbookTextures(scene: Phaser.Scene): void {
  if (typeof document === 'undefined') return;
  const make = (id: Glyph, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
    if (scene.textures.exists(T[id])) return;
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const c = canvas.getContext('2d');
    if (!c) return;
    c.imageSmoothingEnabled = false;
    draw(c); pixelizeCanvas(canvas, 1, { hard: true });
    scene.textures.addCanvas(T[id], canvas)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  };
  const rect = (c: CanvasRenderingContext2D, col: number, x: number, y: number, w: number, h: number) => {
    c.fillStyle = css(col); c.fillRect(x, y, w, h);
  };
  make('mine', 32, 24, c => {
    rect(c, C.ink, 2, 13, 28, 9); rect(c, C.dark, 4, 15, 24, 5);
    for (const x of [4, 10, 16, 22]) {
      rect(c, C.pale, x, 10, 3, 8); rect(c, C.green, x + 1, 8, 2, 4);
    }
    rect(c, C.ink, 10, 2, 12, 13); rect(c, C.violet, 12, 3, 8, 10);
    rect(c, C.green, 13, 6, 2, 3); rect(c, C.green, 17, 6, 2, 3);
    rect(c, C.pale, 15, 11, 2, 2);
  });
  make('harvest', 48, 32, c => {
    // A serrated green crescent; distinct from Death Scythe's long purple shaft.
    for (let i = 0; i < 9; i++) {
      const x = 4 + i * 4, y = 3 + Math.floor((i - 4) ** 2 / 3);
      rect(c, C.ink, x - 1, y - 1, 7, 8);
      rect(c, C.green, x, y, 5, 4); rect(c, C.pale, x, y, 4, 1);
      if (i % 2 === 0) rect(c, C.violet, x + 2, y + 4, 2, 5);
    }
    rect(c, C.green, 38, 13, 4, 12); rect(c, C.green, 34, 24, 5, 3);
  });
  make('tithe', 24, 28, c => {
    rect(c, C.ink, 3, 9, 18, 9); rect(c, C.violet, 5, 10, 14, 7);
    rect(c, C.pale, 5, 10, 2, 5); rect(c, C.green, 7, 11, 10, 3);
    rect(c, C.ink, 9, 17, 6, 8); rect(c, C.lilac, 11, 17, 2, 6);
    rect(c, C.ink, 5, 24, 14, 3); rect(c, C.pale, 7, 24, 10, 1);
    rect(c, 0x672b49, 10, 1, 4, 7); rect(c, 0xc76c85, 11, 3, 2, 5);
  });
  make('passage', 32, 32, c => {
    rect(c, C.ink, 14, 3, 11, 24); rect(c, C.dark, 16, 5, 9, 19);
    rect(c, C.violet, 4, 12, 16, 3); rect(c, C.lilac, 0, 18, 22, 2);
    rect(c, C.violet, 7, 24, 16, 3); rect(c, C.green, 19, 9, 3, 2);
    for (let i = 0; i < 5; i++) rect(c, C.pale, 22 + i, 12 + i, 2, 10 - i * 2);
    rect(c, C.green, 15, 27, 6, 2);
  });
  make('dirge', 32, 36, c => {
    rect(c, C.ink, 9, 2, 15, 23); rect(c, C.dark, 11, 4, 11, 22);
    rect(c, C.violet, 7, 18, 19, 11);
    for (const x of [8, 15, 22]) rect(c, C.lilac, x, 25, 3, x === 15 ? 10 : 6);
    rect(c, C.pale, 14, 7, 9, 7); rect(c, C.ink, 19, 9, 3, 2);
    rect(c, C.green, 23, 13, 6, 3); rect(c, C.ink, 17, 15, 7, 7);
    rect(c, C.green, 19, 16, 3, 4);
    for (const y of [8, 17, 26]) rect(c, C.green, 2, y, 3, 1);
  });
  make('doom', 32, 32, c => {
    rect(c, C.ink, 1, 1, 30, 30); rect(c, C.lilac, 3, 3, 26, 26);
    c.clearRect(5, 5, 22, 22);
    for (let i = 0; i < 6; i++) {
      rect(c, C.violet, 5 + i * 3, 14 - Math.min(i, 5 - i) * 2, 4, 6 + Math.min(i, 5 - i) * 4);
    }
    rect(c, C.pale, 13, 11, 6, 10); rect(c, C.ink, 15, 12, 2, 8);
    for (const [x, y] of [[1, 1], [25, 1], [1, 25], [25, 25]]) rect(c, C.green, x, y, 6, 3);
  });
  make('relay', 24, 24, c => {
    rect(c, C.ink, 3, 1, 18, 4); rect(c, C.ink, 3, 19, 18, 4);
    rect(c, C.pale, 4, 2, 16, 2); rect(c, C.pale, 4, 20, 16, 2);
    for (let i = 0; i < 8; i++) {
      rect(c, C.violet, 5 + i, 5 + i, 2, 2); rect(c, C.violet, 17 - i, 5 + i, 2, 2);
      rect(c, C.lilac, 12 - i, 12 + i, 2, 2); rect(c, C.lilac, 10 + i, 12 + i, 2, 2);
    }
    rect(c, C.green, 10, 9, 4, 6);
  });
  make('ward', 32, 40, c => {
    rect(c, C.ink, 6, 4, 20, 31); rect(c, C.ink, 3, 34, 26, 5);
    rect(c, C.pale, 8, 5, 16, 28); rect(c, C.dark, 10, 7, 12, 24);
    rect(c, C.violet, 12, 9, 8, 5); rect(c, C.lilac, 14, 10, 4, 2);
    rect(c, C.green, 11, 18, 4, 4); rect(c, C.green, 17, 18, 4, 4);
    rect(c, C.green, 13, 21, 6, 4); rect(c, C.green, 15, 25, 2, 2);
    rect(c, C.lilac, 5, 35, 22, 2);
  });
}

function glyph(scene: Phaser.Scene, id: Glyph, x: number, y: number) {
  // Also safe with a second TextureManager, even if the School's lazy registration was already played.
  ensureOnce(scene, 'shadow-spellbook', generateSpellbookTextures);
  return image(scene, T[id], x, y);
}

export function graveMine(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.Container {
  const c = root(scene, o), floor = (o.groundY ?? o.y + 34) - o.y;
  c.add(glyph(scene, 'mine', 0, floor - 16));
  for (const x of [-88, 88]) c.add(image(scene, ST.bone, x, floor).setTint(C.green));
  const eye = image(scene, ST.mote, 0, floor - 26);
  c.add(eye); loop(scene, c, { targets: eye, alpha: 0.2, duration: 450, yoyo: true });
  return c;
}

export function mineBurst(scene: Phaser.Scene, o: VfxOptions): void {
  const floor = o.groundY ?? o.y + 34;
  for (let i = -2; i <= 2; i++) {
    const tooth = image(scene, ST.bone, o.x + i * 32, floor).setRotation(Math.PI / 2);
    fade(scene, tooth, 380, { y: o.y - 28 - (2 - Math.abs(i)) * 8 });
  }
  const cloud = sheet(scene, 'cm_nebula', o.x, o.y, { dur: 450, alpha: 0.7 }) ?? glyph(scene, 'mine', o.x, o.y);
  fade(scene, cloud, 460);
}

export function bitterHarvest(scene: Phaser.Scene, o: VfxOptions): void {
  const blade = glyph(scene, 'harvest', o.x - o.facing * 55, o.y + 20).setFlipX(o.facing < 0);
  fade(scene, blade, 400, { x: o.x + o.facing * 55, y: o.y - 22 });
  for (const x of [-85, 0, 85]) {
    const venom = image(scene, ST.mote, o.x + x, o.y - 28).setTint(C.green);
    fade(scene, venom, 460, { x: o.x, y: o.y + 10 });
  }
}

export function bloodTithe(scene: Phaser.Scene, o: VfxOptions): void {
  const cup = glyph(scene, 'tithe', o.x, o.y - 36);
  fade(scene, cup, 750, { y: o.y - 60 });
  for (const side of [-1, 1]) {
    const drop = image(scene, ST.mote, o.x + side * 30, o.y - 12).setTint(0xc76c85);
    fade(scene, drop, 450, { x: o.x, y: o.y - 36 });
  }
  const mana = sheet(scene, 'sf_heal', o.x, o.y - 40, { dur: 650 }) ?? image(scene, ST.ring, o.x, o.y - 40);
  fade(scene, mana, 680);
}

export function umbraPassage(scene: Phaser.Scene, o: VfxOptions): void {
  const dx = (o.targetX ?? o.x) - o.x, dy = (o.targetY ?? o.y) - o.y;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 60));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const shade = glyph(scene, 'passage', o.x + dx * t, o.y + dy * t).setFlipX(dx < 0).setAlpha(0.35 + 0.65 * t);
    fade(scene, shade, 380 + i * 30, { y: shade.y - 8 });
  }
}

export function dirgeWraith(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.Container {
  const c = root(scene, o), body = glyph(scene, 'dirge', 0, 0);
  c.setDepth(DEPTH.SUMMON).add(body);
  loop(scene, c, { targets: body, y: -4, alpha: 0.6, duration: 400, yoyo: true, ease: 'Stepped', easeParams: [2] });
  return c;
}

export function dirgeBeam(scene: Phaser.Scene, o: VfxOptions): void {
  const dx = (o.targetX ?? o.x + o.facing * 360) - o.x;
  const n = Math.max(1, Math.ceil(Math.abs(dx) / 44));
  for (let i = 0; i < n; i++) {
    const x = o.x + dx * (i + 0.5) / n;
    const note = image(scene, ST.shackle, x, o.y).setTint(C.green);
    fade(scene, note, 280, { x: x + o.facing * 18 });
    const spark = sheet(scene, 'sf_ring', x, o.y, { dur: 260, alpha: 0.5 });
    if (spark) fade(scene, spark, 280);
  }
}

export function doomSeal(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.Container {
  const c = root(scene, o), seal = glyph(scene, 'doom', 0, 0);
  c.add(seal);
  for (const x of [-116, 116]) for (const y of [-70, 70]) c.add(image(scene, ST.shackle, x, y).setAlpha(0.7));
  loop(scene, c, { targets: seal, alpha: 0.3, duration: 300, yoyo: true });
  return c;
}

export function doomCollapse(scene: Phaser.Scene, o: VfxOptions): void {
  for (const x of [-112, 112]) for (const y of [-68, 68]) {
    const seal = glyph(scene, 'doom', o.x + x, o.y + y);
    fade(scene, seal, 380, { x: o.x, y: o.y });
  }
  const flash = sheet(scene, 'cm_midnight', o.x, o.y, { dur: 450 }) ?? glyph(scene, 'doom', o.x, o.y);
  fade(scene, flash, 470);
}

export function hexRelay(scene: Phaser.Scene, o: VfxOptions): void {
  const dx = (o.targetX ?? o.x + o.facing * 180) - o.x, dy = (o.targetY ?? o.y) - o.y;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 50));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const hourglass = glyph(scene, 'relay', o.x + dx * t, o.y + dy * t);
    fade(scene, hourglass, 350, { y: hourglass.y - 6 });
  }
}

export function soulWard(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.Container {
  const c = root(scene, o), floor = (o.groundY ?? o.y + 34) - o.y;
  c.add(glyph(scene, 'ward', 0, floor - 38));
  for (const x of [-150, -90, 90, 150]) {
    const bone = image(scene, ST.bone, x, floor).setTint(C.green);
    c.add(bone); loop(scene, c, { targets: bone, alpha: 0.35, duration: 900, yoyo: true });
  }
  return c;
}

export function soulWardPulse(scene: Phaser.Scene, o: VfxOptions): void {
  for (const side of [-1, 1]) {
    const soul = glyph(scene, 'ward', o.x + side * 120, o.y);
    fade(scene, soul, 650, { x: o.x, y: o.y - 24 });
  }
  const ripple = sheet(scene, 'cm_shield', o.x, o.y, { dur: 650, alpha: 0.5 }) ?? image(scene, ST.ring, o.x, o.y);
  fade(scene, ripple, 680);
}
