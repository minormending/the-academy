// OWNER: A2 (skill-engine). STUB — replace with real implementation.
import Phaser from 'phaser';
import type { DamageNumberKind, Element, GameServices, ICombatSystem, IMonster, StatusSpec } from '../core/types';
export class CombatSystem implements ICombatSystem {
  constructor(private scene: Phaser.Scene, private services: GameServices) {}
  rollSkillDamage(element: Element, damagePct: number, target: IMonster) { return { amount: 1, crit: false }; }
  damageMonster(target: IMonster, amount: number, opts?: { crit?: boolean; element?: Element; fromX?: number; knockback?: number; kind?: DamageNumberKind; stackIndex?: number }) {}
  tryApplyStatus(target: IMonster, spec: StatusSpec, lv: number, element: Element, baseHit: number) {}
  hitPlayer(raw: number, fromX: number) {}
  showNumber(x: number, y: number, amount: number, kind: DamageNumberKind, stackIndex?: number) {}
  update(time: number, delta: number) {}
}
