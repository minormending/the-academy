// OWNER: A9 (progression). Pure derived-stat math (no services) — shared by Progression and SaveSystem.
import type { DerivedStatKey, DerivedStats, PlayerState, StatModifier } from '../../core/types';
import { Registry } from '../../core/registry';
import { expToNext } from '../../core/balance';
import { MAX_LEVEL } from '../../core/constants';

/** Fraction of the current level's EXP requirement lost on death. */
export const DEATH_EXP_PENALTY = 0.05;

/** EXP lost when dying at this level/exp (never drops below 0 EXP, no penalty at max level). */
export function deathExpLoss(level: number, exp: number): number {
  if (level >= MAX_LEVEL) return 0;
  return Math.max(0, Math.min(exp, Math.floor(expToNext(level) * DEATH_EXP_PENALTY)));
}

/**
 * Base formula (before equipment / passives / buffs).
 * Calibrated so INT-focused AP (≈4 INT + 1 LUK per level) + on-level gear gives
 * matk ≈ refMatk(level) = 12 + 5L (base ≈ 6.9 + 4.4L; gear supplies ≈ 5 + 0.6L).
 */
export function baseDerived(state: PlayerState): DerivedStats {
  const L = Math.max(1, state.level | 0);
  const { str, dex, int, luk } = state.base;
  return {
    maxHp: 55 + 19 * L + str,
    maxMp: 36 + 20 * L + int * 0.4,
    matk: int * 0.9 + luk * 0.3 + L * 0.5,
    def: L * 0.3 + str * 0.2,
    critRate: 0.05 + Math.max(0, luk - 6) * 0.001,
    critDmg: 0.5,
    mastery: 0.45 + Math.max(0, dex - 4) * 0.002,
    speed: 200,
    jump: 560,
    hpRegen: 5 + L * 0.6 + str * 0.2,
    mpRegen: 4 + L * 0.5 + int * 0.08,
    mpShield: 0,
    dmgAll: 0,
    dmgFire: 0,
    dmgIce: 0,
    dmgLightning: 0,
    castSpeed: 0,
    cdr: 0,
  };
}

/** Equipment modifiers + learned passive modifiers. */
export function persistentModifiers(state: PlayerState): StatModifier[] {
  const mods: StatModifier[] = [];
  for (const stack of Object.values(state.equipment)) {
    if (!stack) continue;
    const def = Registry.item(stack.itemId);
    if (def?.equip) mods.push(...def.equip.modifiers);
  }
  for (const [id, lv] of Object.entries(state.skills)) {
    if (!lv) continue;
    const sk = Registry.skill(id);
    if (!sk?.passive) continue;
    try { mods.push(...sk.passive(lv)); } catch (e) { console.warn(`[progression] passive ${id} threw`, e); }
  }
  return mods;
}

const INT_STATS: DerivedStatKey[] = ['maxHp', 'maxMp', 'matk', 'def', 'speed', 'jump', 'hpRegen', 'mpRegen'];

/** final = (base + Σadd) × (1 + Σmul), then rounded/clamped. */
export function applyModifiers(base: DerivedStats, mods: StatModifier[]): DerivedStats {
  const addSum: Partial<Record<DerivedStatKey, number>> = {};
  const mulSum: Partial<Record<DerivedStatKey, number>> = {};
  for (const m of mods) {
    if (!m || !(m.stat in base)) continue;
    if (typeof m.add === 'number' && isFinite(m.add)) addSum[m.stat] = (addSum[m.stat] ?? 0) + m.add;
    if (typeof m.mul === 'number' && isFinite(m.mul)) mulSum[m.stat] = (mulSum[m.stat] ?? 0) + m.mul;
  }
  const out = { ...base };
  for (const k of Object.keys(base) as DerivedStatKey[]) {
    out[k] = (base[k] + (addSum[k] ?? 0)) * (1 + (mulSum[k] ?? 0));
  }
  for (const k of INT_STATS) out[k] = Math.max(0, Math.floor(out[k]));
  out.maxHp = Math.max(1, out.maxHp);
  out.maxMp = Math.max(1, out.maxMp);
  out.matk = Math.max(1, out.matk);
  out.speed = Math.max(60, out.speed);
  out.jump = Math.max(200, out.jump);
  out.critRate = clamp(out.critRate, 0, 1);
  out.critDmg = Math.max(0, out.critDmg);
  out.mastery = clamp(out.mastery, 0, 0.95);
  out.mpShield = clamp(out.mpShield, 0, 0.9);
  out.castSpeed = clamp(out.castSpeed, 0, 0.75);
  out.cdr = clamp(out.cdr, 0, 0.6);
  return out;
}

export function computeDerived(state: PlayerState, extra: StatModifier[] = []): DerivedStats {
  return applyModifiers(baseDerived(state), [...persistentModifiers(state), ...extra]);
}

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
