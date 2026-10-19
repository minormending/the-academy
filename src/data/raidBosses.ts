// OWNER: raid boss agent. The Unwritten (archon_spire): the final raid boss, the living blank page at the top of
// the Archon Spire. AI lives in src/entities/monsters/Unwritten.ts; art spec in src/art/monsterArt.ts.
import type { MonsterDef } from '../core/types';
import { refMonsterExp, refMonsterHp, refMonsterTouch } from '../core/balance';

const LV = 70;

/**
 * The Unwritten — lv 70, HP ≈ refMonsterHp(70) × 70, EXP × 25. Weak to nothing, resists nothing: every School is
 * a valid answer. Freeze / stun are not immune but capped by FieldBoss (1.5 s, then 4 s of CC immunity).
 */
const theUnwritten: MonsterDef = {
  id: 'the_unwritten',
  name: 'The Unwritten',
  level: LV,
  hp: Math.round(refMonsterHp(LV) * 70),
  exp: Math.round(refMonsterExp(LV) * 25),
  mesos: [9000, 14000],
  touchDamage: Math.round(refMonsterTouch(LV) * 1.2),
  def: 42,
  speed: 60,
  size: { w: 96, h: 176 },
  behavior: 'boss',
  aggressive: true,
  boss: true,
  weak: [],
  resist: [],
  drops: [
    { itemId: 'archon_seal', chance: 1, min: 5, max: 5 },
    { itemId: 'unwritten_tome', chance: 0.6 },
    { itemId: 'white_potion', chance: 1, min: 6, max: 10 },
    { itemId: 'mana_elixir', chance: 1, min: 4, max: 8 },
    { itemId: 'elixir', chance: 0.8, min: 2, max: 4 },
    { itemId: 'tome_page', chance: 1, min: 4, max: 8 },
    { itemId: 'ink_vial', chance: 1, min: 3, max: 6 },
    { itemId: 'void_crystal', chance: 0.8, min: 2, max: 5 },
  ],
};

/** Torn page add summoned in phase 2: a fast, fragile flyer. */
const PAGE_LV = 66;
const unwrittenPage: MonsterDef = {
  id: 'unwritten_page',
  name: 'Unwritten Page',
  level: PAGE_LV,
  hp: Math.round(refMonsterHp(PAGE_LV) * 0.7),
  exp: Math.round(refMonsterExp(PAGE_LV) * 0.5),
  mesos: [80, 160],
  touchDamage: Math.round(refMonsterTouch(PAGE_LV) * 0.8),
  def: 20,
  speed: 110,
  size: { w: 40, h: 36 },
  behavior: 'flyer',
  aggressive: true,
  immune: ['poison'],
  drops: [
    { itemId: 'tome_page', chance: 0.4 },
    { itemId: 'white_potion', chance: 0.08 },
  ],
};

// unwritten_page is defined with the other endgame monsters in src/data/monsters.ts.
export const RAID_BOSSES: MonsterDef[] = [theUnwritten];
void unwrittenPage;
