// OWNER: Holy tree agent. Phase 9 custom casts: Dawn Rush (dash that heals per foe), Martyr's Vow (HP sacrifice →
// burst + heal-over-time), Retribution (blows taken call down judgment), Sanctuary (absorb barrier that bursts) and
// Ray of Dawn (channelled beam). Only the SkillContext contract is used (services + runAttack + playVfx + bus).
//
// Every persistent effect goes through `persist()`: one instance per slot, and it always ends on `map:changed`,
// `player:died` and scene shutdown, and never heals / strikes while the caster is dead or on another map.
import Phaser from 'phaser';
import type { AttackSpec, SkillContext } from '../../core/types';
import { playVfx } from '../../core/vfx';
import { bus } from '../../core/events';
import { bodyOrigin, restore } from './casts';

type EndReason = 'expire' | 'break' | 'replace' | 'map' | 'death' | 'shutdown';

interface PersistOpts {
  durationMs: number;
  /** Tick period (ms); `onTick(n)` gets the 1-based tick number. Return false to end the effect early. */
  tickMs?: number;
  onTick?: (n: number) => boolean | void;
  /** Called for every blow the player takes while the effect is alive (amount = HP the blow will remove). */
  onDamaged?: (amount: number) => void;
  /** Called once when the effect ends, with why. Never called with a dead caster for 'expire' / 'break'. */
  onEnd?: (reason: EndReason) => void;
  /** Persistent visual that follows the player (feet by default, or `place`). Destroyed on end. */
  visual?: Phaser.GameObjects.GameObject | null;
  place?: () => { x: number; y: number };
}

export interface Persisted { end: (reason: EndReason) => void; visual: Phaser.GameObjects.GameObject | null }

const active = new Map<string, Persisted>();

/** True while a persistent effect occupies `slot` (debug / tests). */
export function holyEffectActive(slot: string): boolean { return active.has(slot); }

function persist(ctx: SkillContext, slot: string, o: PersistOpts): Persisted {
  active.get(slot)?.end('replace');
  const s = ctx.services;
  const scene = ctx.scene;
  const map = s.game.currentMap();
  const go = o.visual ?? null;
  let done = false;
  let n = 0;
  const offs: (() => void)[] = [];
  const alive = () => !done && !s.progression.isDead() && s.game.currentMap() === map;
  const place = o.place ?? (() => ({ x: s.player.x, y: s.player.y }));

  const sync = () => {
    if (done) return;
    if (!alive()) { end(s.progression.isDead() ? 'death' : 'map'); return; }
    if (go && go.scene) {
      const t = go as unknown as { x: number; y: number };
      const at = place();
      t.x = at.x; t.y = at.y;
    }
  };

  const end = (reason: EndReason) => {
    if (done) return;
    done = true;
    endTimer.remove(false);
    tickTimer?.remove(false);
    offs.forEach(f => f());
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
    if (active.get(slot) === handle) active.delete(slot);
    if (go && go.scene) {
      if (reason === 'shutdown') go.destroy();
      else {
        try {
          scene.tweens.add({ targets: go, alpha: 0, duration: 200, onComplete: () => { if (go.scene) go.destroy(); } });
        } catch { go.destroy(); }
      }
    }
    try { o.onEnd?.(reason); } catch (e) { console.warn('[holy] effect end', e); }
  };
  const onShutdown = () => end('shutdown');

  const endTimer = scene.time.delayedCall(Math.max(1, o.durationMs), () => end('expire'));
  const tickTimer = o.tickMs && o.onTick
    ? scene.time.addEvent({
      delay: o.tickMs, loop: true,
      callback: () => {
        if (done) return;
        if (!alive()) { end(s.progression.isDead() ? 'death' : 'map'); return; }
        n++;
        let keep: boolean | void = true;
        try { keep = o.onTick!(n); } catch (e) { console.warn('[holy] effect tick', e); keep = false; }
        if (keep === false) end('break');
      },
    })
    : null;

  offs.push(bus.on('map:changed', () => end('map')), bus.on('player:died', () => end('death')));
  if (o.onDamaged) {
    offs.push(bus.on('player:damaged', ({ amount }) => {
      if (!alive()) return;
      o.onDamaged!(Math.max(0, amount || 0));
    }));
  }
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
  const handle: Persisted = { end, visual: go };
  active.set(slot, handle);
  sync();
  return handle;
}

/** Run after the current synchronous hit resolves (hitPlayer emits `player:damaged` before it removes the HP). */
const afterHit = (fn: () => void) => Promise.resolve().then(() => { try { fn(); } catch (e) { console.warn('[holy]', e); } });

// ───────────────────────── Dawn Rush (Year 2) ─────────────────────────

export interface RushOpts {
  dist: number;
  /** Fraction of max HP restored on arrival + per foe struck along the path (up to `maxFoes`). */
  healBase: number; healPerFoe: number; maxFoes: number;
  /** Beam spec run along the travelled path (range / area.w are replaced by the real distance). */
  attack: AttackSpec;
}

/** Charge along the ground in a streak of dawn light: every foe on the path is struck, and you mend per foe. */
export function castDawnRush(ctx: SkillContext, o: RushOpts): void {
  const s = ctx.services;
  const p = s.player;
  const aim = p.getAimDir();
  const dir: 1 | -1 = aim.x !== 0 ? (aim.x as 1 | -1) : p.facing;
  p.facing = dir;
  const ox = p.x, oy = p.y;
  playVfx(ctx.scene, 'holy_rush_out', { x: ox, y: oy, facing: dir, targetX: ox + dir * o.dist, targetY: oy, lv: ctx.level });
  p.blink(dir * o.dist, 0);
  const len = Math.max(48, Math.abs(p.x - ox));
  const h = o.attack.area?.h ?? 90;
  const y = oy - 34;
  const rect = new Phaser.Geom.Rectangle(dir > 0 ? ox : ox - len, y - h / 2, len, h);
  let foes = 0;
  try { foes = s.monsters.inRect(rect).length; } catch { foes = 0; }
  ctx.runAttack({ ...o.attack, range: len, area: { ...(o.attack.area ?? { h }), w: len, h } }, { x: ox, y, facing: dir });
  playVfx(ctx.scene, 'holy_rush_in', { x: p.x, y: p.y, facing: dir, targetX: ox, targetY: oy, lv: ctx.level });
  const maxHp = s.progression.derived().maxHp;
  restore(ctx, maxHp * (o.healBase + o.healPerFoe * Math.min(foes, o.maxFoes)), 0);
}

// ───────────────────────── Martyr's Vow (Year 3) ─────────────────────────

export interface MartyrOpts {
  /** Fraction of CURRENT HP paid (never lethal). */
  payPct: number;
  /** Burst of light around the caster, paid for in blood. */
  attack: AttackSpec;
  /** Heal-over-time: fraction of max HP per tick. */
  hotPct: number; ticks: number; tickMs: number;
}

export function castMartyr(ctx: SkillContext, o: MartyrOpts): void {
  const s = ctx.services;
  const p = s.player;
  const prog = s.progression;
  const hp = Math.floor(prog.state.hp);
  const pay = Math.max(0, Math.min(Math.floor(hp * o.payPct), hp - 1));
  if (pay > 0) {
    prog.loseHp(pay);
    s.combat.showNumber(p.x, p.y - 66, pay, 'player', 0);
  }
  playVfx(ctx.scene, 'holy_martyr_cast', { x: p.x, y: p.y, facing: p.facing, lv: ctx.level });
  ctx.runAttack(o.attack, bodyOrigin(ctx));
  const aura = playVfx(ctx.scene, 'holy_martyr_aura', { x: p.x, y: p.y, facing: p.facing, durationMs: o.ticks * o.tickMs, lv: ctx.level }) || null;
  persist(ctx, 'martyr', {
    durationMs: o.ticks * o.tickMs + 60, tickMs: o.tickMs, visual: aura,
    onTick: (n) => {
      restore(ctx, prog.derived().maxHp * o.hotPct, 0);
      return n < o.ticks;
    },
  });
}

// ───────────────────────── Retribution (Year 3) ─────────────────────────

export interface RetributionOpts {
  durationMs: number;
  /** Fraction of each blow's HP loss given back right after it lands. */
  recoverPct: number;
  /** Minimum ms between two retributive strikes. */
  icdMs: number;
  /** aoe_target strike called down on the nearest foe. */
  attack: AttackSpec;
}

export function castRetribution(ctx: SkillContext, o: RetributionOpts): void {
  const s = ctx.services;
  const p = s.player;
  const prog = s.progression;
  playVfx(ctx.scene, 'holy_retrib_cast', { x: p.x, y: p.y, facing: p.facing, lv: ctx.level });
  const aura = playVfx(ctx.scene, 'holy_retrib_aura', { x: p.x, y: p.y, facing: p.facing, durationMs: o.durationMs, lv: ctx.level }) || null;
  let last = -1e9;
  persist(ctx, 'retribution', {
    durationMs: o.durationMs, visual: aura,
    onDamaged: (amount) => {
      const now = ctx.scene.time.now;
      if (now - last >= o.icdMs) {
        const t = s.monsters.nearest(p.x, p.y - 30, o.attack.range, undefined, 160);
        if (t) {
          last = now;
          const facing: 1 | -1 = t.x >= p.x ? 1 : -1;
          ctx.runAttack(o.attack, { x: p.x, y: p.y - 34, facing });
        }
      }
      if (amount > 0) {
        const back = Math.round(amount * o.recoverPct);
        afterHit(() => { if (!prog.isDead() && back > 0) restore(ctx, back, 0); });
      }
    },
  });
}

// ───────────────────────── Sanctuary (Year 4) ─────────────────────────

export interface SanctuaryOpts {
  durationMs: number;
  /** Barrier strength as a fraction of max HP. */
  poolPct: number;
  /** Burst when the barrier breaks or expires; its damage rises by up to ×2 with the share of the pool absorbed. */
  burst: AttackSpec;
}

export function castSanctuary(ctx: SkillContext, o: SanctuaryOpts): void {
  const s = ctx.services;
  const p = s.player;
  const prog = s.progression;
  const pool = Math.max(1, Math.round(prog.derived().maxHp * o.poolPct));
  let absorbed = 0;
  const map = s.game.currentMap();
  playVfx(ctx.scene, 'holy_sanctuary_cast', { x: p.x, y: p.y, facing: p.facing, lv: ctx.level });
  const aura = playVfx(ctx.scene, 'holy_sanctuary_aura', { x: p.x, y: p.y, facing: p.facing, durationMs: o.durationMs, lv: ctx.level }) || null;
  const dim = () => {
    const a = aura as unknown as { setAlpha?: (v: number) => void; scene?: unknown } | null;
    if (a?.scene && a.setAlpha) a.setAlpha(0.35 + 0.65 * Math.max(0, 1 - absorbed / pool));
  };
  const fx = persist(ctx, 'sanctuary', {
    durationMs: o.durationMs, visual: aura,
    onDamaged: (amount) => {
      const left = pool - absorbed;
      if (left <= 0 || amount <= 0) return;
      const a = Math.min(amount, left);
      absorbed += a;
      // The blow's HP is removed after this event: top up now (covers a would-be lethal hit), the rest right after.
      const d = prog.derived();
      const pre = Math.max(0, Math.min(a, Math.floor(d.maxHp - prog.state.hp)));
      if (pre > 0) prog.heal(pre, 0);
      const post = a - pre;
      if (post > 0) afterHit(() => { if (!prog.isDead()) prog.heal(post, 0); });
      s.combat.showNumber(p.x, p.y - 90, Math.round(a), 'heal', 1);
      playVfx(ctx.scene, 'holy_sanctuary_absorb', { x: p.x, y: p.y, facing: p.facing, lv: ctx.level });
      dim();
      if (absorbed >= pool) afterHit(() => fx.end('break'));
    },
    onEnd: (reason) => {
      if (reason !== 'expire' && reason !== 'break') return;
      if (prog.isDead() || s.game.currentMap() !== map) return;
      const mult = 1 + Math.min(1, absorbed / pool);
      const base = o.burst.damagePct;
      ctx.runAttack({ ...o.burst, damagePct: (lv) => base(lv) * mult }, bodyOrigin(ctx));
    },
  });
}

// ───────────────────────── Ray of Dawn (Year 4) ─────────────────────────

export interface ChannelOpts {
  ticks: number;
  tickMs: number;
  /** Beam spec fired from the staff every tick (its area visual is the persistent beam, so `vfx.area` is unused). */
  attack: AttackSpec;
}

export function castDawnRay(ctx: SkillContext, o: ChannelOpts): void {
  const s = ctx.services;
  const p = s.player;
  const facing = p.facing;
  const at = () => ({ x: p.x + 18 * facing, y: p.y - 34 + (o.attack.area?.offsetY ?? 0) });
  const a0 = at();
  const beam = playVfx(ctx.scene, 'holy_dawn_beam', {
    x: a0.x, y: a0.y, facing, w: o.attack.range, h: o.attack.area?.h ?? 64, durationMs: o.ticks * o.tickMs, lv: ctx.level,
  }) || null;
  persist(ctx, 'dawn_ray', {
    durationMs: o.ticks * o.tickMs + 80, tickMs: o.tickMs, visual: beam, place: at,
    onTick: (n) => {
      ctx.runAttack(o.attack, { x: p.x + 18 * facing, y: p.y - 34, facing });
      return n < o.ticks;
    },
  });
}
