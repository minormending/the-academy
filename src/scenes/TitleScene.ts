// OWNER: A8 (ui); pixel pass by PX5. Title screen for "The Academy": a moonlit (not murky) night sky over the
// Headmistress's tower, DOM menu on top.
// 16-bit look: the backdrop is composed from the CC0 pixel parallax art the world agent loads at boot (Fort of
// Illusion sanctum sky + mountains, Grotto ruins, the mage tower), drifting on integer-scaled TileSprites whose
// scroll offsets snap to whole source pixels. If those textures are missing it falls back to the old procedural
// scene (stepped sky bands + Pixelate post-FX). The DOM menu (pixel fonts + 9-slice frames) stays crisp on top.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../core/constants';
import type { PlayerState } from '../core/types';
import { getAudio } from '../systems/AudioSystem';
import { TitleMenu } from '../ui/titleMenu';
import { applySavedVolumes } from '../ui/miscWindows';

const W = GAME_WIDTH, H = GAME_HEIGHT;
const TOWER_X = 940;

// Loaded world art (src/art/manifests/world.ts): 1× source PNGs under their src_* keys.
const K_SKY = 'src_w_bg_sanctum_sky', K_FAR = 'src_w_bg_sanctum_far', K_MID = 'src_w_bg_sanctum_mid';
const K_TOWER = 'src_t_tower', K_MOON = 'src_w_moon', K_STARS = 'src_w_stars', K_CLOUDS = 'src_w_bg_storm_clouds';
const K_DOT = 'src_w_dot', K_SPARK = 'src_w_spark', K_MOTE = 'src_w_mote';
const SKY_COL = 0x0e0822;

interface Drift { ts: Phaser.GameObjects.TileSprite; speed: number } // speed in source px per second

export class TitleScene extends Phaser.Scene {
  private menu: TitleMenu | null = null;
  private rune: Phaser.GameObjects.Graphics | null = null;
  private rune2: Phaser.GameObjects.Graphics | null = null;
  private crystalGlow: Phaser.GameObjects.Image | null = null;
  private leaving = false;
  private t = 0;
  private drifts: Drift[] = [];
  private pixelBackdrop = false;

  constructor() { super(SCENES.TITLE); }

  create() {
    this.leaving = false;
    // The art is authored at 1280×720; wide phone canvases (src/ui/mobile.ts gameLogicalWidth) zoom it to fill the width.
    const fit = () => {
      const cam = this.cameras.main;
      cam.setZoom(Math.max(1, this.scale.width / W));
      cam.centerOn(W / 2, H / 2);
    };
    fit();
    this.scale.on(Phaser.Scale.Events.RESIZE, fit);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, fit));
    this.t = 0;
    this.drifts = [];
    this.pixelBackdrop = false;
    const havePixel = [K_SKY, K_FAR, K_MID, K_TOWER].every(k => this.textures.exists(k));
    if (havePixel) {
      try { this.buildPixelBackdrop(); this.pixelBackdrop = true; } catch (e) { console.warn('[title] pixel backdrop failed', e); }
    }
    if (!this.pixelBackdrop) {
      this.children.removeAll(true);
      this.tweens.killAll();
      this.time.removeAllEvents();
      this.drifts = [];
      try { this.buildBackground(); } catch (e) { console.warn('[title] background failed', e); }
      try {
        if (this.game.renderer.type === Phaser.WEBGL) this.cameras.main.postFX?.addPixelate(2);
      } catch (e) { console.warn('[title] pixelate fx unavailable', e); }
    }

    this.menu = new TitleMenu(this, (state) => this.startGame(state));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardown());

    const audio = getAudio();
    applySavedVolumes(audio);
    try { audio.playMusic('title'); } catch { /* ignore */ }
    this.cameras.main.fadeIn(600, 0, 0, 0);
  }

  private startGame(state: PlayerState) {
    if (this.leaving) return;
    this.leaving = true;
    const cam = this.cameras.main;
    cam.fadeOut(420, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENES.GAME, { state }));
  }

  private teardown() {
    this.menu?.destroy();
    this.menu = null;
    this.rune = this.rune2 = null;
    this.crystalGlow = null;
    this.drifts = [];
  }

  // ─────────────────────── pixel backdrop (loaded art) ───────────────────────

  private nearest(key: string) {
    try { this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST); } catch { /* ignore */ }
  }

  /** A scrolling layer: integer tile scale k, bottom-anchored (or top when bottom=false), snapped drift. */
  private layer(key: string, k: number, bottomY: number | null, speed: number, opts: { alpha?: number; tint?: number; flipY?: boolean } = {}) {
    const src = this.textures.get(key).getSourceImage() as { width: number; height: number };
    const h = src.height * k;
    const ts = this.add.tileSprite(0, bottomY === null ? 0 : bottomY - h, W, h, key).setOrigin(0, 0).setTileScale(k, k);
    if (opts.alpha !== undefined) ts.setAlpha(opts.alpha);
    if (opts.tint !== undefined) ts.setTint(opts.tint);
    if (opts.flipY) ts.setFlipY(true);
    this.nearest(key);
    if (speed) this.drifts.push({ ts, speed });
    return ts;
  }

  /**
   * Pixel-stepped round glow: concentric discs built from `step`-px rows (no smooth gradient, no hard square).
   * Drawn into one additive Graphics so it can pulse as a whole.
   */
  private pixelGlow(cx: number, cy: number, radii: number[], color: number, alpha: number, step = 4) {
    const g = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    for (const r of radii) {
      g.fillStyle(color, alpha);
      for (let dy = -r; dy < r; dy += step) {
        const yc = dy + step / 2;
        const hw = Math.round(Math.sqrt(Math.max(0, r * r - yc * yc)) / step) * step;
        if (hw > 0) g.fillRect(cx - hw, cy + dy, hw * 2, step);
      }
    }
    return g;
  }

  private buildPixelBackdrop() {
    const rnd = new Phaser.Math.RandomDataGenerator(['arcana']);
    for (const k of [K_DOT, K_SPARK, K_MOTE, K_MOON, K_STARS, K_TOWER]) if (this.textures.exists(k)) this.nearest(k);
    const has = (k: string) => this.textures.exists(k);

    this.add.rectangle(0, 0, W, H, SKY_COL).setOrigin(0, 0);
    // sky (64×272 @×3), slowest layer
    this.layer(K_SKY, 3, null, 1.5);
    // lift the sky: an additive twin turns the near-black violet into a clear moonlit indigo
    this.layer(K_SKY, 3, null, 1.5, { alpha: 0.8, tint: 0x7a78e0 }).setBlendMode(Phaser.BlendModes.ADD);
    if (has(K_STARS)) this.layer(K_STARS, 3, null, 1, { alpha: 0.9 });

    // Moon (28×28 @×4) with a stepped square halo
    const MX = 1120, MY = 132;
    const halo = this.add.graphics();
    for (let i = 4; i >= 1; i--) {
      halo.fillStyle(0xcfd8ff, 0.05);
      const r = 56 + i * 14;
      for (let dy = -r; dy < r; dy += 8) { const hw = Math.round(Math.sqrt(r * r - (dy + 4) * (dy + 4)) / 8) * 8; halo.fillRect(MX - hw, MY + dy, hw * 2, 8); }
    }
    halo.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: halo, alpha: 0.55, duration: 4000, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [6] });
    if (has(K_MOON)) this.add.image(MX, MY, K_MOON).setScale(4);
    else { const m = this.add.graphics(); m.fillStyle(0xf4eedb, 1); m.fillRect(MX - 40, MY - 40, 80, 80); }

    // Twinkling pixel stars (whole-pixel squares + a few 5×5 sparkles), stepped alpha
    const starCols = [0xffffff, 0xdfe6ff, 0xfff1c9, 0xc9d8ff];
    for (let i = 0; i < 90; i++) {
      const x = rnd.between(0, W / 4) * 4, y = rnd.between(0, 400 / 4) * 4;
      const big = rnd.frac() < 0.1 && has(K_SPARK);
      let s: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
      if (big) s = this.add.image(x, y, K_SPARK).setScale(2).setTint(rnd.pick(starCols));
      else { const sz = rnd.pick([2, 2, 4]); s = this.add.rectangle(x, y, sz, sz, rnd.pick(starCols)).setOrigin(0, 0); }
      s.setAlpha(rnd.realInRange(0.5, 1));
      this.tweens.add({ targets: s, alpha: rnd.realInRange(0.1, 0.35), duration: rnd.between(900, 3200), yoyo: true, repeat: -1,
        delay: rnd.between(0, 3000), ease: 'Stepped', easeParams: [3] });
    }

    // Shooting stars: a head square + stepped trail
    this.time.addEvent({ delay: 3800, loop: true, callback: () => this.pixelShootingStar(rnd) });

    // High cloud bank (storm clouds recoloured arcane violet, flipped so the lit edge faces the moon)
    if (has(K_CLOUDS)) this.layer(K_CLOUDS, 2, 330, 4, { alpha: 0.36, tint: 0x9a84e0 });

    // Horizon glow: stepped additive violet bands behind the mountains so their silhouettes read
    const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const gTop = 250, gBands = 10, gH = Math.ceil((H - gTop) / gBands / 8) * 8;
    for (let i = 0; i < gBands; i++) {
      glow.fillStyle(i % 2 ? 0x6a48c0 : 0x5a3cb0, 0.04 + i * 0.02);
      glow.fillRect(0, gTop + i * gH, W, H - gTop - i * gH);
    }

    // Far mountains (256×272 @×2) and ruined mid layer (352×240 @×2); an additive twin lifts the rim light
    this.layer(K_FAR, 2, H + 8, 3);
    this.layer(K_FAR, 2, H + 8, 3, { alpha: 0.95, tint: 0xa894ff }).setBlendMode(Phaser.BlendModes.ADD);
    this.layer(K_MID, 2, H + 6, 6);
    this.layer(K_MID, 2, H + 6, 6, { alpha: 0.8, tint: 0x9a84f4 }).setBlendMode(Phaser.BlendModes.ADD);

    // Mage tower on the right: 100×299 @×2, base sunk in the foreground
    const tx = Math.round(TOWER_X / 2) * 2, ty = 702;
    this.add.image(tx, ty, K_TOWER).setOrigin(0.5, 1).setScale(2);
    // orb glow: soft, round, pixel-stepped halo (was a hard stacked square)
    const orbY = ty - 299 * 2 + 12;
    const og = this.pixelGlow(tx, orbY, [36, 26, 18, 10], 0x7fd8ff, 0.09, 2);
    this.tweens.add({ targets: og, alpha: 0.55, duration: 1300, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [4] });
    try {
      this.add.particles(tx, orbY, has(K_SPARK) ? K_SPARK : K_DOT, {
        lifespan: 1600, speed: { min: 10, max: 40 }, scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 },
        tint: [0x9be7ff, 0xffffff, 0xc59bff], blendMode: Phaser.BlendModes.ADD, frequency: 200,
      });
    } catch (e) { console.warn('[title] sparkle particles failed', e); }

    // Foreground hill silhouette: stepped, so no smooth slopes
    const fg = this.add.graphics();
    fg.fillStyle(0x1a1238, 1);
    for (let x = 0; x < W; x += 16) {
      const near = Math.max(0, 300 - Math.abs(x - tx)) * 0.12;
      const top = Math.round((660 - Math.sin(x / 210) * 14 - near) / 4) * 4;
      fg.fillRect(x, top, 16, H - top);
    }
    // pine silhouettes (stepped triangles) away from the tower
    for (let i = 0; i < 14; i++) {
      const x = Math.round(rnd.between(0, W) / 4) * 4;
      if (Math.abs(x - tx) < 130) continue;
      const top = Math.round((660 - Math.sin(x / 210) * 14) / 4) * 4;
      const hgt = rnd.between(6, 14);
      for (let r = 0; r < hgt; r++) { const w = (2 + Math.floor(r * 0.8)) * 4; fg.fillRect(x - w / 2, top - (hgt - r) * 8, w, 8); }
      fg.fillRect(x - 4, top - 4, 8, 8);
    }

    // Floating motes: small square 3×3 sprites drifting up
    try {
      this.add.particles(0, 0, has(K_MOTE) ? K_MOTE : K_DOT, {
        x: { min: 0, max: W }, y: { min: H - 10, max: H + 30 },
        lifespan: { min: 7000, max: 12000 },
        speedY: { min: -40, max: -12 }, speedX: { min: -10, max: 10 },
        scale: { start: 2, end: 2 }, alpha: { start: 0.9, end: 0 },
        tint: [0xffd27a, 0x9be7ff, 0xc59bff, 0xff9ad5],
        blendMode: Phaser.BlendModes.ADD, frequency: 130, quantity: 1, advance: 9000,
      });
    } catch (e) { console.warn('[title] particles failed', e); }

  }

  private pixelShootingStar(rnd: Phaser.Math.RandomDataGenerator) {
    if (rnd.frac() < 0.35) return;
    const x = Math.round(rnd.between(100, W - 400) / 4) * 4, y = Math.round(rnd.between(30, 220) / 4) * 4;
    const c = this.add.container(x, y);
    for (let i = 0; i < 7; i++) c.add(this.add.rectangle(-i * 12, -i * 5, 4, 4, 0xe8f0ff).setOrigin(0, 0).setAlpha(1 - i * 0.14));
    this.tweens.add({
      targets: c, x: x + 280, y: y + 110, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Stepped', easeParams: [18],
      onComplete: () => c.destroy(),
    });
  }

  // ─────────────────────────── background (procedural fallback) ───────────────────────────

  private ensureTextures() {
    const tex = this.textures;
    if (!tex.exists('title_glow')) {
      const c = tex.createCanvas('title_glow', 64, 64);
      if (c) {
        const g = c.getContext();
        const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
        c.refresh();
      }
    }
    if (!tex.exists('title_star')) {
      const c = tex.createCanvas('title_star', 16, 16);
      if (c) {
        const g = c.getContext();
        const grd = g.createRadialGradient(8, 8, 0, 8, 8, 8);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.4, 'rgba(255,255,255,0.7)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.fillRect(0, 0, 16, 16);
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.fillRect(7.5, 0, 1, 16); g.fillRect(0, 7.5, 16, 1);
        c.refresh();
      }
    }
  }

  private buildBackground() {
    this.ensureTextures();
    const rnd = new Phaser.Math.RandomDataGenerator(['arcana']);

    // Sky
    // Sky: stepped bands with a 1-row checker dither between them (16-bit style, no smooth gradient).
    const sky = this.add.graphics();
    const BANDS = 12, bandH = Math.ceil(H / BANDS / 8) * 8;
    const bandCol = (i: number) => Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x04061a), Phaser.Display.Color.ValueToColor(0x3a1f5e), BANDS - 1, i);
    for (let i = 0; i < BANDS; i++) {
      const c = bandCol(i);
      sky.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      sky.fillRect(0, i * bandH, W, bandH);
      if (i > 0) {
        const p = bandCol(i - 1);
        sky.fillStyle(Phaser.Display.Color.GetColor(p.r, p.g, p.b), 1);
        for (let x = 0; x < W; x += 16) sky.fillRect(x, i * bandH, 8, 4);
      }
    }

    // Nebula clouds
    const neb: [number, number, number, number][] = [[260, 160, 0x6a3cff, 11], [720, 90, 0x2fb8ff, 9], [1100, 300, 0xff5fae, 8], [480, 420, 0x7b4dff, 12]];
    for (const [x, y, tint, s] of neb) {
      const n = this.add.image(x, y, 'title_glow').setScale(s).setTint(tint).setAlpha(0.13).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: n, x: x + rnd.between(-60, 60), y: y + rnd.between(-25, 25), alpha: 0.2, duration: rnd.between(9000, 14000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // Stars
    for (let i = 0; i < 190; i++) {
      const x = rnd.between(0, W), y = rnd.between(0, 540);
      const big = rnd.frac() < 0.12;
      const s = this.add.image(x, y, 'title_star').setScale(big ? rnd.realInRange(0.5, 0.8) : rnd.realInRange(0.12, 0.3))
        .setAlpha(rnd.realInRange(0.35, 1)).setTint(rnd.pick([0xffffff, 0xdfe6ff, 0xfff1c9, 0xc9d8ff]));
      if (!big) s.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: s, alpha: rnd.realInRange(0.1, 0.4), duration: rnd.between(900, 3200), yoyo: true, repeat: -1, delay: rnd.between(0, 3000), ease: 'Sine.easeInOut' });
    }

    // Moon
    const moonGlow = this.add.image(1130, 120, 'title_glow').setScale(5).setTint(0xcfd8ff).setAlpha(0.32).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: moonGlow, alpha: 0.42, scale: 5.4, duration: 4000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const moon = this.add.graphics();
    moon.fillStyle(0xf4eedb, 1); moon.fillCircle(1130, 120, 38);
    moon.fillStyle(0xd9d0b8, 0.6); moon.fillCircle(1118, 110, 8); moon.fillCircle(1144, 132, 6); moon.fillCircle(1136, 102, 4);

    // Shooting stars
    this.time.addEvent({ delay: 3800, loop: true, callback: () => this.shootingStar(rnd) });

    // Far mountains
    const far = this.add.graphics();
    far.fillStyle(0x1d1442, 1);
    this.ridge(far, 470, 80, rnd, 14);
    const mid = this.add.graphics();
    mid.fillStyle(0x130d30, 1);
    this.ridge(mid, 540, 55, rnd, 10);

    // Mist band
    const mist = this.add.image(W / 2, 560, 'title_glow').setScale(26, 2.2).setTint(0x8b6cff).setAlpha(0.14).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: mist, alpha: 0.22, duration: 5000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.buildTower();

    // Foreground hill
    const fg = this.add.graphics();
    fg.fillStyle(0x07050f, 1);
    fg.beginPath();
    fg.moveTo(0, H);
    fg.lineTo(0, 640);
    for (let x = 0; x <= W; x += 40) {
      const y = 640 - Math.sin(x / 210) * 14 - (Math.abs(x - TOWER_X) < 260 ? (260 - Math.abs(x - TOWER_X)) * 0.22 : 0);
      fg.lineTo(x, y);
    }
    fg.lineTo(W, H);
    fg.closePath();
    fg.fillPath();
    // Grass tufts / pines silhouette
    for (let i = 0; i < 16; i++) {
      const x = rnd.between(0, W), base = 646 - Math.sin(x / 210) * 14 - (Math.abs(x - TOWER_X) < 260 ? (260 - Math.abs(x - TOWER_X)) * 0.22 : 0);
      if (Math.abs(x - TOWER_X) < 70) continue;
      const hgt = rnd.between(40, 90), w = hgt * 0.38;
      fg.fillTriangle(x - w, base, x + w, base, x, base - hgt);
      fg.fillTriangle(x - w * 0.8, base - hgt * 0.35, x + w * 0.8, base - hgt * 0.35, x, base - hgt * 1.15);
    }

    // Floating motes
    try {
      this.add.particles(0, 0, 'title_glow', {
        x: { min: 0, max: W }, y: { min: H - 10, max: H + 30 },
        lifespan: { min: 7000, max: 12000 },
        speedY: { min: -40, max: -12 }, speedX: { min: -10, max: 10 },
        scale: { start: 0.16, end: 0.02 }, alpha: { start: 0.85, end: 0 },
        tint: [0xffd27a, 0x9be7ff, 0xc59bff, 0xff9ad5],
        blendMode: Phaser.BlendModes.ADD, frequency: 130, quantity: 1, advance: 9000,
      });
      // Sparkles orbiting the tower top
      this.add.particles(TOWER_X, 96, 'title_star', {
        lifespan: 1600, speed: { min: 10, max: 40 }, scale: { start: 0.45, end: 0 }, alpha: { start: 1, end: 0 },
        tint: [0x9be7ff, 0xffffff, 0xc59bff], blendMode: Phaser.BlendModes.ADD, frequency: 160,
      });
    } catch (e) { console.warn('[title] particles failed', e); }
  }

  private ridge(g: Phaser.GameObjects.Graphics, baseY: number, amp: number, rnd: Phaser.Math.RandomDataGenerator, peaks: number) {
    g.beginPath();
    g.moveTo(0, H);
    g.lineTo(0, baseY);
    const step = W / peaks;
    for (let i = 0; i <= peaks; i++) {
      const x = i * step;
      g.lineTo(x - step / 2, baseY - rnd.realInRange(0.3, 1) * amp);
      g.lineTo(x, baseY - rnd.realInRange(0, 0.35) * amp);
    }
    g.lineTo(W, H);
    g.closePath();
    g.fillPath();
  }

  private buildTower() {
    const x = TOWER_X;
    const g = this.add.graphics();
    const body = 0x0b0720, edge = 0x1b1340;
    // rocky base
    g.fillStyle(body, 1);
    g.fillTriangle(x - 150, 640, x + 160, 640, x, 540);
    // lower tower
    g.fillStyle(body, 1);
    g.fillPoints([new Phaser.Geom.Point(x - 58, 600), new Phaser.Geom.Point(x + 58, 600), new Phaser.Geom.Point(x + 42, 330), new Phaser.Geom.Point(x - 42, 330)], true);
    // rim light on the moon-facing side
    g.fillStyle(edge, 1);
    g.fillPoints([new Phaser.Geom.Point(x + 46, 600), new Phaser.Geom.Point(x + 58, 600), new Phaser.Geom.Point(x + 42, 330), new Phaser.Geom.Point(x + 34, 330)], true);
    // balcony
    g.fillStyle(body, 1);
    g.fillRect(x - 64, 322, 128, 12);
    g.fillTriangle(x - 64, 334, x - 40, 334, x - 40, 352);
    g.fillTriangle(x + 64, 334, x + 40, 334, x + 40, 352);
    // upper tower
    g.fillPoints([new Phaser.Geom.Point(x - 36, 322), new Phaser.Geom.Point(x + 36, 322), new Phaser.Geom.Point(x + 28, 200), new Phaser.Geom.Point(x - 28, 200)], true);
    g.fillStyle(edge, 1);
    g.fillPoints([new Phaser.Geom.Point(x + 28, 322), new Phaser.Geom.Point(x + 36, 322), new Phaser.Geom.Point(x + 28, 200), new Phaser.Geom.Point(x + 22, 200)], true);
    // roof
    g.fillStyle(0x120a2c, 1);
    g.fillTriangle(x - 50, 206, x + 50, 206, x, 112);
    g.fillStyle(0x24185a, 1);
    g.fillTriangle(x + 6, 206, x + 50, 206, x, 112);
    // side turret
    g.fillStyle(body, 1);
    g.fillRect(x - 92, 440, 34, 160);
    g.fillTriangle(x - 98, 444, x - 52, 444, x - 75, 392);

    // glowing windows
    const wins: [number, number, number, number][] = [[x - 8, 540, 14, 24], [x - 22, 450, 12, 20], [x + 10, 400, 12, 20], [x - 6, 250, 12, 22], [x - 80, 500, 10, 16]];
    for (const [wx, wy, ww, wh] of wins) {
      const wg = this.add.graphics();
      wg.fillStyle(0xffc766, 1);
      wg.fillRect(wx, wy, ww, wh);
      wg.fillCircle(wx + ww / 2, wy, ww / 2);
      const glow = this.add.image(wx + ww / 2, wy + wh / 2, 'title_glow').setScale(1.3).setTint(0xffb347).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: [wg, glow], alpha: { from: 1, to: 0.55 }, duration: Phaser.Math.Between(1400, 2600), yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Phaser.Math.Between(0, 1500) });
    }

    // crystal + glow
    this.crystalGlow = this.add.image(x, 96, 'title_glow').setScale(3.2).setTint(0x7fd8ff).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD);
    const beam = this.add.image(x, 30, 'title_glow').setScale(0.7, 6).setTint(0x9be7ff).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: beam, alpha: 0.32, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const c = this.add.graphics();
    c.fillStyle(0xbff0ff, 1);
    c.fillPoints([new Phaser.Geom.Point(x, 70), new Phaser.Geom.Point(x + 11, 96), new Phaser.Geom.Point(x, 122), new Phaser.Geom.Point(x - 11, 96)], true);
    c.fillStyle(0x5fc4ff, 1);
    c.fillPoints([new Phaser.Geom.Point(x, 70), new Phaser.Geom.Point(x + 11, 96), new Phaser.Geom.Point(x, 122)], true);
    this.tweens.add({ targets: c, y: -6, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // rotating rune rings: spin in-plane inside a flattened container (perspective ellipse)
    const ring = this.add.container(x, 100).setScale(1, 0.32);
    this.rune = this.add.graphics();
    this.drawRune(this.rune, 46, 12, 0x9be7ff);
    this.rune.setAlpha(0.85).setBlendMode(Phaser.BlendModes.ADD);
    this.rune2 = this.add.graphics();
    this.drawRune(this.rune2, 30, 8, 0xc59bff);
    this.rune2.setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD);
    ring.add([this.rune, this.rune2]);
  }

  private drawRune(g: Phaser.GameObjects.Graphics, r: number, ticks: number, color: number) {
    g.lineStyle(2, color, 0.9);
    g.strokeCircle(0, 0, r);
    g.lineStyle(1, color, 0.6);
    g.strokeCircle(0, 0, r - 6);
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * Math.PI * 2;
      g.fillStyle(color, 0.9);
      g.fillCircle(Math.cos(a) * (r - 3), Math.sin(a) * (r - 3), i % 3 === 0 ? 2.6 : 1.4);
    }
    g.lineStyle(1, color, 0.5);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      g.lineBetween(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6), Math.cos(a + Math.PI * 2 / 3) * (r - 6), Math.sin(a + Math.PI * 2 / 3) * (r - 6));
    }
  }

  private shootingStar(rnd: Phaser.Math.RandomDataGenerator) {
    if (rnd.frac() < 0.35) return;
    const x = rnd.between(100, W - 300), y = rnd.between(30, 220);
    const s = this.add.image(x, y, 'title_glow').setScale(1.6, 0.06).setRotation(0.38).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setTint(0xe8f0ff);
    this.tweens.add({
      targets: s, x: x + 260, y: y + 104, alpha: { from: 0.95, to: 0 }, duration: 900, ease: 'Quad.easeIn',
      onComplete: () => s.destroy(),
    });
  }

  update(time: number, delta: number) {
    this.t += delta;
    if (this.rune) this.rune.rotation += delta * 0.0006;
    if (this.rune2) this.rune2.rotation -= delta * 0.0011;
    if (this.crystalGlow) this.crystalGlow.setAlpha(0.6 + Math.sin(this.t / 500) * 0.15);
    if (this.pixelBackdrop) {
      // snap every layer to whole source pixels so nothing shimmers
      for (const d of this.drifts) d.ts.tilePositionX = Math.floor((this.t / 1000) * d.speed);
    }
    this.menu?.update(time);
  }
}
