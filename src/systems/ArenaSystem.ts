/**
 * ArenaSystem — the Academy's Trial Hall (map `trial_hall`): replayable wave survival.
 *
 * Flow: idle → Begin → [countdown 3s → fighting → breather 5s (+small heal)] × N → results.
 * Dying, forfeiting or leaving the hall ends the run. Every cleared wave pays Academy Merits
 * (`progression.addMerits`) and bonus EXP immediately, so nothing is lost when a run ends badly;
 * the best wave count is kept in `progression.state.arenaBest`.
 *
 * Arena monsters come from `services.monsters.spawn` (no spawn group → they never respawn) and are
 * destroyed by `clear()` / when a run ends. The hall has no natural spawns, so every living monster in
 * it (including a field boss's own summoned adds) counts toward "enemies left".
 *
 * Wiring (GameScene, lead): construct after `drops`, `bindMap` after `npcs.bindMap`, `update` after
 * `drops.update`, `clear` in the map-change cleanup, `destroy` in teardown. Never calls services in
 * the constructor. The DOM panel (`ui/arenaPanel.ts`) reads `getArena()?.view()`.
 */
import Phaser from 'phaser';
import type { GameServices, IMapInstance, IMonster, MonsterDef } from '../core/types';
import { bus } from '../core/events';
import { Registry } from '../core/registry';
import { DEPTH } from '../core/constants';
import { refMonsterExp, refMonsterHp } from '../core/balance';

export const ARENA_MAP_ID = 'trial_hall';

// ─────────────────────────── tuning ───────────────────────────

export const ARENA_TUNING = {
  countdownMs: 3000,
  breatherMs: 5000,
  /** Fraction of max HP / MP restored at the start of each breather. */
  breatherHeal: 0.15,
  /** Every Nth wave is a boss wave (field boss, or an elite if none fits the level). */
  bossEvery: 5,
  /** Wave size: min(maxCount, baseCount + wave). */
  baseCount: 3,
  maxCount: 12,
  /** Target monster level = player level + levelBias + levelStep × floor((wave−1)/levelEvery), capped at +maxOffset. */
  levelBias: -2,
  levelStep: 2,
  levelEvery: 3,
  maxOffset: 10,
  /** Normal-monster HP grows by this fraction per wave (on top of level normalisation). */
  hpPerWave: 0.05,
  /** Field boss HP multiplier on the first boss wave, and the increase per later boss wave. */
  bossHpFirst: 0.4,
  bossHpStep: 0.15,
  /** Elite HP multiplier (elites appear from wave 6, one more every 5 waves; boss-wave fallback ×2). */
  eliteHp: 4,
  /** Spawn pacing within a wave. */
  spawnIntervalMs: 160,
  /** Keep new spawns at least this far (px) from the player. */
  spawnClearance: 200,
} as const;

/** Merits paid for clearing wave `n` (boss waves pay double). */
export function meritsForWave(n: number): number {
  const base = 2 + 2 * n;
  return n % ARENA_TUNING.bossEvery === 0 ? base * 2 : base;
}

/** Bonus EXP for clearing wave `n` at player `level` (boss waves pay double). */
export function bonusExpForWave(n: number, level: number): number {
  const base = refMonsterExp(Math.max(1, level)) * (1 + n * 0.6);
  return Math.round(n % ARENA_TUNING.bossEvery === 0 ? base * 2 : base);
}

// ─────────────────────────── view model (read by the panel) ───────────────────────────

export type ArenaPhase = 'idle' | 'countdown' | 'fighting' | 'breather' | 'results';
export type ArenaEndReason = 'fell' | 'forfeit' | 'left';

export interface ArenaResult {
  wavesCleared: number;
  merits: number;
  exp: number;
  best: number;
  newBest: boolean;
  reason: ArenaEndReason;
  timeMs: number;
}

export interface ArenaView {
  /** Player is in the Trial Hall (the panel only shows then). */
  inHall: boolean;
  phase: ArenaPhase;
  /** Current wave (countdown/fighting) or the wave just cleared (breather). */
  wave: number;
  wavesCleared: number;
  enemiesLeft: number;
  enemiesTotal: number;
  /** ms left in the countdown / breather. */
  phaseMsLeft: number;
  /** Time spent in the current wave's fight. */
  waveMs: number;
  /** Whole run time. */
  runMs: number;
  merits: number;
  exp: number;
  best: number;
  bossWave: boolean;
  /** Boss (or elite) name for boss waves. */
  bossName: string | null;
  /** Upcoming wave label (during countdown/breather). */
  nextLabel: string;
  result: ArenaResult | null;
  canBegin: boolean;
}

let current: ArenaSystem | null = null;
/** The live ArenaSystem (null until GameScene constructs one). */
export function getArena(): ArenaSystem | null { return current; }

// ─────────────────────────── internals ───────────────────────────

interface WavePlan {
  n: number;
  targetLv: number;
  count: number;
  picks: MonsterDef[];
  boss: MonsterDef | null;
  /** Boss-wave fallback: an elite of this def (when no field boss fits the level). */
  bossElite: MonsterDef | null;
  elites: number;
  label: string;
}

interface Pending { def: MonsterDef; hpMul: number; elite: boolean; boss: boolean }
interface Tracked { m: IMonster; elite: boolean; aura: Phaser.GameObjects.Image | null; tag: Phaser.GameObjects.Text | null }

const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class ArenaSystem {
  private map: IMapInstance | null = null;
  private phase: ArenaPhase = 'idle';
  private wave = 0;
  private cleared = 0;
  private timer = 0;
  private runMs = 0;
  private waveMs = 0;
  private merits = 0;
  private exp = 0;
  private total = 0;
  private plan: WavePlan | null = null;
  private pending: Pending[] = [];
  private spawnAcc = 0;
  private provokeAcc = 0;
  private lastTick = -1;
  private tracked: Tracked[] = [];
  private result: ArenaResult | null = null;
  private newBest = false;
  private unsubs: (() => void)[] = [];
  private warned = false;
  private destroyed = false;

  constructor(private scene: Phaser.Scene, private services: GameServices) {
    current = this;
    this.unsubs.push(bus.on('player:died', () => { if (this.running()) this.endRun('fell'); }));
  }

  // ─────────────────────────── public API ───────────────────────────

  bindMap(map: IMapInstance) {
    if (this.running()) this.endRun('left');
    this.map = map?.def?.id === ARENA_MAP_ID ? map : null;
    if (this.map && this.phase !== 'results') this.phase = 'idle';
  }

  /** Start a run (from the panel). Returns false when not possible right now. */
  begin(): boolean {
    if (!this.canBegin()) return false;
    this.wave = 0; this.cleared = 0; this.runMs = 0; this.waveMs = 0;
    this.merits = 0; this.exp = 0; this.total = 0;
    this.result = null; this.newBest = false;
    this.pending = []; this.tracked = [];
    this.despawnAll();
    bus.emit('ui:log', { text: 'The Trial begins. Survive as many waves as you can!', color: '#ffd76a' });
    this.sfx('ui_open');
    this.startCountdown(1);
    return true;
  }

  forfeit() {
    if (this.running()) this.endRun('forfeit');
  }

  /** Dismiss the results card (back to the Begin prompt). */
  dismissResult() {
    if (this.phase === 'results') { this.phase = 'idle'; this.result = null; }
  }

  running(): boolean {
    return this.phase === 'countdown' || this.phase === 'fighting' || this.phase === 'breather';
  }

  view(): ArenaView {
    const best = Math.max(this.services.progression?.state?.arenaBest ?? 0, 0);
    const plan = this.plan;
    const boss = !!plan && plan.n % ARENA_TUNING.bossEvery === 0;
    const next = this.phase === 'breather' ? this.wave + 1 : this.wave;
    return {
      inHall: this.inHall(),
      phase: this.phase,
      wave: this.wave,
      wavesCleared: this.cleared,
      enemiesLeft: this.phase === 'fighting' ? this.enemiesLeft() : 0,
      enemiesTotal: this.total,
      phaseMsLeft: Math.max(0, this.timer),
      waveMs: this.waveMs,
      runMs: this.runMs,
      merits: this.merits,
      exp: this.exp,
      best,
      bossWave: boss && this.phase !== 'breather',
      bossName: plan ? (plan.boss?.name ?? (plan.bossElite ? `Elite ${plan.bossElite.name}` : null)) : null,
      nextLabel: next > 0 ? `Wave ${next}${next % ARENA_TUNING.bossEvery === 0 ? ' · Boss' : ''}` : '',
      result: this.result,
      canBegin: this.canBegin(),
    };
  }

  update(_time: number, delta: number) {
    if (this.destroyed || !this.map) return;
    try {
      this.tick(Math.min(Math.max(0, delta || 0), 100));
    } catch (e) {
      if (!this.warned) { this.warned = true; console.warn('[arena] update failed', e); }
    }
  }

  /** Map-change cleanup: ends any run and removes every arena monster. */
  clear() {
    if (this.running()) this.endRun('left');
    this.despawnAll();
    this.map = null;
  }

  destroy() {
    if (this.destroyed) return;
    try { this.clear(); } catch { /* ignore */ }
    this.destroyed = true;
    for (const u of this.unsubs) { try { u(); } catch { /* ignore */ } }
    this.unsubs = [];
    if (current === this) current = null;
  }

  // ─────────────────────────── frame ───────────────────────────

  private tick(dt: number) {
    if (!this.running()) return;
    if (!this.inHall()) { this.endRun('left'); return; }
    if (this.services.progression.isDead()) { this.endRun('fell'); return; }
    this.runMs += dt;

    if (this.phase === 'countdown') {
      this.timer -= dt;
      const sec = Math.ceil(this.timer / 1000);
      if (sec !== this.lastTick && sec > 0) { this.lastTick = sec; this.sfx('ui_click'); }
      if (this.timer <= 0) this.startFight();
      return;
    }

    if (this.phase === 'fighting') {
      this.waveMs += dt;
      this.drainSpawns(dt);
      this.syncTracked();
      this.provokeAcc += dt;
      if (this.provokeAcc >= 1500) { this.provokeAcc = 0; this.provokeAll(); }
      if (this.pending.length === 0 && this.enemiesLeft() === 0) this.waveCleared();
      return;
    }

    if (this.phase === 'breather') {
      this.timer -= dt;
      if (this.timer <= 0) this.startCountdown(this.wave + 1);
    }
  }

  private startCountdown(n: number) {
    this.wave = n;
    this.plan = this.planWave(n);
    this.phase = 'countdown';
    this.timer = ARENA_TUNING.countdownMs;
    this.lastTick = -1;
    const boss = n % ARENA_TUNING.bossEvery === 0;
    bus.emit('ui:banner', {
      text: `Wave ${n}`,
      sub: this.plan.label,
      color: boss ? '#ff9b6b' : '#ffd76a',
    });
  }

  private startFight() {
    const plan = this.plan ?? this.planWave(this.wave);
    this.phase = 'fighting';
    this.waveMs = 0;
    this.provokeAcc = 0;
    this.spawnAcc = ARENA_TUNING.spawnIntervalMs; // first spawn immediately
    this.pending = this.buildSpawns(plan);
    this.total = this.pending.length;
    this.sfx(plan.boss || plan.bossElite ? 'boss_roar' : 'whoosh');
  }

  private waveCleared() {
    const n = this.wave;
    const prog = this.services.progression;
    this.cleared = n;
    const m = meritsForWave(n);
    const e = bonusExpForWave(n, prog.state.level);
    this.merits += m;
    this.exp += e;
    try { prog.addMerits(m); } catch (err) { console.warn('[arena] addMerits failed', err); }
    try { prog.gainExp(e); } catch (err) { console.warn('[arena] gainExp failed', err); }
    // Personal best is recorded as soon as it is beaten (survives a crash / tab close via the next save).
    const best = prog.state.arenaBest ?? 0;
    if (n > best) { prog.state.arenaBest = n; this.newBest = true; }
    // Breather: small heal.
    try {
      const d = prog.derived();
      const hp = Math.round(d.maxHp * ARENA_TUNING.breatherHeal), mp = Math.round(d.maxMp * ARENA_TUNING.breatherHeal);
      prog.heal(hp, mp);
      const p = this.services.player;
      if (p) this.services.combat?.showNumber(p.x, p.y - 70, hp, 'heal');
    } catch { /* ignore */ }
    this.sfx('quest_complete');
    bus.emit('ui:banner', { text: `Wave ${n} cleared!`, sub: `+${m} Merits · +${e.toLocaleString()} EXP`, color: '#9fe8a8' });
    this.phase = 'breather';
    this.timer = ARENA_TUNING.breatherMs;
    this.total = 0;
    this.untrackAll();
  }

  private endRun(reason: ArenaEndReason) {
    if (!this.running()) return;
    const prog = this.services.progression;
    const best = Math.max(prog?.state?.arenaBest ?? 0, this.cleared);
    if (prog) prog.state.arenaBest = best;
    this.result = {
      wavesCleared: this.cleared, merits: this.merits, exp: this.exp,
      best, newBest: this.newBest && this.cleared >= best && this.cleared > 0, reason, timeMs: this.runMs,
    };
    this.phase = 'results';
    this.pending = [];
    this.total = 0;
    this.despawnAll();
    try { prog?.save(); } catch { /* ignore */ }
    const why = reason === 'fell' ? 'You fell in the Trial' : reason === 'forfeit' ? 'You yielded the Trial' : 'You left the Trial Hall';
    const tail = this.result.newBest ? ' — a new personal best!' : '';
    bus.emit('ui:log', {
      text: `${why}: ${this.cleared} wave${this.cleared === 1 ? '' : 's'} cleared, +${this.merits} Merits${tail} (best ${best}).`,
      color: '#ffd76a',
    });
    if (reason === 'forfeit') {
      bus.emit('ui:banner', { text: 'Trial Ended', sub: `${this.cleared} wave${this.cleared === 1 ? '' : 's'} cleared${tail}`, color: '#ffd76a' });
    }
  }

  // ─────────────────────────── wave planning ───────────────────────────

  private planWave(n: number): WavePlan {
    const T = ARENA_TUNING;
    const level = Math.max(1, this.services.progression?.state?.level ?? 1);
    const offset = Math.min(T.maxOffset, T.levelStep * Math.floor((n - 1) / T.levelEvery));
    const targetLv = Math.max(1, level + T.levelBias + offset);
    const count = Math.min(T.maxCount, T.baseCount + n);
    const all = Registry.monsters();
    const normals = all.filter(d => !d.boss && d.behavior !== 'boss' && d.hp > 0);
    const byDist = [...normals].sort((a, b) => Math.abs(a.level - targetLv) - Math.abs(b.level - targetLv));
    let cands = byDist.filter(d => Math.abs(d.level - targetLv) <= 6);
    if (cands.length < 3) cands = byDist.slice(0, 3);
    // Mix up to three different monster types per wave.
    const picks: MonsterDef[] = [];
    const pool = [...cands];
    while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    if (!picks.length && normals.length) picks.push(normals[0]);

    let boss: MonsterDef | null = null, bossElite: MonsterDef | null = null;
    const bossWave = n % T.bossEvery === 0;
    if (bossWave) {
      const bosses = all.filter(d => d.boss && d.behavior === 'boss' && d.id !== 'lich_archon')
        .filter(d => d.level <= targetLv + 4 && d.level >= targetLv - 12)
        .sort((a, b) => Math.abs(a.level - targetLv) - Math.abs(b.level - targetLv));
      boss = bosses[0] ?? null;
      if (!boss) bossElite = [...picks].sort((a, b) => b.level - a.level)[0] ?? null;
    }
    const elites = bossWave ? 0 : n >= 6 ? Math.floor((n - 1) / 5) : 0;
    const label = boss ? `${boss.name} approaches!`
      : bossElite ? `An Elite ${bossElite.name} approaches!`
        : `${count} challengers${elites ? ` · ${elites} elite${elites > 1 ? 's' : ''}` : ''}`;
    return { n, targetLv, count, picks, boss, bossElite, elites, label };
  }

  private normalHpMul(n: number, def: MonsterDef, targetLv: number): number {
    // Normalise to the target level when the roster tops out below it (lv 46 is the highest normal).
    const lvl = clamp(refMonsterHp(targetLv) / Math.max(1, refMonsterHp(def.level)), 1, 3);
    return (1 + ARENA_TUNING.hpPerWave * (n - 1)) * lvl;
  }

  private buildSpawns(plan: WavePlan): Pending[] {
    const T = ARENA_TUNING;
    const out: Pending[] = [];
    const n = plan.n;
    if (plan.boss) {
      const k = Math.floor(n / T.bossEvery) - 1;
      const lvl = clamp(refMonsterHp(plan.targetLv) / Math.max(1, refMonsterHp(plan.boss.level)), 1, 3);
      out.push({ def: plan.boss, hpMul: (T.bossHpFirst + T.bossHpStep * k) * lvl, elite: false, boss: true });
    } else if (plan.bossElite) {
      out.push({ def: plan.bossElite, hpMul: this.normalHpMul(n, plan.bossElite, plan.targetLv) * T.eliteHp * 2, elite: true, boss: true });
    }
    const adds = plan.boss || plan.bossElite ? Math.max(2, Math.floor(plan.count / 4)) : plan.count;
    for (let i = 0; i < adds; i++) {
      // Round-robin over the picks so every type shows up, then shuffle the order.
      const def = plan.picks[i % Math.max(1, plan.picks.length)];
      if (!def) break;
      out.push({ def, hpMul: this.normalHpMul(n, def, plan.targetLv), elite: false, boss: false });
    }
    for (let i = 0; i < plan.elites && i < out.length; i++) {
      const e = out[out.length - 1 - i];
      e.elite = true;
      e.hpMul *= T.eliteHp;
    }
    // Boss first, the rest shuffled.
    const head = out.filter(p => p.boss), rest = Phaser.Utils.Array.Shuffle(out.filter(p => !p.boss));
    return [...head, ...rest];
  }

  // ─────────────────────────── spawning & tracking ───────────────────────────

  private drainSpawns(dt: number) {
    if (!this.pending.length) return;
    this.spawnAcc += dt;
    let guard = 4;
    while (this.pending.length && this.spawnAcc >= ARENA_TUNING.spawnIntervalMs && guard-- > 0) {
      this.spawnAcc -= ARENA_TUNING.spawnIntervalMs;
      const p = this.pending.shift()!;
      this.spawnOne(p);
    }
  }

  private spawnOne(p: Pending) {
    const map = this.map;
    if (!map) return;
    const pos = this.spawnPoint(p.def, p.boss);
    let m: IMonster | null = null;
    try { m = this.services.monsters.spawn(p.def.id, pos.x, pos.y); } catch (e) { console.warn('[arena] spawn failed', e); }
    if (!m) { this.total = Math.max(0, this.total - 1); return; }
    if (Math.abs(p.hpMul - 1) > 0.001) {
      const max = Math.max(1, Math.round(m.maxHp * p.hpMul));
      try { (m as unknown as { maxHp: number }).maxHp = max; m.hp = max; } catch { /* ignore */ }
    }
    (m as { provoke?: (ms: number) => void }).provoke?.(60000);
    this.ring(pos.x, pos.y, p.boss ? 0xff9b6b : p.elite ? 0xffd36b : 0xb58cff);
    const t: Tracked = { m, elite: p.elite, aura: null, tag: null };
    if (p.elite && !p.boss) this.decorateElite(t);
    else if (p.elite && p.boss) this.decorateElite(t, true);
    this.tracked.push(t);
  }

  /** A floor/air point in the hall, away from the player and the exit portal. */
  private spawnPoint(def: MonsterDef, boss: boolean): { x: number; y: number } {
    const map = this.map!;
    const W = map.widthPx;
    const ground = map.def.platforms.find(p => !p.oneWay) ?? { x1: 0, x2: W, y: map.heightPx - 120, oneWay: false };
    const minX = 300, maxX = W - 80;
    const px = this.services.player?.x ?? W / 2;
    let x = minX + Math.random() * (maxX - minX);
    for (let i = 0; i < 12; i++) {
      const cand = minX + Math.random() * (maxX - minX);
      const clearance = boss ? 380 : ARENA_TUNING.spawnClearance;
      if (Math.abs(cand - px) >= clearance) { x = cand; break; }
      x = cand;
    }
    if (boss) x = px < W / 2 ? clamp(W * 0.72, minX, maxX) : clamp(W * 0.38, minX, maxX);
    // Flyers: Monster derives its drift band from the spawn point (band.y = y + 26) and never dives below
    // band.y − 12, so spawning them at floor − 26 keeps them able to swoop down to the player.
    const flyer = def.behavior === 'flyer';
    const y = flyer ? ground.y - 26 : ground.y - 1;
    return { x: Math.round(x), y: Math.round(y) };
  }

  private decorateElite(t: Tracked, bossy = false) {
    const s = this.scene;
    try {
      if (s.textures.exists('px_flare')) {
        t.aura = s.add.image(t.m.x, t.m.y, 'px_flare').setTint(bossy ? 0xff8a4a : 0xffc640)
          .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55).setDepth(DEPTH.MONSTER - 0.5)
          .setScale(Math.max(1.2, (t.m.def.size.w + 30) / 48), Math.max(1.2, (t.m.def.size.h + 30) / 48));
      }
      t.tag = s.add.text(t.m.x, t.m.y, bossy ? '★ ELITE CHAMPION ★' : '★ ELITE', {
        fontFamily: '"Kenney Pixel", monospace', fontSize: '16px', color: bossy ? '#ffb38a' : '#ffe08a',
        stroke: '#140c1c', strokeThickness: 4,
      }).setOrigin(0.5, 1).setDepth(DEPTH.NAMETAG);
    } catch { /* cosmetic only */ }
  }

  private syncTracked() {
    const t0 = this.scene.time.now;
    for (const t of this.tracked) {
      if (!t.aura && !t.tag) continue;
      if (!t.m.alive) { this.undecorate(t); continue; }
      const b = t.m.getBounds();
      if (t.aura) t.aura.setPosition(Math.round(t.m.x), Math.round(b.centerY)).setAlpha(0.45 + (Math.sin(t0 / 160) > 0 ? 0.12 : 0));
      if (t.tag) t.tag.setPosition(Math.round(t.m.x), Math.round(b.top - 18));
    }
    if (this.tracked.length > 40) this.tracked = this.tracked.filter(t => t.m.alive);
  }

  private undecorate(t: Tracked) {
    try { t.aura?.destroy(); } catch { /* ignore */ }
    try { t.tag?.destroy(); } catch { /* ignore */ }
    t.aura = null; t.tag = null;
  }

  private untrackAll() {
    for (const t of this.tracked) this.undecorate(t);
    this.tracked = [];
  }

  private provokeAll() {
    for (const m of this.livingMonsters()) (m as { provoke?: (ms: number) => void }).provoke?.(8000);
  }

  private livingMonsters(): IMonster[] {
    try { return this.services.monsters?.all() ?? []; } catch { return []; }
  }

  private enemiesLeft(): number {
    return this.livingMonsters().length + this.pending.length;
  }

  /** Remove every arena monster (no EXP / drops) and their decorations. */
  private despawnAll() {
    this.untrackAll();
    if (!this.map) return;
    for (const m of this.livingMonsters()) { try { m.destroy(); } catch { /* ignore */ } }
  }

  // ─────────────────────────── helpers ───────────────────────────

  private inHall(): boolean {
    const map = this.map;
    if (!map) return false;
    try { return this.services.game?.currentMap() === map; } catch { return false; }
  }

  private canBegin(): boolean {
    if (this.running() || !this.inHall()) return false;
    try { return !this.services.progression.isDead(); } catch { return false; }
  }

  private ring(x: number, y: number, tint: number) {
    const s = this.scene;
    if (!s.textures.exists('px_ring')) return;
    try {
      const r = s.add.image(x, y - 24, 'px_ring').setTint(tint).setDepth(DEPTH.VFX).setScale(0.6).setAlpha(0.9);
      s.tweens.add({ targets: r, scale: 2.4, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
    } catch { /* ignore */ }
  }

  private sfx(key: Parameters<GameServices['audio']['play']>[0]) {
    try { this.services.audio?.play(key); } catch { /* ignore */ }
  }
}
