// OWNER: A4 (ice-tree). Cryomancer -> Frostbinder -> Glacial Sage.
// Identity: control & safety. Chill slows, freeze locks, Shatter detonates frozen targets,
// Frost Armor / Winter's Embrace keep the mage alive. Raw damage sits slightly under fire.
import { playVfx } from '../core/vfx';
import type { IconSpec, SkillContext, SkillDef, StatusSpec } from '../core/types';

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

/** Passives have no cast hook: show their own sigil when a companion spell is used. */
function passiveSigil(ctx: SkillContext, id: string, key: string): void {
  const level = ctx.services.progression.state.skills[id] ?? 0;
  if (level <= 0) return;
  const p = ctx.services.player;
  playVfx(ctx.scene, key, { x: p.x, y: p.y, facing: p.facing, lv: level });
}

function focusedAttack(ctx: SkillContext): void {
  const p = ctx.services.player;
  if (ctx.skill.attack) ctx.runAttack(ctx.skill.attack, { x: p.x + 18 * p.facing, y: p.y - 34, facing: p.facing });
  passiveSigil(ctx, 'ice_rime_guard', 'ice_rime_guard_sigil');
  passiveSigil(ctx, 'ice_crystal_memory', 'ice_crystal_memory_sigil');
}

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

const rimeRay: SkillDef = {
  id: 'ice_rime_ray', name: 'Rime Ray',
  description: 'Draw a narrow ray through a line of enemies, coating them in slowing rime.',
  element: 'ice', job: 'cryomancer', kind: 'attack', maxLevel: 15,
  icon: icon('icicle', 0x68c9ee), mpCost: lerpR(16, 24, 15),
  cooldownMs: () => 1200, castTimeMs: 420, sfx: 'cast_ice',
  attack: {
    pattern: 'beam', damagePct: lerp(95, 140, 15), hits: () => 1,
    maxTargets: () => 5, range: 460, area: { w: 460, h: 58 },
    status: chill([1, 1], [2500, 4000], [0.25, 0.45], 15),
    vfx: { cast: 'ice_cast', area: 'ice_rime_ray_beam', hit: 'ice_hit' },
  },
  onCast: focusedAttack,
};

const crystalWall: SkillDef = {
  id: 'ice_crystal_wall', name: 'Crystal Wall',
  description: 'Raise a ridge of brittle ice ahead that pushes enemies back and freezes them in its zone.',
  element: 'ice', job: 'cryomancer', kind: 'attack', maxLevel: 15,
  icon: icon('glacier', 0x69b9ef), requires: [{ skillId: 'ice_frost_nova', level: 3 }],
  mpCost: lerpR(20, 28, 15), cooldownMs: lerpR(10000, 7500, 15), castTimeMs: 440, sfx: 'freeze',
  attack: {
    pattern: 'melee_arc', damagePct: lerp(80, 120, 15), hits: () => 1,
    maxTargets: () => 6, range: 240, area: { w: 240, h: 180, offsetX: 150, offsetY: 0 },
    status: freeze([0.85, 1], [1200, 2000], 15), knockback: 110, delayMs: 140,
    vfx: { cast: 'ice_cast', area: 'ice_crystal_wall_area', hit: 'ice_hit' },
  },
};

const frostStep: SkillDef = {
  id: 'ice_frost_step', name: 'Frost Step',
  description: 'Slip through a snowflake into a short directional blink to escape approaching enemies.',
  element: 'ice', job: 'cryomancer', kind: 'movement', maxLevel: 15,
  icon: icon('teleport', 0xa8eaff), requires: [{ skillId: 'ice_frost_armor', level: 1 }],
  mpCost: lerpR(14, 20, 15), cooldownMs: lerpR(5500, 3500, 15), castTimeMs: 120, sfx: 'blink',
  movement: { kind: 'blink', distance: lerpR(140, 220, 15), vfxOut: 'ice_frost_step_out', vfxIn: 'ice_frost_step_in' },
};

const rimeGuard: SkillDef = {
  id: 'ice_rime_guard', name: 'Rime Guard',
  description: 'Passive: reinforce your body with frost, increasing maximum HP, defense and natural recovery.',
  element: 'ice', job: 'cryomancer', kind: 'passive', maxLevel: 15,
  icon: icon('robe', 0x80bddf), requires: [{ skillId: 'ice_frost_armor', level: 3 }],
  mpCost: () => 0, sfx: 'buff',
  passive: lv => [
    { stat: 'maxHp', mul: 0.01 * lv }, { stat: 'def', add: 2 * lv }, { stat: 'hpRegen', add: lv },
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
    attackIntervalMs: 1000,
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
  requires: [{ skillId: 'ice_cold_mastery', level: 5 }, { skillId: 'ice_lance', level: 1 }],
  mpCost: () => 0,
  passive: lv => [
    { stat: 'dmgIce', add: 0.02 * lv },
    { stat: 'mastery', add: 0.015 * lv },
  ],
};

const crystalNeedle: SkillDef = {
  id: 'ice_crystal_needle', name: 'Crystal Needle',
  description: 'Focus a thin two-hit beam on one enemy, dealing bonus damage to frozen targets without thawing them.',
  element: 'ice', job: 'frostbinder', kind: 'attack', maxLevel: 20,
  icon: icon('ice_shard', 0xe3faff), requires: [{ skillId: 'ice_lance', level: 3 }],
  mpCost: lerpR(28, 38, 20), cooldownMs: lerpR(2400, 1800, 20), castTimeMs: 460, sfx: 'shatter',
  attack: {
    pattern: 'beam', damagePct: lerp(115, 165, 20), hits: () => 2, hitIntervalMs: 90,
    maxTargets: () => 1, range: 620, area: { w: 620, h: 46 },
    bonusVs: { status: 'freeze', mult: 1.35 }, delayMs: 100,
    vfx: { cast: 'ice_cast_rune', area: 'ice_crystal_needle_beam', hit: 'ice_crystal_needle_hit' },
  },
  onCast: focusedAttack,
};

const restorativeThaw: SkillDef = {
  id: 'ice_restorative_thaw', name: 'Restorative Thaw',
  description: 'Melt a reserve of enchanted ice to restore a portion of your maximum HP and MP.',
  element: 'ice', job: 'frostbinder', kind: 'buff', maxLevel: 15,
  icon: icon('heart', 0x9ae6f2), requires: [{ skillId: 'ice_frost_elemental', level: 1 }],
  mpCost: lerpR(30, 42, 15), cooldownMs: lerpR(30000, 22000, 15), castTimeMs: 650, sfx: 'heal',
  // onCast replaces the default buff path: instant recovery, no lingering stat modifier.
  onCast: (ctx, lv) => {
    const { progression, player, combat } = ctx.services;
    const d = progression.derived();
    const hpBefore = progression.state.hp, mpBefore = progression.state.mp;
    progression.heal(Math.round(d.maxHp * lerp(0.1, 0.22, 15)(lv)), Math.round(d.maxMp * lerp(0.03, 0.08, 15)(lv)));
    const hp = progression.state.hp - hpBefore, mp = progression.state.mp - mpBefore;
    if (hp > 0) combat.showNumber(player.x, player.y - 64, hp, 'heal');
    if (mp > 0) combat.showNumber(player.x, player.y - 86, mp, 'mp');
    playVfx(ctx.scene, 'ice_restorative_thaw', { x: player.x, y: player.y, facing: player.facing, lv });
    passiveSigil(ctx, 'ice_crystal_memory', 'ice_crystal_memory_sigil');
  },
};

const crystalMemory: SkillDef = {
  id: 'ice_crystal_memory', name: 'Crystal Memory',
  description: 'Passive: memorize each crystal lattice to recover MP faster and shorten your casting locks.',
  element: 'ice', job: 'frostbinder', kind: 'passive', maxLevel: 15,
  icon: icon('scroll', 0xa4e3ed), requires: [{ skillId: 'ice_glacial_mastery', level: 3 }],
  mpCost: () => 0, sfx: 'buff',
  passive: lv => [{ stat: 'mpRegen', add: lv }, { stat: 'castSpeed', add: 0.006 * lv }],
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
  requires: [{ skillId: 'ice_lance', level: 5 }],
  mpCost: lerpR(45, 60, 20),
  // No cooldown: it is the tier-4 primary (fire/lightning primaries have none). A fanned volley shares one
  // hit set (AttackRunner), so a target takes ONE lance per cast: the per-hit % carries the single-target
  // damage and the per-lance target cap keeps the cone's AoE near fire's 6-target lance.
  castTimeMs: 480,
  sfx: 'cast_ice',
  attack: {
    pattern: 'projectile',
    damagePct: lerp(380, 540, 20),
    hits: () => 1,
    maxTargets: lv => 2 + Math.floor(lv / 10),
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
  requires: [{ skillId: 'ice_frost_elemental', level: 5 }, { skillId: 'ice_winters_embrace', level: 1 }],
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
  requires: [{ skillId: 'ice_glacial_mastery', level: 5 }, { skillId: 'ice_glacial_lance', level: 1 }],
  mpCost: () => 0,
  passive: lv => [
    { stat: 'critDmg', add: 0.04 * lv },
    { stat: 'cdr', add: 0.01 * lv },
  ],
};

const hoarfrostRelay: SkillDef = {
  id: 'ice_hoarfrost_relay', name: 'Hoarfrost Relay',
  description: 'Link scattered enemies with crystalline chains that spread a deep, lingering chill.',
  element: 'ice', job: 'glacial_sage', kind: 'attack', maxLevel: 20,
  icon: icon('chain', 0xa7e7f5), requires: [{ skillId: 'ice_glacial_lance', level: 3 }],
  mpCost: lerpR(45, 60, 20), cooldownMs: lerpR(6500, 4500, 20), castTimeMs: 510, sfx: 'cast_ice',
  attack: {
    pattern: 'chain', damagePct: lerp(200, 285, 20), hits: () => 1,
    maxTargets: () => 8, range: 500, chain: { jumpRange: 230, jumpDelayMs: 100 },
    status: chill([1, 1], [4500, 6500], [0.5, 0.7], 20),
    vfx: { cast: 'ice_cast_rune', area: 'ice_hoarfrost_link', hit: 'ice_hoarfrost_hit' },
  },
};

const absoluteZero: SkillDef = {
  id: 'ice_absolute_zero', name: 'Absolute Zero',
  description: 'Ultimate: collapse a vast crystal dome into one shattering blast, consuming freeze for bonus damage.',
  element: 'ice', job: 'glacial_sage', kind: 'attack', maxLevel: 10,
  icon: icon('frost_nova', 0xf0fcff, 0x5393d1), requires: [{ skillId: 'ice_blizzard', level: 1 }],
  mpCost: lerpR(75, 90, 10), cooldownMs: lerpR(80000, 65000, 10), castTimeMs: 900, sfx: 'shatter',
  attack: {
    pattern: 'aoe_self', damagePct: lerp(800, 1050, 10), hits: () => 1,
    maxTargets: () => 12, range: 0, area: { w: 760, h: 360 },
    bonusVs: { status: 'freeze', mult: 1.4, consume: true }, knockback: 70, delayMs: 600,
    vfx: { cast: 'ice_absolute_zero_cast', area: 'ice_absolute_zero_area', hit: 'ice_absolute_zero_hit' },
  },
};

const diamondBarrier: SkillDef = {
  id: 'ice_diamond_barrier', name: 'Diamond Barrier',
  description: 'Raise a brief lattice barrier that greatly increases defense and diverts incoming damage to MP.',
  element: 'ice', job: 'glacial_sage', kind: 'buff', maxLevel: 15,
  icon: icon('shield', 0xe4faff, 0x5f9fd2), requires: [{ skillId: 'ice_winters_embrace', level: 3 }],
  mpCost: lerpR(50, 65, 15), cooldownMs: lerpR(40000, 30000, 15), castTimeMs: 320, sfx: 'buff',
  buff: {
    durationMs: lerpR(6000, 10000, 15),
    modifiers: lv => [{ stat: 'def', add: lerpR(70, 140, 15)(lv) }, { stat: 'mpShield', add: lerp(0.15, 0.3, 15)(lv) }],
    vfx: 'ice_diamond_barrier_cast', auraVfx: 'ice_diamond_barrier_aura',
  },
};

// 3 entry paths / Year; 115 / 120 / 110 SP to max each Year (345 total).
export const ICE_SKILLS: SkillDef[] = [
  // Year 2 — four attacks, armor + blink, two passives.
  frostBolt, frostNova, frostArmor, coldMastery, rimeRay, crystalWall, frostStep, rimeGuard,
  // Year 3 — four attacks, companion, recovery, two passives.
  iceLance, glacialSpike, shatter, frostElemental, glacialMastery, crystalNeedle, restorativeThaw, crystalMemory,
  // Year 4 — four attacks (two ultimates), persistent orb, two buffs, one passive.
  glacialLance, blizzard, frozenOrb, wintersEmbrace, permafrost, hoarfrostRelay, absoluteZero, diamondBarrier,
];
