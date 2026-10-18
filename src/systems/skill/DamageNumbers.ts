// OWNER: A2 (skill-engine). Maple-style damage numbers rendered from cached per-glyph canvas textures.
import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';
import type { DamageNumberKind } from '../../core/types';

interface Style {
  size: number;
  stops: [number, string][];   // vertical gradient top→bottom
  stroke: string;
  strokeW: number;
  shadow: string;
  kern: number;                // overlap between glyphs (px)
  pop: number;                 // peak pop scale
  life: number;                // ms
  rise: number;                // px risen over the lifetime
}

const FONT = '"Arial Black", "Arial Rounded MT Bold", Impact, "Trebuchet MS", sans-serif';

const STYLES: Record<DamageNumberKind, Style> = {
  monster: { size: 34, stops: [[0, '#ff7212'], [0.42, '#ffa62a'], [0.72, '#ffd23f'], [1, '#fff27a']], stroke: '#2a1000', strokeW: 6, shadow: 'rgba(20,6,0,0.55)', kern: 7, pop: 1.3, life: 900, rise: 46 },
  crit:    { size: 42, stops: [[0, '#ff1f4f'], [0.4, '#ff5c8d'], [0.75, '#ffb3cc'], [1, '#ffffff']], stroke: '#3a0014', strokeW: 7, shadow: 'rgba(40,0,12,0.6)', kern: 8, pop: 1.55, life: 1000, rise: 52 },
  player:  { size: 34, stops: [[0, '#8a2cff'], [0.45, '#b46bff'], [0.8, '#dcb2ff'], [1, '#f6e8ff']], stroke: '#1b0434', strokeW: 6, shadow: 'rgba(14,0,30,0.6)', kern: 7, pop: 1.3, life: 900, rise: 44 },
  heal:    { size: 28, stops: [[0, '#16b545'], [0.5, '#58e06e'], [1, '#d8ffb0']], stroke: '#05260d', strokeW: 5, shadow: 'rgba(0,20,6,0.55)', kern: 5, pop: 1.2, life: 900, rise: 40 },
  mp:      { size: 28, stops: [[0, '#2a62ff'], [0.5, '#5aa2ff'], [1, '#c8ecff']], stroke: '#03143a', strokeW: 5, shadow: 'rgba(0,8,30,0.55)', kern: 5, pop: 1.2, life: 900, rise: 40 },
  miss:    { size: 26, stops: [[0, '#80858f'], [0.55, '#b9bdc6'], [1, '#f2f3f6']], stroke: '#1d2026', strokeW: 5, shadow: 'rgba(0,0,0,0.5)', kern: 3, pop: 1.2, life: 800, rise: 36 },
  dot:     { size: 23, stops: [[0, '#ff5a12'], [0.5, '#ff8f2e'], [1, '#ffc46b']], stroke: '#2a0b00', strokeW: 5, shadow: 'rgba(20,6,0,0.5)', kern: 4, pop: 1.15, life: 800, rise: 34 },
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
}

function texKey(kind: DamageNumberKind) { return `dmgnum_${kind}`; }

/** Builds (once per game) a canvas atlas per number kind. */
function buildAtlas(scene: Phaser.Scene, kind: DamageNumberKind): Atlas | null {
  const style = STYLES[kind];
  const key = texKey(kind);
  const glyphs = new Map<string, GlyphInfo>();
  const pad = style.strokeW + 4;
  const h = Math.ceil(style.size * 1.08 + pad * 2 + 3);
  const font = `900 ${style.size}px ${FONT}`;

  // Measure first.
  const meas = document.createElement('canvas').getContext('2d');
  if (!meas) return null;
  meas.font = font;
  const items = [...GLYPHS.split(''), ...(kind === 'miss' ? WORDS : [])];
  const widths = items.map(s => Math.ceil(meas.measureText(s).width) + pad * 2);
  const totalW = widths.reduce((a, b) => a + b + 2, 0);

  let tex: Phaser.Textures.CanvasTexture | null = null;
  if (scene.textures.exists(key)) {
    const existing = scene.textures.get(key);
    // Re-derive frame sizes from the existing texture.
    items.forEach(s => {
      const f = existing.has(s) ? existing.get(s) : null;
      if (f) glyphs.set(s, { frame: s, w: f.width, h: f.height });
    });
    return { key, glyphs, style };
  }
  tex = scene.textures.createCanvas(key, totalW, h);
  if (!tex) return null;
  const ctx = tex.getContext();
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const baseline = pad + style.size * 0.86;
  const top = baseline - style.size * 0.76;

  let x = 0;
  items.forEach((s, i) => {
    const w = widths[i];
    const gx = x + pad;
    // Drop shadow (thick, offset).
    ctx.strokeStyle = style.shadow;
    ctx.lineWidth = style.strokeW + 2;
    ctx.strokeText(s, gx, baseline + 3);
    // Outline.
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.strokeW;
    ctx.strokeText(s, gx, baseline);
    // Gradient fill.
    const g = ctx.createLinearGradient(0, top, 0, baseline + 1);
    for (const [o, c] of style.stops) g.addColorStop(o, c);
    ctx.fillStyle = g;
    ctx.fillText(s, gx, baseline);
    // Thin glossy highlight on the upper part.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, 0, w, top + style.size * 0.28);
    ctx.clip();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(s, gx, baseline);
    ctx.restore();

    tex!.add(s, 0, x, 0, w, h);
    glyphs.set(s, { frame: s, w, h });
    x += w + 2;
  });
  tex.refresh();
  return { key, glyphs, style };
}

function buildBurst(scene: Phaser.Scene) {
  if (scene.textures.exists(BURST_KEY)) return;
  const S = 96;
  const tex = scene.textures.createCanvas(BURST_KEY, S, S);
  if (!tex) return;
  const ctx = tex.getContext();
  const c = S / 2;
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, 'rgba(255,255,255,0.95)');
  glow.addColorStop(0.25, 'rgba(255,160,200,0.6)');
  glow.addColorStop(1, 'rgba(255,60,120,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  const spikes = 10;
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? c * (0.92 + (i % 4 === 0 ? 0.08 : -0.1)) : c * 0.36;
    const px = c + Math.cos(a) * r, py = c + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
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
    o.x = x; o.y = y - (stackIndex % 12) * STACK_PX;

    // Layout glyphs.
    let total = 0;
    const infos = tokens.map(t => atlas.glyphs.get(t)).filter((g): g is GlyphInfo => !!g);
    infos.forEach((g, i) => { total += g.w - (i > 0 ? style.kern * 2 : 0); });
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
      if (i > 0) cx -= style.kern * 2;
      img.setTexture(atlas.key, g.frame).setOrigin(0, 1).setVisible(true);
      // Slight Maple-style vertical stagger between digits.
      img.setPosition(cx, (i % 2 === 0 ? 0 : -2) + 4);
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
    o.c.setPosition(o.x, o.y).setScale(0.5).setAlpha(1).setVisible(true).setActive(true);
    o.c.setDepth(DEPTH.DAMAGE_TEXT + (o.seq % 1000) / 1000 + (kind === 'crit' ? 0.5 : 0));
    this.active.push(o);

    if (this.active.length > MAX_ACTIVE) this.release(this.active.shift()!);
  }

  private acquire(): NumObj {
    const o = this.pool.pop();
    if (o && o.c.scene) return o;
    const c = this.scene.add.container(0, 0).setDepth(DEPTH.DAMAGE_TEXT);
    return { c, imgs: [], burst: null, t: 0, x: 0, y: 0, style: STYLES.monster, kind: 'monster', active: false, seq: 0 };
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
      const rise = s.rise * (1 - Math.pow(1 - lp, 2));
      const alpha = lp < 0.55 ? 1 : 1 - (lp - 0.55) / 0.45;
      o.c.setScale(sc).setAlpha(alpha).setPosition(o.x, o.y - rise);
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
