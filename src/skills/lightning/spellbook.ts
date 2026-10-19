// Phase 9 additions. Existing spell definitions stay in lightning.ts unchanged.
import type { IconSpec, SkillDef, StatusSpec } from '../../core/types';
import { lerpLv } from './shared';
import { arcSkate, bloodDynamo, channelArcs, plantField, tempestReprisal } from './spellbookMechanics';

const lin = (a: number, b: number, max: number) => (lv: number) => lerpLv(a, b, lv, max);
const int = (a: number, b: number, max: number) => (lv: number) => Math.round(lerpLv(a, b, lv, max));
const icon = (glyph: IconSpec['glyph']): IconSpec => ({ glyph, color: 0xffe94d, color2: 0xa66bff, bg: 0x1b1340 });
const shock = (max: number, duration: number, potency: number): StatusSpec => ({
  kind: 'shock', chance: () => 1, durationMs: int(duration * 0.6, duration, max), potency: () => potency,
});

export const SPELLBOOK_LIGHTNING_SKILLS: SkillDef[] = [
  {
    id: 'ltn_ion_brand', name: 'Ion Brand',
    description: 'Brand one foe with guaranteed, long-lived shock to prepare a discharge combo.',
    element: 'lightning', job: 'stormcaller', kind: 'attack', maxLevel: 10,
    icon: icon('eye'), mpCost: () => 14, cooldownMs: () => 2000, castTimeMs: 180, sfx: 'zap',
    attack: {
      pattern: 'aoe_target', damagePct: lin(12, 20, 10), hits: () => 2, maxTargets: () => 1,
      range: 400, area: { w: 56, h: 120 }, hitIntervalMs: 45,
      status: shock(10, 8000, 0.2), vfx: { area: 'ltn_brand_stamp' },
    },
  },
  {
    id: 'ltn_grounding_seal', name: 'Grounding Seal',
    description: 'Plant an eight-second ward that wakes for intruders and repeatedly stuns them; one seal at a time.',
    element: 'lightning', job: 'stormcaller', kind: 'summon', maxLevel: 15,
    icon: icon('shield'), mpCost: int(18, 26, 15), cooldownMs: () => 14000, castTimeMs: 360, sfx: 'cast_lightning',
    onCast: (ctx, lv) => plantField(ctx, lv, false),
    summon: {
      durationMs: () => 8000, attackIntervalMs: 900, offset: { x: 80, y: -32 }, follow: false,
      vfx: 'ltn_grounding_seal_body',
      attack: {
        pattern: 'aoe_self', damagePct: lin(20, 30, 15), hits: () => 2, maxTargets: () => 4,
        range: 90, area: { w: 180, h: 96 }, hitIntervalMs: 60,
        status: { kind: 'stun', chance: lin(0.6, 1, 15), durationMs: int(450, 600, 15), potency: () => 0 },
        vfx: { area: 'ltn_grounding_seal_pulse' },
      },
    },
  },
  {
    id: 'ltn_short_circuit', name: 'Short Circuit',
    description: 'Chain a twin discharge through three foes, consuming shock for 80% more damage.',
    element: 'lightning', job: 'stormcaller', kind: 'attack', maxLevel: 15,
    icon: icon('chain'), requires: [{ skillId: 'ltn_ion_brand', level: 3 }],
    mpCost: int(18, 26, 15), cooldownMs: int(6000, 4500, 15), castTimeMs: 300, sfx: 'thunder',
    attack: {
      pattern: 'chain', damagePct: lin(46, 66, 15), hits: () => 2, maxTargets: () => 3,
      range: 360, chain: { jumpRange: 190, jumpDelayMs: 100 }, hitIntervalMs: 55,
      bonusVs: { status: 'shock', mult: 1.8, consume: true }, vfx: { area: 'ltn_circuit_break' },
    },
  },
  {
    id: 'ltn_blood_dynamo', name: 'Blood Dynamo',
    description: 'Trade up to 12% max HP for 10-18% max MP, proportional to HP paid and preserving your last HP.',
    element: 'lightning', job: 'stormbinder', kind: 'buff', maxLevel: 10,
    icon: icon('heart'), mpCost: () => 0, cooldownMs: int(26000, 18000, 10), castTimeMs: 400, sfx: 'zap',
    onCast: bloodDynamo,
  },
  {
    id: 'ltn_arc_skate', name: 'Arc Skate',
    description: 'Blink horizontally through foes, leaving three shock-inflicting cuts along the actual path.',
    element: 'lightning', job: 'stormbinder', kind: 'movement', maxLevel: 15,
    icon: icon('shoes'), mpCost: int(28, 38, 15), cooldownMs: int(8500, 6500, 15), castTimeMs: 160, sfx: 'blink',
    movement: { kind: 'blink', distance: int(240, 360, 15), vfxOut: 'ltn_skate_depart', vfxIn: 'ltn_skate_arrive' },
    onCast: arcSkate,
    attack: {
      pattern: 'beam', damagePct: lin(50, 72, 15), hits: () => 3, maxTargets: () => 6,
      range: 360, area: { w: 360, h: 80 }, hitIntervalMs: 45,
      status: shock(15, 3000, 0.2), vfx: { area: 'ltn_skate_trail' },
    },
  },
  {
    id: 'ltn_tesla_channel', name: 'Tesla Channel',
    description: 'Channel five twin arcs from a fixed stance over one second; moving breaks the channel.',
    element: 'lightning', job: 'stormbinder', kind: 'attack', maxLevel: 15,
    icon: icon('staff'), mpCost: int(32, 44, 15), cooldownMs: int(7000, 5500, 15), castTimeMs: 1000, sfx: 'cast_lightning',
    onCast: channelArcs,
    attack: {
      pattern: 'beam', damagePct: lin(50, 70, 15), hits: () => 2, maxTargets: () => 4,
      range: 460, area: { w: 460, h: 54 }, hitIntervalMs: 45,
      vfx: { area: 'ltn_channel_arc' },
    },
  },
  {
    id: 'ltn_storm_circuit', name: 'Storm Circuit',
    description: 'Anchor a six-second static field that shocks foes only while you stand inside; one circuit at a time.',
    element: 'lightning', job: 'tempest_sage', kind: 'summon', maxLevel: 15,
    icon: icon('storm'), mpCost: int(48, 65, 15), cooldownMs: () => 18000, castTimeMs: 480, sfx: 'thunder',
    onCast: (ctx, lv) => plantField(ctx, lv, true),
    summon: {
      durationMs: () => 6000, attackIntervalMs: 750, offset: { x: 0, y: -34 }, follow: false,
      vfx: 'ltn_circuit_lattice',
      attack: {
        pattern: 'aoe_self', damagePct: lin(30, 42, 15), hits: () => 2, maxTargets: () => 6,
        range: 180, area: { w: 360, h: 160 }, hitIntervalMs: 60,
        status: shock(15, 2500, 0.25), vfx: { area: 'ltn_circuit_pulse' },
      },
    },
  },
  {
    id: 'ltn_tempest_reprisal', name: 'Tempest Reprisal',
    description: 'For six seconds, retaliate against damage up to three times, consuming nearby shock for 80% bonus damage.',
    element: 'lightning', job: 'tempest_sage', kind: 'buff', maxLevel: 10,
    icon: icon('claw'), requires: [{ skillId: 'ltn_grounding_seal', level: 3 }],
    mpCost: int(45, 60, 10), cooldownMs: () => 18000, castTimeMs: 360, sfx: 'buff',
    onCast: tempestReprisal,
    buff: { durationMs: () => 6000, modifiers: () => [], auraVfx: 'ltn_reprisal_aegis' },
    attack: {
      pattern: 'aoe_self', damagePct: lin(34, 50, 10), hits: () => 5, maxTargets: () => 6,
      range: 170, area: { w: 340, h: 200 }, hitIntervalMs: 45,
      bonusVs: { status: 'shock', mult: 1.8, consume: true }, vfx: { area: 'ltn_reprisal_fangs' },
    },
  },
];
