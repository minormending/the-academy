/** Boot: generates every procedural texture/animation, registers VFX. Owned by the lead. */
import Phaser from 'phaser';
import { SCENES } from '../core/constants';
import { generateParticleTextures } from '../art/particles';
import { generateCharacterTextures } from '../art/characters';
import { generateMonsterTextures } from '../art/monsterArt';
import { generateTileTextures } from '../art/tileArt';
import { generateSkillTextures, registerAllVfx } from '../skills';

export class BootScene extends Phaser.Scene {
  constructor() { super(SCENES.BOOT); }
  create() {
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2, 'Weaving the Arcana…', { fontFamily: 'Trebuchet MS', fontSize: '28px', color: '#cfd8ff' }).setOrigin(0.5);
    // Let the loading text render one frame before the heavy generation work.
    this.time.delayedCall(30, () => {
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
    });
  }
}
