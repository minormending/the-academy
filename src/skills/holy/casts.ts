// OWNER: Holy tree agent. Custom `onCast` behaviours for the holy tree (heals, MP prayer, holy step, consecration field).
// Everything here only uses the SkillContext contract (services + runAttack + playVfx + bus).
import type { AttackSpec, SkillContext } from '../../core/types';
import { playVfx } from '../../core/vfx';
import { bus } from '../../core/events';

/** Restore HP/MP and show the numbers that actually landed. Returns what was restored. */
export function restore(ctx: SkillContext, hp: number, mp: number): { hp: number; mp: number } {
  const s = ctx.services;
  const p = s.player;
  const prog = s.progression;
  const h0 = prog.state.hp, m0 = prog.state.mp;
  prog.heal(Math.max(0, Math.round(hp)), Math.max(0, Math.round(mp)));
  const got = { hp: Math.round(prog.state.hp - h0), mp: Math.round(prog.state.mp - m0) };
  if (got.hp > 0) s.combat.showNumber(p.x, p.y - 72, got.hp, 'heal', 0);
  if (got.mp > 0) s.combat.showNumber(p.x, p.y - 72, got.mp, 'mp', got.hp > 0 ? 1 : 0);
  return got;
}

/** Origin centred on the caster's body (aoe_self centers on origin.x). */
export function bodyOrigin(ctx: SkillContext): { x: number; y: number; facing: 1 | -1 } {
  const p = ctx.services.player;
  return { x: p.x, y: p.y - 34, facing: p.facing };
}

/** Heal: % max HP + a share of matk, then holy damage around the caster. */
export function castHeal(ctx: SkillContext, pct: number, matkShare: number, attack: AttackSpec): void {
  const p = ctx.services.player;
  const d = ctx.services.progression.derived();
  playVfx(ctx.scene, 'holy_heal_self', { x: p.x, y: p.y, facing: p.facing, lv: ctx.level });
  restore(ctx, d.maxHp * pct + d.matk * matkShare, 0);
  ctx.runAttack(attack, bodyOrigin(ctx));
}

/** Prayer of Mana / Salvation style restore with its own VFX key. */
export function castRestore(ctx: SkillContext, hpPct: number, mpPct: number, vfx: string): void {
  const p = ctx.services.player;
  const d = ctx.services.progression.derived();
  playVfx(ctx.scene, vfx, { x: p.x, y: p.y, facing: p.facing, lv: ctx.level });
  restore(ctx, d.maxHp * hpPct, d.maxMp * mpPct);
}

/** Holy Step: blink in the held direction (like Blink) and mend a little HP on arrival. */
export function castHolyStep(ctx: SkillContext, dist: number, healPct: number): void {
  const p = ctx.services.player;
  const aim = p.getAimDir();
  let dx = 0, dy = 0;
  if (aim.x !== 0) dx = aim.x * dist;
  else if (aim.y !== 0) dy = aim.y * dist;
  else dx = p.facing * dist;
  const ox = p.x, oy = p.y;
  playVfx(ctx.scene, 'holy_step_out', { x: ox, y: oy, facing: p.facing, targetX: ox + dx, targetY: oy + dy, lv: ctx.level });
  p.blink(dx, dy);
  playVfx(ctx.scene, 'holy_step_in', { x: p.x, y: p.y, facing: p.facing, targetX: ox, targetY: oy, lv: ctx.level });
  restore(ctx, ctx.services.progression.derived().maxHp * healPct, 0);
}

// ───────────────────────── Consecration (persistent field) ─────────────────────────

let endActiveField: (() => void) | null = null;

export interface FieldOpts {
  durationMs: number;
  tickMs: number;
  /** Field footprint (centered on the caster's feet when cast). */
  w: number; h: number;
  /** Per-tick damage attack (aoe_self; its `area` should match w/h). */
  attack: AttackSpec;
  /** Fraction of max HP restored per tick while the caster stands in the field. */
  healPct: number;
}

/**
 * Consecrate the ground under the caster: every tick it smites monsters in the field and mends the caster if they
 * stand inside. Ends on expiry, death or map change; only one field exists at a time.
 */
export function castField(ctx: SkillContext, o: FieldOpts): void {
  endActiveField?.();
  const s = ctx.services;
  const scene = ctx.scene;
  const p = s.player;
  const fx = p.x, gy = p.y, facing = p.facing;
  const map = s.game.currentMap();
  const go = playVfx(scene, 'holy_consecration_field', { x: fx, y: gy, facing, w: o.w, h: o.h, durationMs: o.durationMs, lv: ctx.level }) || null;
  const ticks = Math.max(1, Math.floor(o.durationMs / o.tickMs));
  let done = false;
  let n = 0;
  const offs: (() => void)[] = [];
  const end = () => {
    if (done) return;
    done = true;
    timer.remove(false);
    offs.forEach(f => f());
    if (endActiveField === end) endActiveField = null;
    if (go && go.scene) {
      try {
        scene.tweens.add({ targets: go, alpha: 0, duration: 250, onComplete: () => { if (go.scene) go.destroy(); } });
      } catch { go.destroy(); }
    }
  };
  const timer = scene.time.addEvent({
    delay: o.tickMs, repeat: ticks - 1,
    callback: () => {
      if (done) return;
      if (s.game.currentMap() !== map || s.progression.isDead()) { end(); return; }
      n++;
      ctx.runAttack(o.attack, { x: fx, y: gy - 34, facing });
      playVfx(scene, 'holy_consecration_pulse', { x: fx, y: gy, facing, w: o.w, lv: ctx.level });
      if (Math.abs(p.x - fx) <= o.w / 2 && Math.abs(p.y - gy) <= o.h) {
        const d = s.progression.derived();
        const h0 = s.progression.state.hp;
        s.progression.heal(Math.round(d.maxHp * o.healPct), 0);
        const got = Math.round(s.progression.state.hp - h0);
        if (got > 0) s.combat.showNumber(p.x, p.y - 72, got, 'heal', 0);
      }
      if (n >= ticks) end();
    },
  });
  offs.push(bus.on('map:changed', end), bus.on('player:died', end));
  endActiveField = end;
}
