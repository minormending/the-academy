// OWNER: A6 (monsters). Item/meso drops: roll, pop-out arc, bob, pickup, despawn.
import Phaser from 'phaser';
import type { GameServices, IDropManager, IMapInstance, MonsterDef } from '../core/types';
import { bus } from '../core/events';
import { Registry } from '../core/registry';
import { DEPTH } from '../core/constants';
import { playVfx } from '../core/vfx';
import { iconTexture } from '../art/icons';
import { DROP_TEX, dropCoinAnimKey } from '../art/monsterArt';
import { groundBelow } from '../entities/monsters/ground';

const GRAVITY = 1400;
const LAUNCH_VY = -380;
const PICKUP_RANGE = 50;
const LIFETIME_MS = 60000;
const BLINK_MS = 6000;
const MESO_CHANCE = 0.8;

interface Drop {
  kind: 'item' | 'mesos';
  itemId: string;
  qty: number;
  img: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  groundY: number;
  state: 'fly' | 'rest' | 'pick';
  born: number;
  bounced: boolean;
  phase: number;
}

type PendingDrop = { kind: 'item'; itemId: string; qty: number } | { kind: 'mesos'; amount: number };

export class DropManager implements IDropManager {
  private drops: Drop[] = [];
  private map: IMapInstance | null = null;
  private lastFullMsg = 0;

  constructor(private scene: Phaser.Scene, private services: GameServices) {
    bus.on('monster:killed', ({ monster }) => {
      try { this.dropFromMonster(monster.def, monster.x, monster.y); } catch (e) { console.warn('[drops] drop failed', e); }
    });
  }

  // ─────────────────────────── IDropManager ───────────────────────────

  dropFromMonster(def: MonsterDef, x: number, y: number) {
    if (!this.map) return;
    const pending: PendingDrop[] = [];
    if (def.mesos && (def.boss || Math.random() < MESO_CHANCE)) {
      const [lo, hi] = def.mesos;
      const amount = Phaser.Math.Between(Math.min(lo, hi), Math.max(lo, hi));
      if (def.boss) {
        // a boss spills several bags
        const bags = 4;
        for (let i = 0; i < bags; i++) pending.push({ kind: 'mesos', amount: Math.max(1, Math.round(amount / bags)) });
      } else if (amount > 0) pending.push({ kind: 'mesos', amount });
    }
    for (const d of def.drops ?? []) {
      if (Math.random() >= d.chance) continue;
      const min = d.min ?? 1, max = d.max ?? min;
      const qty = Phaser.Math.Between(Math.min(min, max), Math.max(min, max));
      if (qty > 0) pending.push({ kind: 'item', itemId: d.itemId, qty });
    }
    if (!pending.length) return;
    // shuffle a bit so mesos are not always on the same side
    for (let i = pending.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pending[i], pending[j]] = [pending[j], pending[i]];
    }
    const startY = y - Math.min(def.size.h / 2, 40);
    const spacing = def.boss ? 28 : 22;
    const n = pending.length;
    pending.forEach((p, i) => {
      const tx = x + (i - (n - 1) / 2) * spacing;
      if (p.kind === 'mesos') this.launch('mesos', 'mesos', p.amount, x, startY, tx, y, i * 35);
      else this.launch('item', p.itemId, p.qty, x, startY, tx, y, i * 35);
    });
  }

  spawnItem(itemId: string, qty: number, x: number, y: number) {
    this.launch('item', itemId, Math.max(1, qty), x, y - 20, x + Phaser.Math.Between(-12, 12), y, 0);
  }

  spawnMesos(amount: number, x: number, y: number) {
    if (amount <= 0) return;
    this.launch('mesos', 'mesos', amount, x, y - 20, x + Phaser.Math.Between(-12, 12), y, 0);
  }

  bindMap(map: IMapInstance) {
    this.map = map;
  }

  tryPickup(): boolean {
    const s = this.services;
    try {
      if (!s.player || s.progression?.isDead()) return false;
      const now = this.scene.time.now;
      const px = s.player.x, py = s.player.y;
      let best: Drop | null = null;
      let bestD = PICKUP_RANGE;
      for (const d of this.drops) {
        if (d.state === 'pick') continue;
        if (d.state === 'fly' && now - d.born < 250) continue;
        const dist = Math.hypot(d.x - px, (d.y - py) * 1.2);
        if (dist <= bestD) { best = d; bestD = dist; }
      }
      if (!best) return false;
      if (best.kind === 'mesos') {
        s.progression.addMesos(best.qty);
        s.audio?.play('mesos');
      } else {
        const ok = s.progression.addItem(best.itemId, best.qty);
        if (!ok) {
          if (now - this.lastFullMsg > 1500) {
            this.lastFullMsg = now;
            bus.emit('ui:log', { text: 'Your inventory is full.', color: '#ff9b9b' });
            s.audio?.play('ui_error');
          }
          return false;
        }
        s.audio?.play('pickup');
      }
      this.animatePickup(best);
      return true;
    } catch (e) {
      console.warn('[drops] pickup failed', e);
      return false;
    }
  }

  update(time: number, delta: number) {
    if (!this.drops.length) return;
    const dt = Math.min(delta, 50) / 1000;
    const now = this.scene.time.now;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (d.state === 'pick') continue;
      try {
        if (d.state === 'fly') {
          if (now < d.born) { d.img.setVisible(false); continue; }
          d.img.setVisible(true);
          d.vy += GRAVITY * dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          if (d.vy > 0 && d.y >= d.groundY) {
            d.y = d.groundY;
            if (!d.bounced && d.vy > 150) {
              d.bounced = true;
              d.vy = -d.vy * 0.32;
              d.vx = 0;
            } else {
              d.state = 'rest';
              d.vx = d.vy = 0;
            }
          }
          d.img.setPosition(d.x, d.y);
        } else {
          d.phase += dt * 3.2;
          d.img.setPosition(d.x, d.y - 3 - Math.sin(d.phase) * 2.5);
        }
        const age = now - d.born;
        if (age > LIFETIME_MS) {
          this.remove(i, true);
          continue;
        }
        if (age > LIFETIME_MS - BLINK_MS) d.img.setAlpha(Math.floor(age / 140) % 2 ? 0.25 : 1);
      } catch {
        this.remove(i, false);
      }
    }
  }

  clear() {
    for (const d of this.drops) {
      try { this.scene.tweens.killTweensOf(d.img); d.img.destroy(); } catch { /* ignore */ }
    }
    this.drops = [];
    this.map = null;
  }

  // ─────────────────────────── internals ───────────────────────────

  private launch(kind: 'item' | 'mesos', itemId: string, qty: number, x0: number, y0: number, tx: number, feetY: number, delayMs: number) {
    const map = this.map;
    if (!map) return;
    // keep the fan on the platform the monster stood on
    const home = groundBelow(map, x0, feetY - 4);
    if (home) tx = Phaser.Math.Clamp(tx, home.x1 + 8, home.x2 - 8);
    tx = Phaser.Math.Clamp(tx, 10, Math.max(10, map.widthPx - 10));
    const g = groundBelow(map, tx, Math.min(y0, feetY) - 4);
    const groundY = g ? g.y : feetY;
    const drop = groundY - y0;
    const tFlight = (-LAUNCH_VY + Math.sqrt(LAUNCH_VY * LAUNCH_VY + 2 * GRAVITY * Math.max(-50, drop))) / GRAVITY || 0.55;
    const img = this.makeSprite(kind, itemId, qty, x0, y0);
    img.setVisible(delayMs <= 0);
    this.drops.push({
      kind, itemId, qty, img, x: x0, y: y0,
      vx: (tx - x0) / Math.max(0.2, tFlight), vy: LAUNCH_VY,
      groundY, state: 'fly', born: this.scene.time.now + delayMs, bounced: false, phase: Math.random() * Math.PI * 2,
    });
  }

  private makeSprite(kind: 'item' | 'mesos', itemId: string, qty: number, x: number, y: number): Phaser.GameObjects.Sprite {
    const sc = this.scene;
    let spr: Phaser.GameObjects.Sprite;
    if (kind === 'mesos') {
      const tier = qty < 20 ? 'bronze' : qty < 80 ? 'silver' : qty < 400 ? 'gold' : 'bag';
      if (tier === 'bag') {
        spr = sc.add.sprite(x, y, sc.textures.exists(DROP_TEX.bag) ? DROP_TEX.bag : '__DEFAULT');
      } else {
        const key = DROP_TEX[tier];
        spr = sc.add.sprite(x, y, sc.textures.exists(key) ? key : '__DEFAULT', sc.textures.exists(key) ? 'f0' : undefined);
        const anim = dropCoinAnimKey(tier);
        if (sc.anims.exists(anim)) spr.play({ key: anim, startFrame: Phaser.Math.Between(0, 3) });
      }
    } else {
      let key = '';
      const def = Registry.item(itemId);
      if (def) {
        try { key = iconTexture(sc, def.icon, 32); } catch { key = ''; }
      }
      if (!key || key === '__DEFAULT' || key === '__MISSING' || !sc.textures.exists(key)) {
        key = sc.textures.exists(DROP_TEX.fallback) ? DROP_TEX.fallback : '__DEFAULT';
      }
      spr = sc.add.sprite(x, y, key);
      if (spr.width > 0 && spr.height > 0) {
        const s = 28 / Math.max(spr.width, spr.height);
        spr.setScale(s);
      }
    }
    spr.setOrigin(0.5, 1).setDepth(DEPTH.DROP);
    return spr;
  }

  private animatePickup(d: Drop) {
    d.state = 'pick';
    const img = d.img;
    const sx = d.x, sy = img.y;
    const s0 = img.scaleX;
    try { playVfx(this.scene, 'pickup_sparkle', { x: d.x, y: d.y - 10, facing: 1 }); } catch { /* ignore */ }
    this.scene.tweens.addCounter({
      from: 0, to: 1, duration: 200, ease: 'Quad.easeIn',
      onUpdate: tw => {
        const k = tw.getValue() ?? 0;
        let tx = sx, ty = sy;
        try { tx = this.services.player.x; ty = this.services.player.y - 30; } catch { /* ignore */ }
        img.setPosition(sx + (tx - sx) * k, sy + (ty - sy) * k);
        img.setScale(s0 * (1 - 0.6 * k));
        img.setAlpha(1 - 0.7 * k);
      },
      onComplete: () => {
        const i = this.drops.indexOf(d);
        if (i >= 0) this.drops.splice(i, 1);
        img.destroy();
      },
    });
  }

  private remove(i: number, fade: boolean) {
    const d = this.drops[i];
    this.drops.splice(i, 1);
    if (!d) return;
    if (fade) {
      d.state = 'pick';
      this.scene.tweens.add({ targets: d.img, alpha: 0, duration: 300, onComplete: () => d.img.destroy() });
    } else {
      d.img.destroy();
    }
  }
}
