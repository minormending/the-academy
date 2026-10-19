/** Year 5 (Winter Archon) Ice VFX. Hand-pixelled at 1x, shown at exactly 2x, with optional recolored CC0 sheet accents.
 * No textures of their own: registered through the Ice school's lazyRegister, so the school's art is ensured first.
 * Persistent visuals (spire body, aegis aura) are engine-owned; one-shots self-destroy.
 */
import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';
import { pxFx } from '../../art/particles';
import type { VfxFn, VfxOptions } from '../../core/types';
import { bindLife } from './fx';

const INK = 0x12304f, BLUE = 0x3b7cc0, CYAN = 0x84d6f0, PALE = 0xd6f4fc, WHITE = 0xf8fdff, AURORA = 0x9ff0c8;
type Group = Phaser.GameObjects.Container;
type Pixels = Phaser.GameObjects.Graphics;

function group(scene: Phaser.Scene, o: VfxOptions): Group {
  return scene.add.container(Math.round(o.x), Math.round(o.y)).setDepth(DEPTH.VFX);
}
function pixels(scene: Phaser.Scene, owner: Group, x = 0, y = 0): Pixels {
  const g = scene.add.graphics({ x, y }).setScale(2);
  owner.add(g);
  return g;
}
function rect(g: Pixels, x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha).fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}
function gem(g: Pixels, x: number, y: number, r: number, color = CYAN): void {
  for (let row = -r; row <= r; row++) {
    const half = r - Math.abs(row);
    rect(g, x - half, y + row, half * 2 + 1, 1, INK);
    if (half > 0) rect(g, x - half + 1, y + row, half * 2 - 1, 1, color);
    if (half > 1 && row > -r + 1 && row < r - 1) rect(g, x, y + row, 1, 1, WHITE);
  }
}
function snow(g: Pixels, x: number, y: number, r: number): void {
  rect(g, x - r, y, r * 2 + 1, 1, PALE);
  rect(g, x, y - r, 1, r * 2 + 1, PALE);
  for (let i = -r + 1; i < r; i++) { rect(g, x + i, y + i, 1, 1, CYAN); rect(g, x - i, y + i, 1, 1, CYAN); }
  rect(g, x, y, 1, 1, WHITE);
}
function tween(scene: Phaser.Scene, owner: Group, target: Phaser.GameObjects.GameObject,
  cfg: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>): void {
  const tw = scene.tweens.add({ ...cfg, targets: target });
  bindLife(owner, () => tw.stop());
}
function finish(scene: Phaser.Scene, owner: Group, hold = 160, fade = 220): void {
  tween(scene, owner, owner, { alpha: 0, delay: hold, duration: fade, onComplete: () => owner.destroy() });
}
function sheet(scene: Phaser.Scene, owner: Group, id: string, x = 0, y = 0, scale = 2, dur = 400, ice = true): void {
  const s = pxFx(scene, id, x, y, { scale, v: ice ? 'ice' : undefined, dur, alpha: 0.8 });
  if (s) owner.add(s);
}

// ───────────── Boreal Cataclysm: two waves of ice crowns sweep out from the caster ─────────────

const cataclysmCast: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  snow(g, 0, -14, 14);
  for (const s of [-1, 1]) for (let i = 1; i <= 3; i++) gem(g, s * i * 12, -4 - i * 3, 5 - i + 2, i % 2 ? PALE : CYAN);
  sheet(scene, c, 'cm_ring', 0, -20, 3, 420);
  finish(scene, c, 200, 240);
};

const cataclysmArea: VfxFn = (scene, o) => {
  const c = group(scene, o);
  const hw = Math.round((o.w ?? 900) / 4);
  const ground = Math.round((o.groundY !== undefined ? o.groundY - o.y : (o.h ?? 380) / 2 - 28) / 2);
  const base = pixels(scene, c);
  rect(base, -hw, ground - 2, hw * 2, 3, INK); rect(base, -hw, ground - 2, hw * 2, 1, PALE);
  // Two waves (matching the two damage lines): outward from centre, 260ms apart.
  for (let wave = 0; wave < 2; wave++) {
    for (const s of [-1, 1]) {
      const crest = pixels(scene, c, 0, ground);
      for (let i = 0; i < 4; i++) {
        gem(crest, s * i * 7, -i * 4 - 8, 9 - i * 2, i % 2 ? CYAN : PALE);
        rect(crest, s * i * 7 - 1, -i * 4 - 2, 3, i * 4 + 2, BLUE);
      }
      crest.setAlpha(0);
      tween(scene, c, crest, { alpha: 1, delay: wave * 260, duration: 20 });
      tween(scene, c, crest, { x: s * hw * 2, delay: wave * 260, duration: 380, ease: 'Stepped', easeParams: [14] });
      tween(scene, c, crest, { alpha: 0, delay: wave * 260 + 340, duration: 120 });
    }
  }
  sheet(scene, c, 'sf_snow', 0, 0, 4, 600);
  finish(scene, c, 700, 260);
};

// ───────────── Polar Judgment: one huge lance (drawn pointing +x) ─────────────

const judgmentProj: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  rect(g, -24, -4, 30, 9, INK); rect(g, -23, -3, 28, 7, BLUE); rect(g, -23, -1, 28, 3, PALE);
  for (let i = 0; i < 9; i++) { // pointed head
    const half = 5 - Math.floor(i / 2);
    rect(g, 6 + i, -half - 1, 1, half * 2 + 3, INK);
    if (half > 0) rect(g, 6 + i, -half, 1, half * 2 + 1, i < 5 ? CYAN : WHITE);
  }
  for (const y of [-9, 9]) { gem(g, -16, y, 4, PALE); gem(g, -4, y * 1.2, 3, CYAN); }
  rect(g, -34, -1, 10, 3, CYAN, 0.7); rect(g, -42, 0, 8, 1, WHITE, 0.5);
  tween(scene, c, g, { alpha: 0.7, duration: 70, yoyo: true, repeat: -1 });
  return c;
};

const judgmentHit: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  snow(g, 0, 0, 16);
  for (let i = -3; i <= 3; i++) { gem(g, i * 7, (i % 2 ? -10 : 10) - Math.abs(i), 5, i % 2 ? PALE : CYAN); }
  rect(g, -20, -1, 40, 3, WHITE);
  sheet(scene, c, 'sf_shatter', 0, 0, 4, 420);
  finish(scene, c, 140, 240);
};

// ───────────── Eternal Winter: a vast frozen rose window, then five shards of pulse ─────────────

const winterCast: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  snow(g, 0, -18, 24);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    gem(g, Math.round(Math.cos(a) * 30), -18 + Math.round(Math.sin(a) * 28), 4, i % 2 ? PALE : CYAN);
  }
  sheet(scene, c, 'cm_shield', 0, -34, 3, 900);
  sheet(scene, c, 'cm_ring', 0, -34, 5, 700);
  tween(scene, c, g, { y: -10, duration: 800, ease: 'Stepped', easeParams: [10] });
  finish(scene, c, 700, 260);
};

const winterArea: VfxFn = (scene, o) => {
  const c = group(scene, o);
  const hw = Math.round((o.w ?? 1100) / 4), hh = Math.round((o.h ?? 460) / 4);
  const base = pixels(scene, c);
  for (let x = -hw; x <= hw; x += 4) {
    const edge = Math.round(hh * Math.sqrt(Math.max(0, 1 - (x * x) / (hw * hw))));
    rect(base, x, -edge, 4, 2, BLUE); rect(base, x, edge, 4, 2, CYAN);
  }
  // Five pulse rings (one per damage line) expand from the centre; the field floods pale between.
  for (let i = 0; i < 5; i++) {
    const ring = pixels(scene, c);
    const rx = Math.round(hw * 0.6), ry = Math.round(hh * 0.6);
    for (let t = 0; t < 40; t++) {
      const a = (t / 40) * Math.PI * 2;
      rect(ring, Math.cos(a) * rx, Math.sin(a) * ry, 3, 3, i % 2 ? WHITE : PALE);
    }
    ring.setScale(0.2).setAlpha(0);
    tween(scene, c, ring, { alpha: 0.9, delay: i * 190, duration: 30 });
    tween(scene, c, ring, { scaleX: 2 * (1 + 0.08 * i), scaleY: 2 * (1 + 0.08 * i), delay: i * 190, duration: 340, ease: 'Stepped', easeParams: [8] });
    tween(scene, c, ring, { alpha: 0, delay: i * 190 + 300, duration: 100 });
  }
  for (let i = 0; i < 10; i++) {
    const s = pixels(scene, c, (i - 4.5) * (hw / 4.5), -hh - 30);
    gem(s, 0, 0, 7, i % 2 ? PALE : CYAN);
    rect(s, 0, 7, 1, 10, WHITE);
    tween(scene, c, s, { y: hh * 2 - 8, delay: 80 + (i % 5) * 190, duration: 300, ease: 'Stepped', easeParams: [9], repeat: 0 });
    tween(scene, c, s, { alpha: 0, delay: 80 + (i % 5) * 190 + 260, duration: 80 });
  }
  sheet(scene, c, 'cm_nebula', 0, 0, 6, 1100);
  finish(scene, c, 1000, 400);
};

const winterHit: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  for (let i = -2; i <= 2; i++) { gem(g, i * 8, i % 2 ? -10 : 10, 8, PALE); rect(g, i * 8, -18, 1, 36, WHITE); }
  snow(g, 0, 0, 10);
  sheet(scene, c, 'sf_shatter', 0, 0, 4, 420);
  finish(scene, c, 160, 260);
};

// ───────────── Aurora Spire: tall crystal pylon wreathed in aurora ribbons ─────────────

const spireBody: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.SUMMON);
  const g = pixels(scene, c);
  rect(g, -14, 22, 29, 4, INK); rect(g, -12, 21, 25, 2, CYAN);        // plinth
  rect(g, -6, -26, 13, 48, INK); rect(g, -4, -26, 9, 47, BLUE); rect(g, -3, -26, 3, 47, CYAN);
  gem(g, 0, -34, 12, PALE);                                            // apex crystal
  for (const s of [-1, 1]) { gem(g, s * 14, 4, 6, CYAN); gem(g, s * 10, -14, 4, PALE); }
  const ribbons = pixels(scene, c);
  for (let i = 0; i < 3; i++) for (let y = -50; y < 20; y += 3) {
    rect(ribbons, Math.round(Math.sin(y / 9 + i * 2.1) * 18), y, 3, 3, i === 1 ? AURORA : CYAN, 0.7);
  }
  scene.tweens.add({ targets: ribbons, alpha: 0.4, duration: 800, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [4] });
  scene.tweens.add({ targets: g, y: -4, duration: 1100, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });
  const glow = pxFx(scene, 'cm_freezing', 0, -20, { scale: 2, loop: true, add: true, alpha: 0.45, fps: 12 });
  if (glow) c.add(glow);
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 260, ease: 'Stepped', easeParams: [3] });
  return c; // engine owns position / lifetime; mirrored by scaleX (symmetric art)
};

const spirePulse: VfxFn = (scene, o) => {
  const c = group(scene, o);
  const hh = Math.round((o.h ?? 540) / 4), hw = Math.round((o.w ?? 300) / 4);
  for (const s of [-1, 0, 1]) {
    const col = pixels(scene, c, s * Math.round(hw * 0.6), hh);
    for (let y = 0; y < hh * 2; y += 8) { gem(col, 0, -y, 5 - (y % 16 ? 1 : 0), y % 16 ? CYAN : PALE); }
    rect(col, 0, -hh * 2, 1, hh * 2, WHITE, 0.6);
    col.setAlpha(0);
    tween(scene, c, col, { alpha: 1, delay: Math.abs(s) * 40, duration: 40 });
  }
  sheet(scene, c, 'sf_snow', 0, 0, 3, 360);
  finish(scene, c, 120, 220);
};

// ───────────── Cryoclasm: frozen shards detonate outward (double damage on frozen) ─────────────

const cryoclasmArea: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  const hw = Math.round((o.w ?? 660) / 4);
  for (let x = -hw; x <= hw; x += 4) rect(g, x, 0, 4, 1, x % 8 ? CYAN : WHITE);
  for (let i = 0; i < 10; i++) {
    const s = pixels(scene, c);
    gem(s, 0, 0, i % 3 ? 5 : 8, i % 2 ? PALE : CYAN);
    const dir = i % 2 ? 1 : -1;
    tween(scene, c, s, { x: dir * (14 + i * 11), y: ((i * 37) % 60) - 40, duration: 260, ease: 'Stepped', easeParams: [8] });
    tween(scene, c, s, { alpha: 0, delay: 200, duration: 140 });
  }
  snow(g, 0, -4, 18);
  sheet(scene, c, 'cm_ring', 0, 0, 5, 380);
  finish(scene, c, 240, 240);
};

const cryoclasmHit: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  // A cracked-crystal star: X fracture lines plus flying splinters.
  for (let i = -12; i <= 12; i++) { rect(g, i, i, 2, 2, i % 3 ? WHITE : CYAN); rect(g, i, -i, 2, 2, i % 3 ? WHITE : CYAN); }
  for (const [x, y] of [[-16, -6], [15, -9], [-8, 13], [9, 12]]) gem(g, x, y, 4, PALE);
  sheet(scene, c, 'sf_shatter', 0, 0, 4, 380);
  finish(scene, c, 100, 220);
};

// ───────────── Polar Aegis: a crowned shell of ice plates with aurora trim ─────────────

function aegisPlate(g: Pixels, x: number, y: number): void {
  gem(g, x, y, 8, BLUE); gem(g, x, y, 5, PALE); rect(g, x - 1, y - 1, 3, 3, AURORA);
}

const aegisCast: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    aegisPlate(g, Math.round(Math.cos(a) * 22), -20 + Math.round(Math.sin(a) * 22));
  }
  for (let i = -1; i <= 1; i++) gem(g, i * 8, -50 - (i === 0 ? 4 : 0), i === 0 ? 6 : 4, WHITE); // crown
  sheet(scene, c, 'cm_ring', 0, -38, 3, 520);
  tween(scene, c, g, { alpha: 0.2, delay: 200, duration: 100, yoyo: true });
  finish(scene, c, 260, 300);
};

const aegisAura: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) aegisPlate(g, s * 20, -20 + i * 13);
  for (let i = -1; i <= 1; i++) gem(g, i * 7, -48, i === 0 ? 5 : 3, WHITE);
  rect(g, -14, 3, 29, 1, CYAN); rect(g, -10, 4, 21, 1, AURORA);
  const glow = pxFx(scene, 'cm_shield', 0, -38, { scale: 2, v: 'ice', loop: true, alpha: 0.55 });
  if (glow) c.add(glow);
  tween(scene, c, g, { alpha: 0.6, duration: 1000, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [4] });
  return c;
};

// ───────────── Whiteout Passage: a column of blizzard at each end, a streak between ─────────────

const passageOut: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  for (let i = 0; i < 4; i++) {
    gem(g, -o.facing * i * 7, -14 - (i % 2) * 8, 8 - i, i % 2 ? PALE : WHITE);
    rect(g, -o.facing * i * 7 - 8, -2 - i * 6, 14, 1, CYAN);
  }
  sheet(scene, c, 'sf_snow', 0, -26, 3, 340);
  tween(scene, c, g, { x: -o.facing * 18, duration: 280, ease: 'Stepped', easeParams: [6] });
  finish(scene, c, 60, 240);
};

const passageIn: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  rect(g, -14, -2, 28, 3, INK); rect(g, -12, -3, 24, 1, WHITE);
  snow(g, 0, -20, 14);
  for (const x of [-20, 20]) { gem(g, x, -10, 5); rect(g, x, -34, 1, 20, WHITE); }
  sheet(scene, c, 'cm_ring', 0, -30, 3, 320);
  finish(scene, c, 100, 260);
};

const passageTrail: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  const half = Math.round((o.w ?? 400) / 4) - 15;
  rect(g, -half, 5, half * 2, 5, INK); rect(g, -half, 5, half * 2, 2, WHITE);
  for (let x = -half + 5; x < half; x += 12) { gem(g, x, x % 2 ? -4 : 11, 5, x % 3 ? CYAN : PALE); rect(g, x - 4, -12, 9, 1, BLUE); }
  for (const x of [-half, half]) gem(g, x, 6, 9, WHITE);
  finish(scene, c, 180, 300);
};

/** Registered from iceVfx.ts with the Ice school's lazyRegister, so Ice art is ready before any of these play. */
export function registerIceY5Vfx(register: (key: string, fn: VfxFn) => void): void {
  register('ice_boreal_cataclysm_cast', cataclysmCast);
  register('ice_boreal_cataclysm_area', cataclysmArea);
  register('ice_polar_judgment_proj', judgmentProj);
  register('ice_polar_judgment_hit', judgmentHit);
  register('ice_eternal_winter_cast', winterCast);
  register('ice_eternal_winter_area', winterArea);
  register('ice_eternal_winter_hit', winterHit);
  register('ice_aurora_spire_body', spireBody);
  register('ice_aurora_spire_pulse', spirePulse);
  register('ice_cryoclasm_area', cryoclasmArea);
  register('ice_cryoclasm_hit', cryoclasmHit);
  register('ice_polar_aegis_cast', aegisCast);
  register('ice_polar_aegis_aura', aegisAura);
  register('ice_whiteout_passage_out', passageOut);
  register('ice_whiteout_passage_in', passageIn);
  register('ice_whiteout_passage_trail', passageTrail);
}
