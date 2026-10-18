// Shadow: Occultist → Necromancer → Umbral Sage. Attrition, curses, minions and life drain.
import type { AttackSpec, IconSpec, SkillDef, StatusSpec } from '../core/types';
import { playVfx } from '../core/vfx';

/** Clamped interpolation across learned levels; percentages are per hit line. */
const L = (a: number, b: number, max: number) => (lv: number) =>
  a + (b - a) * (Math.min(max, Math.max(1, lv)) - 1) / (max - 1);
const Li = (a: number, b: number, max: number) => { const f = L(a, b, max); return (lv: number) => Math.round(f(lv)); };
const K = (n: number) => () => n;
const icon = (glyph: IconSpec['glyph'], color = 0xb48cff, color2 = 0x9dce69): IconSpec =>
  ({ glyph, color, color2, bg: 0x171020 });

/** Poison potency is % of the first hit per 500ms tick, not a fractional multiplier. */
const poison = (max: number, chance: [number, number], duration: [number, number], potency: [number, number]): StatusSpec => ({
  kind: 'poison', chance: L(...chance, max), durationMs: Li(...duration, max), potency: L(...potency, max),
});
const curse = (max: number, duration: [number, number], potency: [number, number]): StatusSpec => ({
  kind: 'curse', chance: K(1), durationMs: Li(...duration, max), potency: L(...potency, max),
});

// Shared by the data/UI and onCast: one narrow, immediate strike, never a second default attack.
const SOUL_DRAIN: AttackSpec = {
  pattern: 'beam', damagePct: L(225, 315, 20), hits: K(1), maxTargets: K(1), range: 350,
  area: { w: 350, h: 56, offsetX: 0 },
  vfx: { cast: 'shd_cast', area: 'shd_drain_beam', hit: 'shd_drain_hit' },
};

export const SHADOW_SKILLS: SkillDef[] = [
  // Tier 2 — Occultist, level 10.
  {
    id: 'shd_shadow_bolt', name: 'Shadow Bolt', job: 'occultist', element: 'shadow', kind: 'attack', maxLevel: 20,
    description: 'Hurl a venomous shadow bolt that poisons a single foe.',
    icon: icon('orb'), mpCost: Li(14, 22, 20), castTimeMs: 380, sfx: 'cast_shadow',
    attack: {
      pattern: 'projectile', damagePct: L(158, 242, 20), hits: K(1), maxTargets: K(1), range: 560,
      projectile: { speed: 620, radius: 13 },
      status: poison(20, [0.4, 0.7], [3000, 5000], [8, 14]),
      vfx: { cast: 'shd_cast', projectile: 'shd_bolt_proj', hit: 'shd_hit' },
    },
  },
  {
    id: 'shd_hex', name: 'Hex', job: 'occultist', element: 'shadow', kind: 'attack', maxLevel: 15,
    description: 'Curse nearby foes around your target, amplifying damage taken and weakening their touch.',
    icon: icon('eye'), requires: [{ skillId: 'shd_shadow_bolt', level: 3 }],
    mpCost: Li(18, 26, 15), cooldownMs: Li(6500, 5500, 15), castTimeMs: 420, sfx: 'curse',
    attack: {
      pattern: 'aoe_target', damagePct: L(60, 100, 15), hits: K(1), maxTargets: K(6), range: 380,
      area: { w: 230, h: 160, offsetX: 0 }, delayMs: 180,
      status: curse(15, [6000, 9000], [0.12, 0.24]),
      vfx: { cast: 'shd_cast', area: 'shd_hex_area', hit: 'shd_curse_hit' },
    },
  },
  {
    id: 'shd_dark_pact', name: 'Dark Pact', job: 'occultist', element: 'shadow', kind: 'buff', maxLevel: 15,
    description: 'Bind forbidden power to your staff, increasing magic attack and shadow damage.',
    icon: icon('book'), requires: [{ skillId: 'shd_shadow_bolt', level: 5 }],
    mpCost: Li(18, 28, 15), cooldownMs: K(4000), castTimeMs: 500, sfx: 'buff',
    buff: {
      durationMs: Li(90000, 180000, 15),
      modifiers: (lv) => [{ stat: 'matk', mul: L(0.05, 0.15, 15)(lv) }, { stat: 'dmgShadow', add: L(0.08, 0.2, 15)(lv) }],
      vfx: 'shd_pact_cast', auraVfx: 'shd_pact_aura',
    },
  },
  {
    id: 'shd_umbral_focus', name: 'Umbral Focus', job: 'occultist', element: 'shadow', kind: 'passive', maxLevel: 15,
    description: 'Permanently increase shadow damage and mana regeneration.',
    icon: icon('eye', 0x9dce69), requires: [{ skillId: 'shd_shadow_bolt', level: 3 }], mpCost: K(0),
    passive: (lv) => [{ stat: 'dmgShadow', add: L(0.015, 0.225, 15)(lv) }, { stat: 'mpRegen', add: L(2, 30, 15)(lv) }],
  },
  // Tier 3 — Necromancer, level 25.
  {
    id: 'shd_soul_drain', name: 'Soul Drain', job: 'necromancer', element: 'shadow', kind: 'attack', maxLevel: 20,
    description: 'Tear at one soul in front of you and restore 3–6% of your maximum HP on cast.',
    icon: icon('ghost'), requires: [{ skillId: 'shd_shadow_bolt', level: 10 }],
    mpCost: Li(28, 42, 20), cooldownMs: Li(5500, 4000, 20), castTimeMs: 480, sfx: 'cast_shadow',
    attack: SOUL_DRAIN,
    onCast: (ctx, lv) => {
      const { player, progression, combat } = ctx.services;
      const { x, y, facing } = player;
      ctx.runAttack(SOUL_DRAIN, { x: x + 18 * facing, y: y - 34, facing });
      const requested = Math.max(1, Math.round(progression.derived().maxHp * L(0.03, 0.06, 20)(lv)));
      const before = progression.state.hp;
      progression.heal(requested, 0);
      const healed = Math.max(0, progression.state.hp - before);
      combat.showNumber(x, y - 62, healed, 'heal');
      playVfx(ctx.scene, 'shd_drain_heal', { x, y, facing, lv });
    },
  },
  {
    id: 'shd_plague_cloud', name: 'Plague Cloud', job: 'necromancer', element: 'shadow', kind: 'attack', maxLevel: 15,
    description: 'Drown a target area in lingering plague, striking three times and leaving poison.',
    icon: icon('poison', 0x9dce69), requires: [{ skillId: 'shd_hex', level: 8 }],
    mpCost: Li(30, 44, 15), cooldownMs: Li(7000, 5000, 15), castTimeMs: 520, sfx: 'cast_shadow',
    attack: {
      pattern: 'aoe_target', damagePct: L(135, 205, 15), hits: K(3), maxTargets: K(8), range: 380,
      area: { w: 280, h: 170, offsetX: 0 }, delayMs: 240, hitIntervalMs: 500,
      status: poison(15, [0.7, 1], [5000, 7000], [12, 18]),
      vfx: { cast: 'shd_cast', area: 'shd_plague_area', hit: 'shd_hit' },
    },
  },
  {
    id: 'shd_raise_skeleton', name: 'Raise Skeleton', job: 'necromancer', element: 'shadow', kind: 'summon', maxLevel: 15,
    description: 'Raise a stationary skeletal sentinel that cleaves nearby foes with a bone blade.',
    icon: icon('skull', 0xdde6ba), requires: [{ skillId: 'shd_soul_drain', level: 5 }],
    mpCost: Li(32, 45, 15), cooldownMs: Li(50000, 42000, 15), castTimeMs: 600, sfx: 'cast_shadow',
    summon: {
      durationMs: Li(25000, 40000, 15), attackIntervalMs: 1200, offset: { x: 64, y: -28 }, follow: false, vfx: 'shd_skeleton',
      attack: {
        pattern: 'melee_arc', damagePct: L(140, 215, 15), hits: K(1), maxTargets: K(3), range: 150,
        area: { w: 150, h: 100, offsetX: 70 }, delayMs: 100,
        vfx: { area: 'shd_bone_arc', hit: 'shd_hit' },
      },
    },
  },
  {
    id: 'shd_wither', name: 'Wither', job: 'necromancer', element: 'shadow', kind: 'attack', maxLevel: 15,
    description: 'Send a thin ribbon of decay through foes, renewing a powerful curse.',
    icon: icon('claw'), requires: [{ skillId: 'shd_hex', level: 5 }],
    mpCost: Li(28, 40, 15), cooldownMs: Li(7000, 5000, 15), castTimeMs: 460, sfx: 'curse',
    attack: {
      pattern: 'beam', damagePct: L(180, 280, 15), hits: K(1), maxTargets: K(6), range: 500,
      area: { w: 500, h: 70, offsetX: 0 }, delayMs: 140,
      status: curse(15, [7000, 10000], [0.18, 0.3]),
      vfx: { cast: 'shd_cast', area: 'shd_wither_beam', hit: 'shd_curse_hit' },
    },
  },
  {
    id: 'shd_necrotic_mastery', name: 'Necrotic Mastery', job: 'necromancer', element: 'shadow', kind: 'passive', maxLevel: 15,
    description: 'Deepen your shadow damage and bring every spell closer to its maximum damage.',
    icon: icon('book'), requires: [{ skillId: 'shd_umbral_focus', level: 5 }], mpCost: K(0),
    passive: (lv) => [{ stat: 'dmgShadow', add: L(0.02, 0.3, 15)(lv) }, { stat: 'mastery', add: L(0.012, 0.18, 15)(lv) }],
  },
  // Tier 4 — Umbral Sage, level 40.
  {
    id: 'shd_death_scythe', name: 'Death Scythe', job: 'umbral_sage', element: 'shadow', kind: 'attack', maxLevel: 20,
    description: 'Reap foes three times with a spectral scythe; cursed targets take 1.6× damage without losing their curse.',
    icon: icon('scythe'), requires: [{ skillId: 'shd_soul_drain', level: 10 }, { skillId: 'shd_wither', level: 5 }],
    mpCost: Li(46, 68, 20), castTimeMs: 500, sfx: 'whoosh',
    attack: {
      pattern: 'melee_arc', damagePct: L(120, 190, 20), hits: K(3), maxTargets: K(6), range: 300,
      area: { w: 300, h: 150, offsetX: 150 }, delayMs: 150, hitIntervalMs: 85,
      bonusVs: { status: 'curse', mult: 1.6, consume: false },
      vfx: { cast: 'shd_cast', area: 'shd_scythe_arc', hit: 'shd_hit' },
    },
  },
  {
    id: 'shd_night_tide', name: 'Night Tide', job: 'umbral_sage', element: 'shadow', kind: 'attack', maxLevel: 10,
    description: 'Open the night above a wide field and rain down enormous shadow scythes that spread poison.',
    icon: icon('scythe', 0x9dce69, 0xb48cff),
    requires: [{ skillId: 'shd_death_scythe', level: 5 }, { skillId: 'shd_plague_cloud', level: 10 }],
    mpCost: Li(72, 90, 10), cooldownMs: Li(55000, 45000, 10), castTimeMs: 800, sfx: 'cast_shadow',
    attack: {
      pattern: 'rain', damagePct: L(740, 1200, 10), hits: K(1), maxTargets: K(5), range: 560,
      area: { w: 190, h: 160, offsetX: 270 }, delayMs: 600,
      projectile: { speed: 950, radius: 20 },
      rain: { count: (lv) => 8 + Math.floor(Math.min(10, Math.max(1, lv)) / 2), spreadX: 540, intervalMs: 200, fallHeight: 540 },
      status: poison(10, [0.75, 0.95], [4000, 6000], [5, 7]),
      vfx: { cast: 'shd_tide_cast', projectile: 'shd_tide_proj', area: 'shd_tide_impact', hit: 'shd_hit' },
    },
  },
  {
    id: 'shd_lich_shade', name: 'Lich Shade', job: 'umbral_sage', element: 'shadow', kind: 'summon', maxLevel: 15,
    description: 'Call a towering lich shade that follows you and fires piercing, curse-bearing shadow bolts.',
    icon: icon('ghost', 0x9dce69), requires: [{ skillId: 'shd_raise_skeleton', level: 8 }],
    mpCost: Li(60, 85, 15), cooldownMs: Li(80000, 60000, 15), castTimeMs: 700, sfx: 'cast_shadow',
    summon: {
      durationMs: Li(30000, 45000, 15), attackIntervalMs: 1400, offset: { x: -42, y: -82 }, follow: true, vfx: 'shd_lich',
      attack: {
        pattern: 'projectile', damagePct: L(185, 280, 15), hits: K(1), maxTargets: K(3), range: 540,
        projectile: { speed: 580, radius: 16, pierce: true },
        status: curse(15, [4000, 6000], [0.12, 0.22]),
        vfx: { cast: 'shd_cast', projectile: 'shd_lich_bolt', hit: 'shd_curse_hit' },
      },
    },
  },
  {
    id: 'shd_veil_of_night', name: 'Veil of Night', job: 'umbral_sage', element: 'shadow', kind: 'buff', maxLevel: 15,
    description: 'Draw night around yourself, briefly casting faster and increasing all spell damage.',
    icon: icon('eye'), requires: [{ skillId: 'shd_dark_pact', level: 10 }],
    mpCost: Li(50, 70, 15), cooldownMs: K(60000), castTimeMs: 600, sfx: 'buff',
    buff: {
      durationMs: Li(30000, 45000, 15),
      modifiers: (lv) => [{ stat: 'castSpeed', add: L(0.12, 0.25, 15)(lv) }, { stat: 'dmgAll', add: L(0.05, 0.12, 15)(lv) }],
      vfx: 'shd_veil_cast', auraVfx: 'shd_veil_aura',
    },
  },
  {
    id: 'shd_grave_pact', name: 'Grave Pact', job: 'umbral_sage', element: 'shadow', kind: 'passive', maxLevel: 15,
    description: 'Permanently increase critical damage and reduce skill cooldowns.',
    icon: icon('skull'), requires: [{ skillId: 'shd_necrotic_mastery', level: 10 }], mpCost: K(0),
    passive: (lv) => [{ stat: 'critDmg', add: L(0.03, 0.45, 15)(lv) }, { stat: 'cdr', add: L(0.006, 0.09, 15)(lv) }],
  },
];
