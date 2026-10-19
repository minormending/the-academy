// OWNER: A3 (fire-tree). Year 5 "Fellowship" — eight Fire spells for the Pyre Archon (postgraduate, lv 55+).
//   Solar Spear (single-target nuke) · Pyroclasm (screen-wide eruption) · Daybreak (Fellowship ultimate)
//   Pyre Brazier (stationary burning field) · Cremation (burn combo payoff) · Pyre Covenant (buff)
//   Archon's Furnace (passive) · Comet Stride (dash that leaves a burning trail)
// Persistent effects use `persistent()` (ends on map change, death, scene shutdown; never acts while dead).
// VFX live in ./vfx5.ts and are registered through fireVfx.ts's lazyRegister.
import { playVfx } from '../../core/vfx';
import type { AttackSpec, GameServices, SkillContext, SkillDef } from '../../core/types';
import { K, L, Li, burn, icon } from './scale';
import { persistent } from './persist';

type Facing = 1 | -1;

const staff = (s: GameServices): { x: number; y: number; facing: Facing } => {
  const p = s.player;
  return { x: p.x + 18 * p.facing, y: p.y - 34, facing: p.facing };
};

// ───────── Solar Spear: a lance of sunlight through the nearest foe (tier-5 single-target primary) ─────────
const SPEAR_MAX = 15;
const SOLAR_SPEAR: AttackSpec = {
  pattern: 'aoe_target', damagePct: L(560, 800, SPEAR_MAX), hits: K(2), maxTargets: K(1), range: 480,
  area: { w: 110, h: 210 }, delayMs: 420, hitIntervalMs: 130,
  status: burn(SPEAR_MAX, [0.7, 1], [4000, 6000], [14, 22]),
  vfx: { cast: 'fire_solar_spear_cast', area: 'fire_solar_spear_area', hit: 'fire_hit_big' },
};

// ───────── Pyroclasm: the ground splits and erupts across the whole screen ─────────
const PYRO_MAX = 15;
const PYROCLASM: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(300, 430, PYRO_MAX), hits: K(3), maxTargets: K(12), range: 330,
  area: { w: 660, h: 300, offsetY: -30 }, delayMs: 520, hitIntervalMs: 120, knockback: 40,
  status: burn(PYRO_MAX, [0.6, 0.9], [4000, 6000], [12, 18]),
  vfx: { cast: 'fire_pyroclasm_cast', area: 'fire_pyroclasm_area', hit: 'fire_hit' },
};

// ───────── Daybreak: Fellowship ultimate — a second sun rises and burns the whole field ─────────
const DAY_MAX = 10;
const DAYBREAK: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(260, 410, DAY_MAX), hits: K(6), maxTargets: K(16), range: 480,
  area: { w: 960, h: 440, offsetY: -60 }, delayMs: 1150, hitIntervalMs: 110,
  status: burn(DAY_MAX, [0.9, 1], [5000, 7000], [14, 22]),
  bonusVs: { status: 'burn', mult: 1.25 },
  vfx: { cast: 'fire_daybreak_cast', area: 'fire_daybreak_area', hit: 'fire_hit_big' },
};

// ───────── Pyre Brazier: a stationary brazier that scorches anything near it ─────────
const BRAZ_MAX = 12;
const BRAZIER: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(130, 200, BRAZ_MAX), hits: K(1), maxTargets: K(8), range: 120,
  area: { w: 270, h: 170, offsetY: -70 },
  status: burn(BRAZ_MAX, [0.5, 0.8], [3000, 4500], [12, 18]),
  vfx: { area: 'fire_brazier_pulse', hit: 'fire_jet_hit' },
};

// ───────── Cremation: cash in burning foes — up to double damage, and the burn is consumed ─────────
const CREM_MAX = 15;
const CREMATION: AttackSpec = {
  pattern: 'aoe_target', damagePct: L(380, 560, CREM_MAX), hits: K(2), maxTargets: K(4), range: 430,
  area: { w: 160, h: 170 }, delayMs: 300, hitIntervalMs: 120,
  bonusVs: { status: 'burn', mult: 2.0, consume: true },
  vfx: { cast: 'fire_cast', area: 'fire_cremation_area', hit: 'fire_hit_big' },
};

// ───────── Comet Stride: dash forward as a comet, leaving a scorched trail that keeps burning ─────────
const COMET_MAX = 12;
const cometDist = Li(240, 360, COMET_MAX);
const TRAIL_TICK_MS = 500;
const TRAIL_TICKS = 4;
const COMET: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(220, 340, COMET_MAX), hits: K(1), maxTargets: K(8), range: 360,
  area: { w: 300, h: 100 },
  status: burn(COMET_MAX, [0.5, 0.8], [3000, 4500], [10, 16]),
  vfx: { area: 'fire_comet_area', hit: 'fire_hit' },
};
const COMET_TRAIL: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(70, 120, COMET_MAX), hits: K(1), maxTargets: K(8), range: 360,
  area: { w: 300, h: 100 },
  status: burn(COMET_MAX, [0.35, 0.6], [2500, 3500], [8, 12]),
  vfx: { area: 'fire_comet_ember', hit: 'fire_jet_hit' },
};

let stopTrail: (() => void) | null = null;

function castCometStride(ctx: SkillContext, lv: number): void {
  const s = ctx.services, p = s.player;
  const aim = p.getAimDir();
  const f: Facing = aim.x !== 0 ? (aim.x > 0 ? 1 : -1) : p.facing;
  const ox = p.x, oy = p.y;
  const dist = cometDist(lv);
  playVfx(ctx.scene, 'fire_comet_out', { x: ox, y: oy, facing: f, targetX: ox + f * dist, targetY: oy, lv });
  p.blink(f * dist, 0);
  const nx = p.x, ny = p.y;
  playVfx(ctx.scene, 'fire_comet_in', { x: nx, y: ny, facing: f, targetX: ox, targetY: oy, lv });
  const w = Math.max(100, Math.abs(nx - ox) + 60);
  const mx = (ox + nx) / 2, my = (oy + ny) / 2 - 34;
  ctx.runAttack({ ...COMET, area: { w, h: 100 } }, { x: mx, y: my, facing: f });
  // The trail smoulders for a couple of seconds; stepping out of it is the counterplay.
  stopTrail?.();
  let wait = 0, n = 0;
  const trail: AttackSpec = { ...COMET_TRAIL, area: { w, h: 90 } };
  stopTrail = persistent(ctx, (dt) => {
    wait += dt;
    while (wait >= TRAIL_TICK_MS && n < TRAIL_TICKS) {
      wait -= TRAIL_TICK_MS; n++;
      ctx.runAttack(trail, { x: mx, y: my, facing: f });
    }
    return n < TRAIL_TICKS;
  }, () => { stopTrail = null; });
}

// ═════════════════════════════ definitions ═════════════════════════════

export const FIRE_Y5: SkillDef[] = [
  {
    id: 'fire_solar_spear', name: 'Solar Spear', job: 'pyre_archon', element: 'fire', kind: 'attack', maxLevel: SPEAR_MAX,
    description: 'Hurl a lance of sunlight through the nearest foe: two white-hot strikes for heavy single-target damage, and a deep burn.',
    icon: icon('missile', 0xfff4d0, 0xff9a1a), requires: [{ skillId: 'fire_inferno_lance', level: 10 }],
    mpCost: Li(70, 96, SPEAR_MAX), cooldownMs: L(7000, 4500, SPEAR_MAX), castTimeMs: 560, sfx: 'explosion',
    attack: SOLAR_SPEAR,
  },
  {
    id: 'fire_pyroclasm', name: 'Pyroclasm', job: 'pyre_archon', element: 'fire', kind: 'attack', maxLevel: PYRO_MAX,
    description: 'Split the ground across the whole screen: magma erupts around you in three blasts, burning up to twelve foes.',
    icon: icon('explosion', 0xffe27a, 0xc2321a), requires: [{ skillId: 'fire_meteor_storm', level: 5 }],
    mpCost: Li(80, 110, PYRO_MAX), cooldownMs: L(24000, 16000, PYRO_MAX), castTimeMs: 700, sfx: 'explosion',
    attack: PYROCLASM,
  },
  {
    id: 'fire_daybreak', name: 'Daybreak', job: 'pyre_archon', element: 'fire', kind: 'attack', maxLevel: DAY_MAX,
    description: 'Fellowship ultimate: raise a second sun over the field. It bursts in six waves of fire and hits burning foes harder.',
    icon: icon('sunburst', 0xffffff, 0xff5a14), requires: [{ skillId: 'fire_supernova', level: 8 }],
    mpCost: Li(120, 160, DAY_MAX), cooldownMs: L(150000, 110000, DAY_MAX), castTimeMs: 1000, sfx: 'explosion',
    attack: DAYBREAK,
  },
  {
    id: 'fire_pyre_brazier', name: 'Pyre Brazier', job: 'pyre_archon', element: 'fire', kind: 'summon', maxLevel: BRAZ_MAX,
    description: 'Plant a brazier that stays put and scorches every enemy near it, again and again, until it gutters out.',
    icon: icon('ember', 0xffe27a, 0xff7a1a), requires: [{ skillId: 'fire_last_ember', level: 3 }],
    mpCost: Li(60, 80, BRAZ_MAX), cooldownMs: L(32000, 24000, BRAZ_MAX), castTimeMs: 600, sfx: 'cast_fire',
    summon: {
      durationMs: L(12000, 18000, BRAZ_MAX), attackIntervalMs: 800, offset: { x: 90, y: 0 }, follow: false, vfx: 'fire_brazier',
      attack: BRAZIER,
    },
  },
  {
    id: 'fire_cremation', name: 'Cremation', job: 'pyre_archon', element: 'fire', kind: 'attack', maxLevel: CREM_MAX,
    description: 'Reduce burning foes to ash: strike up to four enemies for double damage against any that are burning, consuming their burn.',
    icon: icon('skull', 0xfff4d0, 0x9a1a0a), requires: [{ skillId: 'fire_immolation', level: 5 }],
    mpCost: Li(55, 80, CREM_MAX), cooldownMs: L(12000, 8000, CREM_MAX), castTimeMs: 480, sfx: 'explosion',
    attack: CREMATION,
  },
  {
    id: 'fire_pyre_covenant', name: 'Pyre Covenant', job: 'pyre_archon', element: 'fire', kind: 'buff', maxLevel: 10,
    description: 'Swear the Fellowship oath in flame: for a time, deal more fire damage, cast faster and recover skills sooner.',
    icon: icon('halo', 0xfff4d0, 0xff9a1a), requires: [{ skillId: 'fire_ascension', level: 5 }],
    mpCost: Li(70, 90, 10), cooldownMs: L(120000, 90000, 10), castTimeMs: 600, sfx: 'buff',
    buff: {
      durationMs: L(40000, 60000, 10),
      modifiers: (lv) => [
        { stat: 'dmgFire', add: L(0.1, 0.25, 10)(lv) },
        { stat: 'castSpeed', add: L(0.06, 0.15, 10)(lv) },
        { stat: 'cdr', add: L(0.05, 0.15, 10)(lv) },
      ],
      vfx: 'fire_covenant_cast', auraVfx: 'fire_covenant_aura',
    },
  },
  {
    id: 'fire_archon_furnace', name: "Archon's Furnace", job: 'pyre_archon', element: 'fire', kind: 'passive', maxLevel: 15,
    description: 'The fire in you never banks: permanently gain fire damage, critical rate and MP regeneration.',
    icon: icon('flame', 0xfff4d0, 0xff4a10), requires: [{ skillId: 'fire_inferno_heart', level: 5 }],
    mpCost: K(0),
    passive: (lv) => [{ stat: 'dmgFire', add: 0.015 * lv }, { stat: 'critRate', add: 0.006 * lv }, { stat: 'mpRegen', add: 2 * lv }],
  },
  {
    id: 'fire_comet_stride', name: 'Comet Stride', job: 'pyre_archon', element: 'fire', kind: 'movement', maxLevel: COMET_MAX,
    description: 'Streak forward as a comet, scorching everything on the path; the trail you leave keeps burning for two seconds.',
    icon: icon('fireball', 0xfff4d0, 0xff7a1a), requires: [{ skillId: 'fire_wandering_sun', level: 3 }],
    mpCost: Li(40, 56, COMET_MAX), cooldownMs: L(10000, 6500, COMET_MAX), castTimeMs: 220, sfx: 'cast_fire',
    movement: { kind: 'blink', distance: cometDist, vfxOut: 'fire_comet_out', vfxIn: 'fire_comet_in' },
    attack: COMET,
    onCast: castCometStride,
  },
];
