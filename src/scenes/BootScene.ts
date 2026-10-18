/** Boot: generates every procedural texture/animation, registers VFX. Owned by the lead. */
import Phaser from 'phaser';
import { SCENES } from '../core/constants';
import { generateParticleTextures } from '../art/particles';
import { generateCharacterTextures } from '../art/characters';
import { generateMonsterTextures } from '../art/monsterArt';
import { generateTileTextures } from '../art/tileArt';
import { generateSkillTextures, registerAllVfx } from '../skills';
import { queueArtAssets } from '../art/assets';

export class BootScene extends Phaser.Scene {
  constructor() { super(SCENES.BOOT); }

  preload() {
    const { width, height } = this.scale;
    const bar = this.add.rectangle(width / 2 - 200, height / 2 + 40, 0, 10, 0xcfd8ff).setOrigin(0, 0.5);
    this.add.rectangle(width / 2, height / 2 + 40, 404, 14).setStrokeStyle(2, 0xcfd8ff);
    this.load.on('progress', (p: number) => bar.setSize(400 * p, 10));
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.warn(`[boot] failed to load ${f.key} (${f.url})`));
    queueArtAssets(this.load);
  }

  create() {
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2, 'Opening the Academy gates…', { fontFamily: 'Trebuchet MS', fontSize: '28px', color: '#cfd8ff' }).setOrigin(0.5);
    // Wait for web fonts (pixel UI/damage fonts), then let the text render one frame before heavy generation.
    const fontsReady: Promise<unknown> = (document as Document & { fonts?: FontFaceSet }).fonts?.ready ?? Promise.resolve();
    Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]).then(() => this.time.delayedCall(30, () => {
      const steps: [string, () => void][] = [
        ['particles', () => generateParticleTextures(this)],
        ['characters', () => generateCharacterTextures(this)],
        ['monsters', () => generateMonsterTextures(this)],
        ['tiles', () => generateTileTextures(this)],
        ['skills', () => generateSkillTextures(this)],
        ['vfx', () => registerAllVfx()],
      ];
      for (const [name, fn] of steps) {
        try { fn(); } catch (e) { console.error(`[boot] ${name} failed`, e); }
      }
      this.scene.start(SCENES.TITLE);
    }));
  }
}
