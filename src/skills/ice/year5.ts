/** Year 5 "Fellowship" (postgraduate) Ice spells for Winter Archon. Eight spells, all requiring tier-4 Ice only.
 * Persistent effects are engine-owned summons / buff auras (they end on map change, death and shutdown).
 */
import { playVfx } from '../../core/vfx';
import type { IconSpec, SkillContext, SkillDef, StatusSpec } from '../../core/types';

const lerp = (lo: number, hi: number, max: number) => (lv: number) =>
  lo + ((hi - lo) * (Math.min(Math.max(lv, 1), max) - 1)) / Math.max(1, max - 1);
const lerpR = (lo: number, hi: number, max: number) => {
  const f = lerp(lo, hi, max);
  return (lv: number) => Math.round(f(lv));
};

const BG = 0x0a2744;
const icon = (glyph: IconSpec['glyph'], color = 0x8fe3ff, color2 = 0xffffff): IconSpec => ({ glyph, color, color2, bg: BG });

const chill = (chance: [number, number], dur: [number, number], slow: [number, number], max: number): StatusSpec => ({
  kind: 'chill', chance: lerp(chance[0], chance[1], max), durationMs: lerpR(dur[0], dur[1], max), potency: lerp(slow[0], slow[1], max),
});
const freeze = (chance: [number, number], dur: [number, number], max: number): StatusSpec => ({
  kind: 'freeze', chance: lerp(chance[0], chance[1], max), durationMs: lerpR(dur[0], dur[1], max), potency: () => 0,
});

const J = 'winter_archon' as const;

// 1. Big AoE: two crushing waves across the whole screen width.
const borealCataclysm: SkillDef = {
  id: 'ice_boreal_cataclysm', name: 'Boreal Cataclysm',
  description: 'Call two crushing waves of glacial ice across a vast field, chilling and freezing everything caught.',
  element: 'ice', job: J, kind: 'attack', maxLevel: 15,
  icon: icon('glacier', 0xe8fbff, 0x4a9fe8), requires: [{ skillId: 'ice_blizzard', level: 5 }],
  mpCost: lerpR(90, 115, 15), cooldownMs: lerpR(14000, 10000, 15), castTimeMs: 720, sfx: 'freeze',
  attack: {
    pattern: 'aoe_self', damagePct: lerp(260, 340, 15), hits: () => 2, hitIntervalMs: 260,
    maxTargets: lv => 10 + Math.floor(lv / 3), range: 0, area: { w: 900, h: 380 },
    status: freeze([0.3, 0.55], [1600, 2600], 15), knockback: 40, delayMs: 380,
    vfx: { cast: 'ice_boreal_cataclysm_cast', area: 'ice_boreal_cataclysm_area', hit: 'ice_hit' },
  },
};

// 2. Big single-target: one piercing judgment bolt, chills.
const polarJudgment: SkillDef = {
  id: 'ice_polar_judgment', name: 'Polar Judgment',
  description: 'Hurl a single colossal lance of polar ice at one enemy for devastating damage, deeply chilling it.',
  element: 'ice', job: J, kind: 'attack', maxLevel: 15,
  icon: icon('icicle', 0xffffff, 0x3f8fe0), requires: [{ skillId: 'ice_glacial_lance', level: 8 }],
  mpCost: lerpR(70, 95, 15), cooldownMs: lerpR(4500, 3000, 15), castTimeMs: 560, sfx: 'cast_ice',
  attack: {
    pattern: 'projectile', damagePct: lerp(680, 950, 15), hits: () => 1, maxTargets: () => 1, range: 760,
    projectile: { speed: 1000, radius: 16 },
    status: chill([1, 1], [4000, 6500], [0.5, 0.7], 15),
    vfx: { cast: 'ice_cast_rune', projectile: 'ice_polar_judgment_proj', hit: 'ice_polar_judgment_hit' },
  },
};

// 3. Fellowship ultimate: a five-pulse winter that never lifts.
const eternalWinter: SkillDef = {
  id: 'ice_eternal_winter', name: 'Eternal Winter',
  description: 'Ultimate: the Fellowship’s winter descends. Five freezing pulses hammer the whole field, hurting chilled enemies even more.',
  element: 'ice', job: J, kind: 'attack', maxLevel: 10,
  icon: icon('blizzard', 0xffffff, 0x6fb6ff), requires: [{ skillId: 'ice_absolute_zero', level: 3 }],
  mpCost: lerpR(120, 150, 10), cooldownMs: lerpR(120000, 95000, 10), castTimeMs: 1000, sfx: 'shatter',
  attack: {
    pattern: 'aoe_self', damagePct: lerp(300, 480, 10), hits: () => 5, hitIntervalMs: 190,
    maxTargets: () => 15, range: 0, area: { w: 1100, h: 460 },
    bonusVs: { status: 'chill', mult: 1.25 },
    status: freeze([0.4, 0.7], [1800, 3000], 10), knockback: 60, delayMs: 700,
    vfx: { cast: 'ice_eternal_winter_cast', area: 'ice_eternal_winter_area', hit: 'ice_eternal_winter_hit' },
  },
};

// 4. Field: a stationary spire that pulses a tall column of frost.
const auroraSpire: SkillDef = {
  id: 'ice_aurora_spire', name: 'Aurora Spire',
  description: 'Raise an aurora-lit spire that lashes tall columns of frost at enemies near it, chilling them.',
  element: 'ice', job: J, kind: 'summon', maxLevel: 12,
  icon: icon('glacier', 0xb5f2ff, 0xffffff), requires: [{ skillId: 'ice_frozen_orb', level: 3 }],
  mpCost: lerpR(75, 95, 12), cooldownMs: lerpR(45000, 35000, 12), castTimeMs: 650, sfx: 'freeze',
  summon: {
    durationMs: lerpR(18000, 28000, 12), attackIntervalMs: 800, offset: { x: 110, y: -40 }, follow: false,
    vfx: 'ice_aurora_spire_body',
    attack: {
      pattern: 'aoe_self', damagePct: lerp(190, 290, 12), hits: () => 1, maxTargets: lv => 5 + Math.floor(lv / 3),
      range: 0, area: { w: 300, h: 540 },
      status: chill([0.8, 1], [3000, 5000], [0.4, 0.6], 12),
      vfx: { hit: 'ice_hit', area: 'ice_aurora_spire_pulse' },
    },
  },
};

// 5. Combo payoff: shatters freeze for double damage.
const cryoclasm: SkillDef = {
  id: 'ice_cryoclasm', name: 'Cryoclasm',
  description: 'Detonate the frozen: enemies that are frozen take double damage and the freeze is consumed.',
  element: 'ice', job: J, kind: 'attack', maxLevel: 15,
  icon: icon('ice_shard', 0xffffff, 0x58a6e6), requires: [{ skillId: 'ice_diamond_reckoning', level: 3 }],
  mpCost: lerpR(65, 85, 15), cooldownMs: lerpR(10000, 7000, 15), castTimeMs: 520, sfx: 'shatter',
  attack: {
    pattern: 'aoe_self', damagePct: lerp(380, 520, 15), hits: () => 1, maxTargets: lv => 8 + Math.floor(lv / 5),
    range: 0, area: { w: 660, h: 280 }, bonusVs: { status: 'freeze', mult: 2, consume: true }, knockback: 20, delayMs: 200,
    vfx: { cast: 'ice_cast_rune', area: 'ice_cryoclasm_area', hit: 'ice_cryoclasm_hit' },
  },
};

// 6. Defensive buff.
const polarAegis: SkillDef = {
  id: 'ice_polar_aegis', name: 'Polar Aegis',
  description: 'Don the Archon’s aegis: greatly raises defense, diverts damage to MP, and quickens HP recovery.',
  element: 'ice', job: J, kind: 'buff', maxLevel: 15,
  icon: icon('shield', 0xffffff, 0x4f9fe0), requires: [{ skillId: 'ice_diamond_barrier', level: 5 }],
  mpCost: lerpR(70, 90, 15), cooldownMs: lerpR(45000, 35000, 15), castTimeMs: 450, sfx: 'buff',
  buff: {
    durationMs: lerpR(20000, 35000, 15),
    modifiers: lv => [
      { stat: 'def', add: Math.round(lerp(120, 230, 15)(lv)) },
      { stat: 'mpShield', add: lerp(0.2, 0.4, 15)(lv) },
      { stat: 'hpRegen', add: Math.round(lerp(40, 160, 15)(lv)) },
    ],
    vfx: 'ice_polar_aegis_cast', auraVfx: 'ice_polar_aegis_aura',
  },
};

// 7. Passive.
const hoarlightDoctrine: SkillDef = {
  id: 'ice_hoarlight_doctrine', name: 'Hoarlight Doctrine',
  description: 'Passive: Fellowship research deepens your winter. Increases ice damage, max MP and MP recovery.',
  element: 'ice', job: J, kind: 'passive', maxLevel: 10,
  icon: icon('gem', 0xe0fbff, 0x5aa8f0), requires: [{ skillId: 'ice_permafrost', level: 5 }],
  mpCost: () => 0,
  passive: lv => [
    { stat: 'dmgIce', add: 0.03 * lv },
    { stat: 'maxMp', mul: 0.02 * lv },
    { stat: 'mpRegen', add: 4 * lv },
  ],
};

// 8. Movement + damage: a whiteout dash that freezes everything along its path.
function castWhiteoutPassage(ctx: SkillContext, lv: number): void {
  const { player: p, progression } = ctx.services;
  if (progression.isDead() || p.state === 'dead' || !ctx.skill.attack || !ctx.skill.movement) return;
  const x = p.x, y = p.y, facing = p.facing;
  playVfx(ctx.scene, 'ice_whiteout_passage_out', { x, y, facing, lv });
  p.blink(facing * ctx.skill.movement.distance(lv), 0);
  const dist = Math.abs(p.x - x);
  if (dist < 2) return;
  playVfx(ctx.scene, 'ice_whiteout_passage_in', { x: p.x, y: p.y, facing, lv });
  // Use the real (clamped) path so walls and map edges shorten the strike zone too.
  ctx.runAttack({ ...ctx.skill.attack, area: { w: dist + 60, h: Math.abs(p.y - y) + 100 } }, {
    x: (x + p.x) / 2, y: (y + p.y) / 2 - 34, facing,
  });
}

const whiteoutPassage: SkillDef = {
  id: 'ice_whiteout_passage', name: 'Whiteout Passage',
  description: 'Vanish in a whiteout and reappear far ahead; every enemy along the path is struck and may be frozen.',
  element: 'ice', job: J, kind: 'movement', maxLevel: 10,
  icon: icon('teleport', 0xffffff, 0x70b8f0), requires: [{ skillId: 'ice_rime_recall', level: 3 }],
  mpCost: lerpR(40, 55, 10), cooldownMs: lerpR(9000, 6000, 10), castTimeMs: 200, sfx: 'blink',
  movement: { kind: 'blink', distance: lerpR(260, 400, 10), vfxOut: 'ice_whiteout_passage_out', vfxIn: 'ice_whiteout_passage_in' },
  attack: {
    pattern: 'aoe_self', damagePct: lerp(300, 440, 10), hits: () => 1, maxTargets: () => 8, range: 0,
    area: { w: 400, h: 180 }, status: freeze([0.4, 0.7], [1500, 2400], 10),
    vfx: { area: 'ice_whiteout_passage_trail', hit: 'ice_hit' },
  },
  onCast: castWhiteoutPassage,
};

export const ICE_Y5: SkillDef[] = [
  borealCataclysm, polarJudgment, eternalWinter, auroraSpire, cryoclasm, polarAegis, hoarlightDoctrine, whiteoutPassage,
];
