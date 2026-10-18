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
      fontFamily: '"Trebuchet MS", Verdana, sans-serif',
      fontSize: '11px',
      color: '#ffffff',
    }).setOrigin(0.5, 0).setResolution(2);
    this.container = scene.add.container(0, 0, [this.bg, this.label]).setDepth(DEPTH.NAMETAG);
    this.container.setVisible(false);
  }

  setName(name: string) {
    if (name === this.name) return;
    this.name = name;
    this.label.setText(name);
    const padX = 5, padY = 2;
    const w = Math.ceil(this.label.width) + padX * 2;
    const h = Math.ceil(this.label.height) + padY * 2;
    this.label.setPosition(0, padY);
    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.55);
    this.bg.fillRoundedRect(-w / 2, 0, w, h, 4);
    this.container.setVisible(name.length > 0);
  }

  /** x = feet center, y = feet. */
  follow(x: number, y: number) {
    this.container.setPosition(Math.round(x), Math.round(y + 3));
  }

  setVisible(v: boolean) { this.container.setVisible(v && this.name.length > 0); }

  destroy() { this.container.destroy(true); }
}
