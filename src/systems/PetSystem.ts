import Phaser from 'phaser';
import type { GameServices, IMapInstance } from '../core/types';
import { DEPTH, PIXEL_SCALE } from '../core/constants';

const TEXTURE = 'pet_pip';
const FLAP = 'pet_pip_flap';
const SOURCE_SIZE = 14;
const SIZE = SOURCE_SIZE * PIXEL_SCALE;
const SCAN_MS = 200;
const SEEK_RADIUS = 260;
const FLIGHT_SPEED = 420;

type Point = { x: number; y: number };
type IgnoredDrop = Point & { until: number };
type Spark = Point & { vx: number; vy: number; age: number; color: number };

// Original 14×14 source pixels: raised, level, lowered wings, then a glide pose.
// O is the one-source-pixel outline; amber/highlight pairs give the eyes a glow.
const PIXELS = [
  [
    '....O....O....',
    '...OBOOOOBO...',
    '.OOOBBTTBBOOO.',
    'OBBOCCCCCCOBBO',
    'OBVOAHCCAHOVBO',
    '.OVOAKCCAKOVO.',
    '..OOBCCACBOO..',
    '...OBCCCCBO...',
    '...OVCCCCVO...',
    '...OVCCCCVO...',
    '...OBVCCVBO...',
    '....OBBBBO....',
    '....OAOOAO....',
    '.....O..O.....',
  ],
  [
    '....O....O....',
    '...OBOOOOBO...',
    '...OBBTTBBO...',
    '...OCCCCCCO...',
    '...OAHCCAHO...',
    '..OOAKCCAKOO..',
    '.OBBBCCACBBBO.',
    'OBBVCCCCCCVBBO',
    '.OOOVCCCCVOOO.',
    '...OVCCCCVO...',
    '...OBVCCVBO...',
    '....OBBBBO....',
    '....OAOOAO....',
    '.....O..O.....',
  ],
  [
    '....O....O....',
    '...OBOOOOBO...',
    '...OBBTTBBO...',
    '...OCCCCCCO...',
    '...OAHCCAHO...',
    '...OAKCCAKO...',
    '...OBCCACBO...',
    '..OBBCCCCBBO..',
    '..OBVCCCCVBO..',
    '..OBVCCCCVBO..',
    '..OVBVCCVBVO..',
    '...OOBBBBOO...',
    '....OAOOAO....',
    '.....O..O.....',
  ],
  [
    '....O....O....',
    '...OBOOOOBO...',
    '...OBBTTBBO...',
    '...OCCCCCCO...',
    '...OAHCCAHO...',
    '.OOOAKCCAKOOO.',
    'OBBBBCCACBBBBO',
    '.OVVCCCCCCVVO.',
    '..OOVCCCCVOO..',
    '...OVCCCCVO...',
    '...OBVCCVBO...',
    '....OBBBBO....',
    '....OAOOAO....',
    '.....O..O.....',
  ],
];

const PALETTE: Record<string, string> = {
  O: '#21182f', B: '#76513e', T: '#b98a62', C: '#f5e2b6',
  V: '#796199', A: '#edaa39', H: '#fff1aa', K: '#3b283b',
};

/** Academy-issued auto-loot familiar. The scene owns binding, updates and disposal. */
export class PetSystem {
  private map: IMapInstance | null = null;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private tag: Phaser.GameObjects.Container | null = null;
  private sparkles: Phaser.GameObjects.Graphics | null = null;
  private sparks: Spark[] = [];
  private ignored: IgnoredDrop[] = [];
  private target: Point | null = null;
  private mode: 'follow' | 'seek' | 'return' = 'follow';
  private x = 0;
  private y = 0;
  private snapped = false;
  private nextScan = 0;
  private enabled = true;
  private destroyed = false;
  private loggedError = false;

  // Services are intentionally only stored: the lead fills them after construction.
  constructor(private scene: Phaser.Scene, private services: GameServices) {}

  bindMap(map: IMapInstance): void {
    if (this.destroyed) return;
    this.clear();
    this.map = map;
    this.snapToPlayer();
  }

  update(time: number, delta: number): void {
    try {
      if (this.destroyed || !this.enabled || !this.map) return;
      const { player, progression, drops } = this.services;
      if (!player || !progression || !Number.isFinite(player.x) || !Number.isFinite(player.y)) return;
      if (!this.snapped) this.snapToPlayer();
      if (!this.snapped || !this.ensureVisuals()) return;
      const dt = Number.isFinite(delta) ? Math.max(0, Math.min(delta, 100)) / 1000 : 0;
      const now = Number.isFinite(time) ? time : this.scene.time.now;
      this.drawSparkles(dt);

      // A blink or warp must not send Pip flying across the entire map.
      if (Math.hypot(this.x - player.x, this.y - player.y) > 700) {
        this.snapToPlayer();
        this.target = null;
        this.mode = 'return';
      }

      if (progression.isDead()) {
        this.target = null;
        this.mode = 'follow';
        this.nextScan = now + SCAN_MS;
        this.sparks = [];
        this.sparkles?.clear();
        // The player's ghost uses the same feet origin. Perch on its head, without bobbing.
        this.x = player.x;
        this.y = player.y - 56;
        this.clampPosition();
        this.present(false, 0);
        return;
      }

      if (now >= this.nextScan) {
        this.nextScan = now + SCAN_MS;
        this.ignored = this.ignored.filter(drop => drop.until > now);
        const positions = drops?.dropPositions() ?? [];
        // Keep cooldowns attached to falling/bouncing drops as well as resting ones.
        // The positions-only contract permits nearest-position tracking, not identity.
        const tracked = new Set<Point>();
        for (const blocked of this.ignored) {
          let closest: Point | null = null;
          let distance = 80;
          for (const drop of positions) {
            const candidate = Math.hypot(drop.x - blocked.x, drop.y - blocked.y);
            if (!tracked.has(drop) && candidate <= distance) {
              closest = drop;
              distance = candidate;
            }
          }
          if (closest) {
            blocked.x = closest.x;
            blocked.y = closest.y;
            tracked.add(closest);
          }
        }
        const eligible = positions.filter(drop =>
          Number.isFinite(drop.x) && Number.isFinite(drop.y) &&
          drop.x >= 0 && drop.x <= this.map!.widthPx &&
          drop.y >= 0 && drop.y <= this.map!.heightPx &&
          Math.hypot(drop.x - player.x, drop.y - player.y) <= SEEK_RADIUS &&
          !this.ignored.some(blocked => Math.hypot(drop.x - blocked.x, drop.y - blocked.y) <= 12),
        );
        // Positions have no IDs. Refresh the chase point as launched drops fall/bounce.
        if (this.target) {
          const previous = this.target;
          const match = eligible.reduce<Point | null>((best, drop) =>
            Math.hypot(drop.x - previous.x, drop.y - previous.y) <= 80 &&
            (!best || Math.hypot(drop.x - previous.x, drop.y - previous.y) <
              Math.hypot(best.x - previous.x, best.y - previous.y)) ? drop : best, null);
          this.target = match ? { ...match } : null;
          if (!this.target) this.mode = 'return';
        }
        if (this.mode === 'follow') {
          const closest = eligible.reduce<Point | null>((best, drop) =>
            !best || Math.hypot(drop.x - player.x, drop.y - player.y) <
              Math.hypot(best.x - player.x, best.y - player.y) ? drop : best, null);
          if (closest) {
            this.target = { ...closest };
            this.mode = 'seek';
          }
        }
      }

      const oldX = this.x;
      const oldY = this.y;
      // Abort a chase promptly if the player moves out of the loot's allowed range.
      if (this.target && Math.hypot(this.target.x - player.x, this.target.y - player.y) > SEEK_RADIUS) {
        this.target = null;
        this.mode = 'return';
      }
      if (this.mode === 'seek' && this.target) {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.hypot(dx, dy);
        const step = Math.min(distance, FLIGHT_SPEED * dt);
        if (distance > 0) {
          this.x += dx / distance * step;
          this.y += dy / distance * step;
        }
        this.clampPosition();
        if (Math.hypot(this.target.x - this.x, this.target.y - this.y) <= 22) {
          // The 22px reach also fits DropManager's vertically weighted 28px radius.
          if (drops?.pickupNear(this.x, this.y, 28)) this.addSparkles();
          else this.ignored.push({ ...this.target, until: now + 3000 });
          this.target = null;
          this.mode = 'return';
        }
      } else {
        const home = this.homePosition(now);
        const amount = 1 - Math.exp(-7 * dt);
        this.x += (home.x - this.x) * amount;
        this.y += (home.y - this.y) * amount;
        this.clampPosition();
        if (this.mode === 'return' && Math.hypot(home.x - this.x, home.y - this.y) < 16) {
          this.mode = 'follow';
        }
      }
      const movement = Math.hypot(this.x - oldX, this.y - oldY);
      this.present(this.mode === 'seek' || movement > dt * 35 || Math.sin(now * 0.003) > 0.25,
        this.x - oldX);
    } catch (error) {
      if (!this.loggedError) {
        this.loggedError = true;
        console.warn('[pet] Pip update failed', error);
      }
    }
  }

  /** Release map-local visuals and targets; the next bindMap recreates them lazily. */
  clear(): void {
    this.map = null;
    this.target = null;
    this.mode = 'follow';
    this.snapped = false;
    this.nextScan = 0;
    this.ignored = [];
    this.sparks = [];
    this.sprite?.destroy();
    this.tag?.destroy(true);
    this.sparkles?.destroy();
    this.sprite = null;
    this.tag = null;
    this.sparkles = null;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.clear();
    this.destroyed = true;
  }

  setEnabled(on: boolean): void {
    if (this.destroyed) return;
    this.enabled = on;
    this.target = null;
    this.mode = 'follow';
    this.nextScan = 0;
    this.sparks = [];
    this.sparkles?.clear();
    this.sprite?.setVisible(on && !!this.map);
    this.tag?.setVisible(on && !!this.map);
    if (on) this.snapToPlayer();
    else this.sprite?.anims.stop();
  }

  isEnabled(): boolean { return this.enabled && !this.destroyed; }

  private homePosition(time: number): Point {
    const player = this.services.player;
    return { x: player.x - player.facing * 40, y: player.y - 50 + Math.sin(time * 0.004) * 4 };
  }

  private snapToPlayer(): void {
    const player = this.services.player;
    if (!this.map || !player || !Number.isFinite(player.x) || !Number.isFinite(player.y)) return;
    this.x = player.x - player.facing * 40;
    this.y = player.y - 50;
    this.clampPosition();
    this.snapped = true;
    this.sprite?.setFlipX(player.facing < 0);
    this.present(false, 0);
  }

  private clampPosition(): void {
    if (!this.map) return;
    // Include the complete sprite and name plate, rather than just the anchor.
    const half = SIZE / 2;
    const width = Math.max(SIZE, this.tag?.width ?? 0);
    const marginX = Math.min(width / 2, this.map.widthPx / 2);
    const marginY = Math.min(half, this.map.heightPx / 2);
    this.x = Phaser.Math.Clamp(this.x, Math.ceil(marginX), Math.floor(this.map.widthPx - marginX));
    this.y = Phaser.Math.Clamp(this.y, Math.ceil(marginY),
      Math.max(Math.ceil(marginY), Math.floor(this.map.heightPx - half - (this.tag?.height ?? 0) - 2)));
  }

  private ensureVisuals(): boolean {
    if (this.sprite) return true;
    if (!this.scene.textures.exists(TEXTURE)) {
      const source = document.createElement('canvas');
      source.width = SOURCE_SIZE * PIXELS.length;
      source.height = SOURCE_SIZE;
      const ctx = source.getContext('2d');
      if (!ctx) return false;
      PIXELS.forEach((frame, index) => frame.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const color = PALETTE[row[x]];
          if (!color) continue;
          ctx.fillStyle = color;
          ctx.fillRect(index * SOURCE_SIZE + x, y, 1, 1);
        }
      }));
      const scaled = document.createElement('canvas');
      scaled.width = source.width * PIXEL_SCALE;
      scaled.height = source.height * PIXEL_SCALE;
      const scaledContext = scaled.getContext('2d');
      if (!scaledContext) return false;
      scaledContext.imageSmoothingEnabled = false;
      scaledContext.drawImage(source, 0, 0, scaled.width, scaled.height);
      const texture = this.scene.textures.addCanvas(TEXTURE, scaled);
      if (!texture) return false;
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      for (let i = 0; i < PIXELS.length; i++) texture.add(i, 0, i * SIZE, 0, SIZE, SIZE);
    }
    if (!this.scene.anims.exists(FLAP)) {
      this.scene.anims.create({
        key: FLAP, frames: [0, 1, 2, 1].map(frame => ({ key: TEXTURE, frame })),
        frameRate: 8, repeat: -1,
      });
    }
    this.sprite = this.scene.add.sprite(this.x, this.y, TEXTURE, 3)
      .setDepth(DEPTH.PLAYER + 1).setVisible(this.enabled);
    this.sprite.setFlipX(this.services.player.facing < 0);

    const label = this.scene.add.text(0, 2, 'Pip', {
      fontFamily: '"Kenney Mini", "Kenney Pixel", monospace', fontSize: '8px', color: '#ffffff',
      shadow: { offsetX: 2, offsetY: 2, color: '#140c1c', blur: 0, fill: true },
    }).setOrigin(0.5, 0).setResolution(2);
    const width = Math.ceil((label.width + 8) / 2) * 2;
    const height = Math.ceil((label.height + 4) / 2) * 2;
    const bg = this.scene.add.graphics();
    const left = -width / 2;
    bg.fillStyle(0x140c1c, 0.85);
    bg.fillRect(left + 2, 0, width - 4, 2);
    bg.fillRect(left + 2, height - 2, width - 4, 2);
    bg.fillRect(left, 2, 2, height - 4);
    bg.fillRect(left + width - 2, 2, 2, height - 4);
    bg.fillStyle(0x1a1b45, 0.8);
    bg.fillRect(left + 2, 2, width - 4, height - 4);
    this.tag = this.scene.add.container(this.x, this.y + SIZE / 2 + 2, [bg, label])
      .setSize(width, height).setDepth(DEPTH.NAMETAG).setVisible(this.enabled);
    this.sparkles = this.scene.add.graphics().setDepth(DEPTH.PLAYER + 1);
    this.clampPosition();
    this.present(false, 0);
    return true;
  }

  private present(flapping: boolean, dx: number): void {
    if (!this.sprite) return;
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y));
    if (Math.abs(dx) > 0.05) this.sprite.setFlipX(dx < 0);
    if (flapping) this.sprite.play(FLAP, true);
    else {
      this.sprite.anims.stop();
      this.sprite.setFrame(3);
    }
    this.tag?.setPosition(Math.round(this.x), Math.round(this.y + SIZE / 2 + 2));
  }

  private addSparkles(): void {
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      this.sparks.push({
        x: this.x, y: this.y, vx: Math.cos(angle) * 32, vy: Math.sin(angle) * 24 - 12,
        age: 0, color: i % 2 ? 0xffe4a0 : 0xb79ade,
      });
    }
  }

  private drawSparkles(dt: number): void {
    this.sparkles?.clear();
    this.sparks = this.sparks.filter(spark => {
      spark.age += dt;
      if (spark.age >= 0.35) return false;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      this.sparkles?.fillStyle(spark.color, 1 - spark.age / 0.35);
      const x = Phaser.Math.Clamp(Math.round(spark.x), 0, Math.max(0, (this.map?.widthPx ?? 2) - 2));
      const y = Phaser.Math.Clamp(Math.round(spark.y), 0, Math.max(0, (this.map?.heightPx ?? 2) - 2));
      this.sparkles?.fillRect(x, y, 2, 2);
      return true;
    });
  }
}
