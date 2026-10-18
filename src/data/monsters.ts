// OWNER: A6 (monsters). Monster definitions, tuned against core/balance.ts reference curves.
import type { DropEntry, Element, MonsterBehavior, MonsterDef, StatusKind } from '../core/types';
import { refMonsterExp, refMonsterHp, refMonsterTouch } from '../core/balance';

interface MonsterSpec {
  id: string;
  name: string;
  level: number;
  behavior: MonsterBehavior;
  speed: number;
  size: { w: number; h: number };
  /** Multipliers vs. the reference curves (×0.8–1.3 variety). */
  hpMul?: number;
  expMul?: number;
  touchMul?: number;
  defMul?: number;
  aggressive?: boolean;
  weak?: Element[];
  resist?: Element[];
  immune?: StatusKind[];
  /** Zone etc drop + its chance. */
  etc: string;
  etcChance?: number;
  extraDrops?: DropEntry[];
}

/** Level-appropriate potions (5–15%). */
function potionDrops(level: number): DropEntry[] {
  if (level < 12) return [
    { itemId: 'red_potion', chance: 0.12, min: 1, max: 2 },
    { itemId: 'blue_potion', chance: 0.07 },
  ];
  if (level < 25) return [
    { itemId: 'orange_potion', chance: 0.11, min: 1, max: 2 },
    { itemId: 'blue_potion', chance: 0.08, min: 1, max: 2 },
    { itemId: 'return_scroll', chance: 0.03 },
  ];
  if (level < 40) return [
    { itemId: 'white_potion', chance: 0.1, min: 1, max: 2 },
    { itemId: 'mana_elixir', chance: 0.06 },
    { itemId: 'return_scroll', chance: 0.03 },
  ];
  return [
    { itemId: 'white_potion', chance: 0.12, min: 1, max: 3 },
    { itemId: 'mana_elixir', chance: 0.08, min: 1, max: 2 },
    { itemId: 'elixir', chance: 0.03 },
    { itemId: 'return_scroll', chance: 0.03 },
  ];
}

/** Occasional on-level equipment (1–3%). */
function equipDrops(level: number): DropEntry[] {
  if (level < 8) return [
    { itemId: 'oak_wand', chance: 0.012 }, { itemId: 'apprentice_hat', chance: 0.015 },
    { itemId: 'apprentice_robe', chance: 0.012 }, { itemId: 'soft_sandals', chance: 0.015 },
  ];
  if (level < 15) return [{ itemId: 'willow_staff', chance: 0.02 }, { itemId: 'soft_sandals', chance: 0.012 }];
  if (level < 20) return [
    { itemId: 'ember_staff', chance: 0.01 }, { itemId: 'frost_staff', chance: 0.01 }, { itemId: 'storm_staff', chance: 0.01 },
  ];
  if (level < 25) return [{ itemId: 'sage_hat', chance: 0.02 }, { itemId: 'sage_robe', chance: 0.015 }];
  if (level < 30) return [{ itemId: 'wind_boots', chance: 0.02 }, { itemId: 'sage_robe', chance: 0.01 }];
  if (level < 35) return [{ itemId: 'mana_ring', chance: 0.02 }, { itemId: 'wind_boots', chance: 0.01 }];
  if (level < 45) return [
    { itemId: 'arcane_amulet', chance: 0.015 }, { itemId: 'inferno_staff', chance: 0.008 },
    { itemId: 'glacier_staff', chance: 0.008 }, { itemId: 'tempest_staff', chance: 0.008 },
  ];
  return [{ itemId: 'arcane_amulet', chance: 0.015 }, { itemId: 'archon_staff', chance: 0.005 }];
}

function mesosFor(level: number): [number, number] {
  return [Math.round(2 + level * 2.2), Math.round(5 + level * 3.6)];
}

function mk(s: MonsterSpec): MonsterDef {
  const lv = s.level;
  return {
    id: s.id,
    name: s.name,
    level: lv,
    hp: Math.round(refMonsterHp(lv) * (s.hpMul ?? 1)),
    exp: Math.max(1, Math.round(refMonsterExp(lv) * (s.expMul ?? 1))),
    mesos: mesosFor(lv),
    touchDamage: Math.round(refMonsterTouch(lv) * (s.touchMul ?? 1)),
    def: Math.round(lv * 0.4 * (s.defMul ?? 1)),
    speed: s.speed,
    size: s.size,
    behavior: s.behavior,
    aggressive: s.aggressive ?? true,
    weak: s.weak,
    resist: s.resist,
    immune: s.immune,
    drops: [
      { itemId: s.etc, chance: s.etcChance ?? 0.45, min: 1, max: 1 },
      ...potionDrops(lv),
      ...equipDrops(lv),
      ...(s.extraDrops ?? []),
    ],
  };
}

const BOSS_LV = 48;

const lichArchon: MonsterDef = {
  id: 'lich_archon',
  name: 'Lich Archon',
  level: BOSS_LV,
  hp: Math.round(refMonsterHp(BOSS_LV) * 250),
  exp: Math.round(refMonsterExp(BOSS_LV) * 40),
  mesos: [3200, 5200],
  touchDamage: Math.round(refMonsterTouch(BOSS_LV) * 1.25),
  def: 30,
  speed: 55,
  size: { w: 84, h: 168 },
  behavior: 'boss',
  aggressive: true,
  boss: true,
  drops: [
    { itemId: 'archon_sigil', chance: 1, min: 1, max: 1 },
    { itemId: 'archon_staff', chance: 0.3 },
    { itemId: 'void_crystal', chance: 1, min: 3, max: 6 },
    { itemId: 'white_potion', chance: 1, min: 4, max: 8 },
    { itemId: 'mana_elixir', chance: 0.9, min: 3, max: 6 },
    { itemId: 'elixir', chance: 0.6, min: 1, max: 3 },
    { itemId: 'arcane_amulet', chance: 0.15 },
    { itemId: 'inferno_staff', chance: 0.08 },
    { itemId: 'glacier_staff', chance: 0.08 },
    { itemId: 'tempest_staff', chance: 0.08 },
  ],
};

export const MONSTERS: MonsterDef[] = [
  // ── whisperwood ──
  mk({ id: 'moss_snail', name: 'Moss Snail', level: 1, behavior: 'walker', speed: 34, size: { w: 36, h: 28 },
    hpMul: 1, touchMul: 0.8, aggressive: false, etc: 'snail_shell', etcChance: 0.55 }),
  mk({ id: 'puff_slime', name: 'Puff Slime', level: 3, behavior: 'hopper', speed: 95, size: { w: 38, h: 32 },
    hpMul: 0.95, touchMul: 0.9, aggressive: false, etc: 'slime_jelly', etcChance: 0.5 }),
  mk({ id: 'cap_shroom', name: 'Cap Shroom', level: 6, behavior: 'walker', speed: 58, size: { w: 40, h: 46 },
    hpMul: 1.05, etc: 'shroom_cap', etcChance: 0.5 }),
  // ── shroom_hollow ──
  mk({ id: 'thorn_shroom', name: 'Thorn Shroom', level: 9, behavior: 'walker', speed: 64, size: { w: 44, h: 52 },
    hpMul: 1.1, expMul: 1.05, touchMul: 1.15, etc: 'thorn_spore' }),
  mk({ id: 'stump_golem', name: 'Stump Golem', level: 13, behavior: 'walker', speed: 44, size: { w: 50, h: 62 },
    hpMul: 1.28, expMul: 1.2, touchMul: 1.1, defMul: 1.5, etc: 'stump_bark', etcChance: 0.4 }),
  // ── frostfang_cliffs ──
  mk({ id: 'frost_bat', name: 'Frost Bat', level: 16, behavior: 'flyer', speed: 95, size: { w: 40, h: 30 },
    hpMul: 0.82, expMul: 0.95, touchMul: 0.9, weak: ['fire'], etc: 'bat_wing' }),
  mk({ id: 'snow_yeti', name: 'Snow Yeti', level: 20, behavior: 'walker', speed: 70, size: { w: 56, h: 72 },
    hpMul: 1.22, expMul: 1.15, touchMul: 1.15, defMul: 1.2, weak: ['fire'], etc: 'yeti_fur', etcChance: 0.4 }),
  mk({ id: 'ice_wisp', name: 'Ice Wisp', level: 23, behavior: 'flyer', speed: 78, size: { w: 34, h: 38 },
    hpMul: 0.85, touchMul: 1.05, weak: ['fire'], resist: ['ice'], immune: ['freeze'], etc: 'wisp_essence' }),
  // ── cinder_caverns ──
  mk({ id: 'ember_imp', name: 'Ember Imp', level: 26, behavior: 'hopper', speed: 105, size: { w: 36, h: 44 },
    hpMul: 0.9, expMul: 0.95, weak: ['ice'], resist: ['fire'], etc: 'imp_horn' }),
  mk({ id: 'lava_salamander', name: 'Lava Salamander', level: 30, behavior: 'walker', speed: 82, size: { w: 64, h: 34 },
    hpMul: 1.05, expMul: 1.05, touchMul: 1.05, weak: ['ice'], resist: ['fire'], immune: ['burn'], etc: 'salamander_scale' }),
  mk({ id: 'magma_golem', name: 'Magma Golem', level: 34, behavior: 'walker', speed: 44, size: { w: 64, h: 80 },
    hpMul: 1.3, expMul: 1.25, touchMul: 1.2, defMul: 1.6, weak: ['ice'], resist: ['fire'], etc: 'magma_core', etcChance: 0.35 }),
  // ── stormspire_peak ──
  mk({ id: 'storm_harpy', name: 'Storm Harpy', level: 37, behavior: 'flyer', speed: 112, size: { w: 44, h: 48 },
    hpMul: 0.84, expMul: 0.95, weak: ['lightning'], etc: 'harpy_feather' }),
  mk({ id: 'crag_golem', name: 'Crag Golem', level: 40, behavior: 'walker', speed: 44, size: { w: 66, h: 84 },
    hpMul: 1.3, expMul: 1.25, touchMul: 1.2, defMul: 1.6, weak: ['lightning'], etc: 'golem_shard', etcChance: 0.35 }),
  mk({ id: 'thunder_drake', name: 'Thunder Drake', level: 43, behavior: 'flyer', speed: 100, size: { w: 70, h: 50 },
    hpMul: 0.95, expMul: 1.1, touchMul: 1.1, weak: ['ice'], resist: ['lightning'], etc: 'drake_scale' }),
  // ── arcane_sanctum ──
  mk({ id: 'void_wisp', name: 'Void Wisp', level: 46, behavior: 'flyer', speed: 92, size: { w: 36, h: 40 },
    hpMul: 0.85, expMul: 0.95, etc: 'void_crystal', extraDrops: [{ itemId: 'wisp_essence', chance: 0.15 }] }),
  lichArchon,
];
