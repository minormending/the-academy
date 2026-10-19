// Year 5 "Fellowship" (Storm Archon, lv 55+). Eight spells that sit on top of the Year-4 Tempest Sage book.
// Persistent effects (the pylon field) reuse the lifetime-managed plantField, so they end on map change,
// death and scene shutdown. Everything else is a plain AttackSpec/BuffSpec the engine already owns.
import type { IconSpec, SkillDef, StatusSpec } from '../../core/types';
import { lerpLv } from './shared';
import { arcSkate, plantField } from './spellbookMechanics';

const lin = (a: number, b: number, max: number) => (lv: number) => lerpLv(a, b, lv, max);
const int = (a: number, b: number, max: number) => (lv: number) => Math.round(lerpLv(a, b, lv, max));
const icon = (glyph: IconSpec['glyph'], color = 0xfff36b, color2 = 0x9f6bff): IconSpec => ({ glyph, color, color2, bg: 0x180a3a });
const shock = (max: number, chance: [number, number], duration: [number, number], potency: [number, number]): StatusSpec => ({
  kind: 'shock', chance: lin(chance[0], chance[1], max), durationMs: int(duration[0], duration[1], max), potency: lin(potency[0], potency[1], max),
});

export const LIGHTNING_Y5: SkillDef[] = [
  {
    id: 'ltn_voltage_cascade', name: 'Voltage Cascade',
    description: 'Branching chain lightning that leaps through six to eight foes, striking each twice and shocking them (60-90% chance).',
    element: 'lightning', job: 'storm_archon', kind: 'attack', maxLevel: 15,
    icon: icon('chain', 0xffffff), requires: [{ skillId: 'ltn_arc_storm', level: 5 }],
    mpCost: int(70, 95, 15), cooldownMs: int(7000, 5000, 15), castTimeMs: 420, sfx: 'cast_lightning',
    attack: {
      pattern: 'chain', damagePct: lin(170, 260, 15), hits: () => 2,
      maxTargets: (lv) => 6 + Math.floor(lv / 7), range: 480,
      chain: { jumpRange: 250, jumpDelayMs: 70 }, hitIntervalMs: 70,
      status: shock(15, [0.6, 0.9], [6000, 8000], [0.3, 0.4]),
      vfx: { cast: 'ltn5_cascade_cast', area: 'ltn5_cascade_arc', hit: 'ltn5_hit_surge' },
    },
  },
  {
    id: 'ltn_zenith_lance', name: 'Zenith Lance',
    description: 'Drive a three-strike pillar of storm into a single foe; deals 25% more damage to shocked targets.',
    element: 'lightning', job: 'storm_archon', kind: 'attack', maxLevel: 15,
    icon: icon('bolt', 0xffffff), requires: [{ skillId: 'ltn_perfect_conductor', level: 5 }],
    mpCost: int(80, 105, 15), cooldownMs: int(8000, 6000, 15), castTimeMs: 520, sfx: 'thunder',
    attack: {
      pattern: 'aoe_target', damagePct: lin(230, 345, 15), hits: () => 3, maxTargets: () => 1,
      range: 560, area: { w: 90, h: 240 }, delayMs: 180, hitIntervalMs: 70,
      bonusVs: { status: 'shock', mult: 1.25 },
      vfx: { cast: 'ltn5_lance_cast', area: 'ltn5_lance_strike', hit: 'ltn_hit_shock' },
    },
  },
  {
    id: 'ltn_fellowship_of_storms', name: 'Fellowship of Storms',
    description: 'Ultimate: the whole Fellowship answers your call. Ten sky-to-ground strikes hammer up to ten foes across the screen, each struck ten times and always shocked.',
    element: 'lightning', job: 'storm_archon', kind: 'attack', maxLevel: 10,
    icon: icon('thunder_cloud', 0xffffff, 0xfff36b), requires: [{ skillId: 'ltn_thunderstorm', level: 5 }],
    mpCost: int(120, 150, 10), cooldownMs: int(90000, 65000, 10), castTimeMs: 1000, sfx: 'thunder',
    attack: {
      pattern: 'aoe_self', damagePct: lin(140, 200, 10), hits: () => 10, maxTargets: () => 10,
      range: 500, area: { w: 1000, h: 460 }, delayMs: 650, hitIntervalMs: 75,
      status: shock(10, [1, 1], [7000, 9000], [0.35, 0.45]),
      vfx: { cast: 'ltn5_fellowship_cast', area: 'ltn5_fellowship_area', hit: 'ltn_hit_shock' },
    },
  },
  {
    id: 'ltn_pylon_array', name: 'Pylon Array',
    description: 'Raise four storm pylons for 9-14 seconds; every 0.7s they arc between each other, striking up to eight foes inside twice and shocking them. One array at a time.',
    element: 'lightning', job: 'storm_archon', kind: 'summon', maxLevel: 15,
    icon: icon('staff', 0xffffff), requires: [{ skillId: 'ltn_storm_circuit', level: 3 }],
    mpCost: int(90, 120, 15), cooldownMs: int(22000, 18000, 15), castTimeMs: 520, sfx: 'cast_lightning',
    onCast: (ctx, lv) => plantField(ctx, lv, false),
    summon: {
      durationMs: int(9000, 14000, 15), attackIntervalMs: 700, offset: { x: 140, y: -34 }, follow: false,
      vfx: 'ltn5_pylon_body',
      attack: {
        pattern: 'aoe_self', damagePct: lin(50, 75, 15), hits: () => 2, maxTargets: () => 8,
        range: 260, area: { w: 520, h: 240 }, hitIntervalMs: 60,
        status: shock(15, [0.8, 1], [3000, 4500], [0.3, 0.4]),
        vfx: { area: 'ltn5_pylon_pulse', hit: 'ltn_hit_zap' },
      },
    },
  },
  {
    id: 'ltn_reckoning_peal', name: 'Reckoning Peal',
    description: 'Combo payoff: call down four hammering peals on up to three foes; shocked targets take 100% more damage and the shock is consumed.',
    element: 'lightning', job: 'storm_archon', kind: 'attack', maxLevel: 15,
    icon: icon('spark', 0xffffff, 0xff9fe8), requires: [{ skillId: 'ltn_ion_judgment', level: 3 }],
    mpCost: int(75, 100, 15), cooldownMs: int(9000, 7000, 15), castTimeMs: 460, sfx: 'thunder',
    attack: {
      pattern: 'aoe_target', damagePct: lin(160, 240, 15), hits: () => 4, maxTargets: () => 3,
      range: 520, area: { w: 150, h: 240 }, delayMs: 120, hitIntervalMs: 65,
      bonusVs: { status: 'shock', mult: 2, consume: true },
      vfx: { cast: 'ltn5_peal_cast', area: 'ltn5_peal_strike', hit: 'ltn5_hit_surge' },
    },
  },
  {
    id: 'ltn_archon_conduit', name: "Archon's Conduit",
    description: 'Become the storm for 30-50 seconds: +15-35% Lightning damage, +10-25% casting speed, +5-15% cooldown recovery and +10-30% critical damage.',
    element: 'lightning', job: 'storm_archon', kind: 'buff', maxLevel: 10,
    icon: icon('halo', 0xffffff, 0xfff36b), requires: [{ skillId: 'ltn_thunderbird', level: 3 }],
    mpCost: int(80, 100, 10), cooldownMs: () => 60000, castTimeMs: 500, sfx: 'buff',
    buff: {
      durationMs: int(30000, 50000, 10),
      modifiers: (lv) => [
        { stat: 'dmgLightning', add: lerpLv(0.15, 0.35, lv, 10) },
        { stat: 'castSpeed', add: lerpLv(0.1, 0.25, lv, 10) },
        { stat: 'cdr', add: lerpLv(0.05, 0.15, lv, 10) },
        { stat: 'critDmg', add: lerpLv(0.1, 0.3, lv, 10) },
      ],
      vfx: 'ltn5_conduit_cast', auraVfx: 'ltn5_conduit_aura',
    },
  },
  {
    id: 'ltn_voltaic_doctrine', name: 'Voltaic Doctrine',
    description: 'Passive: postgraduate study of the storm. Permanently raises Lightning damage (+2-20%), critical rate (+1-7%) and maximum MP (+2-15%).',
    element: 'lightning', job: 'storm_archon', kind: 'passive', maxLevel: 15,
    icon: icon('book', 0xfff36b, 0x9f6bff), requires: [{ skillId: 'ltn_eye_of_the_storm', level: 5 }],
    mpCost: () => 0, sfx: 'buff',
    passive: (lv) => [
      { stat: 'dmgLightning', add: lerpLv(0.02, 0.2, lv, 15) },
      { stat: 'critRate', add: lerpLv(0.01, 0.07, lv, 15) },
      { stat: 'maxMp', mul: lerpLv(0.02, 0.15, lv, 15) },
    ],
  },
  {
    id: 'ltn_ride_the_lightning', name: 'Ride the Lightning',
    description: 'Become a bolt: blink up to 460 px, shredding and shocking every foe along the path with three cuts.',
    element: 'lightning', job: 'storm_archon', kind: 'movement', maxLevel: 15,
    icon: icon('teleport', 0xffffff), requires: [{ skillId: 'ltn_tempest_surge', level: 3 }],
    mpCost: int(52, 70, 15), cooldownMs: int(9000, 7000, 15), castTimeMs: 160, sfx: 'blink',
    movement: { kind: 'blink', distance: int(300, 460, 15), vfxOut: 'ltn5_ride_out', vfxIn: 'ltn5_ride_in' },
    onCast: arcSkate,
    attack: {
      pattern: 'beam', damagePct: lin(80, 120, 15), hits: () => 3, maxTargets: () => 8,
      range: 460, area: { w: 460, h: 90 }, hitIntervalMs: 45,
      status: shock(15, [0.7, 1], [3000, 5000], [0.25, 0.35]),
      vfx: { area: 'ltn5_ride_trail', hit: 'ltn_hit_zap' },
    },
  },
];
