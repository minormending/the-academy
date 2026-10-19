/**
 * Reference balance curves. Owned by the lead — do not edit.
 * Everyone tunes their content against these so systems built in parallel agree.
 */

/** EXP needed to go from `level` to level+1. */
export function expToNext(level: number): number {
  return Math.floor(15 * Math.pow(level, 1.85) + 10);
}

/** Intended number of same-level normal kills per level. */
export function killsPerLevel(level: number): number {
  return 8 + Math.floor(level * 1.6);
}

/** Reference EXP for a normal monster of `level`. Bosses ~ 40x. */
export function refMonsterExp(level: number): number {
  return Math.max(3, Math.round(expToNext(level) / killsPerLevel(level)));
}

/** Expected player magic attack at `level` with on-level gear and INT-focused AP. */
export function refMatk(level: number): number {
  return 12 + 5 * level;
}

/** Reference single-target damage % of the level-appropriate primary skill (per hit line). */
export function refSkillPct(level: number): number {
  return level < 10 ? 140 : level < 25 ? 220 : level < 40 ? 300 : level < 55 ? 450 : 650;
}

/** Expected damage of one hit line of the primary skill. */
export function refHit(level: number): number {
  return (refMatk(level) * refSkillPct(level)) / 100;
}

/** Normal monster HP: ~3-4 primary-skill casts. Bosses: the Lich Archon is ×200; field bosses use ×28–65 (hpMul in FIELD_BOSSES). */
export function refMonsterHp(level: number): number {
  return Math.round(refHit(level) * 3.5);
}

/** Monster touch damage at `level`. */
export function refMonsterTouch(level: number): number {
  return Math.round(8 + level * 4.5);
}

/** Expected player max HP / MP at level (before passives). */
export function refPlayerHp(level: number): number { return 60 + level * 20; }
export function refPlayerMp(level: number): number { return 40 + level * 24; }

/**
 * Guidance for skill authors (per hit line, % of matk):
 *  tier1 primary 120-170, tier1 aoe 70-100
 *  tier2 primary 170-260, aoe 100-150
 *  tier3 primary 240-340, aoe 150-220
 *  tier4 primary 350-600, aoe 220-350, ultimate (long cd) 800-1500
 * Multi-hit skills split this total across lines (e.g. 3 lines x 90% ~= 270% total).
 * MP cost guidance: tier1 8-14, tier2 14-28, tier3 26-45, tier4 45-90 (at max level).
 * Skill points: 3 SP per level-up; max skill levels 10 (t1), 15-20 (t2-t4); ultimates 10.
 */
export const SP_PER_LEVEL = 3;
export const AP_PER_LEVEL = 5;
