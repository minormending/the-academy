/** Skill + VFX aggregation. Owned by the lead — do not edit. */
import Phaser from 'phaser';
import type { SkillDef } from '../core/types';
import { APPRENTICE_SKILLS, registerApprenticeVfx, generateApprenticeTextures } from './apprentice';
import { FIRE_SKILLS } from './fire';
import { registerFireVfx, generateFireTextures } from './fireVfx';
import { ICE_SKILLS } from './ice';
import { registerIceVfx, generateIceTextures } from './iceVfx';
import { LIGHTNING_SKILLS } from './lightning';
import { registerLightningVfx, generateLightningTextures } from './lightningVfx';
import { registerCommonVfx } from '../art/particles';

export const ALL_SKILLS: SkillDef[] = [...APPRENTICE_SKILLS, ...FIRE_SKILLS, ...ICE_SKILLS, ...LIGHTNING_SKILLS];

export function generateSkillTextures(scene: Phaser.Scene) {
  generateApprenticeTextures(scene); generateFireTextures(scene); generateIceTextures(scene); generateLightningTextures(scene);
}
export function registerAllVfx() {
  registerCommonVfx(); registerApprenticeVfx(); registerFireVfx(); registerIceVfx(); registerLightningVfx();
}
