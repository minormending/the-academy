// Year 5 "Fellowship" (postgraduate, Night Archon): eight spells. Existing spell data stays untouched.
import Phaser from 'phaser';
import type { AttackSpec, IconSpec, SkillContext, SkillDef, StatusSpec } from '../../core/types';
import { playVfx } from '../../core/vfx';
import { spellLifetime } from './lifetime';

const L = (a: number, b: number, max: number) => (lv: number) =>
  a + (b - a) * (Math.min(max, Math.max(1, lv)) - 1) / (max - 1);
const Li = (a: number, b: number, max: number) => { const f = L(a, b, max); return (lv: number) => Math.round(f(lv)); };
const K = (n: number) => () => n;
const icon = (glyph: IconSpec['glyph'], color = 0xe6c15a, color2 = 0xb48cff): IconSpec =>
  ({ glyph, color, color2, bg: 0x171020 });
const living = (ctx: SkillContext) => !ctx.services.progression.isDead() && ctx.services.player.state !== 'dead';
const poison = (max: number, chance: [number, number], duration: [number, number], potency: [number, number]): StatusSpec => ({
  kind: 'poison', chance: L(...chance, max), durationMs: Li(...duration, max), potency: L(...potency, max),
});
const curse = (max: number, duration: [number, number], potency: [number, number]): StatusSpec => ({
  kind: 'curse', chance: K(1), durationMs: Li(...duration, max), potency: L(...potency, max),
});

// Reckoning cashes poison first, then curse; each pass consumes its own status.
const RECKON_POISON: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(260, 400, 15), hits: K(1), maxTargets: K(6), range: 170,
  area: { w: 340, h: 170, offsetX: 0 }, bonusVs: { status: 'poison', mult: 2.2, consume: true },
  vfx: { area: 'shd_reckon_poison', hit: 'shd_hit' },
};
const RECKON_CURSE: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(260, 400, 15), hits: K(1), maxTargets: K(6), range: 170,
  area: { w: 340, h: 170, offsetX: 0 }, bonusVs: { status: 'curse', mult: 2, consume: true },
  vfx: { area: 'shd_reckon_curse', hit: 'shd_curse_hit' },
};
const LEDGER: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(400, 600, 10), hits: K(1), maxTargets: K(6), range: 170,
  area: { w: 340, h: 170, offsetX: 0 }, vfx: { area: 'shd_ledger_area', hit: 'shd_drain_hit' },
};
const RIFT_BURST: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(190, 300, 10), hits: K(1), maxTargets: K(6), range: 130,
  area: { w: 260, h: 150, offsetX: 0 }, status: poison(10, [1, 1], [4000, 6000], [10, 16]),
  vfx: { area: 'shd_rift_burst', hit: 'shd_hit' },
};

function reckoning(ctx: SkillContext, lv: number): void {
  if (!living(ctx)) return;
  const p = ctx.services.player, x = p.x, y = p.y - 34, facing = p.facing;
  const scope = spellLifetime(ctx, 700);
  playVfx(ctx.scene, 'shd_reckon_cast', { x, y, facing, lv });
  ctx.runAttack(RECKON_POISON, { x, y, facing });
  scope.after(450, () => ctx.runAttack(RECKON_CURSE, { x, y, facing }));
}

/** Pay HP for a burst, then take back at most half the damage actually dealt (capped), so a lone weak target is a net loss. */
function ledger(ctx: SkillContext, lv: number): void {
  if (!living(ctx)) return;
  const { progression, player, monsters, combat } = ctx.services;
  const stats = progression.derived();
  const paid = Math.min(Math.max(1, Math.round(stats.maxHp * 0.1)), Math.floor(progression.state.hp) - 1);
  if (paid <= 0) return;
  progression.loseHp(paid);
  if (!living(ctx)) return;
  const x = player.x, y = player.y - 34, facing = player.facing;
  const rect = new Phaser.Geom.Rectangle(x - 170, y - 85, 340, 170);
  const targets = monsters.inRect(rect).filter(m => m.alive), before = targets.map(m => m.hp);
  playVfx(ctx.scene, 'shd_ledger', { x: player.x, y: player.y, facing, lv });
  ctx.runAttack(LEDGER, { x, y, facing });
  if (!living(ctx)) return;
  // First-line damage is synchronous; drain only what was really removed.
  const drained = targets.reduce((sum, m, i) => sum + Math.max(0, before[i] - Math.max(0, m.hp)), 0);
  const heal = Math.floor(Math.min(stats.maxHp * L(0.12, 0.2, 10)(lv), drained * 0.5));
  if (heal <= 0) return;
  const hp = progression.state.hp;
  progression.heal(heal, 0);
  combat.showNumber(player.x, player.y - 62, Math.max(0, progression.state.hp - hp), 'heal');
}

/** Blink cutting everything on the path; the origin rift detonates 1.5s later and ends on map change / death / shutdown. */
function penumbraRift(ctx: SkillContext, lv: number): void {
  if (!living(ctx)) return;
  const p = ctx.services.player;
  const x = p.x, y = p.y - 34, groundY = p.y, facing = p.facing;
  p.blink(Li(260, 360, 10)(lv) * facing, 0);
  const distance = Math.abs(p.x - x);
  playVfx(ctx.scene, 'shd_rift_path', { x, y, targetX: p.x, targetY: p.y - 34, facing, lv });
  if (distance < 1 || !living(ctx)) return;
  if (ctx.skill.attack) {
    ctx.runAttack({ ...ctx.skill.attack, range: distance, area: { w: distance, h: 110 } },
      { x, y, facing: p.x >= x ? 1 : -1 });
  }
  if (!living(ctx)) return;
  const scope = spellLifetime(ctx, 1700);
  scope.own(playVfx(ctx.scene, 'shd_rift_open', { x, y, groundY, facing, lv, durationMs: 1500 }));
  scope.after(1500, () => { ctx.runAttack(RIFT_BURST, { x, y, facing }); scope.stop(); });
}

export const SHADOW_Y5: SkillDef[] = [
  {
    id: 'shd_eclipse_cascade', name: 'Eclipse Cascade', job: 'night_archon', element: 'shadow', kind: 'attack', maxLevel: 15,
    description: 'Drag a wide field into eclipse and crush up to 8 foes three times over, leaving a lingering poison.',
    icon: icon('storm', 0xb48cff, 0xe6c15a), requires: [{ skillId: 'shd_death_scythe', level: 5 }],
    mpCost: Li(60, 86, 15), cooldownMs: Li(14000, 10000, 15), castTimeMs: 620, sfx: 'cast_shadow',
    attack: {
      pattern: 'aoe_target', damagePct: L(190, 300, 15), hits: K(3), maxTargets: K(8), range: 420,
      area: { w: 340, h: 210, offsetX: 0 }, delayMs: 300, hitIntervalMs: 260,
      status: poison(15, [0.7, 0.95], [4000, 6000], [10, 16]),
      vfx: { cast: 'shd_cast', area: 'shd_cascade_area', hit: 'shd_cascade_hit' },
    },
  },
  {
    id: 'shd_void_requiem', name: 'Void Requiem', job: 'night_archon', element: 'shadow', kind: 'attack', maxLevel: 15,
    description: 'Fire a funerary spear of void at one foe for heavy damage; cursed targets take 1.3× damage without losing their curse.',
    icon: icon('missile', 0xe6c15a, 0xb48cff), requires: [{ skillId: 'shd_oblivion_lance', level: 5 }],
    mpCost: Li(70, 96, 15), cooldownMs: Li(8000, 6000, 15), castTimeMs: 560, sfx: 'cast_shadow',
    attack: {
      pattern: 'projectile', damagePct: L(650, 950, 15), hits: K(1), maxTargets: K(1), range: 720,
      projectile: { speed: 900, radius: 15 }, bonusVs: { status: 'curse', mult: 1.3, consume: false },
      vfx: { cast: 'shd_requiem_cast', projectile: 'shd_requiem_proj', hit: 'shd_requiem_hit' },
    },
  },
  {
    id: 'shd_fellowship_of_night', name: 'Fellowship of Night', job: 'night_archon', element: 'shadow', kind: 'attack', maxLevel: 10,
    description: 'Call the fellowship of the dead: a vast rain of gilded shadow spears that curses and shatters up to 6 foes per impact.',
    icon: icon('scythe', 0xe6c15a, 0xb48cff), requires: [{ skillId: 'shd_night_tide', level: 5 }],
    mpCost: Li(95, 125, 10), cooldownMs: Li(150000, 120000, 10), castTimeMs: 1000, sfx: 'cast_shadow',
    attack: {
      pattern: 'rain', damagePct: L(1500, 2400, 10), hits: K(1), maxTargets: K(6), range: 620,
      area: { w: 220, h: 170, offsetX: 300 }, delayMs: 800,
      projectile: { speed: 1000, radius: 22 },
      rain: { count: (lv) => 7 + Math.floor(Math.min(10, Math.max(1, lv)) / 2), spreadX: 620, intervalMs: 190, fallHeight: 560 },
      status: curse(10, [6000, 9000], [0.15, 0.3]),
      vfx: { cast: 'shd_fellowship_cast', projectile: 'shd_fellowship_proj', area: 'shd_fellowship_impact', hit: 'shd_curse_hit' },
    },
  },
  {
    id: 'shd_gravewarden', name: 'Gravewarden', job: 'night_archon', element: 'shadow', kind: 'summon', maxLevel: 15,
    description: 'Raise a hulking warden that holds its ground and shatters nearby foes with curse-laden pulses every 1.8s.',
    icon: icon('shield', 0xe6c15a, 0xdde6ba), requires: [{ skillId: 'shd_lich_shade', level: 3 }],
    mpCost: Li(70, 92, 15), cooldownMs: Li(70000, 55000, 15), castTimeMs: 700, sfx: 'cast_shadow',
    summon: {
      durationMs: Li(20000, 32000, 15), attackIntervalMs: 1800, offset: { x: 80, y: -44 }, follow: false, vfx: 'shd_warden',
      attack: {
        pattern: 'aoe_self', damagePct: L(200, 320, 15), hits: K(1), maxTargets: K(6), range: 180,
        area: { w: 360, h: 190, offsetX: 0 }, delayMs: 120,
        status: curse(15, [3000, 5000], [0.1, 0.2]),
        vfx: { area: 'shd_warden_pulse', hit: 'shd_curse_hit' },
      },
    },
  },
  {
    id: 'shd_reckoning', name: 'Reckoning', job: 'night_archon', element: 'shadow', kind: 'attack', maxLevel: 15,
    description: 'Cash in your attrition: one sweep consumes poison for 2.2× damage, a second consumes curse for 2×.',
    icon: icon('skull', 0xe6c15a, 0x9dce69), requires: [{ skillId: 'shd_hex_relay', level: 3 }],
    mpCost: Li(52, 74, 15), cooldownMs: Li(13000, 9500, 15), castTimeMs: 560, sfx: 'curse',
    attack: RECKON_POISON, onCast: reckoning,
  },
  {
    id: 'shd_faustian_ledger', name: 'Faustian Ledger', job: 'night_archon', element: 'shadow', kind: 'attack', maxLevel: 10,
    description: 'Pay 10% of your maximum HP for a burst of shadow, then reclaim half of the damage dealt (capped at 12-20% of maximum HP).',
    icon: icon('heart', 0xe6c15a, 0xc76c85), requires: [{ skillId: 'shd_soul_ward', level: 3 }],
    mpCost: Li(40, 56, 10), cooldownMs: Li(22000, 16000, 10), castTimeMs: 520, sfx: 'curse',
    attack: LEDGER, onCast: ledger,
  },
  {
    id: 'shd_archon_dominion', name: 'Archon Dominion', job: 'night_archon', element: 'shadow', kind: 'passive', maxLevel: 15,
    description: 'Permanently increase shadow damage, maximum MP and mana regeneration.',
    icon: icon('eye', 0xe6c15a, 0xb48cff), requires: [{ skillId: 'shd_grave_pact', level: 5 }], mpCost: K(0),
    passive: lv => [
      { stat: 'dmgShadow', add: L(0.03, 0.35, 15)(lv) },
      { stat: 'maxMp', mul: L(0.02, 0.15, 15)(lv) },
      { stat: 'mpRegen', add: L(3, 40, 15)(lv) },
    ],
  },
  {
    id: 'shd_penumbra_rift', name: 'Penumbra Rift', job: 'night_archon', element: 'shadow', kind: 'movement', maxLevel: 10,
    description: 'Blink through foes, cutting all in your path; the rift left behind collapses 1.5s later in a poisonous burst.',
    icon: icon('teleport', 0xe6c15a, 0xb48cff), requires: [{ skillId: 'shd_veil_of_night', level: 3 }],
    mpCost: Li(38, 54, 10), cooldownMs: Li(9000, 6500, 10), castTimeMs: 180, sfx: 'blink',
    movement: { kind: 'blink', distance: Li(260, 360, 10) },
    attack: { pattern: 'beam', damagePct: L(220, 340, 10), hits: K(1), maxTargets: K(6), range: 360,
      area: { w: 360, h: 110 }, vfx: { hit: 'shd_hit' } },
    onCast: penumbraRift,
  },
];
