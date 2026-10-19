// OWNER: Holy tree agent. Holy pixel sprite sheets: gold / white-light palette swaps of the shared CC0 sheets
// (frame layouts read from PX_SHEETS) plus the holy-only sheets in public/assets/vfx/holy (manifests/holy.ts).
// Built once at boot into `holy_pxs_<id>` textures + `holy_pxa_<id>` anims; `hfx()` plays them like PX4's `pxFx`
// (one-shots self-destroy, loops persist, returns null when the source failed to load → procedural fallback).
import Phaser from 'phaser';
import { DEPTH, PIXEL_SCALE } from '../../core/constants';
import { PX_SHEETS } from '../../art/particles';

/** Holy palette ramps (dark → light). Defined here so the shared particles kit stays untouched. */
export const HOLY_RAMPS = {
  /** warm gold: halos, arrows, crosses */
  gold: [0x4a2c06, 0x8a5a10, 0xd29a22, 0xffc93a, 0xffe27a, 0xfff4c0, 0xffffff],
  /** blinding white-gold: pillars, sunbursts (top-heavy so the core stays white) */
  sun: [0x8a5a10, 0xe8b02a, 0xffd95a, 0xffeea0, 0xfff8e0, 0xffffff, 0xffffff],
  /** cool white / pale cyan: divine light, wards */
  light: [0x2e5878, 0x6aa8d0, 0xa8dcf6, 0xdcf4ff, 0xf6fcff, 0xffffff],
} as const;
export type HolyRamp = keyof typeof HOLY_RAMPS;

type Rect = [number, number, number, number];
interface HolySheet {
  /** Loaded source texture key. */
  src: string;
  rects: Rect[];
  fps: number;
  /** Palette ramp; omitted = keep the source colours. */
  ramp?: HolyRamp;
}

const strip = (fw: number, fh: number, n: number, x0 = 0, y0 = 0): Rect[] =>
  Array.from({ length: n }, (_, i): Rect => [x0 + i * fw, y0, fw, fh]);

/** Re-use a shared PX4 sheet's frame layout under a holy palette. */
function shared(id: string, ramp: HolyRamp | undefined, fps?: number): HolySheet | null {
  const d = PX_SHEETS[id];
  if (!d) return null;
  const rects: Rect[] = d.rects ? d.rects.map(r => [...r] as Rect) : strip(d.fw ?? 16, d.fh ?? 16, d.n ?? 1);
  return { src: `src_vfx_${d.src}`, rects, fps: fps ?? d.fps, ramp };
}

const tile = (c: number, r: number): Rect => [c * 16, r * 16, 16, 16];

/** Every holy sheet. Ids are referenced by hfx(scene, id, …). */
function sheetDefs(): Record<string, HolySheet | null> {
  return {
    // ── recoloured shared sheets ──
    h_arrow: { src: 'src_vfx_simplefx', rects: [tile(0, 3)], fps: 1, ramp: 'gold' },     // Emcee Flesher arrow → golden arrow
    h_bolt: shared('sf_fireball', 'gold'),                                                // small comet → holy bolt
    h_star: shared('sf_star_y', 'sun'),                                                   // twinkle
    h_heal: shared('sf_heal', 'gold'),                                                    // heal burst
    h_ringpop: shared('sf_ring', 'sun'),                                                  // tiny ring pop
    h_spear: shared('ss_icespear', 'gold'),                                                // StarsteelGaming ice spear → light spear (Angel Ray)
    h_burst: shared('ss_thunder', 'gold'),                                                 // sparkling starburst (hits)
    h_pillar: shared('cm_fire', 'gold'),                                                   // CodeManu fire column → pillar of light
    h_pillar_l: shared('cm_fire', 'light'),                                               //   … cool variant
    h_flame: shared('cm_brightfire', 'sun'),                                              // small light flames
    h_sun: shared('cm_sunburn', 'gold'),                                                   // radiant sunburst
    h_nebula: shared('cm_nebula', 'gold'),                                                 // big radiant bloom
    h_ring: shared('cm_ring', 'sun'),                                                     // shockwave ring
    h_ward: shared('cm_shield', 'gold'),                                                  // protection circle → golden ward
    h_ward_l: shared('cm_shield', 'light'),
    h_orbb: shared('sf_orb_b', 'sun'),                                                    // tiny glowing orb (Guardian Spirit core)
    h_orb: shared('g9_spark', 'sun'),                                                // Gothicvania spark orb → light orb
    h_spin: shared('cm_firespin', 'sun'),                                                 // spinning sigil of light
    h_sparkle: shared('spark', 'sun'),                                                    // kurohina spark
    // Phase 9 additions
    h_lash: shared('cm_flamelash', 'sun'),                                                // CodeManu flame lash → dawn streak (Dawn Rush)
    h_vortex: shared('cm_vortex', 'gold'),                                                // CodeManu vortex → martyr's offering swirl
    h_skybolt: shared('g9_lightning', 'sun'),                                             // ansimuz lightning → bolt of judgment (Retribution)
    h_boom: shared('ex3', 'sun'),                                                         // ansimuz explosion 3 → sanctuary burst
    h_slash: shared('sf_slash', 'gold'),                                                  // Emcee Flesher slash → verdict cut
    h_frost_l: shared('cm_freezing', 'light'),                                            // CodeManu freezing → crystalline dome bloom
    // ── holy-only sheets (public/assets/vfx/holy) ──
    h_wings: { src: 'src_vfx_holy_wings', rects: strip(94, 38, 5), fps: 12, ramp: 'gold' }, // Cethiel angel wings effect
    h_wings_l: { src: 'src_vfx_holy_wings', rects: strip(94, 38, 5), fps: 12, ramp: 'light' },
    h_angel: { src: 'src_vfx_holy_angel', rects: strip(48, 64, 3), fps: 4 },              // AntumDeluge/Cabbit angel (faces +x)
    h_wing: { src: 'src_vfx_holy_wing', rects: [[0, 0, 32, 32], [32, 0, 32, 32]], fps: 1, ramp: 'gold' }, // twiswist wing (big, small)
    h_wing_w: { src: 'src_vfx_holy_wing', rects: [[0, 0, 32, 32], [32, 0, 32, 32]], fps: 1 },
  };
}

const sheets: Record<string, HolySheet> = {};
const texKey = (id: string) => `holy_pxs_${id}`;
const animKey = (id: string) => `holy_pxa_${id}`;

function newCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  return c;
}

/** Palette-swap by luminance percentile (same idea as PX4's recolour), alpha preserved. */
function recolor(src: CanvasImageSource, w: number, h: number, ramp: readonly number[] | undefined): HTMLCanvasElement | null {
  const c = newCanvas(w, h);
  const ctx = c?.getContext('2d');
  if (!c || !ctx) return null;
  ctx.drawImage(src, 0, 0);
  if (!ramp) return c;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const lum = (i: number) => Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
  const hist = new Array<number>(256).fill(0);
  let total = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 8) { hist[lum(i)]++; total++; }
  if (!total) return c;
  const map = new Array<number>(256).fill(ramp[0]);
  let below = 0;
  for (let l = 0; l < 256; l++) {
    if (!hist[l]) continue;
    const rank = (below + hist[l] / 2) / total;
    map[l] = ramp[Math.min(ramp.length - 1, Math.floor(rank * ramp.length))];
    below += hist[l];
  }
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const col = map[lum(i)];
    d[i] = (col >> 16) & 255; d[i + 1] = (col >> 8) & 255; d[i + 2] = col & 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Build every holy sheet whose source image loaded. Safe to call more than once. */
export function buildHolySheets(scene: Phaser.Scene): void {
  for (const [id, d] of Object.entries(sheetDefs())) {
    if (!d) continue;
    sheets[id] = d;
    try {
      const tk = texKey(id), ak = animKey(id);
      if (scene.textures.exists(tk)) continue;
      if (!scene.textures.exists(d.src)) continue;
      const src = scene.textures.get(d.src).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      if (!src || !src.width) continue;
      const canvas = recolor(src, src.width, src.height, d.ramp ? HOLY_RAMPS[d.ramp] : undefined);
      if (!canvas) continue;
      const t = scene.textures.addCanvas(tk, canvas);
      if (!t) continue;
      d.rects.forEach(([x, y, w, h], i) => t.add(i, 0, x, y, w, h));
      if (!scene.anims.exists(ak)) {
        scene.anims.create({ key: ak, frames: d.rects.map((_, i) => ({ key: tk, frame: i })), frameRate: d.fps, repeat: 0 });
      }
    } catch (e) { console.warn(`[holy] sheet ${id} failed`, e); }
  }
}

export function hHas(scene: Phaser.Scene, id: string): boolean {
  return scene.textures.exists(texKey(id)) && scene.anims.exists(animKey(id));
}

export interface HfxOpts {
  scale?: number; depth?: number; add?: boolean; rot?: number; flipX?: boolean; flipY?: boolean;
  ox?: number; oy?: number; alpha?: number; tint?: number;
  /** override frame rate, or fit the whole anim into `dur` ms */
  fps?: number; dur?: number; delay?: number;
  loop?: boolean; randomStart?: boolean;
  /** fade alpha to 0 over the one-shot */
  fade?: boolean;
  /** show a single static frame (no anim) — persistent, caller owns lifetime */
  frame?: number;
}

/**
 * Play a holy sheet. One-shots self-destroy on ANIMATION_COMPLETE; loops / static frames persist (the owner destroys them).
 * Returns null when the sheet is missing so callers keep a procedural fallback.
 */
export function hfx(scene: Phaser.Scene, id: string, x: number, y: number, o: HfxOpts = {}): Phaser.GameObjects.Sprite | null {
  const d = sheets[id];
  const tk = texKey(id), ak = animKey(id);
  if (!d || !scene.textures.exists(tk)) return null;
  const n = d.rects.length;
  const s = scene.add.sprite(x, y, tk, Math.min(n - 1, Math.max(0, o.frame ?? 0)));
  s.setScale(o.scale ?? PIXEL_SCALE).setDepth(o.depth ?? DEPTH.VFX).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5);
  if (o.rot) s.setRotation(o.rot);
  if (o.flipX) s.setFlipX(true);
  if (o.flipY) s.setFlipY(true);
  if (o.alpha !== undefined) s.setAlpha(o.alpha);
  if (o.tint !== undefined) s.setTint(o.tint);
  if (o.add) s.setBlendMode(Phaser.BlendModes.ADD);
  if (o.frame !== undefined || !scene.anims.exists(ak)) return s;
  const cfg: Phaser.Types.Animations.PlayAnimationConfig = { key: ak };
  if (o.fps) cfg.frameRate = o.fps;
  if (o.dur) cfg.frameRate = Math.max(1, (n * 1000) / o.dur);
  if (o.loop) {
    cfg.repeat = -1;
    if (o.randomStart && n > 1) cfg.startFrame = Math.floor(Math.random() * n);
  } else {
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => { if (s.scene) s.destroy(); });
    if (o.fade) {
      const total = o.dur ?? (n * 1000) / (o.fps ?? d.fps ?? 12);
      scene.tweens.add({ targets: s, alpha: 0, duration: total, delay: o.delay ?? 0, ease: 'Quad.easeIn' });
    }
  }
  if (o.delay && o.delay > 0) {
    s.setVisible(false);
    scene.time.delayedCall(o.delay, () => { if (s.active) { s.setVisible(true); s.play(cfg); } });
  } else s.play(cfg);
  return s;
}

/** Looping holy sheet added to a container (persistent visuals). */
export function hloop(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, id: string, x: number, y: number, o: HfxOpts = {}): Phaser.GameObjects.Sprite | null {
  const s = hfx(scene, id, x, y, { ...o, loop: true });
  if (s) parent.add(s);
  return s;
}

/** Native frame size of a holy sheet. */
export function hSize(id: string): { w: number; h: number } {
  const r = sheets[id]?.rects[0];
  return r ? { w: r[2], h: r[3] } : { w: 16, h: 16 };
}
