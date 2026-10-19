// OWNER: A6 (monsters). Top-of-screen boss HP bar shared by the Lich Archon and the field bosses.
import Phaser from 'phaser';
import { isMobileLayout, pinToScreen } from '../../ui/mobile';

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

const W_DESKTOP = 460;
/** Phones: a shorter bar with bigger text, drawn at MOBILE_SCALE on screen (undoing the camera zoom). */
const W_MOBILE = 240;
const MOBILE_SCALE = 1.5;

export class BossBar {
  private bar: Phaser.GameObjects.Container;
  private fill: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private shownHp = -1;
  private shownEnraged = false;
  private gone = false;
  private readonly mobile: boolean;
  private readonly w: number;
  private placedZoom = -1;

  constructor(private scene: Phaser.Scene, label: string, private style: BossBarStyle) {
    this.mobile = isMobileLayout();
    const W = this.w = this.mobile ? W_MOBILE : W_DESKTOP;
    const top = this.mobile ? -22 : -12, textY = this.mobile ? -21 : -9;
    const bg = scene.add.graphics();
    bg.fillStyle(0x0a0614, 0.85).fillRoundedRect(-W / 2 - 6, top, W + 12, 18 - top, 8);
    bg.lineStyle(2, style.border, 0.9).strokeRoundedRect(-W / 2 - 6, top, W + 12, 18 - top, 8);
    bg.fillStyle(0x2a0a1a, 1).fillRect(-W / 2, 2, W, 10);
    this.fill = scene.add.graphics();
    const name = scene.add.text(-W / 2, textY, label, {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: this.mobile ? '18px' : '12px', color: style.nameColor, fontStyle: 'bold',
    }).setOrigin(0, 0).setShadow(1, 1, '#000', 2);
    this.text = scene.add.text(W / 2, textY, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: this.mobile ? '18px' : '11px', color: style.textColor,
    }).setOrigin(1, 0).setShadow(1, 1, '#000', 2);
    if (this.mobile) { name.setResolution(2); this.text.setResolution(2); }
    this.bar = scene.add.container(0, 0, [bg, this.fill, name, this.text]).setScrollFactor(0).setDepth(1000).setAlpha(0);
    this.place();
    scene.tweens.add({ targets: this.bar, alpha: 1, duration: 400 });
  }

  /** Top-centre of the screen; on phones the camera is zoomed, so undo it for this fixed-to-camera bar. */
  private place() {
    const cam = this.scene.cameras.main;
    if (cam.zoom === this.placedZoom) return;
    this.placedZoom = cam.zoom;
    if (this.mobile || cam.zoom !== 1) pinToScreen(this.bar, cam, cam.width / 2, this.mobile ? 100 : 34, this.mobile ? MOBILE_SCALE : 1);
    else this.bar.setPosition(cam.width / 2, 34).setScale(1);
  }

  /** Redraw if HP (or enrage) changed, or always with `force`. */
  update(hp: number, maxHp: number, enraged: boolean, force = false) {
    if (this.gone) return;
    this.place();
    if (!force && hp === this.shownHp && enraged === this.shownEnraged) return;
    this.shownHp = hp;
    this.shownEnraged = enraged;
    const pct = Phaser.Math.Clamp(hp / Math.max(1, maxHp), 0, 1);
    const W = this.w;
    const g = this.fill;
    g.clear();
    g.fillStyle(enraged ? this.style.enraged : this.style.fill, 1).fillRect(-W / 2, 2, W * pct, 10);
    g.fillStyle(0xffffff, 0.3).fillRect(-W / 2, 2, W * pct, 3);
    g.lineStyle(1, 0xffffff, 0.25);
    for (let i = 1; i < 10; i++) g.lineBetween(-W / 2 + (W * i) / 10, 2, -W / 2 + (W * i) / 10, 12);
    this.text.setText(this.mobile
      ? `${(pct * 100).toFixed(pct < 0.1 ? 1 : 0)}%`
      : `${Math.ceil(hp).toLocaleString()} / ${maxHp.toLocaleString()}  (${(pct * 100).toFixed(1)}%)`);
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
