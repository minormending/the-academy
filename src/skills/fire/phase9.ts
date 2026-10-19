// OWNER: A3 (fire-tree). Phase 9 — eight more Fire spells (+3 Year 2, +3 Year 3, +2 Year 4), each a new kind of play:
//   Y2  Cinder Mine (trap) · Flamethrower (channel) · Kindling Brand (mark + death-chain)
//   Y3  Flashover (burn spread combo) · Backdraft (blast + recoil blink) · Vent Heat (buff → burst)
//   Y4  Last Ember (missing-HP nuke) · Wandering Sun (drifting field that collapses on burns)
// Persistent effects use `persistent()` (ends on map change, death, scene shutdown; never acts while dead).
import Phaser from 'phaser';
import { bus } from '../../core/events';
import { playVfx } from '../../core/vfx';
import type { AttackSpec, GameServices, IMonster, SkillContext, SkillDef } from '../../core/types';
import { K, L, Li, burn, icon } from './scale';
import { centerOf, fadeOut, groundAt, persistent, playerAlive } from './persist';

type GO = Phaser.GameObjects.GameObject;
type Facing = 1 | -1;

const staff = (s: GameServices): { x: number; y: number; facing: Facing } => {
  const p = s.player;
  return { x: p.x + 18 * p.facing, y: p.y - 34, facing: p.facing };
};

const setXY = (go: GO | null, x: number, y: number) => {
  const t = go as unknown as { x?: number; y?: number; scene?: unknown } | null;
  if (t && t.scene) { t.x = x; t.y = y; }
};

// ═════════════════════════════ Year 2 — Pyromancer ═════════════════════════════

// ───────── Cinder Mine: a pressure trap that erupts when a foe steps on it ─────────
const MINE_MAX = 15;
const mineCap = (lv: number) => (lv >= 10 ? 3 : 2);
const mineLife = L(15000, 25000, MINE_MAX);
const MINE_ARM_MS = 500;
const MINE_TRIGGER = { w: 76, h: 96 };
const MINE_BLAST: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(150, 215, MINE_MAX), hits: K(2), maxTargets: K(6), range: 95,
  area: { w: 190, h: 130, offsetY: -20 }, knockback: 40, hitIntervalMs: 110,
  status: burn(MINE_MAX, [0.5, 0.8], [3000, 4500], [10, 16]),
  vfx: { area: 'fire_mine_blast', hit: 'fire_hit' },
};

interface Mine { x: number; gy: number; armIn: number; life: number; armed: boolean; go: GO | null; ctx: SkillContext; facing: Facing }
let mines: Mine[] = [];
let stopMines: (() => void) | null = null;

function castCinderMine(ctx: SkillContext, lv: number): void {
  const s = ctx.services, scene = ctx.scene, p = s.player;
  const f = p.facing;
  const x = p.x + f * 34;
  const gy = groundAt(s, x, p.y - 4);
  playVfx(scene, 'fire_mine_cast', { x: p.x + 18 * f, y: p.y - 34, facing: f, targetX: x, targetY: gy, lv });
  const go = playVfx(scene, 'fire_mine', { x, y: gy, facing: f, lv, durationMs: mineLife(lv) }) || null;
  mines.push({ x, gy, armIn: MINE_ARM_MS, life: mineLife(lv), armed: false, go, ctx, facing: f });
  // Over the cap: the oldest mine fizzles.
  while (mines.length > mineCap(lv)) {
    const old = mines.shift()!;
    playVfx(scene, 'fire_mine_fizzle', { x: old.x, y: old.gy, facing: old.facing, lv });
    fadeOut(scene, old.go, 120);
  }
  if (stopMines) return;
  stopMines = persistent(ctx, (dt) => {
    for (const m of [...mines]) {
      m.life -= dt;
      if (m.life <= 0) {
        mines.splice(mines.indexOf(m), 1);
        playVfx(scene, 'fire_mine_fizzle', { x: m.x, y: m.gy, facing: m.facing, lv });
        fadeOut(scene, m.go, 160);
        continue;
      }
      if (!m.armed) {
        m.armIn -= dt;
        if (m.armIn <= 0) { m.armed = true; playVfx(scene, 'fire_mine_arm', { x: m.x, y: m.gy, facing: m.facing, lv }); }
        continue;
      }
      const r = new Phaser.Geom.Rectangle(m.x - MINE_TRIGGER.w / 2, m.gy - MINE_TRIGGER.h, MINE_TRIGGER.w, MINE_TRIGGER.h + 6);
      if (!s.monsters.inRect(r).some(mm => mm.alive)) continue;
      mines.splice(mines.indexOf(m), 1);
      if (m.go && m.go.scene) m.go.destroy();
      m.ctx.runAttack(MINE_BLAST, { x: m.x, y: m.gy - 34, facing: m.facing });
    }
    return mines.length > 0;
  }, () => {
    for (const m of mines) fadeOut(scene, m.go, 120);
    mines = [];
    stopMines = null;
  });
}

// ───────── Flamethrower: a short channel that follows your facing ─────────
const FT_MAX = 15;
const FT_TICKS = 6;
const FT_TICK_MS = 150;
const FLAMETHROWER: AttackSpec = {
  pattern: 'melee_arc', damagePct: L(48, 70, FT_MAX), hits: K(1), maxTargets: K(5), range: 210,
  area: { w: 210, h: 90, offsetX: 110 },
  status: burn(FT_MAX, [0.12, 0.22], [2500, 3500], [8, 12]),
  vfx: { area: 'fire_flamethrower', hit: 'fire_jet_hit' },
};

let stopChannel: (() => void) | null = null;

function castFlamethrower(ctx: SkillContext, lv: number): void {
  const s = ctx.services, scene = ctx.scene;
  stopChannel?.();
  playVfx(scene, 'fire_flamethrower_cast', { ...staff(s), lv });
  let n = 0;
  let wait = 0;
  const gust = () => { n++; ctx.runAttack(FLAMETHROWER, { ...staff(s), y: s.player.y - 30 }); };
  gust();
  stopChannel = persistent(ctx, (dt) => {
    // Knocked back (hit-stun) breaks the channel: the risk of standing in melee range.
    if (s.player.state === 'hit') return false;
    wait += dt;
    while (wait >= FT_TICK_MS && n < FT_TICKS) { wait -= FT_TICK_MS; gust(); }
    return n < FT_TICKS;
  }, () => { stopChannel = null; });
}

// ───────── Kindling Brand: a mark that burns long and bursts on death ─────────
const BRAND_MAX = 12;
const brandLife = L(8000, 12000, BRAND_MAX);
const BRAND: AttackSpec = {
  pattern: 'aoe_target', damagePct: L(80, 120, BRAND_MAX), hits: K(1), maxTargets: K(3), range: 420,
  area: { w: 130, h: 130 }, delayMs: 120,
  status: burn(BRAND_MAX, [1, 1], [6000, 9000], [16, 24]),
  vfx: { cast: 'fire_cast', area: 'fire_brand_area', hit: 'fire_hit' },
};
const BRAND_BURST: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(130, 190, BRAND_MAX), hits: K(1), maxTargets: K(6), range: 90,
  area: { w: 180, h: 140 }, knockback: 30,
  status: burn(BRAND_MAX, [0.6, 0.9], [3000, 4500], [10, 16]),
  vfx: { area: 'fire_brand_burst', hit: 'fire_hit' },
};

interface Brand { m: IMonster; life: number; go: GO | null; ctx: SkillContext }
const brands = new Map<number, Brand>();
let stopBrands: (() => void) | null = null;

/** The foes an aoe_target cast from `o` will hit (mirrors the engine's front-nearest + rect pick). */
function brandTargets(s: GameServices, o: { x: number; y: number; facing: Facing }, spec: AttackSpec, max: number): IMonster[] {
  const t = s.monsters.nearest(o.x, o.y, spec.range + 30, o.facing, 140);
  if (!t) return [];
  const c = centerOf(t);
  const a = spec.area ?? { w: 120, h: 120 };
  const r = new Phaser.Geom.Rectangle(c.x - a.w / 2, c.y - a.h / 2, a.w, a.h);
  return s.monsters.inRect(r).filter(m => m.alive)
    .sort((a1, b1) => Math.abs(centerOf(a1).x - c.x) - Math.abs(centerOf(b1).x - c.x)).slice(0, max);
}

function castKindlingBrand(ctx: SkillContext, lv: number): void {
  const s = ctx.services, scene = ctx.scene;
  const o = staff(s);
  const targets = brandTargets(s, o, BRAND, 3);
  ctx.runAttack(BRAND, o);
  for (const m of targets) {
    const old = brands.get(m.uid);
    if (old) { old.life = brandLife(lv); old.ctx = ctx; continue; }
    const c = centerOf(m);
    const go = playVfx(scene, 'fire_brand_mark', { x: c.x, y: c.y - c.h / 2 - 14, facing: o.facing, lv }) || null;
    brands.set(m.uid, { m, life: brandLife(lv), go, ctx });
  }
  if (stopBrands || !brands.size) return;
  const onKilled = ({ monster }: { monster: IMonster }) => {
    const b = brands.get(monster.uid);
    if (!b) return;
    brands.delete(monster.uid);
    fadeOut(scene, b.go, 80);
    if (!playerAlive(s)) return;
    const c = centerOf(monster);
    b.ctx.runAttack(BRAND_BURST, { x: c.x, y: c.y, facing: s.player.x <= c.x ? 1 : -1 });
  };
  const offKilled = bus.on('monster:killed', onKilled);
  stopBrands = persistent(ctx, (dt) => {
    for (const [uid, b] of brands) {
      b.life -= dt;
      if (b.life <= 0 || !b.m.alive) { brands.delete(uid); fadeOut(scene, b.go, 160); continue; }
      const c = centerOf(b.m);
      setXY(b.go, c.x, c.y - c.h / 2 - 14);
    }
    return brands.size > 0;
  }, () => {
    try { offKilled(); } catch { /* bus cleared */ }
    for (const b of brands.values()) fadeOut(scene, b.go, 120);
    brands.clear();
    stopBrands = null;
  });
}

// ═════════════════════════════ Year 3 — Flamebinder ═════════════════════════════

// ───────── Flashover: a burning foe passes its fire to everything around it ─────────
const FLASH_MAX = 15;
const FLASH_STRIKE: AttackSpec = {
  pattern: 'aoe_target', damagePct: L(230, 320, FLASH_MAX), hits: K(1), maxTargets: K(1), range: 420,
  area: { w: 100, h: 130 }, delayMs: 120,
  status: burn(FLASH_MAX, [0.6, 0.9], [4000, 5000], [12, 18]),
  vfx: { area: 'fire_flashover_strike', hit: 'fire_hit' },
};
const FLASH_SPREAD: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(160, 225, FLASH_MAX), hits: K(2), maxTargets: K(8), range: 160,
  area: { w: 320, h: 180 }, delayMs: 160, hitIntervalMs: 110,
  status: burn(FLASH_MAX, [1, 1], [4000, 6000], [12, 18]),
  bonusVs: { status: 'burn', mult: 1.3 },
  vfx: { area: 'fire_flashover_spread', hit: 'fire_hit' },
};

function castFlashover(ctx: SkillContext, lv: number): void {
  const s = ctx.services, scene = ctx.scene;
  const o = staff(s);
  playVfx(scene, 'fire_flashover_cast', { ...o, lv });
  const t = s.monsters.nearest(o.x, o.y, FLASH_STRIKE.range + 30, o.facing, 140);
  if (!t || !t.hasStatus('burn')) { ctx.runAttack(FLASH_STRIKE, o); return; }
  const c = centerOf(t);
  const a = FLASH_SPREAD.area!;
  const near = s.monsters.inRect(new Phaser.Geom.Rectangle(c.x - a.w / 2, c.y - a.h / 2, a.w, a.h))
    .filter(m => m.alive && m.uid !== t.uid).slice(0, 7);
  playVfx(scene, 'fire_flashover_leap', { x: o.x, y: o.y, targetX: c.x, targetY: c.y, facing: o.facing, lv });
  near.forEach((m) => {
    const mc = centerOf(m);
    playVfx(scene, 'fire_flashover_leap', { x: c.x, y: c.y, targetX: mc.x, targetY: mc.y, facing: mc.x >= c.x ? 1 : -1, lv });
  });
  ctx.runAttack(FLASH_SPREAD, { x: c.x, y: c.y, facing: o.facing });
}

// ───────── Backdraft: blast forward, ride the recoil backward ─────────
const BACK_MAX = 12;
const backDist = Li(130, 190, BACK_MAX);
const BACKDRAFT: AttackSpec = {
  pattern: 'melee_arc', damagePct: L(200, 280, BACK_MAX), hits: K(2), maxTargets: K(6), range: 200,
  area: { w: 200, h: 120, offsetX: 95 }, knockback: 110, hitIntervalMs: 100,
  status: burn(BACK_MAX, [0.4, 0.6], [3000, 4000], [10, 14]),
  vfx: { area: 'fire_backdraft_area', hit: 'fire_hit' },
};

function castBackdraft(ctx: SkillContext, lv: number): void {
  const s = ctx.services, scene = ctx.scene, p = s.player;
  const f = p.facing;
  const ox = p.x, oy = p.y;
  ctx.runAttack(BACKDRAFT, { x: ox + 18 * f, y: oy - 34, facing: f });
  playVfx(scene, 'fire_backdraft_out', { x: ox, y: oy, facing: f, targetX: ox - f * backDist(lv), targetY: oy, lv });
  p.blink(-f * backDist(lv), 0);
  playVfx(scene, 'fire_backdraft_in', { x: p.x, y: p.y, facing: f, targetX: ox, targetY: oy, lv });
}

// ───────── Vent Heat: cash a running fire buff in for a blast ─────────
const VENT_MAX = 10;
const VENT: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(140, 190, VENT_MAX), hits: K(3), maxTargets: K(10), range: 180,
  area: { w: 360, h: 200, offsetY: -16 }, delayMs: 220, hitIntervalMs: 110, knockback: 50,
  status: burn(VENT_MAX, [0.5, 0.8], [3000, 5000], [12, 18]),
  vfx: { area: 'fire_vent_area', hit: 'fire_hit' },
};
/** Buff → [base power, + power at a full timer]. Overheat vents hottest (and its defense penalty ends with it). */
const VENTABLE: [string, number, number][] = [['fire_overheat', 1.4, 0.8], ['fire_ascension', 1.3, 0.6], ['fire_kindle', 1.15, 0.35]];
const VENT_COLD = 0.6;

function castVentHeat(ctx: SkillContext, lv: number): void {
  const s = ctx.services, scene = ctx.scene, p = s.player;
  const buffs = s.skills.getActiveBuffs();
  let power = VENT_COLD;
  for (const [id, base, full] of VENTABLE) {
    const b = buffs.find(x => x.skillId === id && x.remainingMs > 0);
    if (!b) continue;
    power = base + full * Math.min(1, b.remainingMs / Math.max(1, b.totalMs));
    s.skills.cancelBuff(id);
    break;
  }
  const pct = VENT.damagePct;
  playVfx(scene, 'fire_vent_self', { x: p.x, y: p.y, facing: p.facing, lv, scale: power });
  ctx.runAttack({ ...VENT, damagePct: (l) => pct(l) * power }, { x: p.x, y: p.y - 34, facing: p.facing });
}

// ═════════════════════════════ Year 4 — Inferno Sage ═════════════════════════════

// ───────── Last Ember: hits harder the closer you are to death ─────────
const EMBER_MAX = 12;
const LAST_EMBER: AttackSpec = {
  pattern: 'aoe_target', damagePct: L(280, 380, EMBER_MAX), hits: K(2), maxTargets: K(2), range: 440,
  area: { w: 130, h: 170 }, delayMs: 300, hitIntervalMs: 120,
  status: burn(EMBER_MAX, [0.6, 0.9], [4000, 6000], [14, 20]),
  vfx: { area: 'fire_last_ember_area', hit: 'fire_hit_big' },
};
/** ×1 at full HP rising linearly to ×2.5 at ≤20% HP. */
export function lastEmberMult(hp: number, maxHp: number): number {
  const frac = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
  return 1 + 1.5 * Math.max(0, Math.min(1, (1 - frac) / 0.8));
}

function castLastEmber(ctx: SkillContext, _lv: number): void {
  const s = ctx.services, scene = ctx.scene;
  const mult = lastEmberMult(s.progression.state.hp, s.progression.derived().maxHp);
  const o = staff(s);
  playVfx(scene, 'fire_last_ember_charge', { ...o, lv: ctx.level, scale: mult });
  const pct = LAST_EMBER.damagePct;
  ctx.runAttack({ ...LAST_EMBER, damagePct: (l) => pct(l) * mult }, o);
}

// ───────── Wandering Sun: a slow drifting field that collapses on burns ─────────
const SUN_MAX = 10;
const sunLife = L(3000, 4000, SUN_MAX);
const SUN_SPEED = 110;
const SUN_TICK_MS = 300;
const SUN_TICK: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(80, 115, SUN_MAX), hits: K(1), maxTargets: K(8), range: 80,
  area: { w: 160, h: 160 },
  status: burn(SUN_MAX, [0.35, 0.55], [3000, 4000], [12, 16]),
  vfx: { area: 'fire_sun_pulse', hit: 'fire_jet_hit' },
};
const SUN_COLLAPSE: AttackSpec = {
  pattern: 'aoe_self', damagePct: L(320, 440, SUN_MAX), hits: K(2), maxTargets: K(10), range: 150,
  area: { w: 300, h: 240 }, delayMs: 200, hitIntervalMs: 120, knockback: 50,
  bonusVs: { status: 'burn', mult: 1.4, consume: true },
  vfx: { area: 'fire_sun_collapse', hit: 'fire_hit_big' },
};

let stopSun: (() => void) | null = null;

function castWanderingSun(ctx: SkillContext, lv: number): void {
  const s = ctx.services, scene = ctx.scene;
  stopSun?.();
  const o = staff(s);
  const f = o.facing;
  let x = o.x + f * 30;
  const y = s.player.y - 46;
  let life = sunLife(lv), tick = 0;
  const W = s.game.currentMap()?.widthPx ?? 1e9;
  playVfx(scene, 'fire_cast_big', { ...o, lv });
  const go = playVfx(scene, 'fire_sun', { x, y, facing: f, lv, durationMs: life }) || null;
  stopSun = persistent(ctx, (dt) => {
    life -= dt;
    x = Phaser.Math.Clamp(x + f * SUN_SPEED * (dt / 1000), 40, W - 40);
    setXY(go, x, y);
    tick += dt;
    if (tick >= SUN_TICK_MS) { tick -= SUN_TICK_MS; ctx.runAttack(SUN_TICK, { x, y, facing: f }); }
    if (life > 0) return true;
    ctx.runAttack(SUN_COLLAPSE, { x, y, facing: f });
    return false;
  }, () => {
    if (go && go.scene) go.destroy();
    stopSun = null;
  });
}

// ═════════════════════════════ definitions ═════════════════════════════

export const FIRE_Y2_EXTRA: SkillDef[] = [
  {
    id: 'fire_cinder_mine', name: 'Cinder Mine', job: 'pyromancer', element: 'fire', kind: 'attack', maxLevel: MINE_MAX,
    description: 'Plant a cinder mine (2 at once, 3 from level 10) that arms in half a second and erupts when an enemy steps on it.',
    icon: icon('gem', 0xffb830, 0xe63a12), requires: [{ skillId: 'fire_firebomb', level: 3 }],
    mpCost: Li(15, 24, MINE_MAX), cooldownMs: L(3500, 2200, MINE_MAX), castTimeMs: 380, sfx: 'cast_fire',
    attack: MINE_BLAST,
    onCast: castCinderMine,
  },
  {
    id: 'fire_flamethrower', name: 'Flamethrower', job: 'pyromancer', element: 'fire', kind: 'attack', maxLevel: FT_MAX,
    description: 'Channel a roaring jet of flame: six scorching gusts that follow your facing; being knocked back cuts it short.',
    icon: icon('wind', 0xff9a2e, 0xc2321a),
    mpCost: Li(18, 28, FT_MAX), cooldownMs: L(3600, 2400, FT_MAX), castTimeMs: 900, sfx: 'cast_fire',
    attack: FLAMETHROWER,
    onCast: castFlamethrower,
  },
  {
    id: 'fire_kindling_brand', name: 'Kindling Brand', job: 'pyromancer', element: 'fire', kind: 'attack', maxLevel: BRAND_MAX,
    description: 'Brand up to 3 foes with a sure, lasting burn; a branded foe that dies bursts and sets its neighbours ablaze.',
    icon: icon('eye', 0xffd84a, 0xe63a12), requires: [{ skillId: 'fire_arrow', level: 3 }],
    mpCost: Li(10, 16, BRAND_MAX), cooldownMs: L(2000, 1200, BRAND_MAX), castTimeMs: 320, sfx: 'cast_fire',
    attack: BRAND,
    onCast: castKindlingBrand,
  },
];

export const FIRE_Y3_EXTRA: SkillDef[] = [
  {
    id: 'fire_flashover', name: 'Flashover', job: 'flamebinder', element: 'fire', kind: 'attack', maxLevel: FLASH_MAX,
    description: 'Strike the nearest foe; if it is already burning, the fire leaps to every enemy around it and ignites them all.',
    icon: icon('chain', 0xffe27a, 0xff4a10), requires: [{ skillId: 'fire_kindling_brand', level: 5 }],
    mpCost: Li(28, 40, FLASH_MAX), cooldownMs: L(5000, 3500, FLASH_MAX), castTimeMs: 460, sfx: 'cast_fire',
    attack: FLASH_SPREAD,
    onCast: castFlashover,
  },
  {
    id: 'fire_backdraft', name: 'Backdraft', job: 'flamebinder', element: 'fire', kind: 'movement', maxLevel: BACK_MAX,
    description: 'Detonate a blast in front of you that hurls enemies back while the recoil throws you the other way.',
    icon: icon('explosion', 0xffd84a, 0x9a1a0a), requires: [{ skillId: 'fire_flame_dash', level: 5 }],
    mpCost: Li(22, 32, BACK_MAX), cooldownMs: L(8000, 5500, BACK_MAX), castTimeMs: 220, sfx: 'explosion',
    movement: { kind: 'blink', distance: backDist, vfxOut: 'fire_backdraft_out', vfxIn: 'fire_backdraft_in' },
    attack: BACKDRAFT,
    onCast: castBackdraft,
  },
  {
    id: 'fire_vent_heat', name: 'Vent Heat', job: 'flamebinder', element: 'fire', kind: 'attack', maxLevel: VENT_MAX,
    description: 'End your Overheat (or Ascension, or Kindle) in a blast around you: the fresher the buff, the bigger the blast.',
    icon: icon('sunburst', 0xffe27a, 0xe63a12), requires: [{ skillId: 'fire_overheat', level: 3 }],
    mpCost: Li(24, 34, VENT_MAX), cooldownMs: L(20000, 15000, VENT_MAX), castTimeMs: 500, sfx: 'explosion',
    attack: VENT,
    onCast: castVentHeat,
  },
];

export const FIRE_Y4_EXTRA: SkillDef[] = [
  {
    id: 'fire_last_ember', name: 'Last Ember', job: 'inferno_sage', element: 'fire', kind: 'attack', maxLevel: EMBER_MAX,
    description: 'Drop a white-hot ember on the two nearest foes; the lower your HP, the harder it hits (2.5x at 20% HP or less).',
    icon: icon('meteor', 0xfff4d0, 0x9a1a0a), requires: [{ skillId: 'fire_overheat', level: 8 }],
    mpCost: Li(48, 66, EMBER_MAX), cooldownMs: L(9000, 6500, EMBER_MAX), castTimeMs: 520, sfx: 'explosion',
    attack: LAST_EMBER,
    onCast: castLastEmber,
  },
  {
    id: 'fire_wandering_sun', name: 'Wandering Sun', job: 'inferno_sage', element: 'fire', kind: 'attack', maxLevel: SUN_MAX,
    description: 'Release a small sun that drifts forward searing all it passes, then collapses in a blast that detonates burns.',
    icon: icon('sunburst', 0xfff4d0, 0xff7a1a), requires: [{ skillId: 'fire_flame_wall', level: 5 }],
    mpCost: Li(60, 80, SUN_MAX), cooldownMs: L(32000, 24000, SUN_MAX), castTimeMs: 650, sfx: 'cast_fire',
    attack: SUN_TICK,
    onCast: castWanderingSun,
  },
];
