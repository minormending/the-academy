// OWNER: A4 (ice-tree). Cryomancer -> Frostbinder -> Glacial Sage.
// Identity: control & safety. Chill slows, freeze locks, Shatter detonates frozen targets,
// Frost Armor / Winter's Embrace keep the mage alive. Raw damage sits slightly under fire.
import type { IconSpec, SkillDef, StatusSpec } from '../core/types';

// ───────────────────────────── helpers ─────────────────────────────

/** Linear interpolation across skill levels 1..max. */
const lerp = (lo: number, hi: number, max: number) => (lv: number) =>
  lo + ((hi - lo) * (Math.min(Math.max(lv, 1), max) - 1)) / Math.max(1, max - 1);
const lerpR = (lo: number, hi: number, max: number) => {
  const f = lerp(lo, hi, max);
  return (lv: number) => Math.round(f(lv));
};

const BG = 0x0a2744;
const icon = (glyph: IconSpec['glyph'], color = 0x8fe3ff, color2 = 0xffffff): IconSpec => ({ glyph, color, color2, bg: BG });

const chill = (
  chance: [number, number], dur: [number, number], slow: [number, number], max: number,
): StatusSpec => ({
  kind: 'chill',
  chance: lerp(chance[0], chance[1], max),
  durationMs: lerpR(dur[0], dur[1], max),
  potency: lerp(slow[0], slow[1], max),
});

const freeze = (chance: [number, number], dur: [number, number], max: number): StatusSpec => ({
  kind: 'freeze',
  chance: lerp(chance[0], chance[1], max),
  durationMs: lerpR(dur[0], dur[1], max),
  potency: () => 0,
});

// ───────────────────────────── Cryomancer (tier 2, lv 10) ─────────────────────────────

const frostBolt: SkillDef = {
  id: 'ice_frost_bolt',
  name: 'Frost Bolt',
  description: 'Hurl a crystalline bolt that chills its target, slowing it.',
  element: 'ice',
  job: 'cryomancer',
  kind: 'attack',
  maxLevel: 15,
  icon: icon('ice_shard'),
  mpCost: lerpR(14, 22, 15),
  castTimeMs: 380,
  sfx: 'cast_ice',
  attack: {
    pattern: 'projectile',
    damagePct: lerp(170, 250, 15),
    hits: () => 1,
    maxTargets: () => 1,
    range: 560,
    projectile: { speed: 640, radius: 12 },
    status: chill([0.7, 1], [3000, 5000], [0.35, 0.55], 15),
    vfx: { cast: 'ice_cast', projectile: 'ice_bolt', hit: 'ice_hit' },
  },
};

const frostNova: SkillDef = {
  id: 'ice_frost_nova',
  name: 'Frost Nova',
  description: 'Release a freezing ring around you; enemies caught may be frozen solid.',
  element: 'ice',
  job: 'cryomancer',
  kind: 'attack',
  maxLevel: 15,
  icon: icon('frost_nova'),
  requires: [{ skillId: 'ice_frost_bolt', level: 3 }],
  mpCost: lerpR(20, 28, 15),
  cooldownMs: lerpR(7000, 5000, 15),
  castTimeMs: 480,
  sfx: 'freeze',
  attack: {
    pattern: 'aoe_self',
    damagePct: lerp(100, 150, 15),
    hits: () => 1,
    maxTargets: lv => 5 + Math.floor(lv / 3),
    range: 0,
    area: { w: 420, h: 200 },
    status: freeze([0.35, 0.65], [1500, 2600], 15),
    knockback: 30,
    delayMs: 120,
    vfx: { cast: 'ice_cast', hit: 'ice_hit', area: 'ice_nova_area' },
  },
};

const frostArmor: SkillDef = {
  id: 'ice_frost_armor',
  name: 'Frost Armor',
  description: 'Encase yourself in ice: raises defense and diverts part of all damage to MP.',
  element: 'ice',
  job: 'cryomancer',
  kind: 'buff',
  maxLevel: 15,
  icon: icon('shield', 0x7fd0ff),
  requires: [{ skillId: 'ice_frost_bolt', level: 3 }],
  mpCost: lerpR(20, 28, 15),
  cooldownMs: () => 8000,
  castTimeMs: 450,
  sfx: 'buff',
  buff: {
    durationMs: lerpR(120000, 180000, 15),
    modifiers: lv => [
      { stat: 'def', add: Math.round(lerp(14, 70, 15)(lv)) },
      { stat: 'mpShield', add: lerp(0.15, 0.4, 15)(lv) },
    ],
    vfx: 'ice_armor_cast',
    auraVfx: 'ice_armor_aura',
  },
};

const coldMastery: SkillDef = {
  id: 'ice_cold_mastery',
  name: 'Arctic Focus',
  description: 'Passive: the cold sharpens your mind. Increases max MP and ice damage.',
  element: 'ice',
  job: 'cryomancer',
  kind: 'passive',
  maxLevel: 10,
  icon: icon('mana', 0x6fc8ff),
  requires: [{ skillId: 'ice_frost_bolt', level: 1 }],
  mpCost: () => 0,
  passive: lv => [
    { stat: 'maxMp', mul: 0.02 * lv },
    { stat: 'dmgIce', add: 0.015 * lv },
  ],
};

// ───────────────────────────── Frostbinder (tier 3, lv 25) ─────────────────────────────

const iceLance: SkillDef = {
  id: 'ice_lance',
  name: 'Icicle Lance',
  description: 'Launch a piercing lance of ice that chills every enemy it runs through.',
  element: 'ice',
  job: 'frostbinder',
  kind: 'attack',
  maxLevel: 15,
  icon: icon('icicle'),
  requires: [{ skillId: 'ice_frost_bolt', level: 10 }],
  mpCost: lerpR(26, 34, 15),
  cooldownMs: () => 600,
  castTimeMs: 430,
  sfx: 'cast_ice',
  attack: {
    pattern: 'projectile',
    damagePct: lerp(240, 340, 15),
    hits: () => 1,
    maxTargets: lv => 3 + Math.floor(lv / 5),
    range: 640,
    projectile: { speed: 780, radius: 14, pierce: true },
    status: chill([0.8, 1], [3000, 5000], [0.4, 0.6], 15),
    vfx: { cast: 'ice_cast', projectile: 'ice_lance_proj', hit: 'ice_hit' },
  },
};

const glacialSpike: SkillDef = {
  id: 'ice_glacial_spike',
  name: 'Glacial Spike',
  description: 'Crystal spikes erupt from the ground beneath foes ahead, freezing them in place.',
  element: 'ice',
  job: 'frostbinder',
  kind: 'attack',
  maxLevel: 15,
  icon: icon('glacier'),
  requires: [{ skillId: 'ice_frost_nova', level: 5 }],
  mpCost: lerpR(30, 40, 15),
  cooldownMs: lerpR(8000, 6000, 15),
  castTimeMs: 560,
  sfx: 'freeze',
  attack: {
    pattern: 'aoe_target',
    damagePct: lerp(150, 220, 15),
    hits: () => 1,
    maxTargets: lv => 4 + Math.floor(lv / 4),
    range: 380,
    area: { w: 240, h: 240 },
    status: freeze([0.5, 0.8], [2000, 3200], 15),
    delayMs: 300,
    vfx: { cast: 'ice_cast_rune', hit: 'ice_hit', area: 'ice_spike_area' },
  },
};

const shatter: SkillDef = {
  id: 'ice_shatter',
  name: 'Shatter',
  description: 'Detonate the ice on frozen enemies for massive bonus damage, consuming the freeze.',
  element: 'ice',
  job: 'frostbinder',
  kind: 'attack',
  maxLevel: 15,
  icon: icon('crystal', 0xbff4ff, 0x5ac8ff),
  requires: [{ skillId: 'ice_glacial_spike', level: 3 }],
  mpCost: lerpR(32, 42, 15),
  cooldownMs: lerpR(4000, 3000, 15),
  castTimeMs: 520,
  sfx: 'shatter',
  attack: {
    pattern: 'aoe_target',
    damagePct: lerp(160, 230, 15),
    hits: () => 1,
    maxTargets: lv => 4 + Math.floor(lv / 5),
    range: 420,
    area: { w: 280, h: 220 },
    bonusVs: { status: 'freeze', mult: 2.8, consume: true },
    delayMs: 220,
    vfx: { cast: 'ice_cast_rune', hit: 'ice_shatter_hit', area: 'ice_shatter_area' },
  },
};

const frostElemental: SkillDef = {
  id: 'ice_frost_elemental',
  name: 'Frost Elemental',
  description: 'Summon a frost elemental that follows you and hurls chilling shards at enemies.',
  element: 'ice',
  job: 'frostbinder',
  kind: 'summon',
  maxLevel: 15,
  icon: icon('snowflake', 0xa8ecff),
  requires: [{ skillId: 'ice_frost_armor', level: 5 }],
  mpCost: lerpR(36, 45, 15),
  cooldownMs: lerpR(45000, 38000, 15),
  castTimeMs: 600,
  sfx: 'cast_ice',
  summon: {
    durationMs: lerpR(30000, 60000, 15),
    attackIntervalMs: 1400,
    offset: { x: -56, y: -52 },
    follow: true,
    vfx: 'ice_elemental',
    attack: {
      pattern: 'projectile',
      damagePct: lerp(130, 200, 15),
      hits: () => 1,
      maxTargets: () => 1,
      range: 520,
      projectile: { speed: 520, radius: 12 },
      status: chill([0.7, 1], [2500, 4000], [0.3, 0.45], 15),
      vfx: { projectile: 'ice_elemental_bolt', hit: 'ice_hit' },
    },
  },
};

const glacialMastery: SkillDef = {
  id: 'ice_glacial_mastery',
  name: 'Glacial Mastery',
  description: 'Passive: deepen your command of ice. Increases ice damage and damage consistency.',
  element: 'ice',
  job: 'frostbinder',
  kind: 'passive',
  maxLevel: 10,
  icon: icon('book', 0x7fd8ff),
  requires: [{ skillId: 'ice_cold_mastery', level: 5 }],
  mpCost: () => 0,
  passive: lv => [
    { stat: 'dmgIce', add: 0.02 * lv },
    { stat: 'mastery', add: 0.015 * lv },
  ],
};

// ───────────────────────────── Glacial Sage (tier 4, lv 40) ─────────────────────────────

const glacialLance: SkillDef = {
  id: 'ice_glacial_lance',
  name: 'Glacial Lance',
  description: 'Fire three piercing glacial lances in a tight fan, chilling everything they hit.',
  element: 'ice',
  job: 'glacial_sage',
  kind: 'attack',
  maxLevel: 20,
  icon: icon('icicle', 0xd8f8ff, 0x4aa8ff),
  requires: [{ skillId: 'ice_lance', level: 10 }],
  mpCost: lerpR(45, 60, 20),
  cooldownMs: () => 800,
  castTimeMs: 480,
  sfx: 'cast_ice',
  attack: {
    pattern: 'projectile',
    damagePct: lerp(150, 215, 20),
    hits: () => 1,
    maxTargets: lv => 4 + Math.floor(lv / 5),
    range: 700,
    projectile: { speed: 860, radius: 15, pierce: true, count: () => 3, spreadDeg: 7 },
    status: chill([0.85, 1], [3500, 6000], [0.45, 0.65], 20),
    hitIntervalMs: 70,
    vfx: { cast: 'ice_cast_rune', projectile: 'ice_glacial_proj', hit: 'ice_hit' },
  },
};

const blizzard: SkillDef = {
  id: 'ice_blizzard',
  name: 'Blizzard',
  description: 'Call down a howling storm of ice spears over a wide area, freezing foes caught within.',
  element: 'ice',
  job: 'glacial_sage',
  kind: 'attack',
  maxLevel: 10,
  icon: icon('blizzard', 0xe4faff, 0x58b8ff),
  requires: [
    { skillId: 'ice_shatter', level: 5 },
    { skillId: 'ice_glacial_spike', level: 5 },
  ],
  mpCost: lerpR(70, 90, 10),
  cooldownMs: lerpR(50000, 40000, 10),
  castTimeMs: 800,
  sfx: 'freeze',
  attack: {
    pattern: 'rain',
    // Per impact; a target inside the 560px storm is typically hit ~6-10 times (~700-1450% total).
    damagePct: lerp(110, 150, 10),
    hits: () => 1,
    maxTargets: lv => 6 + Math.floor(lv / 2),
    range: 420,
    area: { w: 150, h: 110, offsetX: 420 },
    projectile: { speed: 760, radius: 8 },
    rain: { count: lerpR(24, 36, 10), spreadX: 560, intervalMs: 100, fallHeight: 460 },
    status: freeze([0.35, 0.6], [1800, 2600], 10),
    delayMs: 350,
    vfx: {
      cast: 'ice_blizzard_cast',
      projectile: 'ice_blizzard_proj',
      hit: 'ice_hit',
      area: 'ice_blizzard_impact',
    },
  },
};

const frozenOrb: SkillDef = {
  id: 'ice_frozen_orb',
  name: 'Frozen Orb',
  description: 'Conjure a frozen orb that hangs in place, pulsing frost that damages and may freeze nearby foes.',
  element: 'ice',
  job: 'glacial_sage',
  kind: 'summon',
  maxLevel: 15,
  icon: icon('orb', 0xa8ecff, 0xffffff),
  requires: [{ skillId: 'ice_frost_elemental', level: 5 }],
  mpCost: lerpR(55, 75, 15),
  cooldownMs: lerpR(50000, 40000, 15),
  castTimeMs: 650,
  sfx: 'freeze',
  summon: {
    durationMs: lerpR(15000, 25000, 15),
    attackIntervalMs: 1000,
    offset: { x: 96, y: -62 },
    follow: false,
    vfx: 'ice_orb',
    attack: {
      pattern: 'aoe_self',
      damagePct: lerp(130, 200, 15),
      hits: () => 1,
      maxTargets: lv => 6 + Math.floor(lv / 3),
      range: 0,
      area: { w: 400, h: 280 },
      status: freeze([0.2, 0.35], [1200, 1800], 15),
      vfx: { hit: 'ice_hit', area: 'ice_orb_pulse' },
    },
  },
};

const wintersEmbrace: SkillDef = {
  id: 'ice_winters_embrace',
  name: "Winter's Embrace",
  description: 'Wrap yourself in a blizzard shroud: more damage, faster casting, and tougher defense.',
  element: 'ice',
  job: 'glacial_sage',
  kind: 'buff',
  maxLevel: 10,
  icon: icon('wind', 0xcff4ff, 0x5ac0ff),
  requires: [{ skillId: 'ice_frost_armor', level: 8 }],
  mpCost: lerpR(55, 70, 10),
  cooldownMs: () => 20000,
  castTimeMs: 550,
  sfx: 'buff',
  buff: {
    durationMs: lerpR(90000, 150000, 10),
    modifiers: lv => [
      { stat: 'dmgAll', add: lerp(0.1, 0.22, 10)(lv) },
      { stat: 'castSpeed', add: lerp(0.1, 0.25, 10)(lv) },
      { stat: 'def', add: Math.round(lerp(40, 110, 10)(lv)) },
    ],
    vfx: 'ice_winter_cast',
    auraVfx: 'ice_winter_aura',
  },
};

const permafrost: SkillDef = {
  id: 'ice_permafrost',
  name: 'Permafrost',
  description: 'Passive: cold control rewards precision. Increases critical damage and reduces cooldowns.',
  element: 'ice',
  job: 'glacial_sage',
  kind: 'passive',
  maxLevel: 10,
  icon: icon('gem', 0xa0e4ff),
  requires: [{ skillId: 'ice_glacial_mastery', level: 5 }],
  mpCost: () => 0,
  passive: lv => [
    { stat: 'critDmg', add: 0.04 * lv },
    { stat: 'cdr', add: 0.01 * lv },
  ],
};

export const ICE_SKILLS: SkillDef[] = [
  // tier 2
  frostBolt, frostNova, frostArmor, coldMastery,
  // tier 3
  iceLance, glacialSpike, shatter, frostElemental, glacialMastery,
  // tier 4
  glacialLance, blizzard, frozenOrb, wintersEmbrace, permafrost,
];
