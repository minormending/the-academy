// The reference curves every piece of content is tuned against must be well-behaved.
import { describe, expect, it } from 'vitest';
import {
  expToNext, killsPerLevel, refHit, refMatk, refMonsterExp, refMonsterHp, refMonsterTouch, refPlayerHp, refPlayerMp, refSkillPct,
} from '../src/core/balance';
import { MAX_LEVEL } from '../src/core/constants';
import { MONSTERS } from '../src/data/monsters';
import { problems } from './support/problems';

const LEVELS = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);

function monotonic(name: string, fn: (lv: number) => number, strict = true) {
  it(`${name} ${strict ? 'strictly ' : ''}increases with level`, () => {
    const p = problems();
    for (let lv = 1; lv < MAX_LEVEL; lv++) {
      const a = fn(lv), b = fn(lv + 1);
      p.check(Number.isFinite(a) && Number.isFinite(b), `${name}(${lv}) is not finite`);
      p.check(strict ? b > a : b >= a, `${name}(${lv + 1}) = ${b} is not above ${name}(${lv}) = ${a}`);
    }
    p.done();
  });
}

describe('balance curves', () => {
  monotonic('expToNext', expToNext);
  monotonic('killsPerLevel', killsPerLevel, false);
  monotonic('refMatk', refMatk);
  monotonic('refSkillPct', refSkillPct, false);
  monotonic('refHit', refHit);
  monotonic('refMonsterHp', refMonsterHp);
  monotonic('refMonsterTouch', refMonsterTouch);
  monotonic('refPlayerHp', refPlayerHp);
  monotonic('refPlayerMp', refPlayerMp);
  monotonic('refMonsterExp', refMonsterExp, false);

  it('are positive integers where the game stores whole numbers', () => {
    for (const lv of LEVELS) {
      for (const fn of [expToNext, killsPerLevel, refMonsterExp, refMonsterHp, refMonsterTouch]) {
        const v = fn(lv);
        expect(Number.isInteger(v) && v > 0, `${fn.name}(${lv}) = ${v}`).toBe(true);
      }
    }
  });

  it('level 1 needs a small first level-up and the whole climb is finite', () => {
    expect(expToNext(1)).toBeLessThan(50);
    let total = 0;
    for (let lv = 1; lv < MAX_LEVEL; lv++) total += expToNext(lv);
    expect(Number.isFinite(total) && total > 0).toBe(true);
  });

  it('a level takes roughly as many kills as promised (reference EXP x kills ~ EXP to next)', () => {
    for (const lv of LEVELS) {
      const ratio = (refMonsterExp(lv) * killsPerLevel(lv)) / expToNext(lv);
      expect(ratio, `level ${lv}`).toBeGreaterThan(0.8);
      expect(ratio, `level ${lv}`).toBeLessThan(1.25);
    }
  });

  it('a monster takes about 3-4 reference hits to kill', () => {
    for (const lv of LEVELS) expect(refMonsterHp(lv) / refHit(lv), `level ${lv}`).toBeCloseTo(3.5, 0);
  });

  it('the player outlasts a monster touch at every level', () => {
    for (const lv of LEVELS) expect(refPlayerHp(lv) / refMonsterTouch(lv), `level ${lv}`).toBeGreaterThan(4);
  });
});

describe('monster tuning stays near the reference curves', () => {
  it('normal monsters: HP, EXP and touch damage within the variety band of their level', () => {
    const p = problems();
    for (const m of MONSTERS.filter(x => !x.boss)) {
      const lv = m.level;
      p.check(m.hp >= refMonsterHp(lv) * 0.5 && m.hp <= refMonsterHp(lv) * 1.6, `${m.id} hp ${m.hp} vs ref ${refMonsterHp(lv)}`);
      p.check(m.exp >= refMonsterExp(lv) * 0.5 && m.exp <= refMonsterExp(lv) * 1.6, `${m.id} exp ${m.exp} vs ref ${refMonsterExp(lv)}`);
      p.check(m.touchDamage >= refMonsterTouch(lv) * 0.5 && m.touchDamage <= refMonsterTouch(lv) * 1.6, `${m.id} touch ${m.touchDamage} vs ref ${refMonsterTouch(lv)}`);
    }
    p.done();
  });

  it('bosses are much tougher than a normal monster of their level', () => {
    const p = problems();
    for (const m of MONSTERS.filter(x => x.boss)) p.check(m.hp >= refMonsterHp(m.level) * 10, `${m.id} hp ${m.hp} is under 10x the reference ${refMonsterHp(m.level)}`);
    p.done();
  });
});
