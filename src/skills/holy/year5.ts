// OWNER: Holy tree agent. Year 5 — Light Archon (lv 55, "Fellowship"): eight postgraduate Holy spells.
// Identity stays sustain / smite / control: the biggest heals in the game, stun-and-cash-in combos, and a
// Fellowship ultimate that mends you while it scours the field. Persistent effects go through `persist5()`: one
// instance per slot, ended by map change / death / scene shutdown, and never heals or strikes while the caster is dead.
import Phaser from 'phaser';
import type { AttackSpec, IconSpec, SkillContext, SkillDef, StatusSpec } from '../../core/types';
import { playVfx } from '../../core/vfx';
import { bus } from '../../core/events';
import { bodyOrigin, restore } from './casts';

const L = (a: number, b: number, max: number) => (lv: number) => a + ((b - a) * (Math.min(Math.max(lv, 1), max) - 1)) / Math.max(1, max - 1);
const Li = (a: number, b: number, max: number) => { const f = L(a, b, max); return (lv: number) => Math.round(f(lv)); };
const K = (n: number) => () => n;

const icon = (glyph: IconSpec['glyph'], color = 0xffffff, color2 = 0xffe066, bg = 0x4a3204): IconSpec => ({ glyph, color, color2, bg });
const iconHeal = (glyph: IconSpec['glyph'], color = 0xffffff, color2 = 0xb8ffa0): IconSpec => ({ glyph, color, color2, bg: 0x1c3a12 });
const iconLight = (glyph: IconSpec['glyph'], color = 0xffffff, color2 = 0x9fe6ff): IconSpec => ({ glyph, color, color2, bg: 0x123048 });

const stun = (max: number, chance: [number, number], dur: [number, number]): StatusSpec => ({
  kind: 'stun', chance: L(chance[0], chance[1], max), durationMs: L(dur[0], dur[1], max), potency: K(0),
});

// ───────────────────────── persistent effects ─────────────────────────

type EndReason = 'expire' | 'break' | 'replace' | 'map' | 'death' | 'shutdown';
interface PersistOpts {
  durationMs: number;
  tickMs?: number;
  /** 1-based tick number; return false to end early. */
  onTick?: (n: number) => boolean | void;
  visual?: Phaser.GameObjects.GameObject | null;
}
interface Persisted { end: (reason: EndReason) => void }
const active = new Map<string, Persisted>();

/** True while a Year-5 persistent effect occupies `slot` (debug / tests). */
export function holyY5EffectActive(slot: string): boolean { return active.has(slot); }

function persist5(ctx: SkillContext, slot: string, o: PersistOpts): Persisted {
  active.get(slot)?.end('replace');
  const s = ctx.services;
  const scene = ctx.scene;
  const map = s.game.currentMap();
  const go = o.visual ?? null;
  let done = false;
  let n = 0;
  const offs: (() => void)[] = [];
  const alive = () => !done && !s.progression.isDead() && s.game.currentMap() === map;

  const sync = () => {
    if (done) return;
    if (!alive()) { end(s.progression.isDead() ? 'death' : 'map'); return; }
    if (go && go.scene) {
      const t = go as unknown as { x: number; y: number };
      t.x = s.player.x; t.y = s.player.y;
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
        try { scene.tweens.add({ targets: go, alpha: 0, duration: 200, onComplete: () => { if (go.scene) go.destroy(); } }); } catch { go.destroy(); }
      }
    }
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
        try { keep = o.onTick!(n); } catch (e) { console.warn('[holy y5] tick', e); keep = false; }
        if (keep === false) end('break');
      },
    })
    : null;

  offs.push(bus.on('map:changed', () => end('map')), bus.on('player:died', () => end('death')));
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
  const handle: Persisted = { end };
  active.set(slot, handle);
  sync();
  return handle;
}

// ───────────────────────── specs ─────────────────────────

/** Sunfall — the single-target smite (tier-5 ref 650% single target; Holy keeps a mid-pack hit because it also stuns 35-55% of the time). */
const SUN_MAX = 15;
const SUNFALL: AttackSpec = {
  pattern: 'aoe_target', damagePct: L(520, 720, SUN_MAX), hits: K(1), maxTargets: K(1), range: 520,
  area: { w: 130, h: 300 }, delayMs: 380,
  status: stun(SUN_MAX, [0.35, 0.55], [1200, 1800]),
  vfx: { cast: 'holy_cast_big', area: 'holy_sunfall_area', hit: 'holy_hit_big' },
};

/** Empyrean Nova — the big AoE ring. */
const NOVA_MAX = 15;
const NOVA: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(270, 390, NOVA_MAX), hits: K(2), maxTargets: K(12), range: 240,
  area: { w: 480, h: 240 }, knockback: 50, delayMs: 200, hitIntervalMs: 130,
  status: stun(NOVA_MAX, [0.25, 0.4], [1500, 2200]),
  vfx: { cast: 'holy_cast_big', area: 'holy_empyrean_area', hit: 'holy_hit' },
};

/** Fellowship of Light — ultimate: whole-screen scouring + a mending fellowship that smites for a few seconds. */
const FELLOW_MAX = 10;
export const FELLOWSHIP = { ticks: 5, tickMs: 1200, healPct: L(0.025, 0.045, FELLOW_MAX), instantHealPct: L(0.3, 0.5, FELLOW_MAX) };
const FELLOW_BURST: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(250, 390, FELLOW_MAX), hits: K(4), maxTargets: K(15), range: 700,
  area: { w: 1400, h: 700 }, delayMs: 800, hitIntervalMs: 150,
  status: stun(FELLOW_MAX, [0.6, 0.9], [2500, 3500]),
  vfx: { cast: 'holy_fellowship_cast', area: 'holy_fellowship_area', hit: 'holy_hit_big' },
};
const FELLOW_STRIKE: AttackSpec = {
  pattern: 'aoe_target', damagePct: L(90, 160, FELLOW_MAX), hits: K(1), maxTargets: K(3), range: 520,
  area: { w: 120, h: 260 }, delayMs: 100,
  vfx: { area: 'holy_retrib_strike', hit: 'holy_hit' },
};

/** Lantern of Vigil — stationary summon that pulses light and stuns. */
const LANTERN_MAX = 10;

/** Reckoning — combo payoff: cashes in a stun. */
const RECK_MAX = 15;
const RECKONING: AttackSpec = {
  pattern: 'aoe_target', damagePct: L(200, 300, RECK_MAX), hits: K(2), maxTargets: K(4), range: 460,
  area: { w: 200, h: 220 }, delayMs: 300, hitIntervalMs: 140,
  bonusVs: { status: 'stun', mult: 2, consume: true },
  vfx: { cast: 'holy_cast', area: 'holy_reckoning_area', hit: 'holy_hit_big' },
};

/** Covenant of Mercy — the strongest heal in the book: instant mend + a heal over time. */
const COV_MAX = 10;
export const COVENANT = {
  instantPct: L(0.3, 0.5, COV_MAX), matkShare: L(0.8, 1.4, COV_MAX), ticks: 6, tickMs: 1000, hotPct: L(0.03, 0.05, COV_MAX),
};
const COV_BURST: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(120, 200, COV_MAX), hits: K(1), maxTargets: K(6), range: 150,
  area: { w: 300, h: 160 }, delayMs: 120,
  vfx: { area: 'holy_covenant_burst', hit: 'holy_hit' },
};

/** Celestial Stride — movement that smites along the path and bursts on arrival. */
const STRIDE_MAX = 10;
const strideDist = L(240, 360, STRIDE_MAX);
const STRIDE_TRAIL: AttackSpec = {
  pattern: 'beam', damagePct: L(180, 270, STRIDE_MAX), hits: K(1), maxTargets: K(6), range: 300,
  area: { w: 300, h: 100 }, delayMs: 40,
  status: stun(STRIDE_MAX, [0.2, 0.35], [900, 1300]),
  vfx: { area: 'holy_stride_trail', hit: 'holy_hit' },
};
const STRIDE_LAND: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(150, 230, STRIDE_MAX), hits: K(1), maxTargets: K(8), range: 140,
  area: { w: 260, h: 140 }, delayMs: 60,
  vfx: { hit: 'holy_hit' },
};

// ───────────────────────── custom casts ─────────────────────────

function castFellowship(ctx: SkillContext, lv: number): void {
  const s = ctx.services;
  const p = s.player;
  const prog = s.progression;
  playVfx(ctx.scene, 'holy_fellowship_cast', { x: p.x, y: p.y, facing: p.facing, lv });
  restore(ctx, prog.derived().maxHp * FELLOWSHIP.instantHealPct(lv), 0);
  ctx.runAttack(FELLOW_BURST, bodyOrigin(ctx));
  const dur = FELLOWSHIP.ticks * FELLOWSHIP.tickMs;
  const aura = playVfx(ctx.scene, 'holy_fellowship_aura', { x: p.x, y: p.y, facing: p.facing, durationMs: dur, lv }) || null;
  persist5(ctx, 'fellowship', {
    durationMs: dur + 60, tickMs: FELLOWSHIP.tickMs, visual: aura,
    onTick: (n) => {
      restore(ctx, prog.derived().maxHp * FELLOWSHIP.healPct(lv), 0);
      ctx.runAttack(FELLOW_STRIKE, { x: p.x, y: p.y - 34, facing: p.facing });
      return n < FELLOWSHIP.ticks;
    },
  });
}

function castCovenant(ctx: SkillContext, lv: number): void {
  const s = ctx.services;
  const p = s.player;
  const prog = s.progression;
  const d = prog.derived();
  playVfx(ctx.scene, 'holy_covenant_cast', { x: p.x, y: p.y, facing: p.facing, lv });
  restore(ctx, d.maxHp * COVENANT.instantPct(lv) + d.matk * COVENANT.matkShare(lv), 0);
  ctx.runAttack(COV_BURST, bodyOrigin(ctx));
  const dur = COVENANT.ticks * COVENANT.tickMs;
  const aura = playVfx(ctx.scene, 'holy_covenant_aura', { x: p.x, y: p.y, facing: p.facing, durationMs: dur, lv }) || null;
  persist5(ctx, 'covenant', {
    durationMs: dur + 60, tickMs: COVENANT.tickMs, visual: aura,
    onTick: (n) => {
      restore(ctx, prog.derived().maxHp * COVENANT.hotPct(lv), 0);
      return n < COVENANT.ticks;
    },
  });
}

function castStride(ctx: SkillContext, lv: number): void {
  const s = ctx.services;
  const p = s.player;
  const aim = p.getAimDir();
  const dir: 1 | -1 = aim.x !== 0 ? (aim.x as 1 | -1) : p.facing;
  p.facing = dir;
  const dist = strideDist(lv);
  const ox = p.x, oy = p.y;
  playVfx(ctx.scene, 'holy_stride_out', { x: ox, y: oy, facing: dir, targetX: ox + dir * dist, targetY: oy, lv });
  p.blink(dir * dist, 0);
  const len = Math.max(48, Math.abs(p.x - ox));
  const h = STRIDE_TRAIL.area?.h ?? 100;
  const y = oy - 34;
  ctx.runAttack({ ...STRIDE_TRAIL, range: len, area: { ...(STRIDE_TRAIL.area ?? { h }), w: len, h } }, { x: ox, y, facing: dir });
  playVfx(ctx.scene, 'holy_stride_in', { x: p.x, y: p.y, facing: dir, targetX: ox, targetY: oy, lv });
  ctx.runAttack(STRIDE_LAND, { x: p.x, y: p.y - 34, facing: dir });
  restore(ctx, s.progression.derived().maxHp * L(0.03, 0.06, STRIDE_MAX)(lv), 0);
}

// ───────────────────────── the spells ─────────────────────────

export const HOLY_Y5: SkillDef[] = [
  {
    id: 'holy_sunfall', name: 'Sunfall', job: 'light_archon', element: 'holy', kind: 'attack', maxLevel: SUN_MAX,
    description: 'Call a sliver of the sun down on one enemy: a single devastating smite with a good chance to stun it. Short cooldown.',
    icon: icon('sunburst', 0xffffff, 0xffd84a, 0x3a1a08), requires: [{ skillId: 'holy_angel_ray', level: 5 }],
    mpCost: Li(70, 95, SUN_MAX), cooldownMs: L(6000, 4500, SUN_MAX), castTimeMs: 560, sfx: 'cast_holy',
    attack: SUNFALL,
  },
  {
    id: 'holy_empyrean_nova', name: 'Empyrean Nova', job: 'light_archon', element: 'holy', kind: 'attack', maxLevel: NOVA_MAX,
    description: 'Two rings of heavenly fire roll out from you, scorching, shoving back and often stunning up to twelve foes around you.',
    icon: icon('halo', 0xffffff, 0xffe066, 0x4a3204), requires: [{ skillId: 'holy_halo_nova', level: 8 }],
    mpCost: Li(75, 100, NOVA_MAX), cooldownMs: L(9000, 6500, NOVA_MAX), castTimeMs: 560, sfx: 'cast_holy',
    attack: NOVA,
  },
  {
    id: 'holy_fellowship', name: 'Fellowship of Light', job: 'light_archon', element: 'holy', kind: 'attack', maxLevel: FELLOW_MAX,
    description: 'Your whole fellowship answers: you are mended, the screen is scoured four times and most foes stunned, then spirits of light heal you and smite nearby foes for six seconds.',
    icon: icon('wings', 0xffffff, 0xffe066, 0x4a3204),
    requires: [{ skillId: 'holy_genesis', level: 5 }, { skillId: 'holy_judgment', level: 5 }],
    mpCost: Li(100, 130, FELLOW_MAX), cooldownMs: L(120000, 90000, FELLOW_MAX), castTimeMs: 900, sfx: 'cast_holy',
    attack: FELLOW_BURST,
    onCast: (ctx, lv) => castFellowship(ctx, lv),
  },
  {
    id: 'holy_lantern', name: 'Lantern of Vigil', job: 'light_archon', element: 'holy', kind: 'summon', maxLevel: LANTERN_MAX,
    description: 'Plant a lantern of light ahead of you; it pulses about once a second, searing and sometimes stunning up to eight foes in reach.',
    icon: iconLight('halo', 0xffffff, 0xffe066), requires: [{ skillId: 'holy_seraph', level: 3 }],
    mpCost: Li(55, 75, LANTERN_MAX), cooldownMs: L(40000, 30000, LANTERN_MAX), castTimeMs: 520, sfx: 'cast_holy',
    summon: {
      durationMs: L(14000, 20000, LANTERN_MAX), attackIntervalMs: 1100, offset: { x: 90, y: 0 }, follow: false, vfx: 'holy_lantern',
      attack: {
        pattern: 'aoe_self', damagePct: L(170, 260, LANTERN_MAX), hits: K(1), maxTargets: K(8), range: 160,
        area: { w: 320, h: 120, offsetY: -60 }, delayMs: 60,
        status: stun(LANTERN_MAX, [0.2, 0.35], [900, 1300]),
        vfx: { area: 'holy_lantern_pulse', hit: 'holy_hit' },
      },
    },
  },
  {
    id: 'holy_reckoning', name: 'Reckoning', job: 'light_archon', element: 'holy', kind: 'attack', maxLevel: RECK_MAX,
    description: 'Cash in a stun: judgment falls twice on up to four foes ahead, and any stunned foe takes double damage as its stun is spent.',
    icon: icon('holy_cross', 0xffffff, 0xffd84a, 0x3a1a08), requires: [{ skillId: 'holy_halo_nova', level: 3 }],
    mpCost: Li(48, 68, RECK_MAX), cooldownMs: L(12000, 9000, RECK_MAX), castTimeMs: 500, sfx: 'cast_holy',
    attack: RECKONING,
  },
  {
    id: 'holy_covenant', name: 'Covenant of Mercy', job: 'light_archon', element: 'holy', kind: 'buff', maxLevel: COV_MAX,
    description: 'A sacred vow: a huge instant mend, a surge of light that scorches foes beside you, then six seconds of strong regeneration. The strongest heal in the book.',
    icon: iconHeal('heart', 0xffffff, 0xfff3b0), requires: [{ skillId: 'holy_divine_aegis', level: 5 }],
    mpCost: Li(60, 80, COV_MAX), cooldownMs: L(45000, 32000, COV_MAX), castTimeMs: 650, sfx: 'heal',
    attack: COV_BURST,
    onCast: (ctx, lv) => castCovenant(ctx, lv),
  },
  {
    id: 'holy_ascendance', name: 'Ascendance', job: 'light_archon', element: 'holy', kind: 'passive', maxLevel: 15,
    description: 'Permanently increases holy damage, max HP and HP regeneration.',
    icon: iconLight('wings', 0xffffff, 0xffe066), requires: [{ skillId: 'holy_benediction', level: 5 }],
    mpCost: K(0),
    passive: (lv) => [
      { stat: 'dmgHoly', add: +(0.02 * lv).toFixed(3) },
      { stat: 'maxHp', mul: +(0.01 * lv).toFixed(3) },
      { stat: 'hpRegen', add: 8 * lv },
    ],
  },
  {
    id: 'holy_stride', name: 'Celestial Stride', job: 'light_archon', element: 'holy', kind: 'movement', maxLevel: STRIDE_MAX,
    description: 'Streak across the ground in a path of light (hold an arrow to aim): foes on the way are struck and may be stunned, a burst greets those where you land, and you mend a little.',
    icon: iconHeal('wings', 0xfff3b0, 0xffffff), requires: [{ skillId: 'holy_dawn_ray', level: 3 }],
    mpCost: Li(40, 60, STRIDE_MAX), cooldownMs: L(8000, 5000, STRIDE_MAX), castTimeMs: 220, sfx: 'whoosh',
    movement: { kind: 'blink', distance: strideDist, vfxOut: 'holy_stride_out', vfxIn: 'holy_stride_in' },
    onCast: (ctx, lv) => castStride(ctx, lv),
  },
];
