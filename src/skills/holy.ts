// OWNER: Holy tree agent. Cleric (Year 2) -> Priest (Year 3) -> Hierophant (Year 4); 8 spells per year.
// Identity: sustain, smite, control. ~10-15% less raw damage than fire, paid back with heals, regen, wards and stuns.
// Max levels deliberately exceed the SP a student earns per year (3/level): builds are choices.
import type { AttackSpec, IconSpec, SkillDef, StatusSpec } from '../core/types';
import { castField, castHeal, castHolyStep, castRestore } from './holy/casts';

/** Linear interpolation across levels 1..max (clamped). */
const L = (a: number, b: number, max: number) => (lv: number) => a + ((b - a) * (Math.min(Math.max(lv, 1), max) - 1)) / Math.max(1, max - 1);
const Li = (a: number, b: number, max: number) => { const f = L(a, b, max); return (lv: number) => Math.round(f(lv)); };
const K = (n: number) => () => n;

const icon = (glyph: IconSpec['glyph'], color = 0xfff3b0, color2 = 0xffc93a, bg = 0x3a2a08): IconSpec => ({ glyph, color, color2, bg });
const iconLight = (glyph: IconSpec['glyph'], color = 0xffffff, color2 = 0x9fe6ff): IconSpec => ({ glyph, color, color2, bg: 0x123048 });
const iconHeal = (glyph: IconSpec['glyph'], color = 0xb8ffa0, color2 = 0xfff3b0): IconSpec => ({ glyph, color, color2, bg: 0x1c3a12 });

/** Stun helper (holy's control tool). */
const stun = (max: number, chance: [number, number], dur: [number, number]): StatusSpec => ({
  kind: 'stun', chance: L(chance[0], chance[1], max), durationMs: L(dur[0], dur[1], max), potency: K(0),
});

// ───────────────────────── custom-cast specs ─────────────────────────

const HEAL_MAX = 20;
/** Heal: fraction of max HP restored + flat share of matk. */
export const healPct = L(0.12, 0.26, HEAL_MAX);
export const healMatk = L(0.3, 0.6, HEAL_MAX);
const HEAL_ATTACK: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(75, 125, HEAL_MAX), hits: K(1), maxTargets: K(6), range: 150,
  area: { w: 300, h: 150, offsetY: 10 }, delayMs: 120,
  vfx: { area: 'holy_heal_area', hit: 'holy_hit' },
};

const STEP_MAX = 10;
const stepDist = L(130, 210, STEP_MAX);
const stepHeal = L(0.02, 0.05, STEP_MAX);

const CONSEC_MAX = 15;
export const CONSECRATION = {
  w: 280, h: 120, tickMs: 800,
  durationMs: L(6000, 9600, CONSEC_MAX),
  healPct: L(0.01, 0.02, CONSEC_MAX),
};
const CONSEC_ATTACK: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(60, 90, CONSEC_MAX), hits: K(1), maxTargets: K(8), range: 140,
  area: { w: CONSECRATION.w, h: CONSECRATION.h },
  status: stun(CONSEC_MAX, [0.04, 0.08], [700, 1000]),
  vfx: { hit: 'holy_hit' },
};

const PRAYER_MAX = 10;
const SALV_MAX = 10;

/** Genesis geometry (the VFX sizes its pillars from the same numbers). */
export const GENESIS = {
  count: (lv: number) => 8 + Math.floor(lv / 2),
  spreadX: 620,
  intervalMs: 150,
  fallHeight: 600,
  area: { w: 150, h: 260 },
};

export const HOLY_SKILLS: SkillDef[] = [
  // ───────────────────────── Year 2 — Cleric (lv 10) ─────────────────────────
  {
    id: 'holy_arrow', name: 'Holy Arrow', job: 'cleric', element: 'holy', kind: 'attack', maxLevel: 20,
    description: 'Loose an arrow of pure light at one enemy; it may stun the target for a moment.',
    icon: icon('holy_cross'), mpCost: Li(11, 20, 20), castTimeMs: 380, sfx: 'cast_holy',
    attack: {
      pattern: 'projectile', damagePct: L(150, 230, 20), hits: K(1), maxTargets: K(1), range: 560,
      projectile: { speed: 700, radius: 14 },
      status: stun(20, [0.06, 0.14], [900, 1300]),
      vfx: { cast: 'holy_cast', projectile: 'holy_arrow_proj', hit: 'holy_hit' },
    },
  },
  {
    id: 'holy_prism', name: 'Prism Shards', job: 'cleric', element: 'holy', kind: 'attack', maxLevel: 15,
    description: 'Split light into three shards that fan out ahead, each striking a different foe.',
    icon: icon('spark', 0xffffff, 0x9fe6ff), requires: [{ skillId: 'holy_arrow', level: 3 }],
    mpCost: Li(14, 24, 15), castTimeMs: 400, sfx: 'cast_holy',
    attack: {
      pattern: 'projectile', damagePct: L(85, 130, 15), hits: K(1), maxTargets: K(1), range: 440,
      projectile: { speed: 640, radius: 12, count: K(3), spreadDeg: 10 },
      vfx: { cast: 'holy_cast', projectile: 'holy_prism_proj', hit: 'holy_hit' },
    },
  },
  {
    id: 'holy_smite', name: 'Smite', job: 'cleric', element: 'holy', kind: 'attack', maxLevel: 15,
    description: 'Bring a hammer of light down on the enemies in front of you, knocking them back and often stunning them.',
    icon: icon('holy_cross', 0xffe066, 0xffffff), requires: [{ skillId: 'holy_arrow', level: 5 }],
    mpCost: Li(16, 26, 15), cooldownMs: L(4000, 2500, 15), castTimeMs: 440, sfx: 'cast_holy',
    attack: {
      pattern: 'melee_arc', damagePct: L(100, 145, 15), hits: K(2), maxTargets: K(5), range: 160,
      area: { w: 160, h: 120, offsetX: 80 }, knockback: 40, delayMs: 160, hitIntervalMs: 110,
      status: stun(15, [0.25, 0.45], [1200, 1800]),
      vfx: { cast: 'holy_cast', area: 'holy_smite_area', hit: 'holy_hit' },
    },
  },
  {
    id: 'holy_heal', name: 'Heal', job: 'cleric', element: 'holy', kind: 'attack', maxLevel: HEAL_MAX,
    description: 'Restore a share of your max HP and sear every enemy crowding around you with holy light.',
    icon: iconHeal('heart'), requires: [{ skillId: 'holy_arrow', level: 1 }],
    mpCost: Li(18, 30, HEAL_MAX), cooldownMs: L(5000, 3000, HEAL_MAX), castTimeMs: 480, sfx: 'heal',
    attack: HEAL_ATTACK,
    onCast: (ctx, lv) => castHeal(ctx, healPct(lv), healMatk(lv), HEAL_ATTACK),
  },
  {
    id: 'holy_bless', name: 'Bless', job: 'cleric', element: 'holy', kind: 'buff', maxLevel: 15,
    description: 'A blessing of light: more defense, magic attack and holy damage for a long time.',
    icon: icon('halo'), requires: [{ skillId: 'holy_heal', level: 3 }],
    mpCost: Li(16, 26, 15), cooldownMs: K(4000), castTimeMs: 500, sfx: 'buff',
    buff: {
      durationMs: L(90000, 180000, 15),
      modifiers: (lv) => [
        { stat: 'def', add: Math.round(L(10, 40, 15)(lv)) },
        { stat: 'matk', mul: L(0.04, 0.12, 15)(lv) },
        { stat: 'dmgHoly', add: L(0.06, 0.16, 15)(lv) },
      ],
      vfx: 'holy_bless_cast', auraVfx: 'holy_bless_aura',
    },
  },
  {
    id: 'holy_step', name: 'Holy Step', job: 'cleric', element: 'holy', kind: 'movement', maxLevel: STEP_MAX,
    description: 'Step through a beam of light to a nearby spot (hold an arrow to aim) and mend a little HP on arrival.',
    icon: icon('wings', 0xffffff, 0xffe066), requires: [{ skillId: 'holy_heal', level: 3 }],
    mpCost: Li(10, 16, STEP_MAX), cooldownMs: L(1200, 800, STEP_MAX), castTimeMs: 150, sfx: 'blink',
    movement: { kind: 'blink', distance: stepDist, vfxOut: 'holy_step_out', vfxIn: 'holy_step_in' },
    onCast: (ctx, lv) => castHolyStep(ctx, stepDist(lv), stepHeal(lv)),
  },
  {
    id: 'holy_divine_focus', name: 'Divine Focus', job: 'cleric', element: 'holy', kind: 'passive', maxLevel: 15,
    description: 'Permanently increases holy damage and mana regeneration.',
    icon: icon('sunburst', 0xfff3b0, 0x7fd6ff), requires: [{ skillId: 'holy_arrow', level: 3 }],
    mpCost: K(0),
    passive: (lv) => [{ stat: 'dmgHoly', add: 0.015 * lv }, { stat: 'mpRegen', add: 2 * lv }],
  },
  {
    id: 'holy_faith', name: 'Faith', job: 'cleric', element: 'holy', kind: 'passive', maxLevel: 10,
    description: 'Permanently increases max HP and HP regeneration.',
    icon: iconHeal('heart', 0xffffff, 0xffd84a), requires: [{ skillId: 'holy_heal', level: 5 }],
    mpCost: K(0),
    passive: (lv) => [{ stat: 'maxHp', mul: +(0.012 * lv).toFixed(3) }, { stat: 'hpRegen', add: 2 * lv }],
  },

  // ───────────────────────── Year 3 — Priest (lv 25) ─────────────────────────
  {
    id: 'holy_shining_ray', name: 'Shining Ray', job: 'priest', element: 'holy', kind: 'attack', maxLevel: 20,
    description: 'Rays of light converge on the nearest foes and burst three times, often stunning them.',
    icon: icon('sunburst'), requires: [{ skillId: 'holy_arrow', level: 10 }],
    mpCost: Li(26, 40, 20), castTimeMs: 480, sfx: 'cast_holy',
    attack: {
      pattern: 'aoe_target', damagePct: L(72, 100, 20), hits: K(3), maxTargets: K(6), range: 380,
      area: { w: 220, h: 170 }, delayMs: 220, hitIntervalMs: 110,
      status: stun(20, [0.15, 0.3], [1200, 2000]),
      vfx: { cast: 'holy_cast', area: 'holy_shining_area', hit: 'holy_hit' },
    },
  },
  {
    id: 'holy_sacred_lance', name: 'Sacred Lance', job: 'priest', element: 'holy', kind: 'attack', maxLevel: 15,
    description: 'Thrust a lance of light straight ahead, piercing every enemy in a long line twice.',
    icon: icon('holy_cross', 0xffffff, 0xffd84a), requires: [{ skillId: 'holy_shining_ray', level: 5 }],
    mpCost: Li(30, 44, 15), cooldownMs: L(3000, 2000, 15), castTimeMs: 460, sfx: 'cast_holy',
    attack: {
      pattern: 'beam', damagePct: L(115, 170, 15), hits: K(2), maxTargets: K(6), range: 520,
      area: { w: 520, h: 70 }, delayMs: 120, hitIntervalMs: 90,
      status: stun(15, [0.08, 0.15], [900, 1300]),
      vfx: { cast: 'holy_lance_cast', area: 'holy_lance_beam', hit: 'holy_hit' },
    },
  },
  {
    id: 'holy_consecration', name: 'Consecration', job: 'priest', element: 'holy', kind: 'attack', maxLevel: CONSEC_MAX,
    description: 'Hallow the ground beneath you: for several seconds it smites enemies on it and mends you while you stand inside.',
    icon: icon('halo', 0xffe066, 0xb8ffa0), requires: [{ skillId: 'holy_heal', level: 10 }],
    mpCost: Li(34, 46, CONSEC_MAX), cooldownMs: L(18000, 13000, CONSEC_MAX), castTimeMs: 560, sfx: 'cast_holy',
    attack: CONSEC_ATTACK,
    onCast: (ctx, lv) => castField(ctx, {
      durationMs: CONSECRATION.durationMs(lv), tickMs: CONSECRATION.tickMs, w: CONSECRATION.w, h: CONSECRATION.h,
      attack: CONSEC_ATTACK, healPct: CONSECRATION.healPct(lv),
    }),
  },
  {
    id: 'holy_symbol', name: 'Holy Symbol', job: 'priest', element: 'holy', kind: 'buff', maxLevel: 15,
    description: 'Raise a holy sigil beneath you: all damage rises and your wounds slowly close.',
    icon: icon('sunburst', 0xffffff, 0xffc93a), requires: [{ skillId: 'holy_bless', level: 5 }],
    mpCost: Li(30, 45, 15), cooldownMs: L(30000, 20000, 15), castTimeMs: 560, sfx: 'buff',
    buff: {
      durationMs: L(60000, 120000, 15),
      modifiers: (lv) => [
        { stat: 'dmgAll', add: L(0.06, 0.15, 15)(lv) },
        { stat: 'hpRegen', add: Math.round(L(10, 45, 15)(lv)) },
      ],
      vfx: 'holy_symbol_cast', auraVfx: 'holy_symbol_aura',
    },
  },
  {
    id: 'holy_prayer', name: 'Prayer of Mana', job: 'priest', element: 'holy', kind: 'buff', maxLevel: PRAYER_MAX,
    description: 'A moment of prayer refills a large share of your mana.',
    icon: iconLight('mana', 0xbfeaff, 0xffffff), requires: [{ skillId: 'holy_divine_focus', level: 5 }],
    mpCost: K(0), cooldownMs: L(45000, 30000, PRAYER_MAX), castTimeMs: 650, sfx: 'heal',
    onCast: (ctx, lv) => castRestore(ctx, 0, L(0.15, 0.3, PRAYER_MAX)(lv), 'holy_prayer'),
  },
  {
    id: 'holy_guardian_spirit', name: 'Guardian Spirit', job: 'priest', element: 'holy', kind: 'summon', maxLevel: 15,
    description: 'A winged spirit of light hovers at your shoulder and fires holy bolts at nearby enemies.',
    icon: icon('wings'), requires: [{ skillId: 'holy_shining_ray', level: 5 }],
    mpCost: Li(32, 46, 15), cooldownMs: L(55000, 45000, 15), castTimeMs: 600, sfx: 'cast_holy',
    summon: {
      durationMs: L(30000, 45000, 15), attackIntervalMs: 1000, offset: { x: 30, y: -104 }, follow: true, vfx: 'holy_guardian',
      attack: {
        pattern: 'projectile', damagePct: L(140, 210, 15), hits: K(1), maxTargets: K(1), range: 460,
        projectile: { speed: 620, radius: 12 },
        status: stun(15, [0.05, 0.1], [800, 1100]),
        vfx: { cast: 'holy_guardian_cast', projectile: 'holy_guardian_bolt', hit: 'holy_hit' },
      },
    },
  },
  {
    id: 'holy_radiant_mastery', name: 'Radiant Mastery', job: 'priest', element: 'holy', kind: 'passive', maxLevel: 15,
    description: 'Holy damage rises and your spells roll closer to their maximum damage.',
    icon: icon('halo', 0xffffff, 0xffd84a), requires: [{ skillId: 'holy_arrow', level: 10 }],
    mpCost: K(0),
    passive: (lv) => [{ stat: 'dmgHoly', add: 0.02 * lv }, { stat: 'mastery', add: 0.012 * lv }],
  },
  {
    id: 'holy_grace', name: 'Grace', job: 'priest', element: 'holy', kind: 'passive', maxLevel: 10,
    description: 'Permanently increases max MP and casting speed.',
    icon: iconLight('book'), requires: [{ skillId: 'holy_prayer', level: 3 }],
    mpCost: K(0),
    passive: (lv) => [{ stat: 'maxMp', mul: +(0.015 * lv).toFixed(3) }, { stat: 'castSpeed', add: +(0.006 * lv).toFixed(3) }],
  },

  // ───────────────────────── Year 4 — Hierophant (lv 40) ─────────────────────────
  {
    id: 'holy_angel_ray', name: 'Angel Ray', job: 'hierophant', element: 'holy', kind: 'attack', maxLevel: 20,
    description: 'Hurl a spear of angelic light that pierces up to four enemies, striking each three times.',
    icon: icon('wings', 0xffffff, 0xffd84a), requires: [{ skillId: 'holy_sacred_lance', level: 10 }],
    mpCost: Li(44, 66, 20), castTimeMs: 480, sfx: 'cast_holy',
    attack: {
      pattern: 'projectile', damagePct: L(115, 180, 20), hits: K(3), maxTargets: K(4), range: 600,
      projectile: { speed: 780, radius: 16, pierce: true }, hitIntervalMs: 80,
      status: stun(20, [0.08, 0.16], [1000, 1500]),
      vfx: { cast: 'holy_angelray_cast', projectile: 'holy_angelray_proj', hit: 'holy_hit_big' },
    },
  },
  {
    id: 'holy_halo_nova', name: 'Halo Nova', job: 'hierophant', element: 'holy', kind: 'attack', maxLevel: 15,
    description: 'A blazing halo bursts outward from you, hurling back and stunning everything close by.',
    icon: icon('halo', 0xffffff, 0xffe066, 0x4a3204), requires: [{ skillId: 'holy_shining_ray', level: 10 }],
    mpCost: Li(50, 70, 15), cooldownMs: L(7000, 5000, 15), castTimeMs: 520, sfx: 'cast_holy',
    attack: {
      pattern: 'aoe_self', damagePct: L(190, 290, 15), hits: K(2), maxTargets: K(10), range: 190,
      area: { w: 380, h: 200 }, knockback: 60, delayMs: 150, hitIntervalMs: 120,
      status: stun(15, [0.25, 0.4], [1500, 2200]),
      vfx: { cast: 'holy_cast_big', area: 'holy_nova_area', hit: 'holy_hit' },
    },
  },
  {
    id: 'holy_genesis', name: 'Genesis', job: 'hierophant', element: 'holy', kind: 'attack', maxLevel: 10,
    description: 'Open the heavens: pillars of light crash down across a wide area, smiting and stunning all beneath.',
    icon: icon('sunburst', 0xffffff, 0xffe066, 0x4a3204),
    requires: [{ skillId: 'holy_angel_ray', level: 5 }, { skillId: 'holy_shining_ray', level: 10 }],
    mpCost: Li(70, 90, 10), cooldownMs: L(55000, 42000, 10), castTimeMs: 820, sfx: 'cast_holy',
    attack: {
      pattern: 'rain', damagePct: L(750, 1150, 10), hits: K(1), maxTargets: K(6), range: 480,
      area: { ...GENESIS.area }, delayMs: 650,
      projectile: { speed: 1500, radius: 20 },
      rain: { count: GENESIS.count, spreadX: GENESIS.spreadX, intervalMs: GENESIS.intervalMs, fallHeight: GENESIS.fallHeight },
      status: stun(10, [0.3, 0.5], [2000, 3000]),
      vfx: { cast: 'holy_genesis_cast', projectile: 'holy_genesis_proj', area: 'holy_genesis_impact', hit: 'holy_hit_big' },
    },
  },
  {
    id: 'holy_judgment', name: 'Judgment', job: 'hierophant', element: 'holy', kind: 'attack', maxLevel: 10,
    description: 'Pass judgment on everything in sight: the whole screen is scoured by light four times, stunning most foes.',
    icon: icon('holy_cross', 0xffffff, 0xffe066, 0x4a3204),
    requires: [{ skillId: 'holy_halo_nova', level: 8 }, { skillId: 'holy_sacred_lance', level: 10 }],
    mpCost: Li(80, 100, 10), cooldownMs: L(80000, 65000, 10), castTimeMs: 900, sfx: 'cast_holy',
    attack: {
      pattern: 'aoe_self', damagePct: L(210, 330, 10), hits: K(4), maxTargets: K(15), range: 700,
      area: { w: 1400, h: 700 }, delayMs: 900, hitIntervalMs: 170,
      status: stun(10, [0.5, 0.8], [2500, 3500]),
      vfx: { cast: 'holy_judgment_cast', area: 'holy_judgment_area', hit: 'holy_hit_big' },
    },
  },
  {
    id: 'holy_seraph', name: 'Summon Seraph', job: 'hierophant', element: 'holy', kind: 'summon', maxLevel: 10,
    description: 'A winged seraph descends to fight at your side, sweeping enemies with beams of divine light.',
    icon: icon('wings', 0xffe066, 0xffffff, 0x4a3204), requires: [{ skillId: 'holy_guardian_spirit', level: 8 }],
    mpCost: Li(60, 85, 10), cooldownMs: L(90000, 70000, 10), castTimeMs: 700, sfx: 'cast_holy',
    summon: {
      durationMs: L(30000, 50000, 10), attackIntervalMs: 1600, offset: { x: -64, y: -96 }, follow: true, vfx: 'holy_seraph',
      attack: {
        pattern: 'beam', damagePct: L(120, 180, 10), hits: K(2), maxTargets: K(5), range: 460,
        area: { w: 460, h: 100, offsetY: 40 }, delayMs: 160, hitIntervalMs: 100,
        status: stun(10, [0.1, 0.2], [1000, 1500]),
        vfx: { cast: 'holy_seraph_cast', area: 'holy_seraph_beam', hit: 'holy_hit' },
      },
    },
  },
  {
    id: 'holy_divine_aegis', name: 'Divine Aegis', job: 'hierophant', element: 'holy', kind: 'buff', maxLevel: 15,
    description: 'Wrap yourself in a golden ward: mana absorbs much of every blow, defense soars and HP regenerates.',
    icon: icon('shield', 0xfff3b0, 0xffd84a), requires: [{ skillId: 'holy_symbol', level: 10 }],
    mpCost: Li(50, 70, 15), cooldownMs: L(90000, 70000, 15), castTimeMs: 600, sfx: 'buff',
    buff: {
      durationMs: L(30000, 60000, 15),
      modifiers: (lv) => [
        { stat: 'mpShield', add: +L(0.2, 0.4, 15)(lv).toFixed(3) },
        { stat: 'def', add: Math.round(L(40, 100, 15)(lv)) },
        { stat: 'hpRegen', add: Math.round(L(20, 70, 15)(lv)) },
      ],
      vfx: 'holy_aegis_cast', auraVfx: 'holy_aegis_aura',
    },
  },
  {
    id: 'holy_salvation', name: 'Salvation', job: 'hierophant', element: 'holy', kind: 'buff', maxLevel: SALV_MAX,
    description: 'An answered prayer: instantly restore most of your HP and some MP. Long cooldown.',
    icon: iconHeal('wings', 0xffffff, 0xb8ffa0), requires: [{ skillId: 'holy_divine_aegis', level: 5 }],
    mpCost: K(0), cooldownMs: L(150000, 110000, SALV_MAX), castTimeMs: 700, sfx: 'heal',
    onCast: (ctx, lv) => castRestore(ctx, L(0.4, 0.8, SALV_MAX)(lv), L(0.15, 0.3, SALV_MAX)(lv), 'holy_salvation'),
  },
  {
    id: 'holy_benediction', name: 'Benediction', job: 'hierophant', element: 'holy', kind: 'passive', maxLevel: 15,
    description: 'Permanently increases critical rate and shortens all cooldowns.',
    icon: iconLight('halo'), requires: [{ skillId: 'holy_radiant_mastery', level: 10 }],
    mpCost: K(0),
    passive: (lv) => [{ stat: 'critRate', add: +(0.01 * lv).toFixed(3) }, { stat: 'cdr', add: +(0.008 * lv).toFixed(3) }],
  },
];
