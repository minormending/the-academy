// OWNER: A2 (skill-engine). STUB — replace with real implementation.
import Phaser from 'phaser';
import type { ActiveBuff, CastResult, GameServices, ISkillSystem, StatModifier } from '../core/types';
export class SkillSystem implements ISkillSystem {
  constructor(private scene: Phaser.Scene, private services: GameServices) {}
  tryCast(skillId: string): CastResult { return 'unknown'; }
  getCooldownRemaining(skillId: string) { return 0; }
  getCooldownTotal(skillId: string) { return 0; }
  getActiveBuffs(): ActiveBuff[] { return []; }
  getBuffModifiers(): StatModifier[] { return []; }
  cancelBuff(skillId: string) {}
  update(time: number, delta: number) {}
  clearWorld() {}
}
