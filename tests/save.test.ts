// SaveSystem: repairState must turn anything into a valid character, and the slot store must round-trip.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerState } from '../src/core/types';
import { HOTBAR_SIZE } from '../src/core/types';
import { MAX_LEVEL, SAVE_KEY, START_MAP, TOWN_MAP } from '../src/core/constants';
import { Registry } from '../src/core/registry';
import { ITEMS } from '../src/data/items';
import { newPlayerState, repairState, SAVE_SLOTS } from '../src/systems/SaveSystem';
import { computeDerived } from '../src/systems/progression/stats';
import { problems } from './support/problems';
import { stubStorage } from './support/storage';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** A mid-game character with a bit of everything. */
function midGame(): PlayerState {
  const s = newPlayerState('Midgame');
  s.level = 30; s.exp = 1234; s.job = 'flamebinder'; s.sp = 4; s.ap = 2; s.mesos = 99999;
  s.base = { str: 8, dex: 6, int: 90, luk: 30 };
  const learn = Registry.skillsForJob('pyromancer').slice(0, 3);
  s.skills = { app_arcane_bolt: 5, ...Object.fromEntries(learn.map(k => [k.id, 2])) };
  s.hotbar[1] = learn[0].id; s.hotbar[13] = learn[1].id;
  s.inventory.push({ uid: 'u-extra', itemId: 'snail_shell', qty: 7 });
  s.mapId = 'whisperwood';
  s.quests = { story_orientation: { status: 'turned_in', counts: [] }, story_first_practicum: { status: 'active', counts: [2, 1] } };
  s.merits = 55; s.arenaBest = 7; s.playTimeMs = 123456;
  const d = computeDerived(s);
  s.hp = d.maxHp - 10; s.mp = d.maxMp - 5;
  return s;
}

describe('newPlayerState', () => {
  it('is a valid level-1 apprentice with a 24-slot hotbar and potions on every page', () => {
    const s = newPlayerState('Hero');
    expect(s.level).toBe(1);
    expect(s.job).toBe('apprentice');
    expect(s.hotbar).toHaveLength(HOTBAR_SIZE);
    expect(s.hotbar[0]).toBe('app_arcane_bolt');
    expect([s.hotbar[10], s.hotbar[11], s.hotbar[22], s.hotbar[23]]).toEqual(['item:red_potion', 'item:blue_potion', 'item:red_potion', 'item:blue_potion']);
    expect(Registry.skill('app_arcane_bolt')).toBeDefined();
    expect(s.hp).toBe(computeDerived(s).maxHp);
    expect(Registry.map(s.mapId)).toBeDefined();
    for (const st of [...s.inventory, ...Object.values(s.equipment)]) expect(Registry.item(st!.itemId), st!.itemId).toBeDefined();
  });

  it('trims long names and defaults an empty one', () => {
    expect(newPlayerState('x'.repeat(40)).name).toHaveLength(16);
    expect(newPlayerState('').name).toBe('Apprentice');
  });
});

describe('repairState', () => {
  it('turns non-objects into a fresh character', () => {
    for (const junk of [null, undefined, 42, 'save', true, [], () => 1]) {
      const s = repairState(junk);
      expect(s.level, String(junk)).toBe(1);
      expect(s.job).toBe('apprentice');
      expect(s.hotbar).toHaveLength(HOTBAR_SIZE);
    }
  });

  it('turns an empty object into a valid character', () => {
    const s = repairState({});
    expect(s.version).toBe(1);
    expect(s.name).toBe('Apprentice');
    expect(s.skills).toEqual({});
    expect(s.hotbar).toEqual(new Array(HOTBAR_SIZE).fill(null));
    expect(s.hp).toBeGreaterThan(0);
    expect(s.mapId).toBe(START_MAP);
  });

  it('never throws, even on hostile input', () => {
    const hostile = [
      { level: 'ten', exp: {}, base: 7, skills: [1, 2], hotbar: 'abc', inventory: 5, equipment: [], quests: 'x', mapId: 9, job: {} },
      { get level(): number { throw new Error('boom'); } },
      { hotbar: [{}, [], 3, null, undefined, '', 'item:'], inventory: [null, 1, 'x', { itemId: 5 }], skills: { a: 'x', b: -5, c: NaN, d: Infinity } },
      { quests: { story_orientation: null, story_supplies: 'x', q_none: { status: 'active', counts: [] } } },
    ];
    for (const h of hostile) expect(() => repairState(h)).not.toThrow();
    for (const h of hostile) expect(repairState(h).hotbar).toHaveLength(HOTBAR_SIZE);
  });

  it('round-trips a new and a mid-game character unchanged through JSON', () => {
    for (const s of [newPlayerState('Fresh'), midGame()]) {
      // merits / arenaBest are optional on a brand-new character; repair always fills them in.
      expect(repairState(clone(s))).toEqual({ ...s, merits: s.merits ?? 0, arenaBest: s.arenaBest ?? 0 });
    }
  });

  it('is idempotent', () => {
    const once = repairState({ level: 999, exp: -5, skills: { nope: 3 }, hotbar: ['x'], job: 'wizard' });
    expect(repairState(clone(once))).toEqual(once);
  });

  describe('hotbar', () => {
    it('grows an old 12-slot hotbar to 24, keeping its entries in place', () => {
      const old = clone(midGame());
      old.hotbar = old.hotbar.slice(0, 12);
      expect(old.hotbar).toHaveLength(12);
      const s = repairState(old);
      expect(s.hotbar).toHaveLength(24);
      expect(s.hotbar.slice(0, 12)).toEqual(old.hotbar);
      expect(s.hotbar.slice(12)).toEqual(new Array(12).fill(null));
    });

    it('trims an over-long hotbar and drops entries for skills the character does not know or items that do not exist', () => {
      const raw = clone(midGame());
      raw.hotbar = new Array(40).fill('app_arcane_bolt');
      raw.hotbar[2] = 'fire_not_a_skill';
      raw.hotbar[3] = 'item:not_an_item';
      raw.hotbar[4] = 'item:red_potion';
      raw.hotbar[5] = Registry.skillsForJob('inferno_sage')[0].id; // real skill, never learned
      const s = repairState(raw);
      expect(s.hotbar).toHaveLength(24);
      expect([s.hotbar[2], s.hotbar[3], s.hotbar[5]]).toEqual([null, null, null]);
      expect(s.hotbar[4]).toBe('item:red_potion');
      expect(s.hotbar[0]).toBe('app_arcane_bolt');
    });
  });

  describe('numbers', () => {
    it('clamps level and EXP, floors fractions, and defaults the rest', () => {
      expect(repairState({ level: 999 }).level).toBe(MAX_LEVEL);
      expect(repairState({ level: 0 }).level).toBe(1);
      expect(repairState({ level: -4 }).level).toBe(1);
      expect(repairState({ level: NaN }).level).toBe(1);
      expect(repairState({ level: 12.9 }).level).toBe(12);
      expect(repairState({ exp: -100 }).exp).toBe(0);
      expect(repairState({ mesos: -1 }).mesos).toBe(0);
      expect(repairState({ ap: 3.7, sp: 2.2 })).toMatchObject({ ap: 3, sp: 2 });
    });

    it('missing merits and arenaBest (old saves) become 0', () => {
      const old = clone(midGame()) as unknown as Record<string, unknown>;
      delete old.merits; delete old.arenaBest;
      expect(repairState(old)).toMatchObject({ merits: 0, arenaBest: 0 });
      expect(repairState({ merits: -3, arenaBest: 'x' })).toMatchObject({ merits: 0, arenaBest: 0 });
      expect(repairState({ merits: 42.8 }).merits).toBe(42);
    });

    it('keeps base stats >= 1 and falls back for junk', () => {
      expect(repairState({ base: { str: 0, dex: -9, int: 'x', luk: null } }).base).toEqual({ str: 1, dex: 1, int: 10, luk: 6 });
    });

    it('clamps HP and MP to the derived maximum', () => {
      const s = repairState({ level: 1, hp: 1e9, mp: 1e9 });
      const d = computeDerived(s);
      expect(s.hp).toBe(d.maxHp);
      expect(s.mp).toBe(d.maxMp);
    });

    it('a character saved dead respawns in town with the EXP penalty and at least half HP', () => {
      const raw = { ...clone(midGame()), hp: 0, mapId: 'whisperwood', exp: 5000 };
      const s = repairState(raw);
      expect(s.hp).toBeGreaterThanOrEqual(Math.ceil(computeDerived(s).maxHp * 0.5));
      expect(s.mapId).toBe(TOWN_MAP);
      expect(s.exp).toBeLessThan(5000);
      expect(s.exp).toBeGreaterThanOrEqual(0);
    });
  });

  describe('identity fields', () => {
    it('falls back for an unknown job or map, and trims the name', () => {
      expect(repairState({ job: 'archwizard' }).job).toBe('apprentice');
      expect(repairState({ job: 'priest' }).job).toBe('priest');
      expect(repairState({ mapId: 'atlantis' }).mapId).toBe(START_MAP);
      expect(repairState({ mapId: 'whisperwood' }).mapId).toBe('whisperwood');
      expect(repairState({ name: 'n'.repeat(99) }).name).toHaveLength(16);
      expect(repairState({ name: '   ' }).name).toBe('Apprentice');
    });
  });

  describe('skills', () => {
    it('refunds SP for unknown skills and for levels above the maximum', () => {
      const real = Registry.skillsForJob('apprentice')[0];
      const s = repairState({ sp: 1, skills: { gone_skill: 4, [real.id]: real.maxLevel + 3, zero: 0, neg: -2 } });
      expect(s.skills).toEqual({ [real.id]: real.maxLevel });
      expect(s.sp).toBe(1 + 4 + 3);
    });
  });

  describe('inventory and equipment', () => {
    it('drops unknown items, clamps stack sizes, repairs duplicate uids and caps the bag at 48 stacks', () => {
      const potion = Registry.item('red_potion')!;
      const raw = {
        inventory: [
          { uid: 'a', itemId: 'red_potion', qty: potion.maxStack + 500 },
          { uid: 'a', itemId: 'blue_potion', qty: 2 },
          { uid: 'b', itemId: 'not_an_item', qty: 1 },
          { uid: 'c', itemId: 'red_potion', qty: -4 },
          { itemId: 'return_scroll', qty: 1.5 },
          ...Array.from({ length: 80 }, (_, i) => ({ uid: `z${i}`, itemId: 'snail_shell', qty: 1 })),
        ],
      };
      const s = repairState(raw);
      expect(s.inventory.length).toBe(48);
      expect(s.inventory.every(x => Registry.item(x.itemId))).toBe(true);
      expect(s.inventory[0].qty).toBe(potion.maxStack);
      expect(new Set(s.inventory.map(x => x.uid)).size).toBe(s.inventory.length);
      expect(s.inventory.find(x => x.uid === 'c')?.qty).toBe(1);
    });

    it('only keeps equipment in its own slot, one of each', () => {
      const hat = ITEMS.find(i => i.equip?.slot === 'hat')!;
      const wand = ITEMS.find(i => i.equip?.slot === 'weapon')!;
      const s = repairState({
        equipment: {
          weapon: { uid: 'e1', itemId: hat.id, qty: 1 },       // wrong slot
          hat: { uid: 'e2', itemId: hat.id, qty: 5 },           // qty forced to 1
          robe: { uid: 'e3', itemId: 'red_potion', qty: 1 },    // not equipment
          ring: { uid: 'e4', itemId: 'not_an_item', qty: 1 },
          mystery: { uid: 'e5', itemId: wand.id, qty: 1 },      // not a slot
        },
      });
      expect(Object.keys(s.equipment)).toEqual(['hat']);
      expect(s.equipment.hat!.qty).toBe(1);
    });
  });

  describe('quests', () => {
    it('drops unknown quests, fixes status and sizes counts to the objectives', () => {
      const q = Registry.quest('story_first_practicum')!;
      const s = repairState({
        quests: {
          story_first_practicum: { status: 'wibble', counts: [3, -1, 9, 9, 9] },
          nonexistent_quest: { status: 'active', counts: [1] },
          story_orientation: 'done',
          story_supplies: { status: 'turned_in' },
        },
      });
      expect(Object.keys(s.quests).sort()).toEqual(['story_first_practicum', 'story_supplies']);
      expect(s.quests.story_first_practicum.status).toBe('active');
      expect(s.quests.story_first_practicum.counts).toEqual([3, 0]);
      expect(s.quests.story_first_practicum.counts).toHaveLength(q.objectives.length);
      expect(s.quests.story_supplies.status).toBe('turned_in');
      expect(s.quests.story_supplies.counts).toHaveLength(Registry.quest('story_supplies')!.objectives.length);
    });
  });

  describe('honors', () => {
    it('a save from before honors existed stays without them (HonorsSystem backfills)', () => {
      const old = clone(midGame()) as unknown as Record<string, unknown>;
      delete old.honors;
      expect(repairState(old).honors).toBeUndefined();
    });

    it('keeps well-formed entries and drops junk', () => {
      const s = repairState({
        honors: {
          done: { first_blood: 1700000000000, bad: 'x', neg: -5, zero: 0, '': 3 },
          counters: { kills: 12, junk: 'many', neg: -1, nan: NaN, huge: 1e30 },
          title: 'Scholar',
        },
      });
      expect(s.honors!.done).toEqual({ first_blood: 1700000000000 });
      expect(s.honors!.counters.kills).toBe(12);
      expect(Object.keys(s.honors!.counters).sort()).toEqual(['huge', 'kills']);
      expect(s.honors!.counters.huge).toBeLessThanOrEqual(1e12);
      expect(s.honors!.title).toBe('Scholar');
    });

    it('turns a non-object into "no honors" and never throws', () => {
      for (const junk of [5, 'x', [], null]) expect(() => repairState({ honors: junk })).not.toThrow();
      expect(repairState({ honors: 'x' }).honors).toBeUndefined();
      expect(repairState({ honors: {} }).honors).toEqual({ done: {}, counters: {} });
    });
  });

  it('does not alias the caller\'s objects', () => {
    const raw = clone(midGame());
    const s = repairState(raw);
    s.skills.app_arcane_bolt = 99;
    s.inventory[0].qty = 99;
    expect(raw.skills.app_arcane_bolt).toBe(5);
    expect(raw.inventory[0].qty).not.toBe(99);
  });
});

describe('save slots', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });
  const load = () => import('../src/systems/SaveSystem');

  it('writeSave then loadSave returns the same character, and listSlots describes it', async () => {
    stubStorage();
    const S = await load();
    const me = midGame();
    expect(S.hasSave()).toBe(false);
    expect(S.writeSave(me)).toBe(true);
    expect(S.hasSave()).toBe(true);
    expect(S.loadSave()).toEqual(me);
    const slots = S.listSlots();
    expect(slots).toHaveLength(SAVE_SLOTS);
    expect(slots[0]).toMatchObject({ status: 'ok', name: 'Midgame', level: 30, job: 'flamebinder', school: 'fire', year: 3, last: true });
    expect(slots.slice(1).every(x => x.status === 'empty')).toBe(true);
  });

  it('keeps slots independent, finds the first empty slot and deletes one', async () => {
    stubStorage();
    const S = await load();
    S.setActiveSlot(2); S.writeSave(newPlayerState('Two'));
    S.setActiveSlot(0); S.writeSave(newPlayerState('Zero'));
    expect(S.loadSlot(2)!.name).toBe('Two');
    expect(S.loadSlot(0)!.name).toBe('Zero');
    expect(S.firstEmptySlot()).toBe(1);
    expect(S.lastPlayedSlot()).toBe(0);
    S.deleteSlot(0);
    expect(S.loadSlot(0)).toBeNull();
    expect(S.firstEmptySlot()).toBe(0);
    expect(S.loadSlot(2)!.name).toBe('Two');
  });

  it('flags a corrupt slot as damaged without throwing, and leaves the others alone', async () => {
    const st = stubStorage();
    const S = await load();
    S.setActiveSlot(1); S.writeSave(newPlayerState('Keeper'));
    st.setItem(`${SAVE_KEY}:slot3`, '{not json');
    st.setItem(`${SAVE_KEY}:slot4`, JSON.stringify({ state: { name: 5 } }));
    const slots = S.listSlots();
    expect(slots[1].status).toBe('ok');
    expect(slots[3].status).toBe('damaged');
    expect(slots[4].status).toBe('damaged');
    expect(S.loadSlot(3)).toBeNull();
    expect(S.firstEmptySlot()).toBe(0);
  });

  it('migrates a legacy single save into slot 1', async () => {
    const legacy = newPlayerState('Legacy');
    stubStorage({ [SAVE_KEY]: JSON.stringify(legacy) });
    const S = await load();
    expect(S.getActiveSlot()).toBe(0);
    expect(S.loadSlot(0)!.name).toBe('Legacy');
    expect(S.listSlots()[0].status).toBe('ok');
  });

  it('repairs on load: an old 12-slot save comes back with 24 slots', async () => {
    const old = clone(newPlayerState('Old'));
    old.hotbar = old.hotbar.slice(0, 12);
    delete (old as Partial<PlayerState>).merits;
    const st = stubStorage({ [`${SAVE_KEY}:slot0`]: JSON.stringify({ format: 1, savedAt: 1, slot: 0, state: old }) });
    expect(st.length).toBe(1);
    const S = await load();
    const s = S.loadSlot(0)!;
    expect(s.hotbar).toHaveLength(24);
    expect(s.merits).toBe(0);
  });

  it('works with no storage at all', async () => {
    vi.stubGlobal('localStorage', undefined);
    const S = await load();
    expect(S.hasSave()).toBe(false);
    expect(S.writeSave(newPlayerState('x'))).toBe(false);
    expect(S.listSlots()).toHaveLength(SAVE_SLOTS);
  });

  it('survives storage that throws (quota / blocked)', async () => {
    const st = stubStorage();
    const S = await load();
    st.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(S.writeSave(newPlayerState('x'))).toBe(false);
  });
});

it('(sanity) the junk-proof checks above use real item and skill data', () => {
  const p = problems();
  p.check(Registry.items().length > 20 && Registry.skills().length > 50, 'registry is empty: Phaser stub or data import broke');
  p.done();
});
