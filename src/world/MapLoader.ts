// OWNER: A7 (world). Builds a map: physics bodies (invisible static zones) + layered visuals
// (sky, parallax, decor, terrain, ropes, portals, ambient). Visual failures never break physics.
import Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import { Registry } from '../core/registry';
import { maybeServices } from '../core/services';
import type { IMapInstance, MapDef, PlatformDef, PortalDef, RopeDef } from '../core/types';
import { MAPS } from '../data/maps';
import { generateTileTextures, WORLD_TEX_READY } from '../art/tileArt';
import { TERRAIN, TK } from '../art/world/palettes';
import { PIXEL_KEYS, PIXEL_TERRAIN_THEMES, PIX_TERRAIN, ladderKeyFor } from '../art/world/pixel';
import { PIXEL_BG, bgSrcKey } from '../art/manifests/world';
import { hashStr, rng } from '../art/world/util';
import { Ambient } from './ambient';
import { MAP_EXTRAS, type DecorPlace } from './mapExtras';
import { PortalVisual } from './portals';
import { DECOR_BOB, DECOR_GLOWS, PIXEL_GLOW_DY, THEME_RUNTIME, type ThemeRuntime } from './themes';

/** One-way platform body thickness (px) at the top surface. */
export const ONE_WAY_BODY_H = 12;
/** Portal interaction window (relative to the player's feet). */
export const PORTAL_REACH = { dx: 40, dy: 60 } as const;

export function loadMap(scene: Phaser.Scene, mapId: string): IMapInstance {
  const def = Registry.map(mapId) ?? MAPS.find(m => m.id === mapId) ?? MAPS[0];
  if (!def) throw new Error(`[map] no maps defined`);
  if (def.id !== mapId) console.warn(`[map] unknown map ${mapId}, loading ${def.id}`);
  return new MapInstance(scene, def);
}

interface Pulser { obj: Phaser.GameObjects.Image; base: number; amp: number; speed: number; phase: number; }
interface Bobber { obj: Phaser.GameObjects.Image | Phaser.GameObjects.Container; baseY: number; amp: number; phase: number; }
interface ParallaxLayer {
  obj: Phaser.GameObjects.TileSprite; fx: number; fy: number; screenTop: number; drift?: number;
  /** Pixel layers: integer display scale (tile position is in source px, snapped to whole pixels). */
  k?: number;
  /** Solid fill that follows the layer (below or above the strip). */
  fills?: { obj: Phaser.GameObjects.Rectangle; dy: number }[];
}
type TerrainGeom = { lipH: number; lipSurface: number; platH: number; platSurface: number; capW: number; capOverhang: number };

export class MapInstance implements IMapInstance {
  readonly def: MapDef;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly solids: Phaser.Physics.Arcade.StaticGroup;
  readonly platforms: Phaser.Physics.Arcade.StaticGroup;

  /** Walkable spans: platforms split around walls standing on them, plus wall tops. */
  readonly walkables: PlatformDef[] = [];

  private scene: Phaser.Scene;
  private theme: ThemeRuntime;
  private visuals: Phaser.GameObjects.GameObject[] = [];
  private layers: ParallaxLayer[] = [];
  private fixedSky: Phaser.GameObjects.Image[] = [];
  private pulsers: Pulser[] = [];
  private bobbers: Bobber[] = [];
  private scrollers: { obj: Phaser.GameObjects.TileSprite; vy: number }[] = [];
  private portalVisuals: PortalVisual[] = [];
  private ambient: Ambient | null = null;
  private destroyed = false;
  private elapsed = 0;
  /** Terrain texture geometry for this map's theme (pixel kit or procedural fallback). */
  private geom: TerrainGeom = TERRAIN;
  private pixelTerrain = false;

  constructor(scene: Phaser.Scene, def: MapDef) {
    this.scene = scene;
    this.def = def;
    this.widthPx = def.width;
    this.heightPx = def.height;
    this.theme = THEME_RUNTIME[def.theme] ?? THEME_RUNTIME.forest;
    this.solids = scene.physics.add.staticGroup();
    this.platforms = scene.physics.add.staticGroup();
    this.buildWalkables();
    this.buildPhysics();
    try {
      if (!scene.textures.exists(WORLD_TEX_READY)) generateTileTextures(scene);
    } catch (e) { console.warn('[map] texture generation failed', e); }
    this.pixelTerrain = PIXEL_TERRAIN_THEMES.has(def.theme);
    this.geom = this.pixelTerrain ? PIX_TERRAIN : TERRAIN;
    const steps: [string, () => void][] = [
      ['backdrop', () => this.buildBackdrop()],
      ['falls', () => this.buildFalls()],
      ['decor', () => this.buildDecor()],
      ['terrain', () => this.buildTerrain()],
      ['ropes', () => this.buildRopes()],
      ['portals', () => this.buildPortals()],
      ['ambient', () => { this.ambient = new Ambient(scene, this.theme.ambient); }],
    ];
    for (const [name, fn] of steps) {
      try { fn(); } catch (e) { console.warn(`[map] ${def.id}: ${name} failed`, e); }
    }
  }

  // ─────────────────────────── queries ───────────────────────────

  getRopeAt(x: number, y: number, tolerance = 16): RopeDef | null {
    let best: RopeDef | null = null, bestD = Infinity;
    for (const r of this.def.ropes) {
      const d = Math.abs(r.x - x);
      if (d > tolerance) continue;
      if (y < r.top - 12 || y > r.bottom + 40) continue;
      if (d < bestD) { best = r; bestD = d; }
    }
    return best;
  }

  getPortalNear(x: number, y: number): PortalDef | null {
    let best: PortalDef | null = null, bestD = Infinity;
    for (const p of this.def.portals) {
      const dx = Math.abs(p.x - x), dy = Math.abs(p.y - y);
      if (dx > PORTAL_REACH.dx || dy > PORTAL_REACH.dy) continue;
      if (dx < bestD) { best = p; bestD = dx; }
    }
    return best;
  }

  getPortalById(id: string): PortalDef | null {
    return this.def.portals.find(p => p.id === id) ?? null;
  }

  getDefaultSpawn(): { x: number; y: number } {
    const extra = MAP_EXTRAS[this.def.id]?.spawn;
    if (extra) return { ...extra };
    const p = this.def.portals.find(q => q.id === 'west') ?? this.def.portals[0];
    if (p) return { x: p.x, y: p.y };
    const x = this.widthPx / 2;
    return { x, y: this.groundYAt(x) };
  }

  platformAt(x: number, y: number, tolerance = 12): PlatformDef | null {
    let best: PlatformDef | null = null, bestD = Infinity;
    for (const p of this.walkables) {
      if (x < p.x1 || x > p.x2) continue;
      const d = p.y - y;              // >= 0: surface at/below the point
      if (d < -tolerance || d > tolerance) continue;
      const score = d >= 0 ? d : -d + 0.5; // prefer at/below
      if (score < bestD) { best = p; bestD = score; }
    }
    return best;
  }

  /** Highest solid (non-one-way) surface under x — ground or a wall top. */
  groundYAt(x: number): number {
    let y = Infinity;
    for (const p of this.walkables) if (!p.oneWay && x >= p.x1 && x <= p.x2 && p.y < y) y = p.y;
    if (!Number.isFinite(y)) {
      for (const p of this.def.platforms) if (!p.oneWay && x >= p.x1 && x <= p.x2) y = Math.min(y, p.y);
    }
    return Number.isFinite(y) ? y : this.heightPx - 120;
  }

  // ─────────────────────────── frame ───────────────────────────

  update(time: number, delta: number) {
    if (this.destroyed) return;
    try {
      this.elapsed += delta;
      const cam = this.scene.cameras.main;
      const maxScrollY = Math.max(0, this.heightPx - cam.height);
      const climb = Math.max(0, maxScrollY - cam.scrollY);
      for (const l of this.layers) {
        const tx = cam.scrollX * l.fx + (l.drift ? this.elapsed * l.drift : 0);
        if (l.k) {
          l.obj.tilePositionX = Math.round(tx / l.k);
          l.obj.y = Math.round((l.screenTop + climb * l.fy) / l.k) * l.k;
        } else {
          l.obj.tilePositionX = tx;
          l.obj.y = l.screenTop + climb * l.fy;
        }
        if (l.fills) for (const f of l.fills) f.obj.y = l.obj.y + f.dy;
      }
      for (const s of this.fixedSky) s.y = (s.getData('baseY') as number) + climb * 0.02;
      const t = this.elapsed / 1000;
      for (const p of this.pulsers) p.obj.setAlpha(Math.max(0, p.base + Math.sin(t * p.speed + p.phase) * p.amp));
      for (const b of this.bobbers) b.obj.y = b.baseY + Math.sin(t * 1.6 + b.phase) * b.amp;
      for (const s of this.scrollers) s.obj.tilePositionY -= s.vy * delta / 1000;
      let player: { x: number; y: number } | null = null;
      try { const pl = maybeServices()?.player; if (pl) player = { x: pl.x, y: pl.y }; } catch { player = null; }
      for (const pv of this.portalVisuals) pv.update(time, delta, player);
      this.ambient?.update(time, delta);
    } catch (e) {
      if (!(this as unknown as { _warned?: boolean })._warned) { console.warn('[map] update error', e); (this as unknown as { _warned?: boolean })._warned = true; }
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    try { this.ambient?.destroy(); } catch { /* ignore */ }
    for (const pv of this.portalVisuals) { try { pv.destroy(); } catch { /* ignore */ } }
    for (const o of this.visuals) { try { o.destroy(); } catch { /* ignore */ } }
    try { this.solids.destroy(true); } catch { /* ignore */ }
    try { this.platforms.destroy(true); } catch { /* ignore */ }
    this.visuals = []; this.layers = []; this.fixedSky = []; this.pulsers = []; this.bobbers = []; this.scrollers = [];
    this.portalVisuals = []; this.ambient = null;
  }

  // ─────────────────────────── physics ───────────────────────────

  private buildWalkables() {
    const walls = this.def.walls ?? [];
    for (const p of this.def.platforms) {
      let segs: [number, number][] = [[p.x1, p.x2]];
      for (const w of walls) {
        if (!(w.y < p.y && w.y + w.h >= p.y - 2)) continue;
        segs = segs.flatMap(([a, b]): [number, number][] => {
          if (w.x + w.w <= a || w.x >= b) return [[a, b]];
          const out: [number, number][] = [];
          if (w.x > a) out.push([a, w.x]);
          if (w.x + w.w < b) out.push([w.x + w.w, b]);
          return out;
        });
      }
      if (segs.length === 1 && segs[0][0] === p.x1 && segs[0][1] === p.x2) this.walkables.push(p);
      else for (const [a, b] of segs) this.walkables.push({ x1: a, x2: b, y: p.y, oneWay: p.oneWay });
    }
    for (const w of walls) this.walkables.push({ x1: w.x, x2: w.x + w.w, y: w.y, oneWay: false });
  }

  private zone(group: Phaser.Physics.Arcade.StaticGroup, x: number, y: number, w: number, h: number) {
    const z = this.scene.add.zone(x + w / 2, y + h / 2, w, h);
    group.add(z);
    const body = z.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) { body.setSize(w, h); body.updateFromGameObject(); }
    return z;
  }

  private buildPhysics() {
    const H = this.heightPx, W = this.widthPx;
    for (const p of this.def.platforms) {
      const w = Math.max(1, p.x2 - p.x1);
      if (p.oneWay) {
        const z = this.zone(this.platforms, p.x1, p.y, w, ONE_WAY_BODY_H);
        const b = z.body as Phaser.Physics.Arcade.StaticBody | null;
        if (b) { b.checkCollision.down = false; b.checkCollision.left = false; b.checkCollision.right = false; b.checkCollision.up = true; }
        z.setData('platform', p);
      } else {
        // solid column from the surface to below the map bottom
        const z = this.zone(this.solids, p.x1, p.y, w, Math.max(32, H - p.y + 200));
        z.setData('platform', p);
      }
    }
    for (const wl of this.def.walls ?? []) this.zone(this.solids, wl.x, wl.y, wl.w, wl.h).setData('wall', wl);
    // map-edge walls (outside the map) so nothing walks off the sides even without world-bounds collision
    this.zone(this.solids, -64, -600, 64, H + 1200);
    this.zone(this.solids, W, -600, 64, H + 1200);
  }

  // ─────────────────────────── visuals ───────────────────────────

  private has(key: string) { return this.scene.textures.exists(key); }
  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T { this.visuals.push(o); return o; }

  /** 16-bit parallax: source strips at an integer scale, tiled horizontally, with solid fills above/below. */
  private buildPixelBackdrop(): boolean {
    const s = this.scene, cam = s.cameras.main, t = this.def.theme, th = this.theme;
    const cfg = PIXEL_BG[t];
    if (!cfg?.length || !this.has(bgSrcKey(t, cfg[0].name))) return false;
    const cw = cam.width, ch = cam.height;
    const base = cfg[0].bottom ?? cfg[0].top ?? 0x000000;
    this.keep(s.add.rectangle(0, 0, cw, ch, base).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.SKY - 1));
    cfg.forEach((l, i) => {
      const key = bgSrcKey(t, l.name);
      if (!this.has(key)) return;
      const isSky = l.y === 'top';
      const depth = isSky ? DEPTH.SKY : DEPTH.PARALLAX_FAR + i * 40;
      const h = l.h * l.k;
      const top = isSky ? 0 : (l.y as number) - h;
      const ts = this.keep(s.add.tileSprite(0, top, Math.ceil(cw / l.k) + 2, l.h, key)
        .setOrigin(0).setScrollFactor(0).setScale(l.k).setDepth(depth));
      if (l.alpha !== undefined) ts.setAlpha(l.alpha);
      const fills: { obj: Phaser.GameObjects.Rectangle; dy: number }[] = [];
      if (l.bottom !== undefined) {
        const r = this.keep(s.add.rectangle(0, top + h, cw, ch + 400, l.bottom).setOrigin(0).setScrollFactor(0).setDepth(depth - 0.5));
        if (l.alpha !== undefined) r.setAlpha(l.alpha);
        fills.push({ obj: r, dy: h });
      }
      if (isSky && l.top !== undefined) {
        const r = this.keep(s.add.rectangle(0, -400, cw, 400, l.top).setOrigin(0).setScrollFactor(0).setDepth(depth - 0.5));
        fills.push({ obj: r, dy: -400 });
      }
      this.layers.push({ obj: ts, fx: l.fx, fy: l.fy, screenTop: top, drift: l.drift, k: l.k, fills });
    });
    if (th.stars && this.has('w_stars')) {
      const st = this.keep(s.add.tileSprite(0, 0, cw, ch, 'w_stars').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.SKY + 1).setAlpha(th.stars));
      this.layers.push({ obj: st, fx: 0.02, fy: 0.01, screenTop: 0 });
      this.pulsers.push({ obj: st as unknown as Phaser.GameObjects.Image, base: th.stars * 0.9, amp: th.stars * 0.1, speed: 0.7, phase: 0 });
    }
    if (th.celestial && th.pixelCelestial !== false && this.has(th.celestial.key)) {
      const c = th.celestial;
      const img = this.keep(s.add.image(Math.round(cw * c.x), c.y, c.key).setScrollFactor(0).setDepth(DEPTH.SKY + 2).setAlpha(Math.min(1, c.alpha + 0.1)));
      img.setData('baseY', c.y);
      this.fixedSky.push(img);
    }
    return true;
  }

  private buildBackdrop() {
    if (this.buildPixelBackdrop()) return;
    const s = this.scene, cam = s.cameras.main, t = this.def.theme, th = this.theme;
    const cw = cam.width, ch = cam.height;
    if (this.has(TK.sky(t))) {
      this.keep(s.add.image(0, 0, TK.sky(t)).setOrigin(0).setScrollFactor(0).setDisplaySize(cw, ch).setDepth(DEPTH.SKY));
    } else {
      this.keep(s.add.rectangle(0, 0, cw, ch, 0x6aa8e0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.SKY));
    }
    if (th.stars && this.has('w_stars')) {
      const st = this.keep(s.add.tileSprite(0, 0, cw, ch, 'w_stars').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.SKY + 1).setAlpha(th.stars));
      this.layers.push({ obj: st, fx: 0.02, fy: 0.01, screenTop: 0 });
      this.pulsers.push({ obj: st as unknown as Phaser.GameObjects.Image, base: th.stars * 0.9, amp: th.stars * 0.1, speed: 0.7, phase: 0 });
    }
    if (th.celestial && this.has(th.celestial.key)) {
      const c = th.celestial;
      const img = this.keep(s.add.image(cw * c.x, c.y, c.key).setScrollFactor(0).setDepth(DEPTH.SKY + 2).setAlpha(c.alpha).setBlendMode(Phaser.BlendModes.SCREEN));
      if (c.tint !== undefined) img.setTint(c.tint);
      img.setData('baseY', c.y);
      this.fixedSky.push(img);
    }
    const depthOf = { far: DEPTH.PARALLAX_FAR, mid: DEPTH.PARALLAX_MID, near: DEPTH.PARALLAX_NEAR } as const;
    for (const l of th.layers) {
      const key = TK[l.key](t);
      if (!this.has(key)) continue;
      // Inset 2 rows so linear filtering never wraps the opaque bottom row onto the top edge.
      const ts = this.keep(s.add.tileSprite(0, l.screenTop, cw, TERRAIN.layerH - 4, key).setOrigin(0).setScrollFactor(0).setDepth(depthOf[l.key]));
      ts.tilePositionY = 2;
      if (l.alpha !== undefined) ts.setAlpha(l.alpha);
      this.layers.push({ obj: ts, fx: l.fx, fy: l.fy, screenTop: l.screenTop });
    }
    if (th.clouds && this.has(TK.clouds(t))) {
      const c = th.clouds;
      const depth = c.front ? DEPTH.PARALLAX_MID + 10 : DEPTH.PARALLAX_FAR + 10;
      const ts = this.keep(s.add.tileSprite(0, c.screenTop, cw, 256, TK.clouds(t)).setOrigin(0).setScrollFactor(0).setDepth(depth).setAlpha(c.alpha));
      this.layers.push({ obj: ts, fx: c.fx, fy: 0.03, screenTop: c.screenTop, drift: c.speed * 10 });
      if (c.front) {
        // a second, slower bank behind the far ridge for depth
        const ts2 = this.keep(s.add.tileSprite(0, c.screenTop + 40, cw, 256, TK.clouds(t)).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.PARALLAX_FAR + 5).setAlpha(c.alpha * 0.7).setFlipX(true));
        this.layers.push({ obj: ts2, fx: c.fx * 0.5, fy: 0.02, screenTop: c.screenTop + 40, drift: c.speed * 4 });
      }
    }
  }

  private buildFalls() {
    const ex = MAP_EXTRAS[this.def.id];
    for (const f of ex?.falls ?? []) {
      const key = f.kind === 'lava' ? 'w_lavafall' : 'w_waterfall';
      if (!this.has(key)) continue;
      // pixel strips tile every 48px: snap the width so the texture never seams mid-fall
      const w = PIXEL_KEYS.has(key) ? 48 : (f.w ?? 48), h = Math.max(16, f.bottom - f.top);
      const ts = this.keep(this.scene.add.tileSprite(f.x - w / 2, f.top, w, h, key).setOrigin(0).setDepth(DEPTH.PARALLAX_NEAR + 20));
      ts.setAlpha(f.kind === 'lava' ? 0.8 : 0.7);
      if (f.kind === 'lava') ts.setBlendMode(Phaser.BlendModes.ADD);
      this.scrollers.push({ obj: ts, vy: f.kind === 'lava' ? -70 : -240 });
      if (this.has('w_glow')) {
        const g = this.keep(this.scene.add.image(f.x, f.bottom - 10, 'w_glow').setDepth(DEPTH.PARALLAX_NEAR + 21).setBlendMode(Phaser.BlendModes.ADD)
          .setTint(f.kind === 'lava' ? 0xff6a10 : 0xbfeaff).setScale(w / 40, 1.1));
        this.pulsers.push({ obj: g, base: 0.6, amp: 0.2, speed: 2.2, phase: f.x });
        if (f.kind === 'lava' && f.top <= 0) {
          // glowing seam where the fall leaves the cave ceiling
          const top = this.keep(this.scene.add.image(f.x, 0, 'w_glow').setDepth(DEPTH.PARALLAX_NEAR + 21).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff8a20).setScale(w / 50, 0.8));
          this.pulsers.push({ obj: top, base: 0.5, amp: 0.15, speed: 1.7, phase: f.x * 0.3 });
        }
      }
      if (f.kind === 'lava' && this.has('w_lavapool')) {
        this.keep(this.scene.add.image(f.x, f.bottom + 6, 'w_lavapool').setOrigin(0.5, 1).setDepth(DEPTH.PARALLAX_NEAR + 22).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9));
      }
    }
  }

  /** Places one decor sprite; returns it (or null). */
  private placeDecor(d: DecorPlace & { depth?: number }, r: () => number): Phaser.GameObjects.Image | null {
    if (!this.has(d.key)) return null;
    const s = this.scene;
    const y = d.y ?? this.groundYAt(d.x);
    const hanging = d.key === 'd_vine' || d.key === 'd_icicles';
    const layer = d.layer ?? 'back';
    const depth = d.depth ?? (layer === 'far' ? DEPTH.PARALLAX_NEAR + 30 : layer === 'back' ? DEPTH.TERRAIN - 40 : layer === 'mid' ? DEPTH.TERRAIN + 2 : DEPTH.DECOR);
    const sink = hanging ? 0 : layer === 'front' ? 6 : 4;
    const pixel = PIXEL_KEYS.has(d.key);
    const img = this.keep(s.add.image(Math.round(d.x), y + sink, d.key).setOrigin(0.5, hanging ? 0 : 1).setDepth(depth));
    // pixel art is pre-scaled ×PIXEL_SCALE and must stay at integer scale; procedural art keeps its random scale
    if (d.scale && !pixel) img.setScale(d.scale);
    if (d.flip) img.setFlipX(true);
    if (d.alpha !== undefined) img.setAlpha(d.alpha);
    const tint = d.tint ?? this.theme.tints?.[d.key];
    if (tint !== undefined) img.setTint(tint);
    if (d.key === 'd_arcane_circle') {
      img.setBlendMode(Phaser.BlendModes.ADD);
      this.pulsers.push({ obj: img, base: d.alpha ?? 0.7, amp: 0.2, speed: 1.3, phase: 0 });
    }
    const sc = pixel ? 1 : d.scale ?? 1;
    const gl = DECOR_GLOWS[d.key];
    const pg = pixel ? PIXEL_GLOW_DY[d.key] : undefined;
    if (gl && this.has('w_glow') && !(pixel && pg === null)) {
      const gdx = pg ? pg.dx ?? 0 : gl.dx ?? 0;
      const gdy = pg ? pg.dy(img.height) : gl.dy;
      const gx = d.x + gdx * sc * (d.flip ? -1 : 1), gy = y + sink + gdy * sc;
      const g = this.keep(s.add.image(gx, gy, 'w_glow').setTint(gl.color).setBlendMode(Phaser.BlendModes.ADD)
        .setScale(pixel && PIXEL_KEYS.has('w_glow') ? 1 : (gl.r * 2 * sc) / 128).setDepth(depth + 0.5).setAlpha(gl.alpha));
      if (gl.pulse) this.pulsers.push({ obj: g, base: gl.alpha, amp: gl.alpha * gl.pulse, speed: 2 + r() * 2, phase: r() * 6 });
      if (DECOR_BOB[d.key]) this.bobbers.push({ obj: g, baseY: gy, amp: DECOR_BOB[d.key], phase: d.x });
    }
    if (DECOR_BOB[d.key]) this.bobbers.push({ obj: img, baseY: img.y, amp: DECOR_BOB[d.key], phase: d.x });
    return img;
  }

  private buildDecor() {
    const def = this.def, th = this.theme, ex = MAP_EXTRAS[def.id];
    const r = rng(hashStr(def.id + ':decor'));
    const density = ex?.density ?? 1;

    // reserved spans: portals, NPCs, ropes, extras with `clear`
    const clear: [number, number][] = [...(ex?.clearZones ?? [])];
    for (const p of def.portals) clear.push([p.x - 90, p.x + 90]);
    for (const n of def.npcs) clear.push([n.x - 60, n.x + 60]);
    for (const d of ex?.decor ?? []) {
      if (!d.clear || !this.has(d.key)) continue;
      const w = (this.scene.textures.get(d.key).getSourceImage().width || 100) * (d.scale ?? 1);
      clear.push([d.x - w / 2, d.x + w / 2]);
    }
    const isClear = (x: number, pad = 0) => !clear.some(([a, b]) => x + pad > a && x - pad < b);
    const nearRope = (x: number, y: number) => def.ropes.some(rp => Math.abs(rp.x - x) < 34 && y >= rp.top - 4 && y <= rp.bottom + 20);

    for (const d of ex?.decor ?? []) this.placeDecor(d, r);

    const solidSurfaces = this.walkables.filter(p => !p.oneWay);
    const oneWays = this.walkables.filter(p => p.oneWay);

    // big background pieces + medium fillers on solid ground
    for (const p of solidSurfaces) {
      if (th.scatter.back.length) {
        for (let x = p.x1 + rr(r, 40, 160); x < p.x2 - 40; x += rr(r, th.scatter.backSpacing[0], th.scatter.backSpacing[1]) / density) {
          if (!isClear(x, 50)) continue;
          const img = this.placeDecor({ key: pickR(r, th.scatter.back), x, y: p.y, layer: 'back', scale: rr(r, 0.82, 1.12), flip: r() < 0.5 }, r);
          if (img && r() < 0.5) { img.setTint(th.backTint); img.setDepth(DEPTH.TERRAIN - 50); }
        }
      }
      if (th.scatter.between.length) {
        for (let x = p.x1 + rr(r, 60, 200); x < p.x2 - 40; x += rr(r, 220, 420) / density) {
          if (!isClear(x, 30)) continue;
          this.placeDecor({ key: pickR(r, th.scatter.between), x, y: p.y, layer: 'back', scale: rr(r, 0.85, 1.1), flip: r() < 0.5, depth: DEPTH.TERRAIN - 30 }, r);
        }
      }
      if (th.scatter.front.length) {
        for (let x = p.x1 + rr(r, 20, 90); x < p.x2 - 20; x += rr(r, th.scatter.frontSpacing[0], th.scatter.frontSpacing[1]) / density) {
          if (!isClear(x, 10)) continue;
          const key = pickR(r, th.scatter.front);
          this.placeDecor({ key, x, y: p.y, layer: 'front', scale: rr(r, 0.65, 1) * (key === 'd_ice_crystal' || key === 'd_obsidian' ? 0.5 : 1), flip: r() < 0.5 }, r);
        }
      }
    }
    // platform dressing
    for (const p of oneWays) {
      const w = p.x2 - p.x1;
      if (th.scatter.onPlatforms.length && w >= 150) {
        for (let x = p.x1 + rr(r, 30, 80); x < p.x2 - 30; x += rr(r, 120, 240) / density) {
          if (nearRope(x, p.y) || !isClear(x)) continue;
          const key = pickR(r, th.scatter.onPlatforms);
          const big = key === 'd_pine_small' || key === 'd_bush';
          this.placeDecor({ key, x, y: p.y, layer: 'mid', scale: (big ? 0.6 : rr(r, 0.6, 0.9)) * (key === 'd_ice_crystal' || key === 'd_obsidian' ? 0.55 : 1), flip: r() < 0.5, depth: big ? DEPTH.TERRAIN - 3 : DEPTH.TERRAIN + 2 }, r);
        }
      }
      if (th.scatter.hanging.length && w >= 120) {
        for (let x = p.x1 + rr(r, 20, 60); x < p.x2 - 20; x += rr(r, 90, 200)) {
          if (nearRope(x, p.y + 30) || r() < 0.35) continue;
          this.placeDecor({ key: pickR(r, th.scatter.hanging), x, y: p.y + this.geom.platH - this.geom.platSurface - 6, layer: 'back', scale: rr(r, 0.6, 1), flip: r() < 0.5, depth: DEPTH.TERRAIN - 3 }, r);
        }
      }
    }
  }

  private buildTerrain() {
    const s = this.scene, t = this.def.theme, H = this.heightPx;
    const G = this.geom, px = this.pixelTerrain;
    const soilK = TK.soil(t), lipK = TK.lip(t);
    // Pixel kit: the lip strip carries the grass edge + top dirt row, the soil continues right under it.
    const soilTop = (y: number) => px ? y - G.lipSurface + G.lipH : y + 4;
    // solid ground columns (lowest first so higher steps overlap)
    const solid = this.def.platforms.filter(p => !p.oneWay).sort((a, b) => b.y - a.y);
    for (const p of solid) {
      const w = p.x2 - p.x1;
      const sy = soilTop(p.y);
      const soilH = Math.max(32, H - sy + 64);
      if (this.has(soilK)) {
        const soil = this.keep(s.add.tileSprite(p.x1, sy, w, soilH, soilK).setOrigin(0).setDepth(DEPTH.TERRAIN - 2));
        soil.tilePositionX = p.x1; soil.tilePositionY = px ? 0 : p.y;
      } else {
        this.keep(s.add.rectangle(p.x1, p.y, w, soilH, 0x6b4a2e).setOrigin(0).setDepth(DEPTH.TERRAIN - 2));
      }
      if (this.has(lipK)) {
        const lip = this.keep(s.add.tileSprite(p.x1, p.y - G.lipSurface, w, G.lipH, lipK).setOrigin(0).setDepth(DEPTH.TERRAIN));
        lip.tilePositionX = p.x1;
      }
    }
    // walls / raised blocks
    for (const wl of this.def.walls ?? []) {
      const wallK = TK.wall(t);
      const by = px ? wl.y + G.lipH - G.lipSurface - 4 : wl.y + 4;
      if (this.has(wallK)) {
        const body = this.keep(s.add.tileSprite(wl.x, by, wl.w, Math.max(4, wl.y + wl.h - by), wallK).setOrigin(0).setDepth(DEPTH.TERRAIN - 1));
        body.tilePositionX = wl.x; body.tilePositionY = px ? 0 : wl.y;
      } else {
        this.keep(s.add.rectangle(wl.x, wl.y, wl.w, wl.h, 0x7a6a5a).setOrigin(0).setDepth(DEPTH.TERRAIN - 1));
      }
      // side shading for volume (whole-pixel bands in pixel mode)
      const g = this.keep(s.add.graphics().setDepth(DEPTH.TERRAIN - 1));
      if (px) {
        g.fillStyle(0x000000, 0.25); g.fillRect(wl.x + wl.w - 4, wl.y + 8, 4, wl.h - 8);
        g.fillStyle(0x000000, 0.12); g.fillRect(wl.x + wl.w - 8, wl.y + 8, 4, wl.h - 8);
      } else {
        g.fillStyle(0x000000, 0.22); g.fillRect(wl.x + wl.w - 8, wl.y + 8, 8, wl.h - 8);
        g.fillStyle(0xffffff, 0.08); g.fillRect(wl.x, wl.y + 8, 5, wl.h - 8);
      }
      if (this.has(lipK)) {
        const lip = this.keep(s.add.tileSprite(wl.x, wl.y - G.lipSurface, wl.w, G.lipH, lipK).setOrigin(0).setDepth(DEPTH.TERRAIN + 0.5));
        lip.tilePositionX = wl.x;
        lip.setCrop(0, 0, wl.w, Math.min(G.lipH, wl.h + G.lipSurface));
      }
    }
    // one-way platforms
    const midK = TK.plat(t), lK = TK.platL(t), rK = TK.platR(t);
    const { capW, capOverhang: ov, platSurface } = G;
    for (const p of this.def.platforms) {
      if (!p.oneWay) continue;
      const top = p.y - platSurface;
      const left = p.x1 - ov, right = p.x2 + ov, total = right - left;
      if (!this.has(midK)) {
        this.keep(s.add.rectangle(p.x1, p.y, p.x2 - p.x1, ONE_WAY_BODY_H, 0x8a6a3a).setOrigin(0).setDepth(DEPTH.TERRAIN + 1));
        continue;
      }
      if (total >= capW * 2 + 4) {
        const mid = this.keep(s.add.tileSprite(left + capW, top, total - capW * 2, G.platH, midK).setOrigin(0).setDepth(DEPTH.TERRAIN + 1));
        mid.tilePositionX = px ? 0 : p.x1;
        if (this.has(lK)) this.keep(s.add.image(left, top, lK).setOrigin(0).setDepth(DEPTH.TERRAIN + 1));
        if (this.has(rK)) this.keep(s.add.image(right - capW, top, rK).setOrigin(0).setDepth(DEPTH.TERRAIN + 1));
      } else if (px) {
        // very short ledge: two caps cropped to fit (never scaled)
        const half = Math.floor(total / 2);
        if (this.has(lK)) this.keep(s.add.image(left, top, lK).setOrigin(0).setDepth(DEPTH.TERRAIN + 1).setCrop(0, 0, half, G.platH));
        if (this.has(rK)) this.keep(s.add.image(right - capW, top, rK).setOrigin(0).setDepth(DEPTH.TERRAIN + 1).setCrop(capW - (total - half), 0, total - half, G.platH));
      } else {
        const half = total / 2;
        if (this.has(lK)) this.keep(s.add.image(left, top, lK).setOrigin(0).setDepth(DEPTH.TERRAIN + 1).setDisplaySize(half + 1, G.platH));
        if (this.has(rK)) this.keep(s.add.image(left + half, top, rK).setOrigin(0).setDepth(DEPTH.TERRAIN + 1).setDisplaySize(half, G.platH));
      }
      // soft contact shadow under the platform (procedural look only)
      if (!px && this.has('w_glow')) {
        this.keep(s.add.image((p.x1 + p.x2) / 2, p.y + 30, 'w_glow').setTint(0x000000).setAlpha(0.12)
          .setDisplaySize(Math.max(60, p.x2 - p.x1) * 0.95, 26).setDepth(DEPTH.TERRAIN - 4));
      }
    }
  }

  private buildRopes() {
    const s = this.scene;
    const pixRope = PIXEL_KEYS.has('w_rope');
    for (const r of this.def.ropes) {
      const len = Math.max(8, r.bottom - r.top);
      if (r.kind === 'ladder') {
        const themed = ladderKeyFor(this.def.theme);
        const key = this.has(themed) ? themed : this.has(this.theme.ladderKey) ? this.theme.ladderKey : 'w_ladder';
        if (this.has(key)) {
          const pixLadder = PIXEL_KEYS.has(key);
          const lad = this.keep(s.add.tileSprite(r.x - 16, r.top - 6, 32, len + 6, key).setOrigin(0).setDepth(DEPTH.ROPE));
          if (pixLadder) lad.tilePositionY = 0;
          if (!pixLadder && this.has('w_ladder_top')) this.keep(s.add.image(r.x, r.top - 2, 'w_ladder_top').setDepth(DEPTH.ROPE + 0.1));
        } else {
          this.keep(s.add.rectangle(r.x - 12, r.top, 24, len, 0x9b6a3c).setOrigin(0).setDepth(DEPTH.ROPE));
        }
      } else {
        if (this.has('w_rope')) {
          const rope = this.keep(s.add.tileSprite(r.x - 8, r.top - 8, 16, len + 8, 'w_rope').setOrigin(0).setDepth(DEPTH.ROPE));
          rope.tilePositionY = pixRope ? 0 : r.x;
        } else {
          this.keep(s.add.rectangle(r.x - 3, r.top, 6, len, 0xc59a5e).setOrigin(0).setDepth(DEPTH.ROPE));
        }
        if (this.has('w_rope_knot')) this.keep(s.add.image(r.x, r.top - 4, 'w_rope_knot').setDepth(DEPTH.ROPE + 0.1));
        if (this.has('w_rope_knot') && !pixRope) this.keep(s.add.image(r.x, r.bottom + 2, 'w_rope_knot').setDepth(DEPTH.ROPE + 0.1).setScale(0.55));
      }
    }
  }

  private buildPortals() {
    for (const p of this.def.portals) {
      try { this.portalVisuals.push(new PortalVisual(this.scene, p)); } catch (e) { console.warn('[map] portal visual failed', p.id, e); }
    }
  }
}

function rr(r: () => number, a: number, b: number) { return a + (b - a) * r(); }
function pickR<T>(r: () => number, arr: readonly T[]): T { return arr[Math.floor(r() * arr.length) % arr.length]; }
