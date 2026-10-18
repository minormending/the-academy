// OWNER: A3 (fire-tree). Pyromancer -> Flamebinder -> Inferno Sage.
// Identity: highest raw damage, burn DoT, explosions, big AoE.
import type { IconSpec, SkillDef, StatusSpec } from '../core/types';

/** Linear interpolation across levels 1..max (clamped). */
const L = (a: number, b: number, max: number) => (lv: number) => a + ((b - a) * (Math.min(Math.max(lv, 1), max) - 1)) / (max - 1);
/** Same, rounded. */
const Li = (a: number, b: number, max: number) => { const f = L(a, b, max); return (lv: number) => Math.round(f(lv)); };
const K = (n: number) => () => n;

const icon = (glyph: IconSpec['glyph'], color = 0xffd84a, color2 = 0xff5a14): IconSpec => ({ glyph, color, color2, bg: 0x4a1208 });

/** Burn DoT helper (potency = % of the hit per 500ms tick). */
const burn = (max: number, chance: [number, number], dur: [number, number], pot: [number, number]): StatusSpec => ({
  kind: 'burn', chance: L(chance[0], chance[1], max), durationMs: L(dur[0], dur[1], max), potency: L(pot[0], pot[1], max),
});

export const FIRE_SKILLS: SkillDef[] = [
  // ───────────────────────── Tier 2 — Pyromancer (lv 10) ─────────────────────────
  {
    id: 'fire_arrow', name: 'Flame Arrow', job: 'pyromancer', element: 'fire', kind: 'attack', maxLevel: 20,
    description: 'Hurl a blazing arrow that strikes one enemy hard and sets it ablaze.',
    icon: icon('fireball'), mpCost: Li(12, 22, 20), castTimeMs: 380, sfx: 'cast_fire',
    attack: {
      pattern: 'projectile', damagePct: L(170, 262, 20), hits: K(1), maxTargets: K(1), range: 560,
      projectile: { speed: 640, radius: 14 },
      status: burn(20, [0.25, 0.6], [3000, 6000], [10, 20]),
      vfx: { cast: 'fire_cast', projectile: 'fire_arrow_proj', hit: 'fire_hit' },
    },
  },
  {
    id: 'fire_flame_burst', name: 'Flame Burst', job: 'pyromancer', element: 'fire', kind: 'attack', maxLevel: 15,
    description: 'Exhale a short cone of flame that scorches and shoves back everything in front of you.',
    icon: icon('flame'), requires: [{ skillId: 'fire_arrow', level: 3 }],
    mpCost: Li(16, 26, 15), cooldownMs: L(2400, 1500, 15), castTimeMs: 420, sfx: 'cast_fire',
    attack: {
      pattern: 'melee_arc', damagePct: L(105, 150, 15), hits: K(2), maxTargets: K(6), range: 200,
      area: { w: 190, h: 110, offsetX: 105 }, knockback: 30, delayMs: 100, hitIntervalMs: 110,
      status: burn(15, [0.3, 0.55], [3000, 4500], [10, 16]),
      vfx: { cast: 'fire_cast', area: 'fire_burst_area', hit: 'fire_hit' },
    },
  },
  {
    id: 'fire_kindle', name: 'Kindle', job: 'pyromancer', element: 'fire', kind: 'buff', maxLevel: 15,
    description: 'Stoke your inner fire: more magic attack and fire damage for a long time.',
    icon: icon('ember', 0xffe27a, 0xff7a1a), requires: [{ skillId: 'fire_arrow', level: 5 }],
    mpCost: Li(18, 28, 15), cooldownMs: K(4000), castTimeMs: 500, sfx: 'buff',
    buff: {
      durationMs: L(90000, 180000, 15),
      modifiers: (lv) => [
        { stat: 'matk', mul: L(0.05, 0.15, 15)(lv) },
        { stat: 'dmgFire', add: L(0.08, 0.2, 15)(lv) },
      ],
      vfx: 'fire_kindle_cast', auraVfx: 'fire_kindle_aura',
    },
  },
  {
    id: 'fire_smolder', name: 'Smoldering Focus', job: 'pyromancer', element: 'fire', kind: 'passive', maxLevel: 15,
    description: 'Permanently increases fire damage and mana regeneration.',
    icon: icon('flame', 0xffb830, 0xc2321a), requires: [{ skillId: 'fire_arrow', level: 3 }],
    mpCost: K(0),
    passive: (lv) => [{ stat: 'dmgFire', add: 0.015 * lv }, { stat: 'mpRegen', add: 2 * lv }],
  },

  // ───────────────────────── Tier 3 — Flamebinder (lv 25) ─────────────────────────
  {
    id: 'fire_orb', name: 'Blazing Orb', job: 'flamebinder', element: 'fire', kind: 'attack', maxLevel: 20,
    description: 'Launch a fireball that detonates on impact, burning everything caught in the blast.',
    icon: icon('explosion', 0xffe27a, 0xff4a10), requires: [{ skillId: 'fire_arrow', level: 10 }],
    mpCost: Li(28, 42, 20), castTimeMs: 480, sfx: 'cast_fire',
    attack: {
      pattern: 'projectile', damagePct: L(245, 345, 20), hits: K(1), maxTargets: K(5), range: 620,
      area: { w: 210, h: 150 },
      projectile: { speed: 520, radius: 18, explodeArea: { w: 210, h: 150 } },
      status: burn(20, [0.35, 0.6], [4000, 6000], [14, 22]),
      vfx: { cast: 'fire_cast_big', projectile: 'fire_orb_proj', hit: 'fire_hit', area: 'fire_explosion' },
    },
  },
  {
    id: 'fire_pillar', name: 'Inferno Pillar', job: 'flamebinder', element: 'fire', kind: 'attack', maxLevel: 15,
    description: 'Call a towering column of fire down on the nearest foes; it scorches them again and again.',
    icon: icon('flame', 0xfff0a0, 0xff3a0c), requires: [{ skillId: 'fire_flame_burst', level: 8 }],
    mpCost: Li(30, 44, 15), cooldownMs: L(6000, 4000, 15), castTimeMs: 520, sfx: 'cast_fire',
    attack: {
      pattern: 'aoe_target', damagePct: L(150, 225, 15), hits: K(3), maxTargets: K(8), range: 380,
      area: { w: 170, h: 260 }, delayMs: 280, hitIntervalMs: 140,
      status: burn(15, [0.5, 0.75], [4000, 5500], [12, 18]),
      vfx: { cast: 'fire_cast', area: 'fire_pillar_area', hit: 'fire_hit' },
    },
  },
  {
    id: 'fire_combust', name: 'Combust', job: 'flamebinder', element: 'fire', kind: 'attack', maxLevel: 15,
    description: 'Detonate the flames in burning enemies for 2.4x damage, extinguishing their burn.',
    icon: icon('explosion', 0xffffff, 0xe8421a), requires: [{ skillId: 'fire_orb', level: 5 }],
    mpCost: Li(34, 46, 15), cooldownMs: L(9000, 6500, 15), castTimeMs: 560, sfx: 'explosion',
    attack: {
      pattern: 'aoe_target', damagePct: L(190, 225, 15), hits: K(2), maxTargets: K(8), range: 340,
      area: { w: 270, h: 190 }, delayMs: 250, hitIntervalMs: 120,
      bonusVs: { status: 'burn', mult: 2.4, consume: true },
      vfx: { cast: 'fire_combust_cast', area: 'fire_combust_area', hit: 'fire_combust_hit' },
    },
  },
  {
    id: 'fire_salamander', name: 'Summon Salamander', job: 'flamebinder', element: 'fire', kind: 'summon', maxLevel: 15,
    description: 'Summon a fire salamander that stands its ground and spits burning bolts at nearby enemies.',
    icon: icon('ember', 0xffd84a, 0xc2321a), requires: [{ skillId: 'fire_orb', level: 5 }],
    mpCost: Li(32, 46, 15), cooldownMs: L(55000, 45000, 15), castTimeMs: 600, sfx: 'cast_fire',
    summon: {
      durationMs: L(30000, 45000, 15), attackIntervalMs: 1100, offset: { x: -46, y: -14 }, vfx: 'fire_salamander',
      attack: {
        pattern: 'projectile', damagePct: L(150, 235, 15), hits: K(1), maxTargets: K(1), range: 440,
        projectile: { speed: 520, radius: 12 },
        status: burn(15, [0.4, 0.6], [3000, 4000], [12, 16]),
        vfx: { cast: 'fire_spit_cast', projectile: 'fire_spit_proj', hit: 'fire_hit' },
      },
    },
  },
  {
    id: 'fire_pyre_mastery', name: 'Pyre Mastery', job: 'flamebinder', element: 'fire', kind: 'passive', maxLevel: 15,
    description: 'Fire damage rises and your spells roll closer to their maximum damage.',
    icon: icon('phoenix', 0xffd84a, 0xff6a1a), requires: [{ skillId: 'fire_arrow', level: 10 }],
    mpCost: K(0),
    passive: (lv) => [{ stat: 'dmgFire', add: 0.02 * lv }, { stat: 'mastery', add: 0.012 * lv }],
  },

  // ───────────────────────── Tier 4 — Inferno Sage (lv 40) ─────────────────────────
  {
    id: 'fire_inferno_lance', name: 'Inferno Lance', job: 'inferno_sage', element: 'fire', kind: 'attack', maxLevel: 20,
    description: 'Fire a piercing lance of white-hot flame that sears everything in a long line three times.',
    icon: icon('meteor', 0xfff0a0, 0xff3a0c), requires: [{ skillId: 'fire_orb', level: 10 }],
    mpCost: Li(46, 70, 20), castTimeMs: 500, sfx: 'cast_fire',
    attack: {
      pattern: 'beam', damagePct: L(130, 205, 20), hits: K(3), maxTargets: K(6), range: 540,
      area: { w: 540, h: 90 }, delayMs: 150, hitIntervalMs: 85,
      status: burn(20, [0.45, 0.7], [4000, 6000], [12, 20]),
      vfx: { cast: 'fire_lance_cast', area: 'fire_lance_beam', hit: 'fire_hit' },
    },
  },
  {
    id: 'fire_meteor_storm', name: 'Meteor Storm', job: 'inferno_sage', element: 'fire', kind: 'attack', maxLevel: 10,
    description: 'Tear open the sky: a barrage of meteors crashes down ahead of you, each one a devastating blast.',
    icon: icon('meteor', 0xffe27a, 0xe8421a),
    requires: [{ skillId: 'fire_inferno_lance', level: 5 }, { skillId: 'fire_pillar', level: 10 }],
    mpCost: Li(70, 90, 10), cooldownMs: L(50000, 38000, 10), castTimeMs: 800, sfx: 'explosion',
    attack: {
      pattern: 'rain', damagePct: L(800, 1300, 10), hits: K(1), maxTargets: K(5), range: 460,
      area: { w: 200, h: 130 }, delayMs: 600,
      projectile: { speed: 950, radius: 20 },
      rain: { count: (lv) => 8 + Math.floor(lv / 2), spreadX: 520, intervalMs: 200, fallHeight: 560 },
      status: burn(10, [0.7, 0.9], [4000, 6000], [5, 7]),
      vfx: { cast: 'fire_meteor_cast', projectile: 'fire_meteor_proj', area: 'fire_meteor_impact', hit: 'fire_hit_big' },
    },
  },
  {
    id: 'fire_phoenix', name: 'Summon Phoenix', job: 'inferno_sage', element: 'fire', kind: 'summon', maxLevel: 10,
    description: 'A phoenix circles you and hurls piercing fire bolts at enemies in front of it.',
    icon: icon('phoenix', 0xffe27a, 0xff4a10), requires: [{ skillId: 'fire_salamander', level: 8 }],
    mpCost: Li(60, 85, 10), cooldownMs: L(80000, 60000, 10), castTimeMs: 700, sfx: 'cast_fire',
    summon: {
      durationMs: L(30000, 50000, 10), attackIntervalMs: 800, offset: { x: -34, y: -96 }, follow: true, vfx: 'fire_phoenix',
      attack: {
        pattern: 'projectile', damagePct: L(250, 380, 10), hits: K(1), maxTargets: K(4), range: 520,
        projectile: { speed: 600, radius: 16, pierce: true },
        status: burn(10, [0.5, 0.7], [4000, 5000], [14, 18]),
        vfx: { cast: 'fire_spit_cast', projectile: 'fire_phoenix_bolt', hit: 'fire_hit' },
      },
    },
  },
  {
    id: 'fire_ascension', name: 'Infernal Ascension', job: 'inferno_sage', element: 'fire', kind: 'buff', maxLevel: 15,
    description: 'Wreathe yourself in fire wings: cast faster and deal more damage with every spell.',
    icon: icon('phoenix', 0xffffff, 0xff7a1a), requires: [{ skillId: 'fire_kindle', level: 10 }],
    mpCost: Li(50, 70, 15), cooldownMs: L(120000, 90000, 15), castTimeMs: 600, sfx: 'buff',
    buff: {
      durationMs: L(30000, 45000, 15),
      modifiers: (lv) => [
        { stat: 'castSpeed', add: L(0.12, 0.25, 15)(lv) },
        { stat: 'dmgAll', add: L(0.08, 0.2, 15)(lv) },
      ],
      vfx: 'fire_ascension_cast', auraVfx: 'fire_ascension_aura',
    },
  },
  {
    id: 'fire_inferno_heart', name: 'Heart of the Inferno', job: 'inferno_sage', element: 'fire', kind: 'passive', maxLevel: 15,
    description: 'Permanently increases critical rate and critical damage.',
    icon: icon('ember', 0xff4a10, 0xffd84a), requires: [{ skillId: 'fire_pyre_mastery', level: 10 }],
    mpCost: K(0),
    passive: (lv) => [{ stat: 'critRate', add: 0.012 * lv }, { stat: 'critDmg', add: 0.035 * lv }],
  },
];
