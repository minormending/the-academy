// OWNER: A3 (fire-tree). Fire-only pixel sheets: palette-swapped copies of the shared CC0 sheets (fire ramp) and a few
// hand-drawn 1× pixel sprites (drawn on a 1px grid, always shown at an integer ×2). Keys: `fire_pxs_<id>` / `fire_pxa_<id>`.
import Phaser from 'phaser';
import { DEPTH, PIXEL_SCALE } from '../../core/constants';
import { RAMPS } from '../../art/particles';

type Rect = [number, number, number, number];

interface FireSheet {
  /** Source texture key (loaded by the vfx manifest), or null for hand-drawn sprites. */
  src: string | null;
  rects: Rect[];
  fps: number;
  /** Recolour to the fire ramp by luminance rank (CC0 sheets in other palettes). */
  recolor?: boolean;
  /** Hand-drawn frames: rows of palette chars, one string[] per frame. */
  art?: string[][];
}

const strip = (fw: number, fh: number, n: number): Rect[] => Array.from({ length: n }, (_, i): Rect => [i * fw, 0, fw, fh]);
const tiles = (...cr: [number, number][]): Rect[] => cr.map(([c, r]): Rect => [c * 16, r * 16, 16, 16]);

/** Palette for hand-drawn sprites ('.' = transparent). */
const PAL: Record<string, number> = {
  k: 0x2a0804, // outline
  d: 0x5c1208, // deep body
  r: 0x9a1a0a, // red
  m: 0xd93512, // crimson
  o: 0xff7a1a, // orange
  g: 0xffb830, // gold
  y: 0xffe27a, // yellow
  w: 0xfff6d8, // white-hot
  n: 0x6b3018, // fuse
};

// 12×12 molten bomb with a fuse (2 frames: spark flicker)
const BOMB_A = [
  '..........y.',
  '.........yw.',
  '........n.y.',
  '....kkkn....',
  '...kmmmmk...',
  '..kmoyommk..',
  '..kmyommrk..',
  '..kmommmrk..',
  '..kmmmmrrk..',
  '...kmrrrk...',
  '....kkkk....',
  '............',
];
const BOMB_B = [
  '.........w..',
  '..........y.',
  '........ny..',
  '....kkkn....',
  '...kmmmmk...',
  '..kmoyommk..',
  '..kmyommrk..',
  '..kmommmrk..',
  '..kmmmmrrk..',
  '...kmrrrk...',
  '....kkkk....',
  '............',
];
// 12×6 ember dart pointing +x (2 frames: tail flicker)
const DART_A = [
  '............',
  '..m..oog....',
  'mmooggyyww..',
  'mmooggyyww..',
  '..m..oog....',
  '............',
];
const DART_B = [
  '............',
  '.m...ogg....',
  '.mmoogyyyww.',
  'm.moogyyyww.',
  '.m...ogg....',
  '............',
];
// 10×10 heat shimmer mote (Overheat aura): a tiny 4-point spark, 3 frames
const MOTE = [
  ['..........', '..........', '....o.....', '....g.....', '..ogwgo...', '....g.....', '....o.....', '..........', '..........', '..........'],
  ['..........', '....o.....', '....g.....', '....y.....', 'oggywyggo.', '....y.....', '....g.....', '....o.....', '..........', '..........'],
  ['..........', '..........', '..........', '....o.....', '...oyo....', '....o.....', '..........', '..........', '..........', '..........'],
];

export const FIRE_SHEETS: Record<string, FireSheet> = {
  // CodeManu protection circle (CC0), green/pink → fire ward ring
  ward: { src: 'src_vfx_cm_shield', rects: strip(36, 36, 16), fps: 16, recolor: true },
  // CodeManu nebula (CC0) → supernova core
  nova: { src: 'src_vfx_cm_nebula', rects: strip(78, 80, 14), fps: 24, recolor: true },
  // Emcee Flesher heal burst (CC0) → cauterize
  heal: { src: 'src_vfx_simplefx', rects: tiles([0, 0], [1, 0], [2, 0], [3, 0], [4, 0]), fps: 14, recolor: true },
  // Emcee Flesher tornado (CC0) → fire whirl (Flame Dash)
  whirl: { src: 'src_vfx_simplefx', rects: tiles([1, 1], [2, 1], [3, 1], [4, 1]), fps: 12, recolor: true },
  // hand-drawn
  bomb: { src: null, rects: strip(12, 12, 2), fps: 10, art: [BOMB_A, BOMB_B] },
  dart: { src: null, rects: strip(12, 6, 2), fps: 14, art: [DART_A, DART_B] },
  mote: { src: null, rects: strip(10, 10, 3), fps: 8, art: MOTE },
};

const texKey = (id: string) => `fire_pxs_${id}`;
const animKey = (id: string) => `fire_pxa_${id}`;

function newCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  return c;
}

/** Luminance-rank palette swap (alpha kept), so even mostly-white sources spread over the whole fire ramp. */
function recolor(src: CanvasImageSource, w: number, h: number, ramp: readonly number[]): HTMLCanvasElement | null {
  const c = newCanvas(w, h);
  const ctx = c?.getContext('2d');
  if (!c || !ctx) return null;
  ctx.drawImage(src, 0, 0);
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
    map[l] = ramp[Math.min(ramp.length - 1, Math.floor(((below + hist[l] / 2) / total) * ramp.length))];
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

function paintArt(frames: string[][], rects: Rect[]): HTMLCanvasElement | null {
  const w = rects.reduce((m, r) => Math.max(m, r[0] + r[2]), 0);
  const h = rects.reduce((m, r) => Math.max(m, r[1] + r[3]), 0);
  const c = newCanvas(w, h);
  const ctx = c?.getContext('2d');
  if (!c || !ctx) return null;
  frames.forEach((rows, f) => {
    const [ox, oy] = rects[f] ?? [0, 0];
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = PAL[row[x]];
        if (col === undefined) continue;
        ctx.fillStyle = `#${col.toString(16).padStart(6, '0')}`;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    });
  });
  return c;
}

/** Builds every fire sheet + anim. Missing sources are skipped (callers fall back). */
export function generateFireSheets(scene: Phaser.Scene): void {
  for (const [id, d] of Object.entries(FIRE_SHEETS)) {
    try {
      const tk = texKey(id), ak = animKey(id);
      if (scene.textures.exists(tk)) continue;
      let canvas: HTMLCanvasElement | null = null;
      if (d.art) canvas = paintArt(d.art, d.rects);
      else if (d.src && scene.textures.exists(d.src)) {
        const src = scene.textures.get(d.src).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
        if (!src || !src.width) continue;
        canvas = d.recolor ? recolor(src, src.width, src.height, RAMPS.fire) : null;
      }
      if (!canvas) continue;
      const t = scene.textures.addCanvas(tk, canvas);
      if (!t) continue;
      d.rects.forEach(([x, y, w, h], i) => t.add(i, 0, x, y, w, h));
      if (!scene.anims.exists(ak)) {
        scene.anims.create({ key: ak, frames: d.rects.map((_, i) => ({ key: tk, frame: i })), frameRate: d.fps, repeat: 0 });
      }
    } catch (e) { console.warn(`[fire] sheet ${id} failed`, e); }
  }
}

export interface FpxOpts {
  scale?: number; depth?: number; add?: boolean; rot?: number; flipX?: boolean;
  ox?: number; oy?: number; alpha?: number; fps?: number; dur?: number; delay?: number;
  loop?: boolean; randomStart?: boolean;
}

/** Play a fire sheet: one-shots self-destroy on completion, loops persist (owner destroys). Null if missing. */
export function fpx(scene: Phaser.Scene, id: string, x: number, y: number, o: FpxOpts = {}): Phaser.GameObjects.Sprite | null {
  const tk = texKey(id), ak = animKey(id);
  const d = FIRE_SHEETS[id];
  if (!d || !scene.textures.exists(tk) || !scene.anims.exists(ak)) return null;
  const n = d.rects.length;
  const s = scene.add.sprite(x, y, tk, 0);
  s.setScale(o.scale ?? PIXEL_SCALE).setDepth(o.depth ?? DEPTH.VFX).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5);
  if (o.rot) s.setRotation(o.rot);
  if (o.flipX) s.setFlipX(true);
  if (o.alpha !== undefined) s.setAlpha(o.alpha);
  if (o.add) s.setBlendMode(Phaser.BlendModes.ADD);
  const cfg: Phaser.Types.Animations.PlayAnimationConfig = { key: ak };
  if (o.fps) cfg.frameRate = o.fps;
  if (o.dur) cfg.frameRate = Math.max(1, (n * 1000) / o.dur);
  if (o.loop) {
    cfg.repeat = -1;
    if (o.randomStart && n > 1) cfg.startFrame = Math.floor(Math.random() * n);
  } else {
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => { if (s.scene) s.destroy(); });
  }
  if (o.delay && o.delay > 0) {
    s.setVisible(false);
    scene.time.delayedCall(o.delay, () => { if (s.active) { s.setVisible(true); s.play(cfg); } });
  } else s.play(cfg);
  return s;
}

/** Looping fire sheet added to a container. */
export function fpxLoop(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, id: string, x: number, y: number, o: FpxOpts = {}): Phaser.GameObjects.Sprite | null {
  const s = fpx(scene, id, x, y, { ...o, loop: true });
  if (s) parent.add(s);
  return s;
}
