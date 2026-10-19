// OWNER: A1 (player). Maple-style name tag drawn under the feet, with the chosen Academy Honors title beneath it.
import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';
import { maybeServices } from '../../core/services';

export class NameTag {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private titleBg: Phaser.GameObjects.Graphics;
  private titleLabel: Phaser.GameObjects.Text;
  private name = '';
  private title = '';
  private plateH = 0;
  private wantVisible = true;

  constructor(scene: Phaser.Scene) {
    this.bg = scene.add.graphics();
    this.label = scene.add.text(0, 0, '', {
      // 16-bit pixel font (CC0 Kenney Mini, bundled by the UI; crisp at multiples of 8px).
      fontFamily: '"Kenney Mini", "Kenney Pixel", monospace',
      fontSize: '16px',
      color: '#ffffff',
      shadow: { offsetX: 2, offsetY: 2, color: '#140c1c', blur: 0, fill: true },
    }).setOrigin(0.5, 0).setResolution(2);
    this.titleBg = scene.add.graphics();
    this.titleLabel = scene.add.text(0, 0, '', {
      fontFamily: '"Kenney Pixel", "Kenney Mini", monospace',
      fontSize: '16px',
      color: '#ffd76a',
      shadow: { offsetX: 1, offsetY: 1, color: '#140c1c', blur: 0, fill: true },
    }).setOrigin(0.5, 0).setResolution(2);
    this.container = scene.add.container(0, 0, [this.bg, this.label, this.titleBg, this.titleLabel]).setDepth(DEPTH.NAMETAG);
    this.container.setVisible(false);
    this.titleBg.setVisible(false);
    this.titleLabel.setVisible(false);
  }

  setName(name: string) {
    if (name === this.name) return;
    this.name = name;
    this.label.setText(name);
    const padX = 6, padY = 2;
    const w = Math.ceil(this.label.width) + padX * 2;
    const h = Math.ceil(this.label.height) + padY * 2;
    this.plateH = h;
    this.label.setPosition(0, padY);
    this.bg.clear();
    // Square pixel plate: dark fill + 2px outline with cut corners.
    const x0 = -Math.round(w / 2);
    this.bg.fillStyle(0x140c1c, 0.85);
    this.bg.fillRect(x0 + 2, 0, w - 4, 2);
    this.bg.fillRect(x0 + 2, h - 2, w - 4, 2);
    this.bg.fillRect(x0, 2, 2, h - 4);
    this.bg.fillRect(x0 + w - 2, 2, 2, h - 4);
    this.bg.fillStyle(0x1a1b45, 0.8);
    this.bg.fillRect(x0 + 2, 2, w - 4, h - 4);
    this.layoutTitle();
    this.container.setVisible(this.wantVisible && name.length > 0);
  }

  /** Academy Honors title shown under the name ('' = none). */
  setTitle(title: string) {
    if (title === this.title) return;
    this.title = title;
    this.titleLabel.setText(title);
    this.layoutTitle();
  }

  private layoutTitle() {
    const on = this.title.length > 0;
    this.titleBg.setVisible(on);
    this.titleLabel.setVisible(on);
    this.titleBg.clear();
    if (!on) return;
    const padX = 5;
    const w = Math.ceil(this.titleLabel.width) + padX * 2;
    const h = Math.ceil(this.titleLabel.height) + 2;
    const y0 = this.plateH + 2;
    const x0 = -Math.round(w / 2);
    this.titleLabel.setPosition(0, y0 + 1);
    // Thinner gold-trimmed plate so the title reads as secondary to the name.
    this.titleBg.fillStyle(0x140c1c, 0.8);
    this.titleBg.fillRect(x0 + 2, y0, w - 4, h);
    this.titleBg.fillRect(x0, y0 + 2, w, h - 4);
    this.titleBg.fillStyle(0x854c30, 0.9);
    this.titleBg.fillRect(x0 + 4, y0 + h - 2, w - 8, 1);
  }

  /** x = feet center, y = feet. */
  follow(x: number, y: number) {
    // The chosen title lives in the save (PlayerState.honors.title); pick up changes from the Honors window.
    let t = '';
    try { t = maybeServices()?.progression?.state?.honors?.title ?? ''; } catch { t = ''; }
    if (t !== this.title) this.setTitle(typeof t === 'string' ? t : '');
    this.container.setPosition(Math.round(x), Math.round(y + 3));
  }

  setVisible(v: boolean) { this.wantVisible = v; this.container.setVisible(v && this.name.length > 0); }

  destroy() { this.container.destroy(true); }
}
