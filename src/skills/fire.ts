// OWNER: A3 (fire-tree). Pyromancer (Year 2) -> Flamebinder (Year 3) -> Inferno Sage (Year 4), 8 spells per Year.
// Identity: highest raw damage, burn DoT, explosions, big AoE, risk/reward (Overheat, Immolation).
import type { AttackSpec, IconSpec, SkillContext, SkillDef, StatusSpec } from '../core/types';
import { playVfx } from '../core/vfx';

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

// ───────────────────────── custom casts (onCast) ─────────────────────────

/** Flame Dash: blink in the held direction, then scorch everything along the path. */
const DASH_MAX = 10;
const dashDist = Li(150, 230, DASH_MAX);
const DASH_ATTACK: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(90, 140, DASH_MAX), hits: K(1), maxTargets: K(6), range: 230,
  area: { w: 230, h: 90 },
  status: burn(DASH_MAX, [0.4, 0.7], [3000, 4000], [10, 14]),
  vfx: { area: 'fire_dash_trail', hit: 'fire_hit' },
};

function castFlameDash(ctx: SkillContext, lv: number): void {
  const p = ctx.services.player;
  const aim = p.getAimDir();
  const dist = dashDist(lv);
  let dx = 0, dy = 0;
  if (aim.x !== 0) dx = aim.x * dist;
  else if (aim.y !== 0) dy = aim.y * dist;
  else dx = p.facing * dist;
  const ox = p.x, oy = p.y;
  playVfx(ctx.scene, 'fire_dash_out', { x: ox, y: oy, facing: p.facing, targetX: ox + dx, targetY: oy + dy, lv });
  p.blink(dx, dy);
  const nx = p.x, ny = p.y;
  playVfx(ctx.scene, 'fire_dash_in', { x: nx, y: ny, facing: p.facing, targetX: ox, targetY: oy, lv });
  const horiz = Math.abs(nx - ox) >= Math.abs(ny - oy);
  const f: 1 | -1 = horiz ? (nx >= ox ? 1 : -1) : p.facing;
  const area = horiz
    ? { w: Math.max(90, Math.abs(nx - ox) + 50), h: 90 }
    : { w: 90, h: Math.max(90, Math.abs(ny - oy) + 60) };
  // aoe_self centres on origin.x (body) — put it at the middle of the travelled path.
  ctx.runAttack({ ...DASH_ATTACK, area }, { x: (ox + nx) / 2, y: (oy + ny) / 2 - 34, facing: f });
}

/** Immolation: pay a slice of max HP (never lethal) to brand the nearest foes with three searing blasts. */
const IMMO_MAX = 20;
const IMMO_HP = 0.06;
const IMMOLATION: AttackSpec = {
  pattern: 'aoe_target', damagePct: L(260, 370, IMMO_MAX), hits: K(3), maxTargets: K(2), range: 360,
  area: { w: 150, h: 170 }, delayMs: 260, hitIntervalMs: 110,
  status: burn(IMMO_MAX, [0.8, 1], [4000, 6000], [14, 22]),
  vfx: { cast: 'fire_immolate_cast', area: 'fire_immolate_area', hit: 'fire_hit_big' },
};

function castImmolation(ctx: SkillContext, lv: number): void {
  const { player: p, progression: prog, combat } = ctx.services;
  const cost = Math.min(Math.round(prog.derived().maxHp * IMMO_HP), Math.max(0, Math.floor(prog.state.hp) - 1));
  if (cost > 0) {
    prog.loseHp(cost);
    combat.showNumber(p.x, p.y - 70, cost, 'player');
  }
  playVfx(ctx.scene, 'fire_immolate_self', { x: p.x, y: p.y, facing: p.facing, lv });
  ctx.runAttack(IMMOLATION, { x: p.x + 18 * p.facing, y: p.y - 34, facing: p.facing });
}

/** Cauterize: sear your wounds shut (heal % max HP) and scorch whatever crowds you. */
const CAUT_MAX = 10;
const cauterizePct = L(0.15, 0.3, CAUT_MAX);
const CAUTERIZE: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(150, 240, CAUT_MAX), hits: K(1), maxTargets: K(6), range: 120,
  area: { w: 240, h: 130, offsetY: 4 }, delayMs: 120,
  status: burn(CAUT_MAX, [0.5, 0.8], [3000, 4000], [10, 16]),
  vfx: { area: 'fire_cauterize_area', hit: 'fire_hit' },
};

function castCauterize(ctx: SkillContext, lv: number): void {
  const { player: p, progression: prog, combat } = ctx.services;
  const before = prog.state.hp;
  prog.heal(Math.max(1, Math.round(prog.derived().maxHp * cauterizePct(lv))), 0);
  const got = Math.round(prog.state.hp - before);
  playVfx(ctx.scene, 'fire_cauterize', { x: p.x, y: p.y, facing: p.facing, lv });
  if (got > 0) combat.showNumber(p.x, p.y - 72, got, 'heal');
  ctx.runAttack(CAUTERIZE, { x: p.x, y: p.y - 34, facing: p.facing });
}

export const FIRE_SKILLS: SkillDef[] = [
  // ───────────────────────── Year 2 — Pyromancer (lv 10) · roots: arrow, firebomb, flame dash ─────────────────────────
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
    id: 'fire_firebomb', name: 'Firebomb', job: 'pyromancer', element: 'fire', kind: 'attack', maxLevel: 15,
    description: 'Lob a molten bomb in an arc; it bursts on the first enemy or surface it touches, burning the crowd.',
    icon: icon('orb', 0xffb830, 0xc2321a), mpCost: Li(14, 24, 15), cooldownMs: L(2000, 1200, 15), castTimeMs: 420, sfx: 'cast_fire',
    attack: {
      pattern: 'projectile', damagePct: L(115, 165, 15), hits: K(1), maxTargets: K(6), range: 300,
      area: { w: 170, h: 120 },
      projectile: { speed: 430, radius: 12, gravity: 900, explodeArea: { w: 170, h: 120 } },
      status: burn(15, [0.35, 0.6], [3000, 4500], [10, 16]),
      vfx: { cast: 'fire_cast', projectile: 'fire_bomb_proj', hit: 'fire_hit', area: 'fire_bomb_area' },
    },
  },
  {
    id: 'fire_flame_dash', name: 'Flame Dash', job: 'pyromancer', element: 'fire', kind: 'movement', maxLevel: DASH_MAX,
    description: 'Burst forward (or up/down with the arrows) in a rush of fire, scorching every enemy along the path.',
    icon: icon('teleport', 0xffd84a, 0xe63a12), mpCost: Li(12, 20, DASH_MAX), cooldownMs: L(5000, 3000, DASH_MAX), castTimeMs: 150, sfx: 'whoosh',
    movement: { kind: 'blink', distance: dashDist, vfxOut: 'fire_dash_out', vfxIn: 'fire_dash_in' },
    attack: DASH_ATTACK,
    onCast: castFlameDash,
  },
  {
    id: 'fire_overheat', name: 'Overheat', job: 'pyromancer', element: 'fire', kind: 'buff', maxLevel: 10,
    description: 'Run dangerously hot: far more fire damage and critical rate, but your defense is halved while it lasts.',
    icon: icon('ember', 0xffffff, 0xe63a12), requires: [{ skillId: 'fire_firebomb', level: 3 }],
    mpCost: Li(16, 24, 10), cooldownMs: L(60000, 45000, 10), castTimeMs: 450, sfx: 'buff',
    buff: {
      durationMs: L(20000, 30000, 10),
      modifiers: (lv) => [
        { stat: 'dmgFire', add: L(0.15, 0.3, 10)(lv) },
        { stat: 'critRate', add: L(0.03, 0.08, 10)(lv) },
        { stat: 'def', mul: -0.5 },
      ],
      vfx: 'fire_overheat_cast', auraVfx: 'fire_overheat_aura',
    },
  },
  {
    id: 'fire_smolder', name: 'Smoldering Focus', job: 'pyromancer', element: 'fire', kind: 'passive', maxLevel: 15,
    description: 'Permanently increases fire damage and mana regeneration.',
    icon: icon('flame', 0xffb830, 0xc2321a), requires: [{ skillId: 'fire_arrow', level: 3 }],
    mpCost: K(0),
    passive: (lv) => [{ stat: 'dmgFire', add: 0.015 * lv }, { stat: 'mpRegen', add: 2 * lv }],
  },
  {
    id: 'fire_fleetflame', name: 'Fleetflame', job: 'pyromancer', element: 'fire', kind: 'passive', maxLevel: 10,
    description: 'Fire in your heels: permanently faster movement, higher jumps and quicker casting.',
    icon: icon('wind', 0xffd84a, 0xff7a1a), requires: [{ skillId: 'fire_flame_dash', level: 3 }],
    mpCost: K(0),
    passive: (lv) => [{ stat: 'speed', add: 2 * lv }, { stat: 'jump', add: 3 * lv }, { stat: 'castSpeed', add: 0.007 * lv }],
  },

  // ───────────────────────── Year 3 — Flamebinder (lv 25) · roots: orb, pillar, pyre mastery ─────────────────────────
  {
    id: 'fire_orb', name: 'Blazing Orb', job: 'flamebinder', element: 'fire', kind: 'attack', maxLevel: 20,
    description: 'Launch a fireball that detonates on impact, burning everything caught in the blast.',
    icon: icon('explosion', 0xffe27a, 0xff4a10), requires: [{ skillId: 'fire_arrow', level: 10 }],
    mpCost: Li(28, 42, 20), castTimeMs: 480, sfx: 'cast_fire',
    attack: {
      pattern: 'projectile', damagePct: L(285, 400, 20), hits: K(1), maxTargets: K(5), range: 620,
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
    id: 'fire_ember_volley', name: 'Ember Volley', job: 'flamebinder', element: 'fire', kind: 'attack', maxLevel: 20,
    description: 'Fan out a spray of ember darts (3, then 5 from level 11) that each strike a different foe.',
    icon: icon('missile', 0xffd84a, 0xe63a12), requires: [{ skillId: 'fire_orb', level: 3 }],
    mpCost: Li(24, 36, 20), castTimeMs: 440, sfx: 'cast_fire',
    attack: {
      pattern: 'projectile', damagePct: L(140, 200, 20), hits: K(1), maxTargets: K(1), range: 500,
      projectile: { speed: 700, radius: 12, count: (lv) => (lv >= 11 ? 5 : 3), spreadDeg: 8 },
      status: burn(20, [0.2, 0.4], [3000, 4000], [8, 12]),
      vfx: { cast: 'fire_volley_cast', projectile: 'fire_volley_proj', hit: 'fire_hit' },
    },
  },
  {
    id: 'fire_flame_wall', name: 'Wall of Fire', job: 'flamebinder', element: 'fire', kind: 'summon', maxLevel: 15,
    description: 'Raise a roaring wall of flame in front of you that keeps burning anything that touches it.',
    icon: icon('flame', 0xff9a2e, 0x9a1a0a), requires: [{ skillId: 'fire_pillar', level: 5 }],
    mpCost: Li(30, 42, 15), cooldownMs: L(16000, 12000, 15), castTimeMs: 520, sfx: 'cast_fire',
    summon: {
      durationMs: L(8000, 11000, 15), attackIntervalMs: 600, offset: { x: 90, y: 0 }, follow: false, vfx: 'fire_wall',
      attack: {
        pattern: 'aoe_self', damagePct: L(80, 120, 15), hits: K(1), maxTargets: K(8), range: 90,
        area: { w: 140, h: 150, offsetY: -60 },
        status: burn(15, [0.3, 0.5], [2000, 3000], [8, 12]),
        vfx: { area: 'fire_wall_pulse', hit: 'fire_hit' },
      },
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
  {
    id: 'fire_ember_ward', name: 'Ember Ward', job: 'flamebinder', element: 'fire', kind: 'buff', maxLevel: 10,
    description: 'Wrap yourself in a ring of embers: part of the damage you take burns away your MP instead, and defense rises.',
    icon: icon('shield', 0xffd84a, 0xe63a12), requires: [{ skillId: 'fire_pyre_mastery', level: 3 }],
    mpCost: Li(20, 30, 10), cooldownMs: K(4000), castTimeMs: 500, sfx: 'buff',
    buff: {
      durationMs: L(60000, 120000, 10),
      modifiers: (lv) => [{ stat: 'mpShield', add: L(0.08, 0.2, 10)(lv) }, { stat: 'def', add: Li(8, 30, 10)(lv) }],
      vfx: 'fire_ward_cast', auraVfx: 'fire_ward_aura',
    },
  },

  // ───────────────────────── Year 4 — Inferno Sage (lv 40) · ultimates: Meteor Storm, Supernova ─────────────────────────
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
    id: 'fire_supernova', name: 'Supernova', job: 'inferno_sage', element: 'fire', kind: 'attack', maxLevel: 10,
    description: 'Gather a star in your hands and let it go: a colossal blast around you that detonates every burn for 1.5x damage.',
    icon: icon('sunburst', 0xfff4d0, 0xff4a10), requires: [{ skillId: 'fire_combust', level: 10 }],
    mpCost: Li(75, 90, 10), cooldownMs: L(70000, 55000, 10), castTimeMs: 900, sfx: 'explosion',
    attack: {
      pattern: 'aoe_self', damagePct: L(380, 520, 10), hits: K(3), maxTargets: K(12), range: 300,
      area: { w: 600, h: 280, offsetY: -20 }, delayMs: 650, hitIntervalMs: 120, knockback: 60,
      bonusVs: { status: 'burn', mult: 1.5, consume: true },
      vfx: { cast: 'fire_supernova_cast', area: 'fire_supernova_area', hit: 'fire_hit_big' },
    },
  },
  {
    id: 'fire_immolation', name: 'Immolation', job: 'inferno_sage', element: 'fire', kind: 'attack', maxLevel: IMMO_MAX,
    description: 'Burn 6% of your own max HP to brand the two nearest foes with three searing blasts (never lethal to you).',
    icon: icon('skull', 0xffd84a, 0xe63a12), requires: [{ skillId: 'fire_inferno_lance', level: 3 }],
    mpCost: Li(40, 60, IMMO_MAX), cooldownMs: L(6000, 4500, IMMO_MAX), castTimeMs: 520, sfx: 'explosion',
    attack: IMMOLATION,
    onCast: castImmolation,
  },
  {
    id: 'fire_phoenix', name: 'Summon Phoenix', job: 'inferno_sage', element: 'fire', kind: 'summon', maxLevel: 10,
    description: 'A phoenix circles you and hurls piercing fire bolts at enemies in front of it.',
    icon: icon('phoenix', 0xffe27a, 0xff4a10), requires: [{ skillId: 'fire_salamander', level: 8 }],
    mpCost: Li(60, 85, 10), cooldownMs: L(80000, 60000, 10), castTimeMs: 700, sfx: 'cast_fire',
    summon: {
      durationMs: L(30000, 50000, 10), attackIntervalMs: 1300, offset: { x: -34, y: -96 }, follow: true, vfx: 'fire_phoenix',
      attack: {
        pattern: 'projectile', damagePct: L(200, 300, 10), hits: K(1), maxTargets: K(4), range: 520,
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
        { stat: 'dmgAll', add: L(0.05, 0.12, 15)(lv) },
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
  {
    id: 'fire_cauterize', name: 'Cauterize', job: 'inferno_sage', element: 'fire', kind: 'attack', maxLevel: CAUT_MAX,
    description: 'Sear your wounds shut, restoring 15-30% of max HP, and scorch every enemy crowding around you.',
    icon: icon('heart', 0xffd84a, 0xe63a12), requires: [{ skillId: 'fire_ascension', level: 3 }],
    mpCost: Li(40, 55, CAUT_MAX), cooldownMs: L(30000, 20000, CAUT_MAX), castTimeMs: 500, sfx: 'heal',
    attack: CAUTERIZE,
    onCast: castCauterize,
  },
];
