// OWNER: A9 (progression). STUB — replace with real implementation.
import type { BaseStatKey, DerivedStats, EquipSlot, GameServices, IProgression, JobDef, JobId, PlayerState } from '../core/types';
import { Registry } from '../core/registry';
export class Progression implements IProgression {
  constructor(private services: GameServices, readonly state: PlayerState) {}
  derived(): DerivedStats { return { maxHp: 100, maxMp: 100, matk: 20, def: 0, critRate: 0.05, critDmg: 0.5, mastery: 0.5, speed: 200, jump: 560, hpRegen: 5, mpRegen: 5, mpShield: 0, dmgAll: 0, dmgFire: 0, dmgIce: 0, dmgLightning: 0, castSpeed: 0, cdr: 0 }; }
  invalidate() {}
  jobDef(): JobDef { return Registry.job(this.state.job); }
  gainExp(amount: number) {}
  addMesos(amount: number) {}
  loseHp(amount: number) {}
  loseMp(amount: number) {}
  spendMp(amount: number) { return true; }
  heal(hp: number, mp: number) {}
  isDead() { return false; }
  respawn() {}
  canLearn(skillId: string) { return false; }
  learnSkill(skillId: string) { return false; }
  allocateAp(stat: BaseStatKey) { return false; }
  autoAllocateAp() {}
  availableAdvancements(): JobId[] { return []; }
  advanceJob(job: JobId) { return false; }
  addItem(itemId: string, qty: number) { return false; }
  removeItem(itemId: string, qty: number) { return false; }
  countItem(itemId: string) { return 0; }
  useItem(itemId: string) { return false; }
  equip(uid: string) { return false; }
  unequip(slot: EquipSlot) { return false; }
  buy(itemId: string, price: number, qty: number) { return false; }
  sell(uid: string, qty: number) { return false; }
  setHotbar(slot: number, entry: string | null) {}
  acceptQuest(questId: string) {}
  turnInQuest(questId: string) { return false; }
  save() {}
  update(time: number, delta: number) {}
}
