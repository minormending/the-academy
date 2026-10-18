// OWNER: A8 (ui). STUB — replace with real implementation.
import Phaser from 'phaser';
import { SCENES } from '../core/constants';
import { loadSave, newPlayerState } from '../systems/SaveSystem';
export class TitleScene extends Phaser.Scene {
  constructor() { super(SCENES.TITLE); }
  create() { this.scene.start(SCENES.GAME, { state: loadSave() ?? newPlayerState('Mage') }); }
}
