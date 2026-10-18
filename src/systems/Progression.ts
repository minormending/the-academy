// OWNER: A9 (progression). Player state, derived stats, leveling, AP/SP, jobs, inventory, equipment, shops, quests.
import type {
  BaseStatKey, DerivedStats, EquipSlot, GameServices, IMonster, IProgression, ItemDef, JobDef, JobId,
  PlayerState, QuestDef, SfxKey, StatModifier,
} from '../core/types';
import { HOTBAR_SIZE } from '../core/types';
import { Registry } from '../core/registry';
import { bus } from '../core/events';
import { AP_PER_LEVEL, SP_PER_LEVEL, expToNext } from '../core/balance';
import { MAX_LEVEL, TOWN_MAP } from '../core/constants';
import { JOB_ADVANCEMENT_QUESTS } from '../data/quests';
import { computeDerived } from './progression/stats';
import { newUid, repairState, writeSave } from './SaveSystem';

/** Max inventory stacks. */
export const MAX_INVENTORY_STACKS = 48;
/** SP granted on each job advancement. */
export const JOB_ADVANCE_BONUS_SP = 3;
/** Fraction of the current level's EXP requirement lost on death. */
export const DEATH_EXP_PENALTY = 0.05;

const REGEN_INTERVAL_MS = 5000;
const AUTOSAVE_MS = 30000;
const SAFE_REGEN_MULT = 3;
const DEFAULT_ITEM_COOLDOWN_MS = 300;

const LOG = {
  exp: '#ffe98a',
  good: '#a8ff9b',
  info: '#cfe3ff',
  warn: '#ff9b9b',
  quest: '#ffd36b',
};

/**
 * EXP multiplier for a kill: monsters ≥10 levels below the player give progressively less
 * (down to 10%); monsters above the player give a small bonus (up to +30%).
 */
export function killExpMultiplier(playerLevel: number, monsterLevel: number): number {
  const diff = playerLevel - monsterLevel;
  if (diff >= 10) return Math.max(0.1, 0.7 - (diff - 10) * 0.06);
  if (diff < 0) return 1 + Math.min(0.3, -diff * 0.05);
  return 1;
}

export class Progression implements IProgression {
  private cache: DerivedStats | null = null;
  private dead = false;
  private now = 0;
  private regenAcc = 0;
  private autosaveAcc = 0;
  private itemReadyAt = new Map<string, number>();

  constructor(private services: GameServices, readonly state: PlayerState) {
    // Defensive: make sure every field exists (state may come from an old/corrupt save).
    Object.assign(this.state, repairState(this.state));
    this.dead = this.state.hp <= 0;
    bus.on('monster:killed', ({ monster }) => this.onMonsterKilled(monster));
  }

  // ─────────────────────────── Stats ───────────────────────────

  derived(): DerivedStats {
    if (this.cache) return this.cache;
    let buffs: StatModifier[] = [];
    try {
      const sk = this.services.skills;
      if (sk && typeof sk.getBuffModifiers === 'function') buffs = sk.getBuffModifiers() ?? [];
    } catch { buffs = []; }
    let d: DerivedStats;
    try {
      d = computeDerived(this.state, buffs);
    } catch (e) {
      console.warn('[progression] derived failed', e);
      d = computeDerived(this.state, []);
    }
    this.cache = d;
    if (this.state.hp > d.maxHp) this.state.hp = d.maxHp;
    if (this.state.mp > d.maxMp) this.state.mp = d.maxMp;
    return d;
  }

  invalidate() {
    this.cache = null;
    this.changed();
  }

  jobDef(): JobDef {
    return Registry.job(this.state.job) ?? Registry.job('apprentice');
  }

  /** EXP needed to reach the next level (0 at max level). */
  expToNextLevel(): number {
    return this.state.level >= MAX_LEVEL ? 0 : expToNext(this.state.level);
  }

  // ─────────────────────────── EXP / leveling ───────────────────────────

  gainExp(amount: number) {
    amount = Math.floor(amount);
    if (!(amount > 0)) return;
    const s = this.state;
    if (s.level >= MAX_LEVEL) { s.exp = 0; return; }
    s.exp += amount;
    bus.emit('ui:log', { text: `+${amount} EXP`, color: LOG.exp });
    const startLevel = s.level;
    while (s.level < MAX_LEVEL && s.exp >= expToNext(s.level)) {
      s.exp -= expToNext(s.level);
      s.level += 1;
      s.sp += SP_PER_LEVEL;
      s.ap += AP_PER_LEVEL;
    }
    if (s.level >= MAX_LEVEL) s.exp = 0;
    if (s.level > startLevel) {
      this.cache = null;
      const d = this.derived();
      s.hp = d.maxHp;
      s.mp = d.maxMp;
      const gained = s.level - startLevel;
      bus.emit('ui:log', {
        text: `Level up! You are now level ${s.level}. (+${gained * SP_PER_LEVEL} SP, +${gained * AP_PER_LEVEL} AP)`,
        color: LOG.good,
      });
      bus.emit('player:levelup', { level: s.level });
      this.refreshQuests();
      if (this.availableAdvancements().length && this.jobDef().tier === 1) {
        bus.emit('ui:log', { text: 'You are ready to choose a path! Speak with Elder Maelis in Mistvale.', color: LOG.quest });
      }
      this.save();
    }
    this.changed();
  }

  addMesos(amount: number) {
    amount = Math.floor(amount);
    if (!amount) return;
    this.state.mesos = Math.max(0, this.state.mesos + amount);
    if (amount > 0) bus.emit('mesos:gained', { amount });
    this.changed();
  }

  private onMonsterKilled(monster: IMonster) {
    try {
      const def = monster?.def;
      if (!def) return;
      const mult = killExpMultiplier(this.state.level, def.level);
      const exp = Math.max(1, Math.round((def.exp || 0) * mult));
      if (def.exp > 0) this.gainExp(exp);
      // Quest kill counts
      for (const [qid, prog] of Object.entries(this.state.quests)) {
        if (prog.status === 'turned_in') continue;
        const q = Registry.quest(qid);
        if (!q) continue;
        let touched = false;
        q.objectives.forEach((o, i) => {
          if (o.kind === 'kill' && o.monsterId === def.id && (prog.counts[i] ?? 0) < o.count) {
            prog.counts[i] = (prog.counts[i] ?? 0) + 1;
            touched = true;
            const c = prog.counts[i];
            if (c === o.count || c % 5 === 0) {
              bus.emit('ui:log', { text: `${q.name}: ${def.name} ${c}/${o.count}`, color: LOG.quest });
            }
          }
        });
        if (touched) this.evalQuest(q, true);
      }
    } catch (e) {
      console.warn('[progression] monster:killed handler failed', e);
    }
  }

  // ─────────────────────────── HP / MP / death ───────────────────────────

  loseHp(amount: number) {
    if (this.dead) return;
    amount = Math.max(0, Math.floor(amount));
    if (!amount) return;
    this.state.hp = Math.max(0, this.state.hp - amount);
    if (this.state.hp <= 0) {
      this.dead = true;
      this.changed();
      bus.emit('player:died', {});
      return;
    }
    this.changed();
  }

  loseMp(amount: number) {
    amount = Math.max(0, Math.floor(amount));
    if (!amount) return;
    this.state.mp = Math.max(0, this.state.mp - amount);
    this.changed();
  }

  spendMp(amount: number): boolean {
    amount = Math.max(0, Math.ceil(amount));
    if (this.dead || this.state.mp < amount) return false;
    this.state.mp -= amount;
    this.changed();
    return true;
  }

  heal(hp: number, mp: number) {
    if (this.dead) return;
    const d = this.derived();
    const s = this.state;
    const hpBefore = s.hp, mpBefore = s.mp;
    s.hp = Math.min(d.maxHp, s.hp + Math.max(0, Math.floor(hp)));
    s.mp = Math.min(d.maxMp, s.mp + Math.max(0, Math.floor(mp)));
    const dh = s.hp - hpBefore, dm = s.mp - mpBefore;
    if (dh > 0 || dm > 0) {
      bus.emit('player:healed', { hp: dh, mp: dm });
      this.changed();
    }
  }

  isDead() { return this.dead; }

  respawn() {
    if (!this.dead) return;
    const s = this.state;
    if (s.level < MAX_LEVEL) {
      const loss = Math.min(s.exp, Math.floor(expToNext(s.level) * DEATH_EXP_PENALTY));
      if (loss > 0) {
        s.exp -= loss;
        bus.emit('ui:log', { text: `You lost ${loss} EXP.`, color: LOG.warn });
      }
    }
    const d = this.derived();
    s.hp = Math.max(1, Math.ceil(d.maxHp * 0.5));
    s.mp = Math.max(s.mp, Math.ceil(d.maxMp * 0.5));
    this.dead = false;
    this.changed();
    bus.emit('player:revived', {});
    this.save();
  }

  // ─────────────────────────── Skills / AP ───────────────────────────

  canLearn(skillId: string): boolean {
    const sk = Registry.skill(skillId);
    if (!sk) return false;
    if (this.state.sp <= 0) return false;
    if (!Registry.jobLineage(this.state.job).some(j => j.id === sk.job)) return false;
    const cur = this.state.skills[skillId] ?? 0;
    if (cur >= sk.maxLevel) return false;
    for (const r of sk.requires ?? []) {
      if ((this.state.skills[r.skillId] ?? 0) < r.level) return false;
    }
    return true;
  }

  learnSkill(skillId: string): boolean {
    if (!this.canLearn(skillId)) return false;
    const sk = Registry.skill(skillId)!;
    const s = this.state;
    const wasNew = !s.skills[skillId];
    s.sp -= 1;
    s.skills[skillId] = (s.skills[skillId] ?? 0) + 1;
    // Convenience: put a newly learned castable skill on the first free skill slot.
    if (wasNew && sk.kind !== 'passive' && !s.hotbar.includes(skillId)) {
      const free = s.hotbar.findIndex((e, i) => e === null && i < 10);
      if (free >= 0) s.hotbar[free] = skillId;
    }
    this.invalidate();
    return true;
  }

  allocateAp(stat: BaseStatKey): boolean {
    if (this.state.ap <= 0 || !(stat in this.state.base)) return false;
    this.state.ap -= 1;
    this.state.base[stat] += 1;
    this.invalidate();
    return true;
  }

  /** INT-heavy auto distribution: ~4 INT per 1 LUK (relative to the starting 10/6). */
  autoAllocateAp() {
    const s = this.state;
    if (s.ap <= 0) return;
    while (s.ap > 0) {
      const intGain = s.base.int - 10;
      const lukGain = s.base.luk - 6;
      if (lukGain * 4 < intGain) s.base.luk += 1; else s.base.int += 1;
      s.ap -= 1;
    }
    this.invalidate();
  }

  // ─────────────────────────── Jobs ───────────────────────────

  availableAdvancements(): JobId[] {
    const s = this.state;
    return Registry.jobs()
      .filter(j => j.parent === s.job && s.level >= j.requiredLevel)
      .filter(j => {
        const qid = JOB_ADVANCEMENT_QUESTS[j.id];
        return !qid || s.quests[qid]?.status === 'turned_in';
      })
      .map(j => j.id);
  }

  /** Validates parent + level (the tier-3/4 trial quests are gated by NPC scripts / availableAdvancements). */
  advanceJob(job: JobId): boolean {
    const def = Registry.job(job);
    const s = this.state;
    if (!def || def.parent !== s.job || s.level < def.requiredLevel) return false;
    s.job = job;
    s.sp += JOB_ADVANCE_BONUS_SP;
    this.cache = null;
    const d = this.derived();
    s.hp = d.maxHp;
    s.mp = d.maxMp;
    bus.emit('ui:log', { text: `You are now a ${def.name}! (+${JOB_ADVANCE_BONUS_SP} SP)`, color: LOG.good });
    bus.emit('player:job', { job });
    this.refreshQuests();
    this.changed();
    this.save();
    return true;
  }

  // ─────────────────────────── Inventory ───────────────────────────

  /** How many more of `itemId` would fit. */
  roomFor(itemId: string): number {
    const def = Registry.item(itemId);
    if (!def) return 0;
    const max = Math.max(1, def.maxStack);
    let room = (MAX_INVENTORY_STACKS - this.state.inventory.length) * max;
    for (const st of this.state.inventory) if (st.itemId === itemId) room += Math.max(0, max - st.qty);
    return room;
  }

  /** True if all of these could be added at once. */
  canFit(items: { itemId: string; qty: number }[]): boolean {
    let freeSlots = MAX_INVENTORY_STACKS - this.state.inventory.length;
    for (const { itemId, qty } of items) {
      const def = Registry.item(itemId);
      if (!def) continue;
      const max = Math.max(1, def.maxStack);
      let left = qty;
      for (const st of this.state.inventory) if (st.itemId === itemId) left -= Math.max(0, max - st.qty);
      if (left > 0) freeSlots -= Math.ceil(left / max);
      if (freeSlots < 0) return false;
    }
    return true;
  }

  addItem(itemId: string, qty: number): boolean {
    const def = Registry.item(itemId);
    qty = Math.floor(qty);
    if (!def || !(qty > 0)) return false;
    if (this.roomFor(itemId) < qty) {
      bus.emit('ui:log', { text: 'Your inventory is full.', color: LOG.warn });
      return false;
    }
    this.putItem(def, qty);
    bus.emit('item:gained', { itemId, qty });
    this.refreshQuests();
    this.changed();
    return true;
  }

  private putItem(def: ItemDef, qty: number) {
    const max = Math.max(1, def.maxStack);
    let left = qty;
    for (const st of this.state.inventory) {
      if (left <= 0) break;
      if (st.itemId !== def.id || st.qty >= max) continue;
      const n = Math.min(left, max - st.qty);
      st.qty += n; left -= n;
    }
    while (left > 0 && this.state.inventory.length < MAX_INVENTORY_STACKS) {
      const n = Math.min(left, max);
      this.state.inventory.push({ uid: newUid(), itemId: def.id, qty: n });
      left -= n;
    }
  }

  removeItem(itemId: string, qty: number): boolean {
    qty = Math.floor(qty);
    if (!(qty > 0)) return true;
    if (this.countItem(itemId) < qty) return false;
    let left = qty;
    const inv = this.state.inventory;
    // Drain the smallest stacks first.
    const order = inv.filter(st => st.itemId === itemId).sort((a, b) => a.qty - b.qty);
    for (const st of order) {
      if (left <= 0) break;
      const n = Math.min(left, st.qty);
      st.qty -= n; left -= n;
    }
    this.state.inventory = inv.filter(st => st.qty > 0);
    this.refreshQuests();
    this.changed();
    return true;
  }

  countItem(itemId: string): number {
    let n = 0;
    for (const st of this.state.inventory) if (st.itemId === itemId) n += st.qty;
    return n;
  }

  /** Remaining per-item cooldown in ms (for hotbar UI). */
  itemCooldownRemaining(itemId: string): number {
    return Math.max(0, (this.itemReadyAt.get(itemId) ?? 0) - this.now);
  }

  useItem(itemId: string): boolean {
    const def = Registry.item(itemId);
    if (!def || def.type !== 'consumable' || !def.consumable) return false;
    if (this.dead) return false;
    if (this.countItem(itemId) <= 0) {
      bus.emit('ui:log', { text: `You have no ${def.name}.`, color: LOG.warn });
      return false;
    }
    if (this.itemCooldownRemaining(itemId) > 0) return false;
    const c = def.consumable;

    if (c.returnToTown) {
      const game = this.services.game;
      if (!game) return false;
      if (game.currentMap()?.def.id === TOWN_MAP) {
        bus.emit('ui:log', { text: 'You are already in town.', color: LOG.info });
        return false;
      }
      this.removeItem(itemId, 1);
      this.itemReadyAt.set(itemId, this.now + (c.cooldownMs ?? DEFAULT_ITEM_COOLDOWN_MS));
      bus.emit('ui:log', { text: `You read the ${def.name}...`, color: LOG.info });
      game.changeMap(TOWN_MAP);
      return true;
    }

    const d = this.derived();
    const hp = (c.hp ?? 0) + Math.floor((c.hpPct ?? 0) * d.maxHp);
    const mp = (c.mp ?? 0) + Math.floor((c.mpPct ?? 0) * d.maxMp);
    const useful = (hp > 0 && this.state.hp < d.maxHp) || (mp > 0 && this.state.mp < d.maxMp);
    if (!useful) {
      bus.emit('ui:log', { text: hp > 0 && mp > 0 ? 'Your HP and MP are already full.' : hp > 0 ? 'Your HP is already full.' : 'Your MP is already full.', color: LOG.info });
      return false;
    }
    this.removeItem(itemId, 1);
    this.itemReadyAt.set(itemId, this.now + (c.cooldownMs ?? DEFAULT_ITEM_COOLDOWN_MS));
    this.heal(hp, mp);
    this.sfx(c.hpPct || c.mpPct ? 'heal' : 'potion');
    return true;
  }

  // ─────────────────────────── Equipment ───────────────────────────

  /** Why an item can't be equipped right now (null = ok). */
  equipBlocker(itemId: string): string | null {
    const def = Registry.item(itemId);
    if (!def?.equip) return 'That cannot be equipped.';
    if (this.state.level < def.equip.reqLevel) return `Requires level ${def.equip.reqLevel}.`;
    const br = def.equip.reqBranch;
    if (br && br !== 'none' && this.jobDef().branch !== br) {
      const name = br === 'fire' ? 'Fire' : br === 'ice' ? 'Ice' : 'Lightning';
      return `Only ${name} mages can wield this.`;
    }
    return null;
  }

  equip(uid: string): boolean {
    const inv = this.state.inventory;
    const idx = inv.findIndex(st => st.uid === uid);
    if (idx < 0) return false;
    const stack = inv[idx];
    const def = Registry.item(stack.itemId);
    const why = this.equipBlocker(stack.itemId);
    if (!def?.equip || why) {
      bus.emit('ui:log', { text: why ?? 'That cannot be equipped.', color: LOG.warn });
      this.sfx('ui_error');
      return false;
    }
    const slot = def.equip.slot;
    const old = this.state.equipment[slot];
    if (stack.qty > 1) {
      stack.qty -= 1;
      if (old) {
        if (inv.length >= MAX_INVENTORY_STACKS) { stack.qty += 1; bus.emit('ui:log', { text: 'Your inventory is full.', color: LOG.warn }); return false; }
        inv.push(old);
      }
      this.state.equipment[slot] = { uid: newUid(), itemId: stack.itemId, qty: 1 };
    } else {
      if (old) inv.splice(idx, 1, old); else inv.splice(idx, 1);
      this.state.equipment[slot] = { ...stack, qty: 1 };
    }
    this.invalidate();
    return true;
  }

  unequip(slot: EquipSlot): boolean {
    const st = this.state.equipment[slot];
    if (!st) return false;
    if (this.state.inventory.length >= MAX_INVENTORY_STACKS) {
      bus.emit('ui:log', { text: 'Your inventory is full.', color: LOG.warn });
      return false;
    }
    delete this.state.equipment[slot];
    this.state.inventory.push(st);
    this.invalidate();
    return true;
  }

  // ─────────────────────────── Shops ───────────────────────────

  buy(itemId: string, price: number, qty: number): boolean {
    const def = Registry.item(itemId);
    qty = Math.floor(qty);
    if (!def || !(qty > 0)) return false;
    const total = Math.max(0, Math.floor(price)) * qty;
    if (this.state.mesos < total) {
      bus.emit('ui:log', { text: 'You don\'t have enough mesos.', color: LOG.warn });
      return false;
    }
    if (this.roomFor(itemId) < qty) {
      bus.emit('ui:log', { text: 'Your inventory is full.', color: LOG.warn });
      return false;
    }
    this.state.mesos -= total;
    this.putItem(def, qty);
    bus.emit('ui:log', { text: `Bought ${def.name}${qty > 1 ? ` ×${qty}` : ''} for ${total.toLocaleString()} mesos.`, color: LOG.info });
    this.refreshQuests();
    this.changed();
    return true;
  }

  sell(uid: string, qty: number): boolean {
    const inv = this.state.inventory;
    const st = inv.find(s => s.uid === uid);
    if (!st) return false;
    const def = Registry.item(st.itemId);
    if (!def) return false;
    if (def.sellPrice <= 0) {
      bus.emit('ui:log', { text: `${def.name} can't be sold.`, color: LOG.warn });
      return false;
    }
    qty = Math.min(st.qty, Math.max(1, Math.floor(qty)));
    const total = def.sellPrice * qty;
    st.qty -= qty;
    if (st.qty <= 0) this.state.inventory = inv.filter(s => s !== st);
    this.state.mesos += total;
    bus.emit('ui:log', { text: `Sold ${def.name}${qty > 1 ? ` ×${qty}` : ''} for ${total.toLocaleString()} mesos.`, color: LOG.info });
    this.refreshQuests();
    this.changed();
    return true;
  }

  setHotbar(slot: number, entry: string | null) {
    slot = Math.floor(slot);
    if (slot < 0 || slot >= HOTBAR_SIZE) return;
    const hb = this.state.hotbar;
    if (entry) for (let i = 0; i < hb.length; i++) if (hb[i] === entry) hb[i] = null;
    hb[slot] = entry || null;
    this.changed();
  }

  // ─────────────────────────── Quests ───────────────────────────

  /** Can the player accept this quest right now? */
  canAcceptQuest(questId: string): boolean {
    const q = Registry.quest(questId);
    if (!q || this.state.quests[questId]) return false;
    if (this.state.level < q.minLevel) return false;
    if (q.requiredJobBranch && q.requiredJobBranch !== 'none' && this.jobDef().branch !== q.requiredJobBranch) return false;
    return true;
  }

  acceptQuest(questId: string) {
    if (!this.canAcceptQuest(questId)) return;
    const q = Registry.quest(questId)!;
    this.state.quests[questId] = { status: 'active', counts: q.objectives.map(() => 0) };
    bus.emit('ui:log', { text: `Quest accepted: ${q.name}`, color: LOG.quest });
    this.evalQuest(q, false);
    bus.emit('quest:updated', { questId });
    this.changed();
  }

  turnInQuest(questId: string): boolean {
    const q = Registry.quest(questId);
    const prog = this.state.quests[questId];
    if (!q || !prog || prog.status === 'turned_in') return false;
    this.evalQuest(q, false);
    if (prog.status !== 'complete') return false;
    const rewards = q.rewards.items ?? [];
    if (!this.canFit(rewards)) {
      bus.emit('ui:log', { text: 'Make some room in your inventory first.', color: LOG.warn });
      return false;
    }
    prog.status = 'turned_in';
    for (const o of q.objectives) if (o.kind === 'collect') this.removeItem(o.itemId, o.count);
    bus.emit('ui:log', { text: `Quest complete: ${q.name}`, color: LOG.quest });
    this.sfx('quest_complete');
    if (q.rewards.mesos) this.addMesos(q.rewards.mesos);
    for (const r of rewards) this.addItem(r.itemId, r.qty);
    if (q.rewards.exp) this.gainExp(q.rewards.exp);
    bus.emit('quest:updated', { questId });
    this.changed();
    this.save();
    return true;
  }

  /** Recompute collect/level counts and status. Returns true if anything changed. */
  private evalQuest(q: QuestDef, emit: boolean): boolean {
    const prog = this.state.quests[q.id];
    if (!prog || prog.status === 'turned_in') return false;
    let changed = false;
    q.objectives.forEach((o, i) => {
      let v = prog.counts[i] ?? 0;
      if (o.kind === 'collect') v = Math.min(o.count, this.countItem(o.itemId));
      else if (o.kind === 'level') v = Math.min(o.level, this.state.level);
      else v = Math.min(o.count, v);
      if (v !== prog.counts[i]) { prog.counts[i] = v; changed = true; }
    });
    const done = q.objectives.every((o, i) => (prog.counts[i] ?? 0) >= (o.kind === 'level' ? o.level : o.count));
    const status = done ? 'complete' : 'active';
    if (status !== prog.status) {
      prog.status = status;
      changed = true;
      if (done) {
        bus.emit('ui:log', { text: `Quest ready to turn in: ${q.name}`, color: LOG.quest });
        this.sfx('quest_complete');
      }
    }
    if (changed && emit) bus.emit('quest:updated', { questId: q.id });
    return changed;
  }

  private refreshQuests() {
    for (const qid of Object.keys(this.state.quests)) {
      const q = Registry.quest(qid);
      if (q) this.evalQuest(q, true);
    }
  }

  /** Quest progress helper for UI/NPC scripts. */
  questStatus(questId: string): 'unavailable' | 'available' | 'active' | 'complete' | 'turned_in' {
    const p = this.state.quests[questId];
    if (p) return p.status;
    return this.canAcceptQuest(questId) ? 'available' : 'unavailable';
  }

  // ─────────────────────────── Persistence / tick ───────────────────────────

  save() {
    writeSave(this.state);
  }

  update(time: number, delta: number) {
    try {
      this.now = time;
      const dt = Math.max(0, Math.min(1000, delta || 0));
      this.state.playTimeMs += dt;

      this.regenAcc += dt;
      if (this.regenAcc >= REGEN_INTERVAL_MS) {
        this.regenAcc -= REGEN_INTERVAL_MS;
        this.regenTick();
      }

      this.autosaveAcc += dt;
      if (this.autosaveAcc >= AUTOSAVE_MS) {
        this.autosaveAcc = 0;
        this.save();
      }
    } catch (e) {
      console.warn('[progression] update failed', e);
    }
  }

  private regenTick() {
    if (this.dead) return;
    const d = this.derived();
    const s = this.state;
    if (s.hp >= d.maxHp && s.mp >= d.maxMp) return;
    let safe = false;
    try { safe = !!this.services.game?.currentMap()?.def.safe; } catch { safe = false; }
    const mult = safe ? SAFE_REGEN_MULT : 1;
    s.hp = Math.min(d.maxHp, s.hp + Math.floor(d.hpRegen * mult));
    s.mp = Math.min(d.maxMp, s.mp + Math.floor(d.mpRegen * mult));
    this.changed();
  }

  private changed() {
    bus.emit('player:changed', {});
  }

  private sfx(key: SfxKey) {
    try { this.services.audio?.play(key); } catch { /* ignore */ }
  }
}

