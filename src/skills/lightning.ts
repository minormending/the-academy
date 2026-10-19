// OWNER: A5 (lightning-tree). Lightning skills: speed, chains, multi-hit, crits, mobility, shock.
import type { IconSpec, SkillContext, SkillDef, StatusSpec } from '../core/types';
import { playVfx } from '../core/vfx';
import { STORM, lerpLv } from './lightning/shared';
import { SPELLBOOK_LIGHTNING_SKILLS } from './lightning/spellbook';

const lin = (a: number, b: number, max: number) => (lv: number) => lerpLv(a, b, lv, max);
const linR = (a: number, b: number, max: number) => (lv: number) => Math.round(lerpLv(a, b, lv, max));

const BG = 0x1b1340;
const icon = (glyph: IconSpec['glyph'], color = 0xffe94d, color2 = 0xa66bff): IconSpec => ({ glyph, color, color2, bg: BG });

/** Shock: target takes `potency` fraction bonus damage for `durationMs`. */
function shock(max: number, chance: [number, number], durationMs: [number, number], potency: [number, number]): StatusSpec {
  return {
    kind: 'shock',
    chance: lin(chance[0], chance[1], max),
    durationMs: linR(durationMs[0], durationMs[1], max),
    potency: lin(potency[0], potency[1], max),
  };
}

/** Passives have no cast event: their own sigils accent these new attack casts while learned. */
function studiedAttack(ctx: SkillContext): void {
  const p = ctx.services.player;
  const origin = { x: p.x + 18 * p.facing, y: p.y - 34, facing: p.facing };
  for (const [id, key] of [
    ['ltn_live_wire', 'ltn_live_wire_sigil'],
    ['ltn_perfect_conductor', 'ltn_conductor_sigil'],
  ]) {
    const lv = ctx.services.progression.state.skills[id] ?? 0;
    if (lv > 0) playVfx(ctx.scene, key, { ...origin, lv });
  }
  if (ctx.skill.attack) ctx.runAttack(ctx.skill.attack, origin);
}

export const LIGHTNING_SKILLS: SkillDef[] = [
  // ───────────────────────── Year 2 — Stormcaller (lv 10) ─────────────────────────
  {
    id: 'ltn_thunder_bolt',
    name: 'Thunder Bolt',
    description: 'Hurl a bolt that chains through 2-4 foes and may shock them.',
    element: 'lightning',
    job: 'stormcaller',
    kind: 'attack',
    maxLevel: 20,
    icon: icon('chain'),
    mpCost: linR(14, 22, 20),
    castTimeMs: 380,
    sfx: 'cast_lightning',
    attack: {
      pattern: 'chain',
      damagePct: lin(155, 230, 20),
      hits: () => 1,
      maxTargets: (lv) => 2 + Math.floor(lv / 8),
      range: 360,
      chain: { jumpRange: 200, jumpDelayMs: 80 },
      status: shock(20, [0.3, 0.5], [4000, 6000], [0.18, 0.28]),
      vfx: { cast: 'ltn_cast_bolt', area: 'ltn_chain_seg', hit: 'ltn_hit_zap' },
    },
  },
  {
    id: 'ltn_spark_lance',
    name: 'Spark Lance',
    description: 'Thrust a piercing lance of electricity that strikes 3 times along its length.',
    element: 'lightning',
    job: 'stormcaller',
    kind: 'attack',
    maxLevel: 15,
    icon: icon('bolt', 0xfff3a0, 0xffe94d),
    requires: [{ skillId: 'ltn_thunder_bolt', level: 3 }],
    mpCost: linR(18, 26, 15),
    cooldownMs: linR(3000, 2000, 15),
    castTimeMs: 420,
    sfx: 'zap',
    attack: {
      pattern: 'beam',
      damagePct: lin(72, 98, 15),
      hits: () => 3,
      maxTargets: (lv) => 3 + Math.floor(lv / 5),
      range: 480,
      area: { w: 480, h: 56 },
      hitIntervalMs: 70,
      status: shock(15, [0.2, 0.4], [3500, 5000], [0.15, 0.25]),
      vfx: { cast: 'ltn_cast_lance', area: 'ltn_beam_lance', hit: 'ltn_hit_zap' },
    },
  },
  {
    id: 'ltn_static_charge',
    name: 'Static Charge',
    description: 'Passive: +1.5% crit rate and +1% lightning damage per level.',
    element: 'lightning',
    job: 'stormcaller',
    kind: 'passive',
    maxLevel: 10,
    icon: icon('spark', 0xffffff, 0xffe94d),
    requires: [{ skillId: 'ltn_thunder_bolt', level: 3 }],
    mpCost: () => 0,
    passive: (lv) => [
      { stat: 'critRate', add: 0.015 * lv },
      { stat: 'dmgLightning', add: 0.01 * lv },
    ],
  },
  {
    id: 'ltn_storm_step',
    name: 'Storm Step',
    description: 'Dissolve into lightning and reappear far away in the direction you hold.',
    element: 'lightning',
    job: 'stormcaller',
    kind: 'movement',
    maxLevel: 10,
    icon: icon('teleport', 0xfff3a0, 0xa66bff),
    requires: [{ skillId: 'ltn_thunder_bolt', level: 5 }],
    mpCost: linR(10, 16, 10),
    cooldownMs: linR(3500, 1500, 10),
    castTimeMs: 120,
    sfx: 'blink',
    movement: {
      kind: 'blink',
      distance: (lv) => 220 + 10 * lv,
      vfxOut: 'ltn_step_out',
      vfxIn: 'ltn_step_in',
    },
  },
  {
    id: 'ltn_galvanic_needle',
    name: 'Galvanic Needle',
    description: 'Fire a swift twin-line needle at one foe; shocked targets take 25% more damage.',
    element: 'lightning', job: 'stormcaller', kind: 'attack', maxLevel: 20,
    icon: icon('missile'),
    mpCost: linR(14, 24, 20), castTimeMs: 290, sfx: 'zap',
    onCast: studiedAttack,
    attack: {
      pattern: 'projectile', damagePct: lin(85, 125, 20), hits: () => 2,
      maxTargets: () => 1, range: 520, hitIntervalMs: 55,
      projectile: { speed: 1050, radius: 8 },
      bonusVs: { status: 'shock', mult: 1.25 },
      vfx: { cast: 'ltn_needle_cast', projectile: 'ltn_needle_proj', hit: 'ltn_hit_zap' },
    },
  },
  {
    id: 'ltn_repulsion_ring',
    name: 'Repulsion Ring',
    description: 'Repel nearby foes with three electric pulses that can briefly stun them.',
    element: 'lightning', job: 'stormcaller', kind: 'attack', maxLevel: 15,
    icon: icon('storm'),
    requires: [{ skillId: 'ltn_thunder_bolt', level: 3 }],
    mpCost: linR(18, 28, 15), cooldownMs: linR(6000, 4000, 15), castTimeMs: 320, sfx: 'thunder',
    attack: {
      pattern: 'aoe_self', damagePct: lin(34, 48, 15), hits: () => 3,
      maxTargets: () => 6, range: 150, area: { w: 300, h: 180 },
      hitIntervalMs: 65, knockback: 100,
      status: { kind: 'stun', chance: lin(0.35, 0.65, 15), durationMs: linR(650, 1100, 15), potency: () => 0 },
      vfx: { area: 'ltn_repulsion_area', hit: 'ltn_hit_zap' },
    },
  },
  {
    id: 'ltn_static_ward',
    name: 'Static Ward',
    description: 'Wrap yourself in a static shield that redirects damage to MP and raises defense.',
    element: 'lightning', job: 'stormcaller', kind: 'buff', maxLevel: 15,
    icon: icon('shield'),
    requires: [{ skillId: 'ltn_live_wire', level: 3 }],
    mpCost: linR(16, 26, 15), cooldownMs: () => 35000, castTimeMs: 300, sfx: 'buff',
    buff: {
      durationMs: linR(25000, 45000, 15),
      modifiers: (lv) => [
        { stat: 'mpShield', add: lerpLv(0.1, 0.25, lv, 15) },
        { stat: 'def', add: Math.round(lerpLv(6, 20, lv, 15)) },
      ],
      vfx: 'ltn_ward_cast', auraVfx: 'ltn_ward_aura',
    },
  },
  {
    id: 'ltn_live_wire',
    name: 'Live Wire',
    description: 'Passive: move and cast faster while regenerating MP through a steady current.',
    element: 'lightning', job: 'stormcaller', kind: 'passive', maxLevel: 15,
    icon: icon('wind'), mpCost: () => 0, sfx: 'buff',
    passive: (lv) => [
      { stat: 'speed', add: lerpLv(4, 20, lv, 15) },
      { stat: 'castSpeed', add: lerpLv(0.015, 0.08, lv, 15) },
      { stat: 'mpRegen', add: lerpLv(1, 6, lv, 15) },
    ],
  },

  // ───────────────────────── Year 3 — Stormbinder (lv 25) ─────────────────────────
  {
    id: 'ltn_thunder_spear',
    name: 'Thunder Spear',
    description: 'Call a spear of lightning down from the sky onto the nearest foe, shocking the area.',
    element: 'lightning',
    job: 'stormbinder',
    kind: 'attack',
    maxLevel: 20,
    icon: icon('bolt', 0xffffff, 0xffe94d),
    mpCost: linR(26, 38, 20),
    cooldownMs: linR(2800, 1800, 20),
    castTimeMs: 450,
    sfx: 'thunder',
    attack: {
      pattern: 'aoe_target',
      damagePct: lin(140, 200, 20),
      hits: () => 2,
      maxTargets: (lv) => 4 + Math.floor(lv / 7),
      range: 400,
      area: { w: 200, h: 320 },
      delayMs: 140,
      hitIntervalMs: 90,
      status: shock(20, [0.45, 0.7], [4500, 6500], [0.22, 0.32]),
      vfx: { cast: 'ltn_cast_spear', area: 'ltn_spear_strike', hit: 'ltn_hit_shock' },
    },
  },
  {
    id: 'ltn_ball_lightning',
    name: 'Ball Lightning',
    description: 'Release a slow orb that pierces enemies and zaps each one six times as it passes.',
    element: 'lightning',
    job: 'stormbinder',
    kind: 'attack',
    maxLevel: 15,
    icon: icon('orb', 0xffffff, 0xa66bff),
    requires: [{ skillId: 'ltn_thunder_spear', level: 5 }],
    mpCost: linR(30, 44, 15),
    cooldownMs: linR(4500, 3000, 15),
    castTimeMs: 500,
    sfx: 'cast_lightning',
    attack: {
      pattern: 'projectile',
      damagePct: lin(44, 62, 15),
      hits: () => 6,
      maxTargets: () => 5,
      range: 560,
      area: { w: 140, h: 140 },
      hitIntervalMs: 110,
      projectile: { speed: 170, radius: 28, pierce: true },
      status: shock(15, [0.3, 0.5], [4000, 6000], [0.2, 0.3]),
      vfx: { cast: 'ltn_cast_ball', projectile: 'ltn_ball_proj', area: 'ltn_ball_burst', hit: 'ltn_hit_zap' },
    },
  },
  {
    id: 'ltn_overload',
    name: 'Overload',
    description: 'Detonate stored charge around you in 4 strikes; shocked foes take double damage (shock is not consumed).',
    element: 'lightning',
    job: 'stormbinder',
    kind: 'attack',
    maxLevel: 10,
    icon: icon('storm', 0xffffff, 0xa66bff),
    requires: [
      { skillId: 'ltn_ball_lightning', level: 5 },
    ],
    mpCost: linR(32, 45, 10),
    cooldownMs: linR(9000, 6000, 10),
    castTimeMs: 600,
    sfx: 'thunder',
    attack: {
      pattern: 'aoe_self',
      damagePct: lin(50, 68, 10),
      hits: () => 4,
      maxTargets: () => 8,
      range: 230,
      area: { w: 460, h: 220 },
      hitIntervalMs: 90,
      bonusVs: { status: 'shock', mult: 2 },
      vfx: { cast: 'ltn_overload_cast', area: 'ltn_overload_area', hit: 'ltn_hit_shock' },
    },
  },
  {
    id: 'ltn_storm_totem',
    name: 'Storm Totem',
    description: 'Plant a totem that chains lightning through up to 3 nearby foes and shocks them.',
    element: 'lightning',
    job: 'stormbinder',
    kind: 'summon',
    maxLevel: 15,
    icon: icon('crystal', 0xffe94d, 0xa66bff),
    mpCost: linR(34, 46, 15),
    cooldownMs: linR(30000, 24000, 15),
    castTimeMs: 600,
    sfx: 'cast_lightning',
    summon: {
      durationMs: (lv) => 18000 + 1000 * lv,
      attackIntervalMs: 1000,
      offset: { x: 60, y: 0 },
      follow: false,
      vfx: 'ltn_totem',
      attack: {
        pattern: 'chain',
        damagePct: lin(110, 170, 15),
        hits: () => 1,
        maxTargets: () => 3,
        range: 360,
        chain: { jumpRange: 180, jumpDelayMs: 80 },
        status: shock(15, [0.25, 0.4], [3500, 5000], [0.18, 0.26]),
        vfx: { cast: 'ltn_totem_pulse', area: 'ltn_chain_totem', hit: 'ltn_hit_zap' },
      },
    },
  },
  {
    id: 'ltn_storm_mastery',
    name: 'Storm Mastery',
    description: 'Passive: +2% lightning damage and +1.5% mastery per level.',
    element: 'lightning',
    job: 'stormbinder',
    kind: 'passive',
    maxLevel: 10,
    icon: icon('book', 0xffe94d, 0xa66bff),
    requires: [{ skillId: 'ltn_storm_totem', level: 3 }],
    mpCost: () => 0,
    passive: (lv) => [
      { stat: 'dmgLightning', add: 0.02 * lv },
      { stat: 'mastery', add: 0.015 * lv },
    ],
  },
  {
    id: 'ltn_capacitor_burst',
    name: 'Capacitor Burst',
    description: 'Drive three concentrated arcs into one nearby foe for 35% more damage against shock.',
    element: 'lightning', job: 'stormbinder', kind: 'attack', maxLevel: 20,
    icon: icon('claw'),
    requires: [{ skillId: 'ltn_thunder_spear', level: 3 }],
    mpCost: linR(26, 40, 20), cooldownMs: linR(3000, 1600, 20), castTimeMs: 330, sfx: 'zap',
    attack: {
      pattern: 'melee_arc', damagePct: lin(80, 110, 20), hits: () => 3,
      maxTargets: () => 1, range: 190, area: { w: 190, h: 100, offsetX: 95 },
      hitIntervalMs: 55, bonusVs: { status: 'shock', mult: 1.35 },
      vfx: { area: 'ltn_capacitor_arc', hit: 'ltn_hit_shock' },
    },
  },
  {
    id: 'ltn_charge_reversal',
    name: 'Charge Reversal',
    description: 'Recycle ambient current to immediately restore a portion of your maximum HP and MP.',
    element: 'lightning', job: 'stormbinder', kind: 'buff', maxLevel: 15,
    icon: icon('mana'),
    requires: [{ skillId: 'ltn_storm_totem', level: 3 }],
    mpCost: linR(28, 40, 15), cooldownMs: linR(40000, 25000, 15), castTimeMs: 420, sfx: 'heal',
    onCast: (ctx, lv) => {
      const { progression, combat, player } = ctx.services;
      const d = progression.derived();
      const hp = Math.round(d.maxHp * lerpLv(0.08, 0.16, lv, 15));
      const mp = Math.round(d.maxMp * lerpLv(0.06, 0.12, lv, 15));
      const beforeHp = progression.state.hp, beforeMp = progression.state.mp;
      progression.heal(hp, mp);
      const gainedHp = progression.state.hp - beforeHp, gainedMp = progression.state.mp - beforeMp;
      if (gainedHp > 0) combat.showNumber(player.x, player.y - 60, gainedHp, 'heal');
      if (gainedMp > 0) combat.showNumber(player.x, player.y - 80, gainedMp, 'mp');
      playVfx(ctx.scene, 'ltn_reversal_cast', { x: player.x, y: player.y, facing: player.facing, lv });
    },
  },
  {
    id: 'ltn_flash_relay',
    name: 'Flash Relay',
    description: 'Blink in any held direction, including diagonals, and shock foes at your destination.',
    element: 'lightning', job: 'stormbinder', kind: 'movement', maxLevel: 15,
    icon: icon('teleport', 0xa66bff, 0xffe94d),
    mpCost: linR(26, 38, 15), cooldownMs: linR(6500, 3500, 15), castTimeMs: 100, sfx: 'blink',
    movement: { kind: 'blink', distance: linR(250, 390, 15), vfxOut: 'ltn_relay_out', vfxIn: 'ltn_relay_in' },
    attack: {
      pattern: 'aoe_self', damagePct: lin(24, 45, 15), hits: () => 2,
      maxTargets: () => 5, range: 100, area: { w: 200, h: 160 }, hitIntervalMs: 60,
      status: shock(15, [1, 1], [3000, 5000], [0.15, 0.25]),
      vfx: { area: 'ltn_relay_arrival', hit: 'ltn_hit_zap' },
    },
    onCast: (ctx, lv) => {
      const p = ctx.services.player, move = ctx.skill.movement!;
      const old = { x: p.x, y: p.y, facing: p.facing, lv };
      const aim = p.getAimDir();
      const length = Math.hypot(aim.x, aim.y) || 1;
      const distance = move.distance(lv);
      const dx = (aim.x || (!aim.y ? p.facing : 0)) * distance / length;
      const dy = aim.y * distance / length;
      playVfx(ctx.scene, move.vfxOut, old);
      p.blink(dx, dy);
      playVfx(ctx.scene, move.vfxIn, { x: p.x, y: p.y, facing: p.facing, lv });
      // Center the arrival nova on the actual, collision-clamped destination.
      if (ctx.skill.attack) ctx.runAttack(ctx.skill.attack, { x: p.x, y: p.y - 34, facing: p.facing });
    },
  },

  // ───────────────────────── Year 4 — Tempest Sage (lv 40) ─────────────────────────
  {
    id: 'ltn_arc_storm',
    name: 'Arc Storm',
    description: 'A raging chain lightning that arcs through 4-6 foes, striking each twice and shocking them.',
    element: 'lightning',
    job: 'tempest_sage',
    kind: 'attack',
    maxLevel: 20,
    icon: icon('chain', 0xffffff, 0xa66bff),
    mpCost: linR(48, 66, 20),
    castTimeMs: 450,
    sfx: 'cast_lightning',
    attack: {
      pattern: 'chain',
      damagePct: lin(150, 215, 20),
      hits: () => 2,
      maxTargets: (lv) => 4 + Math.floor(lv / 10),
      range: 420,
      chain: { jumpRange: 240, jumpDelayMs: 70 },
      hitIntervalMs: 80,
      status: shock(20, [0.4, 0.6], [5000, 7000], [0.25, 0.35]),
      vfx: { cast: 'ltn_cast_arc', area: 'ltn_chain_arc', hit: 'ltn_hit_shock' },
    },
  },
  {
    id: 'ltn_thunderstorm',
    name: 'Thunderstorm',
    description: 'Ultimate: summon dark clouds that rain lightning over a wide area, shocking everything beneath them.',
    element: 'lightning',
    job: 'tempest_sage',
    kind: 'attack',
    maxLevel: 10,
    icon: icon('thunder_cloud', 0xffe94d, 0xa66bff),
    requires: [
      { skillId: 'ltn_arc_storm', level: 5 },
    ],
    mpCost: linR(70, 90, 10),
    cooldownMs: linR(55000, 38000, 10),
    castTimeMs: 800,
    sfx: 'thunder',
    attack: {
      pattern: 'rain',
      damagePct: lin(380, 520, 10),
      hits: () => 1,
      maxTargets: () => 6,
      range: 560,
      area: { w: 150, h: 240, offsetX: STORM.offsetX },
      rain: { count: STORM.count, spreadX: STORM.spreadX, intervalMs: STORM.intervalMs, fallHeight: STORM.fallHeight },
      projectile: { speed: 1100, radius: 12 },
      status: shock(10, [0.7, 0.9], [6000, 8000], [0.3, 0.4]),
      vfx: { cast: 'ltn_storm_cast', projectile: 'ltn_storm_proj', area: 'ltn_storm_strike', hit: 'ltn_hit_shock' },
    },
  },
  {
    id: 'ltn_thunderbird',
    name: 'Thunderbird',
    description: 'Summon a thunderbird of living light that follows you and chains lightning through your foes.',
    element: 'lightning',
    job: 'tempest_sage',
    kind: 'summon',
    maxLevel: 15,
    icon: icon('feather', 0xdff6ff, 0xffe94d),
    mpCost: linR(55, 75, 15),
    cooldownMs: linR(45000, 32000, 15),
    castTimeMs: 600,
    sfx: 'thunder',
    summon: {
      durationMs: linR(30000, 50000, 15),
      attackIntervalMs: 850,
      offset: { x: -46, y: -110 },
      follow: true,
      vfx: 'ltn_thunderbird',
      attack: {
        pattern: 'chain',
        damagePct: lin(200, 300, 15),
        hits: () => 1,
        maxTargets: (lv) => 3 + Math.floor(lv / 6),
        range: 420,
        chain: { jumpRange: 200, jumpDelayMs: 70 },
        status: shock(15, [0.3, 0.45], [4000, 5500], [0.2, 0.3]),
        vfx: { cast: 'ltn_bird_screech', area: 'ltn_chain_bird', hit: 'ltn_hit_zap' },
      },
    },
  },
  {
    id: 'ltn_tempest_surge',
    name: 'Tempest Surge',
    description: 'Charge your body with storm energy: faster movement and casting, and higher crit rate.',
    element: 'lightning',
    job: 'tempest_sage',
    kind: 'buff',
    maxLevel: 10,
    icon: icon('wind', 0xffffff, 0xffe94d),
    requires: [
      { skillId: 'ltn_thunderbird', level: 3 },
    ],
    mpCost: linR(40, 55, 10),
    cooldownMs: () => 45000,
    castTimeMs: 400,
    sfx: 'buff',
    buff: {
      durationMs: linR(40000, 60000, 10),
      modifiers: (lv) => [
        { stat: 'speed', mul: lerpLv(0.1, 0.3, lv, 10) },
        { stat: 'castSpeed', add: lerpLv(0.15, 0.35, lv, 10) },
        { stat: 'critRate', add: lerpLv(0.1, 0.25, lv, 10) },
      ],
      vfx: 'ltn_surge_cast',
      auraVfx: 'ltn_surge_aura',
    },
  },
  {
    id: 'ltn_eye_of_the_storm',
    name: 'Eye of the Storm',
    description: 'Passive: +3% critical damage and +1% cooldown reduction per level.',
    element: 'lightning',
    job: 'tempest_sage',
    kind: 'passive',
    maxLevel: 10,
    icon: icon('eye', 0xffe94d, 0xa66bff),
    requires: [{ skillId: 'ltn_perfect_conductor', level: 3 }],
    mpCost: () => 0,
    passive: (lv) => [
      { stat: 'critDmg', add: 0.03 * lv },
      { stat: 'cdr', add: 0.01 * lv },
    ],
  },
  {
    id: 'ltn_ion_judgment',
    name: 'Ion Judgment',
    description: 'Focus eight rapid strikes on one distant foe, dealing 30% more damage against shock.',
    element: 'lightning', job: 'tempest_sage', kind: 'attack', maxLevel: 20,
    icon: icon('eye', 0xffffff, 0xffe94d),
    requires: [{ skillId: 'ltn_arc_storm', level: 3 }],
    mpCost: linR(45, 68, 20), cooldownMs: linR(5000, 3000, 20), castTimeMs: 380, sfx: 'zap',
    onCast: studiedAttack,
    attack: {
      pattern: 'aoe_target', damagePct: lin(48, 70, 20), hits: () => 8,
      maxTargets: () => 1, range: 520, area: { w: 80, h: 160 }, hitIntervalMs: 45,
      bonusVs: { status: 'shock', mult: 1.3 },
      vfx: { area: 'ltn_judgment_cage', hit: 'ltn_hit_shock' },
    },
  },
  {
    id: 'ltn_rail_of_heaven',
    name: 'Rail of Heaven',
    description: 'Ultimate: unleash a narrow rail of twelve strikes that deals 40% more damage against shock.',
    element: 'lightning', job: 'tempest_sage', kind: 'attack', maxLevel: 10,
    icon: icon('bolt', 0xffffff, 0xa66bff),
    requires: [{ skillId: 'ltn_perfect_conductor', level: 5 }],
    mpCost: linR(72, 90, 10), cooldownMs: linR(75000, 55000, 10), castTimeMs: 900, sfx: 'thunder',
    onCast: studiedAttack,
    attack: {
      pattern: 'beam', damagePct: lin(70, 100, 10), hits: () => 12,
      maxTargets: () => 3, range: 820, area: { w: 820, h: 72 },
      delayMs: 300, hitIntervalMs: 50,
      bonusVs: { status: 'shock', mult: 1.4 },
      vfx: { cast: 'ltn_rail_charge', area: 'ltn_rail_beam', hit: 'ltn_hit_shock' },
    },
  },
  {
    id: 'ltn_perfect_conductor',
    name: 'Perfect Conductor',
    description: 'Passive: stabilize lightning rolls and sharpen critical strikes through perfect conduction.',
    element: 'lightning', job: 'tempest_sage', kind: 'passive', maxLevel: 20,
    icon: icon('gem'), mpCost: () => 0, sfx: 'buff',
    passive: (lv) => [
      { stat: 'mastery', add: lerpLv(0.02, 0.1, lv, 20) },
      { stat: 'critRate', add: lerpLv(0.01, 0.08, lv, 20) },
      { stat: 'critDmg', add: lerpLv(0.02, 0.2, lv, 20) },
    ],
  },
  ...SPELLBOOK_LIGHTNING_SKILLS,
];
