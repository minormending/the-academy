// Derived-stat math (the one formula shared by Progression and SaveSystem).
import { describe, expect, it } from 'vitest';
import type { PlayerState, StatModifier } from '../src/core/types';
import { MAX_LEVEL } from '../src/core/constants';
import { expToNext, refMatk } from '../src/core/balance';
import { Registry } from '../src/core/registry';
import { ITEMS } from '../src/data/items';
import { newPlayerState } from '../src/systems/SaveSystem';
import { applyModifiers, baseDerived, computeDerived, deathExpLoss, DEATH_EXP_PENALTY, persistentModifiers } from '../src/systems/progression/stats';
import { problems } from './support/problems';

const at = (level: number, base?: Partial<PlayerState['base']>): PlayerState => {
  const s = newPlayerState('Test');
  s.level = level;
  s.base = { ...s.base, ...base };
  return s;
};

describe('computeDerived', () => {
  it('a fresh character is sane', () => {
    const d = computeDerived(newPlayerState('Test'));
    expect(d.maxHp).toBeGreaterThan(50);
    expect(d.maxMp).toBeGreaterThan(30);
    expect(d.matk).toBeGreaterThan(5);
    expect(d.speed).toBeGreaterThanOrEqual(200);
    expect(d.critRate).toBeGreaterThanOrEqual(0.05);
    expect(d.critRate).toBeLessThanOrEqual(1);
    expect(d.mastery).toBeGreaterThan(0);
    expect(d.mastery).toBeLessThanOrEqual(0.95);
    for (const [k, v] of Object.entries(d)) expect(Number.isFinite(v), k).toBe(true);
  });

  it('HP, MP and matk grow with level, for a stat-neutral character', () => {
    const p = problems();
    for (let lv = 1; lv < MAX_LEVEL; lv++) {
      const a = baseDerived(at(lv)), b = baseDerived(at(lv + 1));
      for (const k of ['maxHp', 'maxMp', 'matk', 'def', 'hpRegen', 'mpRegen'] as const) p.check(b[k] > a[k], `${k} did not rise from Lv ${lv} to ${lv + 1}`);
    }
    p.done();
  });

  it('INT feeds matk and MP, STR feeds HP, LUK feeds crit, DEX feeds mastery', () => {
    const base = computeDerived(at(20));
    expect(computeDerived(at(20, { int: 60 })).matk).toBeGreaterThan(base.matk);
    expect(computeDerived(at(20, { int: 60 })).maxMp).toBeGreaterThan(base.maxMp);
    expect(computeDerived(at(20, { str: 60 })).maxHp).toBeGreaterThan(base.maxHp);
    expect(computeDerived(at(20, { luk: 60 })).critRate).toBeGreaterThan(base.critRate);
    expect(computeDerived(at(20, { dex: 60 })).mastery).toBeGreaterThan(base.mastery);
  });

  it('an INT-focused build lands near the reference matk curve (within 40%)', () => {
    // ~4 INT + 1 LUK per level after the starting 10/6, as the file comment describes.
    const p = problems();
    for (const lv of [5, 10, 20, 30, 40, 50]) {
      const s = at(lv, { int: 10 + 4 * (lv - 1), luk: 6 + (lv - 1) });
      const d = baseDerived(s);
      // Gear supplies the rest (~5 + 0.6L); compare base matk plus that to the reference.
      const withGear = d.matk + 5 + 0.6 * lv;
      p.check(Math.abs(withGear - refMatk(lv)) / refMatk(lv) < 0.4, `Lv ${lv}: matk ${withGear.toFixed(1)} vs reference ${refMatk(lv)}`);
    }
    p.done();
  });

  it('never returns NaN for junk base stats', () => {
    const s = at(10);
    s.base = { str: 1, dex: 1, int: 1, luk: 1 };
    for (const v of Object.values(computeDerived(s))) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('modifiers', () => {
  const base = baseDerived(at(10));

  it('final = (base + sum add) * (1 + sum mul), floored for whole-number stats', () => {
    const mods: StatModifier[] = [{ stat: 'matk', add: 10 }, { stat: 'matk', add: 5 }, { stat: 'matk', mul: 0.1 }, { stat: 'matk', mul: 0.1 }];
    expect(applyModifiers(base, mods).matk).toBe(Math.floor((base.matk + 15) * 1.2));
  });

  it('applies to fractional stats without flooring', () => {
    expect(applyModifiers(base, [{ stat: 'critRate', add: 0.1 }]).critRate).toBeCloseTo(base.critRate + 0.1, 6);
  });

  it('clamps rates and floors speed/jump', () => {
    const out = applyModifiers(base, [
      { stat: 'critRate', add: 5 }, { stat: 'mpShield', add: 5 }, { stat: 'cdr', add: 5 }, { stat: 'castSpeed', add: 5 },
      { stat: 'mastery', add: 5 }, { stat: 'speed', add: -1000 }, { stat: 'jump', add: -1000 }, { stat: 'maxHp', add: -1e6 },
    ]);
    expect(out.critRate).toBe(1);
    expect(out.mpShield).toBeLessThanOrEqual(0.9);
    expect(out.cdr).toBeLessThanOrEqual(0.6);
    expect(out.castSpeed).toBeLessThanOrEqual(0.75);
    expect(out.mastery).toBeLessThanOrEqual(0.95);
    expect(out.speed).toBeGreaterThanOrEqual(60);
    expect(out.jump).toBeGreaterThanOrEqual(200);
    expect(out.maxHp).toBeGreaterThanOrEqual(1);
  });

  it('ignores garbage modifiers instead of poisoning the stats', () => {
    const out = applyModifiers(base, [
      { stat: 'nope' as never, add: 5 }, { stat: 'matk', add: NaN }, { stat: 'matk', mul: Infinity }, null as never,
    ]);
    expect(out.matk).toBe(Math.max(1, Math.floor(base.matk)));
  });

  it('does not mutate its input', () => {
    const copy = { ...base };
    applyModifiers(base, [{ stat: 'matk', add: 100 }]);
    expect(base).toEqual(copy);
  });

  it('equipment and learned passives both count', () => {
    const s = at(30);
    s.equipment = {}; // a new character already wields an oak wand
    const wand = ITEMS.find(i => i.equip?.slot === 'weapon' && i.equip.modifiers.some(m => m.stat === 'matk' && m.add));
    expect(wand, 'a wand that adds matk').toBeDefined();
    const plain = computeDerived(s).matk;
    s.equipment = { weapon: { uid: 'w1', itemId: wand!.id, qty: 1 } };
    expect(computeDerived(s).matk).toBeGreaterThan(plain);
    expect(persistentModifiers(s).length).toBeGreaterThan(0);

    const passive = Registry.skills().find(k => k.kind === 'passive' && k.passive!(1).some(m => m.stat === 'maxMp' && (m.add || m.mul)));
    if (passive) {
      const before = computeDerived(s).maxMp;
      s.skills = { [passive.id]: passive.maxLevel };
      expect(computeDerived(s).maxMp).toBeGreaterThan(before);
    }
  });

  it('extra (buff) modifiers stack on top', () => {
    const s = at(15);
    expect(computeDerived(s, [{ stat: 'dmgAll', add: 0.25 }]).dmgAll).toBeCloseTo(0.25, 6);
  });
});

describe('death penalty', () => {
  it('is 5% of the level, never more than the EXP held, and nothing at max level', () => {
    expect(deathExpLoss(10, 0)).toBe(0);
    expect(deathExpLoss(10, 1)).toBe(1);
    expect(deathExpLoss(10, 1e9)).toBe(Math.floor(expToNext(10) * DEATH_EXP_PENALTY));
    expect(deathExpLoss(MAX_LEVEL, 1e9)).toBe(0);
  });
});
