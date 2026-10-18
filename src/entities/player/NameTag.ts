// OWNER: A1 (player). Maple-style name tag drawn under the feet.
import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';

export class NameTag {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private name = '';

  constructor(scene: Phaser.Scene) {
    this.bg = scene.add.graphics();
    this.label = scene.add.text(0, 0, '', {
      // 16-bit pixel font (CC0 Kenney Mini, bundled by the UI; crisp at multiples of 8px).
      fontFamily: '"Kenney Mini", "Kenney Pixel", monospace',
      fontSize: '16px',
      color: '#ffffff',
      shadow: { offsetX: 2, offsetY: 2, color: '#140c1c', blur: 0, fill: true },
    }).setOrigin(0.5, 0).setResolution(2);
    this.container = scene.add.container(0, 0, [this.bg, this.label]).setDepth(DEPTH.NAMETAG);
    this.container.setVisible(false);
  }

  setName(name: string) {
    if (name === this.name) return;
    this.name = name;
    this.label.setText(name);
    const padX = 6, padY = 2;
    const w = Math.ceil(this.label.width) + padX * 2;
    const h = Math.ceil(this.label.height) + padY * 2;
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
    this.container.setVisible(name.length > 0);
  }

  /** x = feet center, y = feet. */
  follow(x: number, y: number) {
    this.container.setPosition(Math.round(x), Math.round(y + 3));
  }

  setVisible(v: boolean) { this.container.setVisible(v && this.name.length > 0); }

  destroy() { this.container.destroy(true); }
}
