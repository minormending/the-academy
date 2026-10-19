// Shadow: Occultist → Necromancer → Umbral Sage. Attrition, curses, minions and life drain.
import type { AttackSpec, IconSpec, SkillContext, SkillDef, StatusSpec } from '../core/types';
import { playVfx } from '../core/vfx';
import { SHADOW_SPELLBOOK_ADDITIONS } from './shadow/spellbook';
import { SHADOW_Y5 } from './shadow/year5';

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

/** Keep the passive visual tied to a real cast, without adding stat-side effects or scene listeners. */
function castDreadPulse(ctx: SkillContext, lv: number): void {
  const { player, progression } = ctx.services;
  const { x, y, facing } = player;
  if (ctx.skill.attack) ctx.runAttack(ctx.skill.attack, { x, y: y - 34, facing });
  if ((progression.state.skills.shd_grave_skin ?? 0) > 0) {
    playVfx(ctx.scene, 'shd_grave_skin', { x, y, facing, lv });
  }
}

export const SHADOW_SKILLS: SkillDef[] = [
  // Year 2 — three roots: Shadow Bolt, Dread Pulse, Shadow Step.
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
  {
    id: 'shd_grave_link', name: 'Grave Link', job: 'occultist', element: 'shadow', kind: 'attack', maxLevel: 15,
    description: 'Link scattered foes with a crawling curse that weakens each enemy it reaches.',
    icon: icon('chain'), requires: [{ skillId: 'shd_shadow_bolt', level: 3 }],
    mpCost: Li(16, 25, 15), cooldownMs: Li(6000, 4500, 15), castTimeMs: 420, sfx: 'curse',
    attack: {
      pattern: 'chain', damagePct: L(85, 130, 15), hits: K(1), maxTargets: K(4), range: 360,
      chain: { jumpRange: 180, jumpDelayMs: 140 },
      status: curse(15, [3000, 4500], [0.06, 0.12]),
      vfx: { cast: 'shd_cast', area: 'shd_grave_link', hit: 'shd_curse_hit' },
    },
  },
  {
    id: 'shd_dread_pulse', name: 'Dread Pulse', job: 'occultist', element: 'shadow', kind: 'attack', maxLevel: 15,
    description: 'Repel surrounding foes with a pulse of dread that slows their pursuit.',
    icon: icon('skull'), mpCost: Li(18, 28, 15), cooldownMs: Li(8000, 6000, 15), castTimeMs: 400, sfx: 'cast_shadow',
    attack: {
      pattern: 'aoe_self', damagePct: L(80, 120, 15), hits: K(1), maxTargets: K(5), range: 150,
      area: { w: 300, h: 160, offsetX: 0 }, delayMs: 150, knockback: 80,
      status: { kind: 'chill', chance: K(1), durationMs: Li(2000, 3000, 15), potency: L(0.3, 0.55, 15) },
      vfx: { cast: 'shd_cast', area: 'shd_dread_pulse', hit: 'shd_hit' },
    },
    onCast: castDreadPulse,
  },
  {
    id: 'shd_shadow_step', name: 'Shadow Step', job: 'occultist', element: 'shadow', kind: 'movement', maxLevel: 15,
    description: 'Dissolve into a shadow and blink in your chosen direction.',
    icon: icon('teleport'), mpCost: Li(14, 20, 15), cooldownMs: Li(5000, 3500, 15), castTimeMs: 140, sfx: 'blink',
    movement: { kind: 'blink', distance: Li(140, 240, 15), vfxOut: 'shd_step_out', vfxIn: 'shd_step_in' },
  },
  {
    id: 'shd_grave_skin', name: 'Grave Skin', job: 'occultist', element: 'shadow', kind: 'passive', maxLevel: 15,
    description: 'Harden your flesh with grave magic, increasing maximum HP and defense.',
    icon: icon('bone', 0xdde6ba), requires: [{ skillId: 'shd_shadow_step', level: 3 }], mpCost: K(0), sfx: 'buff',
    passive: lv => [{ stat: 'maxHp', mul: L(0.02, 0.15, 15)(lv) }, { stat: 'def', add: Li(2, 20, 15)(lv) }],
  },
  // Year 3 — three roots: Soul Drain, Plague Cloud, Haunt Wraith.
  {
    id: 'shd_soul_drain', name: 'Soul Drain', job: 'necromancer', element: 'shadow', kind: 'attack', maxLevel: 20,
    description: 'Tear at one soul in front of you and restore 3–6% of your maximum HP on cast.',
    icon: icon('ghost'),
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
    icon: icon('poison', 0x9dce69),
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
    icon: icon('claw'), requires: [{ skillId: 'shd_plague_cloud', level: 3 }],
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
    icon: icon('book'), requires: [{ skillId: 'shd_soul_drain', level: 3 }], mpCost: K(0),
    passive: (lv) => [{ stat: 'dmgShadow', add: L(0.02, 0.3, 15)(lv) }, { stat: 'mastery', add: L(0.012, 0.18, 15)(lv) }],
  },
  {
    id: 'shd_grave_chains', name: 'Grave Chains', job: 'necromancer', element: 'shadow', kind: 'attack', maxLevel: 15,
    description: 'Snap spectral shackles between foes to interrupt a scattered pack.',
    icon: icon('chain', 0xdde6ba), requires: [{ skillId: 'shd_plague_cloud', level: 3 }],
    mpCost: Li(26, 40, 15), cooldownMs: Li(9500, 7000, 15), castTimeMs: 460, sfx: 'curse',
    attack: {
      pattern: 'chain', damagePct: L(140, 200, 15), hits: K(1), maxTargets: K(5), range: 420,
      chain: { jumpRange: 210, jumpDelayMs: 110 },
      status: { kind: 'stun', chance: K(1), durationMs: Li(700, 1200, 15), potency: K(0) },
      vfx: { cast: 'shd_cast', area: 'shd_grave_chains', hit: 'shd_shackle_hit' },
    },
  },
  {
    id: 'shd_bone_ward', name: 'Bone Ward', job: 'necromancer', element: 'shadow', kind: 'buff', maxLevel: 15,
    description: 'Orbit protective bones around yourself, increasing defense and diverting damage to mana.',
    icon: icon('shield', 0xdde6ba), requires: [{ skillId: 'shd_haunt_wraith', level: 3 }],
    mpCost: Li(28, 42, 15), cooldownMs: K(60000), castTimeMs: 500, sfx: 'buff',
    buff: {
      durationMs: Li(25000, 45000, 15),
      modifiers: lv => [{ stat: 'def', add: Li(15, 35, 15)(lv) }, { stat: 'mpShield', add: L(0.1, 0.22, 15)(lv) }],
      vfx: 'shd_ward_cast', auraVfx: 'shd_ward_aura',
    },
  },
  {
    id: 'shd_haunt_wraith', name: 'Haunt Wraith', job: 'necromancer', element: 'shadow', kind: 'summon', maxLevel: 15,
    description: 'Bind a following wraith that breathes piercing plague wisps through foes.',
    icon: icon('ghost'), mpCost: Li(30, 45, 15), cooldownMs: Li(50000, 40000, 15), castTimeMs: 600, sfx: 'cast_shadow',
    summon: {
      durationMs: Li(20000, 30000, 15), attackIntervalMs: 1800, offset: { x: -48, y: -44 }, follow: true, vfx: 'shd_wraith',
      attack: {
        pattern: 'projectile', damagePct: L(140, 210, 15), hits: K(1), maxTargets: K(3), range: 440,
        projectile: { speed: 430, radius: 12, pierce: true },
        status: poison(15, [0.7, 1], [3500, 5000], [10, 16]),
        vfx: { projectile: 'shd_wraith_wisp', hit: 'shd_wraith_hit' },
      },
    },
  },
  // Year 4 — three roots: Death Scythe, Lich Shade, Veil of Night.
  {
    id: 'shd_death_scythe', name: 'Death Scythe', job: 'umbral_sage', element: 'shadow', kind: 'attack', maxLevel: 20,
    description: 'Reap foes three times with a spectral scythe; cursed targets take 1.6× damage without losing their curse.',
    icon: icon('scythe'),
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
    requires: [{ skillId: 'shd_death_scythe', level: 5 }],
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
    icon: icon('ghost', 0x9dce69),
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
    icon: icon('eye'),
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
    icon: icon('skull'), requires: [{ skillId: 'shd_veil_of_night', level: 3 }], mpCost: K(0),
    passive: (lv) => [{ stat: 'critDmg', add: L(0.03, 0.45, 15)(lv) }, { stat: 'cdr', add: L(0.006, 0.09, 15)(lv) }],
  },
  {
    id: 'shd_oblivion_lance', name: 'Oblivion Lance', job: 'umbral_sage', element: 'shadow', kind: 'attack', maxLevel: 20,
    description: 'Hurl a condensed lance into one foe, dealing extra damage to poisoned targets without consuming poison.',
    icon: icon('missile'), requires: [{ skillId: 'shd_death_scythe', level: 3 }],
    mpCost: Li(45, 65, 20), cooldownMs: Li(6500, 5000, 20), castTimeMs: 520, sfx: 'cast_shadow',
    attack: {
      pattern: 'projectile', damagePct: L(340, 460, 20), hits: K(1), maxTargets: K(1), range: 650,
      projectile: { speed: 850, radius: 14 }, bonusVs: { status: 'poison', mult: 1.25, consume: false },
      vfx: { cast: 'shd_lance_cast', projectile: 'shd_lance_proj', hit: 'shd_lance_hit' },
    },
  },
  {
    id: 'shd_bone_dragon', name: 'Bone Dragon', job: 'umbral_sage', element: 'shadow', kind: 'summon', maxLevel: 10,
    description: 'Awaken an ancient bone dragon for a brief reign of curse-bearing breath.',
    icon: icon('skull', 0xdde6ba), requires: [{ skillId: 'shd_lich_shade', level: 5 }],
    mpCost: Li(75, 90, 10), cooldownMs: Li(120000, 100000, 10), castTimeMs: 900, sfx: 'cast_shadow',
    summon: {
      durationMs: Li(12000, 18000, 10), attackIntervalMs: 2400, offset: { x: -76, y: -58 }, follow: true, vfx: 'shd_dragon',
      attack: {
        pattern: 'beam', damagePct: L(520, 800, 10), hits: K(1), maxTargets: K(4), range: 580,
        area: { w: 580, h: 140, offsetX: 0, offsetY: 24 }, delayMs: 250,
        status: curse(10, [3500, 5000], [0.1, 0.15]),
        vfx: { cast: 'shd_dragon_charge', area: 'shd_dragon_breath', hit: 'shd_dragon_hit' },
      },
    },
  },
  {
    id: 'shd_soul_reservoir', name: 'Soul Reservoir', job: 'umbral_sage', element: 'shadow', kind: 'buff', maxLevel: 15,
    description: 'Release stored soul energy to recover a portion of your maximum HP and MP.',
    icon: icon('heart', 0x9dce69), requires: [{ skillId: 'shd_veil_of_night', level: 3 }],
    mpCost: K(45), cooldownMs: Li(45000, 30000, 15), castTimeMs: 650, sfx: 'heal',
    onCast: (ctx, lv) => {
      const { player, progression, combat } = ctx.services;
      const stats = progression.derived(), beforeHp = progression.state.hp;
      progression.heal(Math.round(stats.maxHp * L(0.08, 0.15, 15)(lv)), Math.round(stats.maxMp * L(0.04, 0.08, 15)(lv)));
      combat.showNumber(player.x, player.y - 62, Math.max(0, progression.state.hp - beforeHp), 'heal');
      playVfx(ctx.scene, 'shd_reservoir', { x: player.x, y: player.y, facing: player.facing, lv });
    },
  },
  ...SHADOW_SPELLBOOK_ADDITIONS,
  ...SHADOW_Y5,
];
