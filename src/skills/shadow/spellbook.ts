// Phase 9 additions only. Existing spell data stays in shadow.ts unchanged.
import Phaser from 'phaser';
import type { AttackSpec, IconSpec, SkillContext, SkillDef } from '../../core/types';
import { playVfx } from '../../core/vfx';
import { spellLifetime } from './lifetime';

const L = (a: number, b: number, max: number) => (lv: number) =>
  a + (b - a) * (Math.min(max, Math.max(1, lv)) - 1) / (max - 1);
const Li = (a: number, b: number, max: number) => { const f = L(a, b, max); return (lv: number) => Math.round(f(lv)); };
const K = (n: number) => () => n;
const icon = (glyph: IconSpec['glyph']): IconSpec => ({ glyph, color: 0xb48cff, color2: 0x9dce69, bg: 0x171020 });
const living = (ctx: SkillContext) => !ctx.services.progression.isDead() && ctx.services.player.state !== 'dead';

const MINE: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(90, 140, 10), hits: K(1), maxTargets: K(5), range: 90,
  area: { w: 180, h: 100, offsetX: 0 },
  status: { kind: 'poison', chance: K(1), durationMs: K(4000), potency: K(10) },
  vfx: { area: 'shd_mine_burst', hit: 'shd_hit' },
};
const DOOM: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(160, 240, 15), hits: K(1), maxTargets: K(6), range: 120,
  area: { w: 240, h: 150, offsetX: 0 },
  bonusVs: { status: 'curse', mult: 1.75, consume: true },
  vfx: { area: 'shd_doom_collapse', hit: 'shd_curse_hit' },
};
const WARD: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(90, 140, 10), hits: K(1), maxTargets: K(6), range: 160,
  area: { w: 320, h: 160, offsetX: 0 },
  vfx: { area: 'shd_soul_ward_pulse', hit: 'shd_drain_hit' },
};

function castMine(ctx: SkillContext, lv: number): void {
  if (!living(ctx)) return;
  const p = ctx.services.player;
  const x = p.x + p.facing * 90, y = p.y - 34, facing = p.facing;
  const scope = spellLifetime(ctx, 8000);
  scope.own(playVfx(ctx.scene, 'shd_grave_mine', { x, y, groundY: p.y, facing, lv, durationMs: 8000 }));
  const rect = new Phaser.Geom.Rectangle(x - 90, y - 50, 180, 100);
  const check = () => {
    if (ctx.services.monsters.inRect(rect).some(m => m.alive)) {
      ctx.runAttack(MINE, { x, y, facing });
      scope.stop();
    } else scope.after(100, check);
  };
  scope.after(100, check);
}

function bloodTithe(ctx: SkillContext, lv: number): void {
  if (!living(ctx)) return;
  const { progression, player, combat } = ctx.services;
  const stats = progression.derived();
  const price = Math.max(1, Math.round(stats.maxHp * 0.08));
  const paid = Math.min(price, Math.max(0, progression.state.hp - 1));
  if (paid <= 0) return;
  const beforeHp = progression.state.hp, beforeMp = progression.state.mp;
  progression.loseHp(paid);
  if (!living(ctx)) return;
  const actualPaid = Math.max(0, beforeHp - progression.state.hp);
  progression.heal(0, Math.floor(stats.maxMp * L(0.06, 0.12, 10)(lv) * actualPaid / price));
  combat.showNumber(player.x, player.y - 62, Math.max(0, progression.state.mp - beforeMp), 'mp');
  playVfx(ctx.scene, 'shd_blood_tithe', { x: player.x, y: player.y, facing: player.facing, lv });
}

function umbraPassage(ctx: SkillContext, lv: number): void {
  if (!living(ctx)) return;
  const p = ctx.services.player;
  const x = p.x, y = p.y - 34, facing = p.facing;
  p.blink(Li(200, 280, 10)(lv) * facing, 0);
  // Damage and art follow the actual clamped displacement, including a wall-blocked blink.
  const distance = Math.abs(p.x - x);
  playVfx(ctx.scene, 'shd_umbra_passage', { x, y, targetX: p.x, targetY: p.y - 34, facing, lv });
  if (distance < 1 || !living(ctx) || !ctx.skill.attack) return;
  ctx.runAttack({ ...ctx.skill.attack, range: distance, area: { w: distance, h: 100 } },
    { x, y, facing: p.x >= x ? 1 : -1 });
}

function doomSeal(ctx: SkillContext, lv: number): void {
  if (!living(ctx) || !ctx.skill.attack) return;
  const { player, monsters } = ctx.services;
  const facing = player.facing, staffX = player.x + 18 * facing, staffY = player.y - 34;
  const target = monsters.nearest(staffX, staffY, 400, facing, 140);
  const bounds = target?.getBounds();
  const x = bounds?.centerX ?? staffX + facing * 400, y = bounds?.centerY ?? staffY;
  const scope = spellLifetime(ctx, 2100);
  scope.own(playVfx(ctx.scene, 'shd_doom_seal', { x, y, facing, lv, durationMs: 2000 }));
  ctx.runAttack({ ...ctx.skill.attack, pattern: 'aoe_self' }, { x, y, facing });
  scope.after(2000, () => { ctx.runAttack(DOOM, { x, y, facing }); scope.stop(); });
}

function soulWard(ctx: SkillContext, lv: number): void {
  if (!living(ctx)) return;
  const { player, monsters, progression, combat } = ctx.services;
  const x = player.x, y = player.y - 34, facing = player.facing;
  const scope = spellLifetime(ctx, 8100);
  scope.own(playVfx(ctx.scene, 'shd_soul_ward', { x, y, groundY: player.y, facing, lv, durationMs: 8000 }));
  const rect = new Phaser.Geom.Rectangle(x - 160, y - 80, 320, 160);
  let pulses = 0;
  const pulse = () => {
    const cursed = monsters.inRect(rect).filter(m => m.alive && m.hasStatus('curse'));
    if (cursed.length) {
      const before = cursed.map(m => m.hp);
      ctx.runAttack(WARD, { x, y, facing });
      if (!scope.alive()) return;
      // First-line damage is synchronous; drain only actual HP removed from cursed targets.
      const drained = cursed.reduce((sum, m, i) => sum + Math.max(0, before[i] - Math.max(0, m.hp)), 0);
      const heal = Math.floor(Math.min(progression.derived().maxHp * 0.01, drained * 0.1));
      if (heal > 0) {
        const hp = progression.state.hp;
        progression.heal(heal, 0);
        combat.showNumber(player.x, player.y - 62, Math.max(0, progression.state.hp - hp), 'heal');
      }
    }
    if (++pulses >= 8) scope.stop(); else scope.after(1000, pulse);
  };
  scope.after(1000, pulse);
}

export const SHADOW_SPELLBOOK_ADDITIONS: SkillDef[] = [
  {
    id: 'shd_grave_mine', name: 'Grave Mine', job: 'occultist', element: 'shadow', kind: 'summon', maxLevel: 10,
    description: 'Set one eight-second grave trap that bursts into poison when a foe enters it.',
    icon: icon('skull'), mpCost: Li(16, 24, 10), cooldownMs: K(8000), castTimeMs: 400, sfx: 'curse',
    summon: { durationMs: K(8000), attackIntervalMs: 100, offset: { x: 90, y: -34 }, follow: false,
      vfx: 'shd_grave_mine', attack: MINE },
    onCast: castMine,
  },
  {
    id: 'shd_bitter_harvest', name: 'Bitter Harvest', job: 'occultist', element: 'shadow', kind: 'attack', maxLevel: 15,
    description: 'Cleave nearby foes for double damage against poison, consuming it for immediate burst.',
    icon: icon('scythe'), requires: [{ skillId: 'shd_shadow_bolt', level: 3 }],
    mpCost: Li(18, 26, 15), cooldownMs: Li(6500, 5000, 15), castTimeMs: 440, sfx: 'whoosh',
    attack: { pattern: 'melee_arc', damagePct: L(95, 145, 15), hits: K(1), maxTargets: K(5), range: 230,
      area: { w: 230, h: 120, offsetX: 115 }, bonusVs: { status: 'poison', mult: 2, consume: true },
      vfx: { area: 'shd_bitter_harvest', hit: 'shd_hit' } },
  },
  {
    id: 'shd_blood_tithe', name: 'Blood Tithe', job: 'occultist', element: 'shadow', kind: 'buff', maxLevel: 10,
    description: 'Trade 8% maximum HP for 6–12% maximum MP; partial payments restore proportionally less mana.',
    icon: icon('mana'), mpCost: K(0), cooldownMs: K(25000), castTimeMs: 500, sfx: 'curse', onCast: bloodTithe,
  },
  {
    id: 'shd_umbra_passage', name: 'Umbra Passage', job: 'necromancer', element: 'shadow', kind: 'movement', maxLevel: 10,
    description: 'Blink forward through enemies, cutting every foe along the distance actually travelled.',
    icon: icon('teleport'), mpCost: Li(28, 40, 10), cooldownMs: Li(8000, 6000, 10), castTimeMs: 180, sfx: 'blink',
    movement: { kind: 'blink', distance: Li(200, 280, 10) },
    attack: { pattern: 'beam', damagePct: L(130, 220, 10), hits: K(1), maxTargets: K(6), range: 280,
      area: { w: 280, h: 100 }, vfx: { hit: 'shd_hit' } },
    onCast: umbraPassage,
  },
  {
    id: 'shd_dirge_channel', name: 'Dirge Channel', job: 'necromancer', element: 'shadow', kind: 'summon', maxLevel: 10,
    description: 'Channel through a following wraith for 2.6 seconds; its rapid beams punish cursed foes.',
    icon: icon('ghost'), mpCost: Li(30, 42, 10), cooldownMs: K(12000), castTimeMs: 450, sfx: 'cast_shadow',
    summon: { durationMs: K(2600), attackIntervalMs: 400, offset: { x: 26, y: -34 }, follow: true,
      vfx: 'shd_dirge_wraith',
      attack: { pattern: 'beam', damagePct: L(38, 55, 10), hits: K(1), maxTargets: K(4), range: 360,
        area: { w: 360, h: 60 }, bonusVs: { status: 'curse', mult: 1.4, consume: false },
        vfx: { area: 'shd_dirge_beam', hit: 'shd_hit' } } },
  },
  {
    id: 'shd_doom_seal', name: 'Doom Seal', job: 'necromancer', element: 'shadow', kind: 'attack', maxLevel: 15,
    description: 'Curse a fixed target zone, then collapse it after two seconds to consume curses for bonus damage.',
    icon: icon('eye'), mpCost: Li(28, 40, 15), cooldownMs: Li(10000, 8000, 15), castTimeMs: 500, sfx: 'curse',
    attack: { pattern: 'aoe_target', damagePct: L(40, 65, 15), hits: K(1), maxTargets: K(6), range: 400,
      area: { w: 240, h: 150, offsetX: 0 },
      status: { kind: 'curse', chance: K(1), durationMs: K(6000), potency: K(0.1) },
      vfx: { hit: 'shd_curse_hit' } },
    onCast: doomSeal,
  },
  {
    id: 'shd_hex_relay', name: 'Hex Relay', job: 'umbral_sage', element: 'shadow', kind: 'attack', maxLevel: 15,
    description: 'Relay a death sentence between scattered foes, consuming each curse for 1.8× damage.',
    icon: icon('chain'), requires: [{ skillId: 'shd_hex', level: 3 }],
    mpCost: Li(48, 65, 15), cooldownMs: Li(13000, 10000, 15), castTimeMs: 600, sfx: 'curse',
    attack: { pattern: 'chain', damagePct: L(210, 320, 15), hits: K(1), maxTargets: K(6), range: 500,
      chain: { jumpRange: 250, jumpDelayMs: 120 }, bonusVs: { status: 'curse', mult: 1.8, consume: true },
      vfx: { area: 'shd_hex_relay', hit: 'shd_curse_hit' } },
  },
  {
    id: 'shd_soul_ward', name: 'Soul Ward', job: 'umbral_sage', element: 'shadow', kind: 'buff', maxLevel: 10,
    description: 'Plant an eight-second ward; cursed foes fuel damage pulses and life drain capped at 1% HP per pulse.',
    icon: icon('heart'), mpCost: Li(65, 85, 10), cooldownMs: K(45000), castTimeMs: 650, sfx: 'cast_shadow',
    attack: WARD, onCast: soulWard,
  },
];
