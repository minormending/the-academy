// OWNER: A8 (ui). Title screen: animated arcane night sky + mage tower, DOM menu on top.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../core/constants';
import type { PlayerState } from '../core/types';
import { getAudio } from '../systems/AudioSystem';
import { TitleMenu } from '../ui/titleMenu';
import { applySavedVolumes } from '../ui/miscWindows';

const W = GAME_WIDTH, H = GAME_HEIGHT;
const TOWER_X = 940;

export class TitleScene extends Phaser.Scene {
  private menu: TitleMenu | null = null;
  private rune: Phaser.GameObjects.Graphics | null = null;
  private rune2: Phaser.GameObjects.Graphics | null = null;
  private crystalGlow: Phaser.GameObjects.Image | null = null;
  private leaving = false;
  private t = 0;

  constructor() { super(SCENES.TITLE); }

  create() {
    this.leaving = false;
    this.t = 0;
    try { this.buildBackground(); } catch (e) { console.warn('[title] background failed', e); }

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
  }

  // ─────────────────────────── background ───────────────────────────

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
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x04061a, 0x04061a, 0x2c1656, 0x3a1f5e, 1);
    sky.fillRect(0, 0, W, H);

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
    this.menu?.update(time);
  }
}
