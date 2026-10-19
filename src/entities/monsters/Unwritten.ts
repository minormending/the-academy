// OWNER: raid boss agent. The Unwritten (lv 70, top of the Archon Spire): the final raid boss, a living blank page.
//
// Three phases, every attack telegraphed 0.7–1 s with the shared FieldBoss warning shapes:
//   I   (100–66%): ink torrents (falling columns that leave ink puddles) + paper-blade lanes (jump the low lane)
//                  + a margin sweep charge.
//   II  (66–33%):  rewrites the arena — telegraphed falling sentences across the floor, the floor under one half
//                  re-inked as a hazard, and torn `unwritten_page` adds.
//   III (<33%):    enrage — "chapters" written in the player's own School element (fire pools, icicle rain,
//                  chained bolts, holy pillars, shadow clouds; neutral ink for School-less students).
// All damage goes through FieldBoss.dmg() (respects curse). Freeze/stun are capped by FieldBoss.applyStatus.
import Phaser from 'phaser';
import type { Element, GameServices, IMapInstance, MonsterDef } from '../../core/types';
import { bus } from '../../core/events';
import { DEPTH } from '../../core/constants';
import { BFX, MFX } from '../../art/monsterArt';
import type { MonsterSpawnOptions } from '../Monster';
import { FieldBoss, rand, type BossAction } from './FieldBoss';

const INK = 0x1a1430;
const PAPER = 0xf4ecd8;
const GOLD = '#f4e2a8';

/** Element → hazard tint for the enrage chapters. */
const ELEMENT_TINT: Record<Element, number> = {
  neutral: 0x6a5aa8, fire: 0xff6a1e, ice: 0x8fd8f6, lightning: 0xfff27a, holy: 0xfff4c0, shadow: 0x7a1ec8,
};
const CHAPTER_NAME: Record<Element, string> = {
  neutral: 'Chapter of Ink', fire: 'Chapter of Fire', ice: 'Chapter of Ice', lightning: 'Chapter of Storms',
  holy: 'Chapter of Light', shadow: 'Chapter of Shadow',
};

const WORDS = ['THE', 'END', 'ERASE', 'REWRITE', 'NEVER', 'WRITTEN', 'BLANK', 'FINIS', 'DELETE', 'UNSAID', 'VOID', 'INK'];

/** Tinted pixel image (white/grey FX ramps), integer-scaled. */
function fx(scene: Phaser.Scene, key: string, x: number, y: number, tint: number, scale = 2): Phaser.GameObjects.Image {
  const img = scene.textures.exists(key) ? scene.add.image(x, y, key) : scene.add.image(x, y, '__WHITE').setDisplaySize(12, 12);
  return img.setTint(tint).setScale(scale).setDepth(DEPTH.VFX);
}

export class Unwritten extends FieldBoss {
  private act: 1 | 2 | 3 = 1;

  constructor(scene: Phaser.Scene, services: GameServices, def: MonsterDef, x: number, y: number, map: IMapInstance, opts: MonsterSpawnOptions = {}) {
    super(scene, services, def, x, y, map, opts, {
      bar: { border: 0xf4ecd8, fill: 0x2c2668, enraged: 0xe8203a, nameColor: '#fffaf0', textColor: '#f4e2a8' },
      logColor: GOLD, engageRange: 420, keepDist: 120, actionGap: [1100, 1900], enrageAt: 0.33, enrageTint: 0xffd0c0,
      addIds: ['unwritten_page'], maxAdds: 4,
    });
    this.actions = [
      // ── phase I (kept at lower weight later) ──
      this.inkTorrent(),
      this.paperBlades(),
      this.makeCharge({ id: 'margin_sweep', windMs: 900, speed: 520, mult: 1.3, cooldownMs: 9000, anim: 'move', recoverMs: 800, hitH: 70,
        weight: dx => (dx > 160 ? 22 : 10) }),
      // ── phase II ──
      this.fallingSentences(),
      this.rewriteFloor(),
      this.makeSummon({ id: 'torn_pages', n: () => Phaser.Math.Between(2, 3), cooldownMs: 15000, tint: PAPER, weight: 20 }),
      // ── phase III ──
      this.chapter(),
    ];
    // Pages are only torn loose from phase II on (makeSummon's own weight still respects the add cap).
    const summon = this.actions.find(a => a.id === 'torn_pages');
    if (summon) { const base = summon.weight; summon.weight = dx => (this.act >= 2 ? base(dx) : 0); }
    // Banner on spawn (deferred a beat so the map's HUD is up).
    scene.time.delayedCall(500, () => {
      if (this.destroyed) return;
      try { bus.emit('ui:banner', { text: 'The Unwritten stirs', sub: `Lv.${def.level} raid boss — the final page`, color: GOLD }); } catch { /* ignore */ }
      try { bus.emit('ui:log', { text: 'A blank page the size of a door turns toward you. Nothing is written on it yet.', color: GOLD }); } catch { /* ignore */ }
      this.sfx('boss_roar', { detune: -500, volume: 0.8 });
      this.shake(320, 0.004);
    });
  }

  // ─────────────────────────── phases ───────────────────────────

  protected onEngage() {
    this.log('"Every story you know was written. I am the one that was not."');
  }

  protected onDamaged() {
    super.onDamaged();
    if (this.act === 1 && this.hp > 0 && this.hp / this.maxHp < 0.66) this.enterPhase2();
  }

  private enterPhase2() {
    this.act = 2;
    this.actCd = Math.min(this.actCd, 600);
    this.sfx('boss_roar', { detune: -250 });
    this.shake(360, 0.006);
    try { bus.emit('ui:banner', { text: 'The page rewrites itself', sub: 'Watch the sentences fall', color: GOLD }); } catch { /* ignore */ }
    this.log('The Unwritten begins to rewrite the arena!');
    this.puffAt(this.x, this.y - this.def.size.h / 2, PAPER, 14, 90);
  }

  protected onEnrage() {
    this.act = 3; // (also covers skipping straight past 66% with one huge hit)
    this.actCd = Math.min(this.actCd, 500);
    const el = this.playerElement();
    try { bus.emit('ui:banner', { text: 'The Final Chapter', sub: `It writes with your own ${el === 'neutral' ? 'ink' : el}`, color: '#ff9a8a' }); } catch { /* ignore */ }
    this.log('The Unwritten copies your magic onto its pages!');
  }

  /** The player's School element (Branch values match Element names); 'neutral' before a School. */
  private playerElement(): Element {
    try {
      const b = this.services.progression?.jobDef()?.branch;
      if (b && b !== 'none') return b;
    } catch { /* ignore */ }
    return 'neutral';
  }

  private w(p1: number, p2: number, p3: number) {
    return this.act === 1 ? p1 : this.act === 2 ? p2 : p3;
  }

  // ─────────────────────────── phase I ───────────────────────────

  /** Three ink columns (on the player + two flanks) crash down; each leaves an ink puddle. */
  private inkTorrent(): BossAction {
    const TELE = 850;
    return {
      id: 'ink_torrent', cooldownMs: 4500, weight: () => this.w(34, 16, 10),
      start: () => {
        const p = this.playerPos();
        const px = p?.x ?? this.x;
        const side = Math.random() < 0.5 ? -1 : 1;
        const xs = [px, px + side * rand(150, 210), px - side * rand(260, 340)].map(x => this.clampX(x, 40));
        xs.forEach((x, i) => {
          const gy = this.groundAt(x, this.arena.y - 40);
          const col = new Phaser.Geom.Rectangle(x - 36, gy - 320, 72, 320);
          this.telegraph(col, TELE + i * 120, r => this.inkSplash(r), 'column');
        });
        this.playAnim('attack', true);
        this.sfx('whoosh', { detune: -1000 });
      },
      tick: (_dt, t) => { this.stopX(); return t >= TELE + 400; },
    };
  }

  private inkSplash(r: Phaser.Geom.Rectangle) {
    this.hitIfOverlap(r, this.dmg(1.3));
    const x = r.centerX, gy = r.bottom;
    // the torrent itself: a dark streak that drops and fades
    const streak = this.scene.add.rectangle(x, r.y, 28, 40, INK, 0.9).setOrigin(0.5, 0).setDepth(DEPTH.VFX);
    this.scene.tweens.add({ targets: streak, height: r.height, scaleY: 1, duration: 120, onComplete: () => {
      this.scene.tweens.add({ targets: streak, alpha: 0, duration: 260, onComplete: () => streak.destroy() });
    } });
    this.sfx('land', { detune: -900 });
    this.puffAt(x, gy - 8, INK, 7, 50);
    const img = fx(this.scene, BFX.puddle, x, gy - 10, 0x2c2668, 2).setDepth(DEPTH.MONSTER - 1).setAlpha(0.95);
    this.addHazard(new Phaser.Geom.Rectangle(x - 46, gy - 18, 92, 18), 4200, 500, this.dmg(0.14), [img], h => {
      img.setAlpha(h.life < 800 ? (h.life / 800) * 0.95 : 0.95);
    });
  }

  /** Paper blades sweep the low lane across the whole arena: jump them. Enraged: a second, delayed wave. */
  private paperBlades(): BossAction {
    const TELE = 900;
    const waves = () => (this.act >= 3 ? 2 : 1);
    return {
      id: 'paper_blades', cooldownMs: 6500, weight: () => this.w(28, 14, 12),
      start: () => {
        const p = this.playerPos();
        const dir: 1 | -1 = p && p.x < this.x ? -1 : 1;
        for (let wv = 0; wv < waves(); wv++) {
          const lane = new Phaser.Geom.Rectangle(this.arena.x1, this.arena.y - 44, this.arena.x2 - this.arena.x1, 44);
          const d: 1 | -1 = wv % 2 ? (-dir as 1 | -1) : dir;
          this.telegraph(lane, TELE + wv * 900, () => this.launchBlades(d), 'lane', d);
        }
        this.face(dir);
        this.playAnim('attack', true);
        this.sfx('whoosh', { detune: 400 });
      },
      tick: (_dt, t) => { this.stopX(); return t >= TELE + 300; },
    };
  }

  private launchBlades(dir: 1 | -1) {
    const sx = dir > 0 ? this.arena.x1 + 10 : this.arena.x2 - 10;
    for (let i = 0; i < 3; i++) {
      const img = fx(this.scene, BFX.wave, sx - dir * i * 60, this.arena.y - 20, PAPER, 2).setFlipX(dir < 0);
      this.addProjectile(img, dir * 560, 0, 0, this.dmg(1.1), undefined, 0);
    }
    this.sfx('whoosh', { detune: 800 });
  }

  // ─────────────────────────── phase II ───────────────────────────

  /** Sentences fall across the floor in columns with safe gaps between them. */
  private fallingSentences(): BossAction {
    const TELE = 950;
    return {
      id: 'falling_sentences', cooldownMs: 6000, weight: () => this.w(0, 34, 16),
      start: () => {
        const span = this.arena.x2 - this.arena.x1;
        const n = Phaser.Math.Clamp(Math.floor(span / 190), 3, 8);
        const step = span / n;
        const off = Math.random() < 0.5 ? 0 : 0.5;
        for (let i = 0; i < n; i++) {
          if ((i + (off ? 1 : 0)) % 2) continue; // alternate columns: every other one is a safe gap
          const x = this.arena.x1 + step * (i + 0.5);
          const gy = this.groundAt(x, this.arena.y - 40);
          const w = Math.min(130, step * 0.85);
          this.telegraph(new Phaser.Geom.Rectangle(x - w / 2, gy - 300, w, 300), TELE, r => this.sentenceLands(r), 'column');
        }
        this.playAnim('attack', true);
        this.sfx('boss_roar', { detune: 700, volume: 0.5 });
      },
      tick: (_dt, t) => { this.stopX(); return t >= TELE + 350; },
    };
  }

  private sentenceLands(r: Phaser.Geom.Rectangle) {
    this.hitIfOverlap(r, this.dmg(1.5));
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    const txt = this.scene.add.text(r.centerX, r.y, word, {
      fontFamily: 'Georgia, serif', fontSize: '22px', color: '#1a1430', fontStyle: 'bold',
      backgroundColor: '#f4ecd8', padding: { x: 4, y: 2 },
    }).setOrigin(0.5, 1).setDepth(DEPTH.VFX);
    this.scene.tweens.add({
      targets: txt, y: r.bottom, duration: 140, ease: 'Quad.easeIn',
      onComplete: () => this.scene.tweens.add({ targets: txt, alpha: 0, duration: 500, delay: 250, onComplete: () => txt.destroy() }),
    });
    this.shake(120, 0.004);
    this.debris(r.centerX, r.bottom, PAPER, 6);
    this.sfx('explosion', { detune: -600, volume: 0.6 });
  }

  /** Re-inks the floor under the half of the arena the player stands on (it lingers as a hazard). */
  private rewriteFloor(): BossAction {
    const TELE = 1000;
    return {
      id: 'rewrite_floor', cooldownMs: 11000, weight: () => this.w(0, 22, 12),
      start: () => {
        const p = this.playerPos();
        const mid = (this.arena.x1 + this.arena.x2) / 2;
        const left = (p?.x ?? this.x) < mid;
        const x1 = left ? this.arena.x1 : mid, x2 = left ? mid : this.arena.x2;
        const rect = new Phaser.Geom.Rectangle(x1, this.arena.y - 30, x2 - x1, 30);
        this.telegraph(rect, TELE, r => this.inkFloor(r), 'ground');
        this.playAnim('attack', true);
        this.log('The Unwritten crosses out the floor beneath you!');
        this.sfx('whoosh', { detune: -1200 });
      },
      tick: (_dt, t) => { this.stopX(); return t >= TELE + 250; },
    };
  }

  private inkFloor(r: Phaser.Geom.Rectangle) {
    this.hitIfOverlap(r, this.dmg(0.9));
    const g = this.scene.add.graphics().setDepth(DEPTH.MONSTER - 1);
    g.fillStyle(INK, 0.85).fillRect(r.x, r.bottom - 10, r.width, 10);
    g.fillStyle(0x4f46b0, 0.7);
    for (let x = r.x + 8; x < r.right - 8; x += 22) g.fillRect(x, r.bottom - 12 - (x % 3) * 2, 12, 2); // struck-through lines
    this.puffAt(r.centerX, r.bottom - 8, INK, 10, r.width / 2);
    this.addHazard(new Phaser.Geom.Rectangle(r.x, r.bottom - 18, r.width, 18), 4500, 450, this.dmg(0.16), [g]);
  }

  // ─────────────────────────── phase III ───────────────────────────

  /** A chapter written in the player's own School element. */
  private chapter(): BossAction {
    const TELE = 850;
    let el: Element = 'neutral';
    return {
      id: 'chapter', cooldownMs: 3800, weight: () => this.w(0, 0, 40),
      start: () => {
        el = this.playerElement();
        const tint = ELEMENT_TINT[el];
        this.floatTitle(CHAPTER_NAME[el], tint);
        this.playAnim('attack', true);
        this.sfx('boss_roar', { detune: 300, volume: 0.6 });
        const p = this.playerPos();
        const px = p?.x ?? this.x;
        const gy = (x: number) => this.groundAt(x, this.arena.y - 40);
        switch (el) {
          case 'fire': // three burning pools around the player
            [px, px - 170, px + 170].map(x => this.clampX(x, 50)).forEach((x, i) =>
              this.telegraph(this.groundRect(x, 120, 60), TELE + i * 100, r => this.elementPool(r, tint, 1.2, 0.2, BFX.puddle), 'ground'));
            break;
          case 'ice': // icicle rain: five narrow columns
            for (let i = 0; i < 5; i++) {
              const x = this.clampX(px + (i - 2) * 110 + rand(-20, 20), 30);
              this.telegraph(new Phaser.Geom.Rectangle(x - 24, gy(x) - 300, 48, 300), TELE + i * 80, r => this.icicle(r, tint), 'column');
            }
            break;
          case 'lightning': // chained bolts: one on the player, then two jumping outward
            this.telegraph(new Phaser.Geom.Rectangle(this.clampX(px, 30) - 30, gy(px) - 340, 60, 340), TELE, r => {
              this.bolt(r, tint);
              for (const d of [-1, 1]) {
                const x = this.clampX(r.centerX + d * 200, 30);
                this.telegraph(new Phaser.Geom.Rectangle(x - 30, gy(x) - 340, 60, 340), 700, rr => this.bolt(rr, tint), 'column');
              }
            }, 'column');
            break;
          case 'holy': // two wide pillars of light with a gap between them
            for (const d of [-1, 1]) {
              const x = this.clampX(px + d * 120, 70);
              this.telegraph(new Phaser.Geom.Rectangle(x - 70, gy(x) - 360, 140, 360), TELE + 100, r => this.bolt(r, tint, 1.4), 'column');
            }
            break;
          case 'shadow': // lingering clouds that follow the floor
            [px, px + 220 * (Math.random() < 0.5 ? -1 : 1)].map(x => this.clampX(x, 70)).forEach(x =>
              this.telegraph(this.groundRect(x, 150, 90), TELE, r => this.elementPool(r, tint, 0.9, 0.24, BFX.cloud), 'ground'));
            break;
          default: // neutral: an ink torrent written in boldface
            [px, px - 140, px + 140].map(x => this.clampX(x, 40)).forEach((x, i) =>
              this.telegraph(new Phaser.Geom.Rectangle(x - 36, gy(x) - 320, 72, 320), TELE + i * 120, r => this.inkSplash(r), 'column'));
        }
      },
      tick: (_dt, t) => { this.stopX(); return t >= TELE + 500; },
    };
  }

  private floatTitle(text: string, tint: number) {
    const color = `#${tint.toString(16).padStart(6, '0')}`;
    const t = this.scene.add.text(this.x, this.y - this.def.size.h - 20, text, {
      fontFamily: 'Georgia, serif', fontSize: '16px', color, fontStyle: 'bold italic',
    }).setOrigin(0.5, 1).setDepth(DEPTH.VFX).setShadow(1, 1, '#000', 3);
    this.scene.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 1400, delay: 400, onComplete: () => t.destroy() });
  }

  private elementPool(r: Phaser.Geom.Rectangle, tint: number, hitMult: number, dotMult: number, tex: string) {
    this.hitIfOverlap(r, this.dmg(hitMult));
    const x = r.centerX, gy = r.bottom;
    this.puffAt(x, gy - 10, tint, 8, r.width / 2);
    this.sfx('explosion', { detune: -400, volume: 0.5 });
    const img = fx(this.scene, tex, x, gy - 14, tint, 3).setDepth(DEPTH.MONSTER - 1).setAlpha(0.85);
    this.addHazard(new Phaser.Geom.Rectangle(r.x + 6, gy - Math.min(r.height, 40), r.width - 12, Math.min(r.height, 40)), 4000, 500, this.dmg(dotMult), [img], (h) => {
      img.setAlpha(h.life < 800 ? (h.life / 800) * 0.85 : 0.85);
      if (Math.random() < 0.05 && this.scene.textures.exists(MFX.ember)) this.puffAt(x + rand(-40, 40), gy - 10, tint, 1, 12);
    });
  }

  private icicle(r: Phaser.Geom.Rectangle, tint: number) {
    this.hitIfOverlap(r, this.dmg(1.2));
    const img = fx(this.scene, BFX.icicle, r.centerX, r.y, tint, 2);
    this.scene.tweens.add({ targets: img, y: r.bottom - 10, duration: 130, ease: 'Quad.easeIn', onComplete: () => {
      this.debris(r.centerX, r.bottom, tint, 5, MFX.shard);
      img.destroy();
    } });
    this.sfx('land', { detune: 600, volume: 0.5 });
  }

  private bolt(r: Phaser.Geom.Rectangle, tint: number, mult = 1.3) {
    this.hitIfOverlap(r, this.dmg(mult));
    const g = this.scene.add.graphics().setDepth(DEPTH.VFX);
    g.fillStyle(tint, 0.85).fillRect(r.centerX - r.width * 0.2, r.y, r.width * 0.4, r.height);
    g.fillStyle(0xffffff, 0.9).fillRect(r.centerX - 3, r.y, 6, r.height);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 320, onComplete: () => g.destroy() });
    this.puffAt(r.centerX, r.bottom - 8, tint, 6, 40);
    this.shake(100, 0.004);
    this.sfx('explosion', { detune: 300, volume: 0.5 });
  }
}
