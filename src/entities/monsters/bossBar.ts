// OWNER: A6 (monsters). Top-of-screen boss HP bar shared by the Lich Archon and the field bosses.
import Phaser from 'phaser';

export interface BossBarStyle {
  /** Frame outline. */
  border: number;
  /** HP fill (normal / enraged). */
  fill: number;
  enraged: number;
  /** CSS colours for the name and the numbers. */
  nameColor: string;
  textColor: string;
}

export const LICH_BAR_STYLE: BossBarStyle = { border: 0xc89bff, fill: 0xb04aff, enraged: 0xff3a8a, nameColor: '#f3e6ff', textColor: '#ffd6f4' };

const W = 460;

export class BossBar {
  private bar: Phaser.GameObjects.Container;
  private fill: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private shownHp = -1;
  private shownEnraged = false;
  private gone = false;

  constructor(private scene: Phaser.Scene, label: string, private style: BossBarStyle) {
    const cam = scene.cameras.main;
    const cx = cam.width / 2, cy = 34;
    const bg = scene.add.graphics();
    bg.fillStyle(0x0a0614, 0.85).fillRoundedRect(-W / 2 - 6, -12, W + 12, 30, 8);
    bg.lineStyle(2, style.border, 0.9).strokeRoundedRect(-W / 2 - 6, -12, W + 12, 30, 8);
    bg.fillStyle(0x2a0a1a, 1).fillRect(-W / 2, 2, W, 10);
    this.fill = scene.add.graphics();
    const name = scene.add.text(-W / 2, -9, label, {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '12px', color: style.nameColor, fontStyle: 'bold',
    }).setOrigin(0, 0).setShadow(1, 1, '#000', 2);
    this.text = scene.add.text(W / 2, -9, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '11px', color: style.textColor,
    }).setOrigin(1, 0).setShadow(1, 1, '#000', 2);
    this.bar = scene.add.container(cx, cy, [bg, this.fill, name, this.text]).setScrollFactor(0).setDepth(1000).setAlpha(0);
    scene.tweens.add({ targets: this.bar, alpha: 1, duration: 400 });
  }

  /** Redraw if HP (or enrage) changed, or always with `force`. */
  update(hp: number, maxHp: number, enraged: boolean, force = false) {
    if (this.gone) return;
    if (!force && hp === this.shownHp && enraged === this.shownEnraged) return;
    this.shownHp = hp;
    this.shownEnraged = enraged;
    const pct = Phaser.Math.Clamp(hp / Math.max(1, maxHp), 0, 1);
    const g = this.fill;
    g.clear();
    g.fillStyle(enraged ? this.style.enraged : this.style.fill, 1).fillRect(-W / 2, 2, W * pct, 10);
    g.fillStyle(0xffffff, 0.3).fillRect(-W / 2, 2, W * pct, 3);
    g.lineStyle(1, 0xffffff, 0.25);
    for (let i = 1; i < 10; i++) g.lineBetween(-W / 2 + (W * i) / 10, 2, -W / 2 + (W * i) / 10, 12);
    this.text.setText(`${Math.ceil(hp).toLocaleString()} / ${maxHp.toLocaleString()}  (${(pct * 100).toFixed(1)}%)`);
  }

  /** Fade out and destroy (boss died / disengaged). */
  fadeOut(delay = 600) {
    if (this.gone) return;
    this.gone = true;
    const bar = this.bar;
    this.scene.tweens.add({ targets: bar, alpha: 0, duration: 900, delay, onComplete: () => bar.destroy() });
  }

  destroy() {
    this.gone = true;
    try { this.scene.tweens.killTweensOf(this.bar); } catch { /* ignore */ }
    this.bar.destroy();
  }
}
