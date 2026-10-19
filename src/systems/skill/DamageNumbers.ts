// OWNER: A2 (skill-engine); 16-bit pixel re-skin by PX5. Maple-style damage numbers rendered from cached per-glyph canvas textures.
import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';
import type { DamageNumberKind } from '../../core/types';
import { damageNumberScale } from '../../core/settings';

interface Style {
  scale: number;               // integer pixel scale of the bitmap digits
  stops: string[];             // fill colour per glyph row band, top→bottom (stepped, no smooth gradient)
  stroke: string;              // 1-source-pixel outline
  shadow: string;              // 1-source-pixel drop shadow (down-right)
  size: number;                // rendered glyph height in px (derived)
  kern: number;                // overlap between glyphs (px)
  pop: number;                 // peak pop scale
  life: number;                // ms
  rise: number;                // px risen over the lifetime
}

/**
 * 16-bit damage digits: glyphs of the bundled CC0 pixel font "Kenney Pixel" (see public/assets/ui/CREDITS.md)
 * are rasterised at their 16px design size, thresholded to hard 1-bit pixels, given a 1px outline + drop
 * shadow + stepped colour bands, then integer-scaled (nearest) into a per-kind atlas.
 */
const FONT = '16px "Kenney Pixel", "Courier New", monospace';

const mk = (scale: number, stops: string[], stroke: string, shadow: string, pop: number, life: number, rise: number): Style =>
  ({ scale, stops, stroke, shadow, size: 0, kern: scale, pop, life, rise });
const STYLES: Record<DamageNumberKind, Style> = {
  monster: mk(3, ['#fff27a', '#ffd23f', '#ffa62a', '#ff7212', '#e04a0a'], '#2a1000', 'rgba(20,6,0,0.6)', 1.3, 900, 46),
  crit:    mk(4, ['#ffffff', '#ffb3cc', '#ff5c8d', '#ff1f4f', '#b0002c'], '#3a0014', 'rgba(40,0,12,0.6)', 1.5, 1000, 52),
  player:  mk(3, ['#f6e8ff', '#dcb2ff', '#b46bff', '#8a2cff', '#5a10c0'], '#1b0434', 'rgba(14,0,30,0.6)', 1.3, 900, 44),
  heal:    mk(3, ['#d8ffb0', '#8ef07a', '#58e06e', '#16b545'], '#05260d', 'rgba(0,20,6,0.55)', 1.2, 900, 40),
  mp:      mk(3, ['#c8ecff', '#8ac4ff', '#5aa2ff', '#2a62ff'], '#03143a', 'rgba(0,8,30,0.55)', 1.2, 900, 40),
  miss:    mk(3, ['#f2f3f6', '#d0d3da', '#b9bdc6', '#80858f'], '#1d2026', 'rgba(0,0,0,0.5)', 1.2, 800, 36),
  dot:     mk(2, ['#ffd07b', '#ffaa3e', '#ff8f2e', '#ff5a12'], '#2a0b00', 'rgba(20,6,0,0.5)', 1.15, 800, 34),
};

const GLYPHS = '0123456789+';
const WORDS = ['MISS'];
const BURST_KEY = 'dmgnum_burst';
const MAX_ACTIVE = 90;
const STACK_PX = 26;

interface GlyphInfo { frame: string; w: number; h: number; }
interface Atlas { key: string; glyphs: Map<string, GlyphInfo>; style: Style; }

interface NumObj {
  c: Phaser.GameObjects.Container;
  imgs: Phaser.GameObjects.Image[];
  burst: Phaser.GameObjects.Image | null;
  t: number;
  x: number;
  y: number;
  style: Style;
  kind: DamageNumberKind;
  active: boolean;
  seq: number;
  /** Size multiplier from settings (small/normal/large), captured when shown. */
  mul: number;
}

function texKey(kind: DamageNumberKind) { return `dmgnum_${kind}`; }

interface Bitmap { w: number; h: number; on: Uint8Array; }

/** Rasterise `items` with the pixel font and threshold to 1-bit; rows are a shared window so glyphs align. */
function rasterise(items: string[]): Map<string, Bitmap> {
  const out = new Map<string, Bitmap>();
  const W = 64, H = 24, BASE = 18;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return out;
  ctx.font = FONT; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff';
  const raw = new Map<string, Uint8Array>();
  let top = H, bot = -1;
  for (const s of items) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillText(s, 2, BASE);
    const d = ctx.getImageData(0, 0, W, H).data;
    const on = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) if (d[i * 4 + 3] >= 128) { on[i] = 1; const y = Math.floor(i / W); top = Math.min(top, y); bot = Math.max(bot, y); }
    raw.set(s, on);
  }
  if (bot < top) return out;
  for (const [s, on] of raw) {
    let l = W, r = -1;
    for (let y = top; y <= bot; y++) for (let x = 0; x < W; x++) if (on[y * W + x]) { l = Math.min(l, x); r = Math.max(r, x); }
    if (r < l) { l = 0; r = 2; }
    const w = r - l + 1, h = bot - top + 1, b = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b[y * w + x] = on[(y + top) * W + x + l];
    out.set(s, { w, h, on: b });
  }
  return out;
}

/** Paints one glyph bitmap (outline, shadow, banded fill) at 1× into ctx at (ox, oy), then the caller scales. */
function paintGlyph(ctx: CanvasRenderingContext2D, bm: Bitmap, style: Style, ox: number, oy: number) {
  const { w, h, on } = bm;
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && on[y * w + x] === 1;
  // shadow: outline silhouette shifted 1px down-right
  ctx.fillStyle = style.shadow;
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    let edge = false;
    for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy)) { edge = true; break; }
    if (edge) ctx.fillRect(ox + x + 2, oy + y + 2, 1, 1);
  }
  // outline (8-neighbour dilation)
  ctx.fillStyle = style.stroke;
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    if (at(x, y)) continue;
    let edge = false;
    for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy)) { edge = true; break; }
    if (edge) ctx.fillRect(ox + x + 1, oy + y + 1, 1, 1);
  }
  // fill in stepped bands
  for (let y = 0; y < h; y++) {
    ctx.fillStyle = style.stops[Math.min(style.stops.length - 1, Math.floor((y / h) * style.stops.length))];
    for (let x = 0; x < w; x++) if (at(x, y)) ctx.fillRect(ox + x + 1, oy + y + 1, 1, 1);
  }
  // 1px white glint on each glyph's top-left pixels
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let x = 0; x < w; x++) if (at(x, 0) && !at(x - 1, 0)) ctx.fillRect(ox + x + 1, oy + 1, 1, 1);
}

/** Builds (once per game) a pixel-digit canvas atlas per number kind. */
function buildAtlas(scene: Phaser.Scene, kind: DamageNumberKind): Atlas | null {
  const style = STYLES[kind];
  const key = texKey(kind);
  const glyphs = new Map<string, GlyphInfo>();
  const items = [...GLYPHS.split(''), ...(kind === 'miss' ? WORDS : [])];

  if (scene.textures.exists(key)) {
    const existing = scene.textures.get(key);
    items.forEach(s => {
      const f = existing.has(s) ? existing.get(s) : null;
      if (f) glyphs.set(s, { frame: s, w: f.width, h: f.height });
    });
    const any = glyphs.values().next().value as GlyphInfo | undefined;
    if (any) style.size = any.h;
    return { key, glyphs, style };
  }
  const bms = rasterise(items);
  if (!bms.size) return null;
  const S = style.scale;
  // 1×: glyph + 1px outline each side + 1px shadow
  const dims = items.map(s => { const b = bms.get(s); return b ? { w: b.w + 3, h: b.h + 3 } : { w: 1, h: 1 }; });
  const h1 = Math.max(...dims.map(d => d.h));
  const small = document.createElement('canvas');
  small.width = dims.reduce((a, d) => a + d.w + 1, 0); small.height = h1;
  const sctx = small.getContext('2d');
  if (!sctx) return null;
  const xs: number[] = [];
  let x1 = 0;
  items.forEach((s, i) => { xs.push(x1); const b = bms.get(s); if (b) paintGlyph(sctx, b, style, x1, 0); x1 += dims[i].w + 1; });

  const tex = scene.textures.createCanvas(key, small.width * S, h1 * S);
  if (!tex) return null;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, small.width * S, h1 * S);
  items.forEach((s, i) => {
    const w = dims[i].w * S, hh = h1 * S;
    tex.add(s, 0, xs[i] * S, 0, w, hh);
    glyphs.set(s, { frame: s, w, h: hh });
  });
  tex.refresh();
  style.size = h1 * S;
  return { key, glyphs, style };
}

/** Pixel starburst behind crits (drawn at 1/4 size, integer-upscaled so it stays chunky). */
function buildBurst(scene: Phaser.Scene) {
  if (scene.textures.exists(BURST_KEY)) return;
  const s = 24, K = 4;
  const small = document.createElement('canvas'); small.width = s; small.height = s;
  const g = small.getContext('2d');
  const tex = scene.textures.createCanvas(BURST_KEY, s * K, s * K);
  if (!g || !tex) return;
  const c = s / 2;
  const star = (ro: number, ri: number, col: string) => {
    g.fillStyle = col; g.beginPath();
    const spikes = 8;
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2, r = i % 2 === 0 ? ro * (i % 4 === 0 ? 1 : 0.8) : ri;
      const px = c + Math.cos(a) * r, py = c + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath(); g.fill();
  };
  star(11.5, 4.5, '#ff3c78'); star(8, 3, '#ffa0c4'); star(4.5, 2, '#ffffff');
  // threshold alpha so edges are hard pixels
  const id = g.getImageData(0, 0, s, s);
  for (let i = 3; i < id.data.length; i += 4) id.data[i] = id.data[i] >= 110 ? 255 : 0;
  g.putImageData(id, 0, 0);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, s * K, s * K);
  tex.refresh();
}

/** Pooled number renderer. One per GameScene (owned by CombatSystem). */
export class DamageNumbers {
  private atlases = new Map<DamageNumberKind, Atlas>();
  private pool: NumObj[] = [];
  private active: NumObj[] = [];
  private seq = 0;
  private ready = false;

  constructor(private scene: Phaser.Scene) {}

  private ensure() {
    if (this.ready) return;
    this.ready = true;
    try {
      (Object.keys(STYLES) as DamageNumberKind[]).forEach(k => {
        const a = buildAtlas(this.scene, k);
        if (a) this.atlases.set(k, a);
      });
      buildBurst(this.scene);
    } catch (e) { console.error('[dmgnum] atlas build failed', e); }
  }

  show(x: number, y: number, amount: number, kind: DamageNumberKind, stackIndex = 0) {
    this.ensure();
    const atlas = this.atlases.get(kind) ?? this.atlases.get('monster');
    if (!atlas) return;
    const style = atlas.style;

    let tokens: string[];
    if (kind === 'miss') tokens = ['MISS'];
    else {
      const n = Math.max(0, Math.min(99999999, Math.round(amount)));
      tokens = String(n).split('');
      if (kind === 'heal' || kind === 'mp') tokens.unshift('+');
    }

    const o = this.acquire();
    o.style = style; o.kind = kind; o.t = 0; o.active = true; o.seq = ++this.seq;
    o.mul = damageNumberScale();
    o.x = x; o.y = y - (stackIndex % 12) * STACK_PX * o.mul;

    // Layout glyphs.
    let total = 0;
    const infos = tokens.map(t => atlas.glyphs.get(t)).filter((g): g is GlyphInfo => !!g);
    infos.forEach((g, i) => { total += g.w - (i > 0 ? style.kern : 0); });
    let cx = -total / 2;
    while (o.imgs.length < infos.length) {
      const img = this.scene.make.image({ x: 0, y: 0, key: atlas.key, add: false });
      o.imgs.push(img);
      o.c.add(img);
    }
    for (let i = 0; i < o.imgs.length; i++) {
      const img = o.imgs[i];
      if (i >= infos.length) { img.setVisible(false); continue; }
      const g = infos[i];
      if (i > 0) cx -= style.kern;
      img.setTexture(atlas.key, g.frame).setOrigin(0, 1).setVisible(true);
      // Slight Maple-style vertical stagger between digits.
      img.setPosition(cx, (i % 2 === 0 ? 0 : -style.scale) + style.scale);
      cx += g.w;
    }
    // Order so later glyphs draw on top (left glyph partially covered, like Maple).
    if (o.burst) { o.burst.setVisible(false); }
    if (kind === 'crit') {
      if (!o.burst && this.scene.textures.exists(BURST_KEY)) {
        o.burst = this.scene.make.image({ x: 0, y: 0, key: BURST_KEY, add: false });
        o.burst.setBlendMode(Phaser.BlendModes.ADD);
        o.c.addAt(o.burst, 0);
      }
      if (o.burst) o.burst.setVisible(true).setPosition(-total / 2 - 6, -style.size * 0.45).setScale(0.3).setAlpha(1).setRotation(Math.random() * Math.PI);
    }
    o.c.setPosition(o.x, o.y).setScale(0.5 * o.mul).setAlpha(1).setVisible(true).setActive(true);
    o.c.setDepth(DEPTH.DAMAGE_TEXT + (o.seq % 1000) / 1000 + (kind === 'crit' ? 0.5 : 0));
    this.active.push(o);

    if (this.active.length > MAX_ACTIVE) this.release(this.active.shift()!);
  }

  private acquire(): NumObj {
    const o = this.pool.pop();
    if (o && o.c.scene) return o;
    const c = this.scene.add.container(0, 0).setDepth(DEPTH.DAMAGE_TEXT);
    return { c, imgs: [], burst: null, t: 0, x: 0, y: 0, style: STYLES.monster, kind: 'monster', active: false, seq: 0, mul: 1 };
  }

  private release(o: NumObj) {
    o.active = false;
    if (!o.c.scene) return;
    o.c.setVisible(false).setActive(false);
    this.pool.push(o);
  }

  update(delta: number) {
    if (this.active.length === 0) return;
    const keep: NumObj[] = [];
    for (const o of this.active) {
      if (!o.active) continue;
      if (!o.c.scene) { o.active = false; continue; }
      o.t += delta;
      const s = o.style;
      const t = o.t;
      if (t >= s.life) { this.release(o); continue; }
      // Pop: 0.5 → peak → 1.0
      let sc: number;
      if (t < 80) { const p = t / 80; sc = 0.5 + (s.pop - 0.5) * (1 - (1 - p) * (1 - p)); }
      else if (t < 170) { const p = (t - 80) / 90; sc = s.pop + (1 - s.pop) * p; }
      else sc = 1;
      const lp = t / s.life;
      const rise = s.rise * o.mul * (1 - Math.pow(1 - lp, 2));
      const alpha = lp < 0.55 ? 1 : 1 - (lp - 0.55) / 0.45;
      o.c.setScale(sc * o.mul).setAlpha(alpha).setPosition(o.x, o.y - rise);
      if (o.burst && o.burst.visible) {
        const bp = Math.min(1, t / 320);
        o.burst.setScale(0.35 + bp * 1.05).setAlpha(1 - bp).rotation += delta * 0.002;
        if (bp >= 1) o.burst.setVisible(false);
      }
      keep.push(o);
    }
    this.active = keep;
  }

  destroy() {
    for (const o of [...this.active, ...this.pool]) { try { o.c.destroy(); } catch { /* ignore */ } }
    this.active = []; this.pool = [];
  }
}
