/**
 * HonorsSystem (honors agent F): Academy Honors — achievements and titles.
 *
 * Listens on the bus for things the save does not remember by itself (kills per zone / per monster, casts, deaths,
 * visits, conversations, merits earned and spent, the Lich timer…) and keeps them in `PlayerState.honors.counters`.
 * A throttled evaluation pass checks every honor in `data/honors.ts` (each is a pure function of state + counters)
 * and awards the ones that just reached their target: merits via `progression.addMerits`, a `ui:log` line and a queued
 * `ui:banner`, then a save. `honors.done[id]` is set before anything is granted, so an honor can never pay twice.
 *
 * Old saves (no `honors` field) are backfilled on load from what the save does know (level, job, exams, graduation,
 * quest kill counts, the current map, merits…); whatever that already satisfies is granted in one summary line.
 *
 * GameScene owns it (not on the services object): constructed after progression, updated each frame, destroyed on
 * teardown. The Honors window and the name tag read `PlayerState.honors` directly.
 */
import type Phaser from 'phaser';
import type { GameServices, HonorsState, PlayerState } from '../core/types';
import { bus, type GameEvents } from '../core/events';
import { Registry } from '../core/registry';
import { getSettings } from '../core/settings';
import { availableHonors, COUNTER, HONORS, honorDef, LICH_ID, type HonorDef, type HonorView } from '../data/honors';
import { FIELD_BOSSES } from '../data/monsters';
import { GRADUATION_MERITS } from '../data/npcScripts';
import { GRADUATION_QUEST_ID } from '../data/storyQuests';

const EVAL_THROTTLE_MS = 250;
const EVAL_PERIOD_MS = 2000;
const BANNER_GAP_MS = 3200;
/** Hold honor banners this long after a map change so the map-name banner is readable. */
const BANNER_AFTER_MAP_MS = 2600;
/** First pass after load: this many honors or more are announced as one summary instead of one banner each. */
const SUMMARY_AT = 3;
const HONOR_COLOR = '#ffd76a';

/** Make sure `state.honors` exists and is well-formed; returns it. */
export function ensureHonors(state: PlayerState): HonorsState {
  const h = state.honors;
  if (!h || typeof h !== 'object') state.honors = { done: {}, counters: {} };
  else {
    if (!h.done || typeof h.done !== 'object') h.done = {};
    if (!h.counters || typeof h.counters !== 'object') h.counters = {};
  }
  return state.honors!;
}

export function honorView(state: PlayerState): HonorView {
  const honors = ensureHonors(state);
  return { state, honors, c: (k: string) => honors.counters[k] ?? 0 };
}

/** Titles the character may wear (from earned honors). */
export function earnedTitles(state: PlayerState): string[] {
  const done = state.honors?.done ?? {};
  return HONORS.filter(h => h.title && done[h.id]).map(h => h.title!);
}

export class HonorsSystem {
  private unsubs: (() => void)[] = [];
  private started = false;
  private destroyed = false;
  private clock = 0;
  private dirty = true;
  /** First pass waits a moment so the "Welcome back" line and the map banner come first. */
  private nextEval = 1200;
  private nextPeriodic = 0;
  private firstPass = true;
  private granting = false;
  private lastMerits = 0;
  private lastSkillSum = 0;
  private hurtPending = false;
  /** No honor banner before this clock time (map-name / level-up banners are showing). */
  private bannersHeldUntil = 0;
  private nextBannerAt = 0;
  private banners: GameEvents['ui:banner'][] = [];
  /** Lich Archon uid → clock time of the first hit (for the speed honor). */
  private lichFirstHit = new Map<number, number>();

  // Services are only stored: GameScene fills them in after construction.
  constructor(_scene: Phaser.Scene, private services: GameServices) {
    this.on('monster:killed', ({ monster }) => this.onKill(monster));
    this.on('monster:damaged', ({ monster }) => {
      if (monster?.def?.id === LICH_ID && !this.lichFirstHit.has(monster.uid)) this.lichFirstHit.set(monster.uid, this.clock);
    });
    this.on('skill:cast', () => this.bump(COUNTER.casts));
    this.on('player:died', () => this.bump(COUNTER.deaths));
    this.on('player:damaged', () => { this.hurtPending = true; });
    // Level-up / exam banners are big centred banners that hold area banners back: wait for them to finish.
    this.on('player:levelup', () => { this.holdBanners(3400); this.markDirty(); });
    this.on('player:job', () => { this.holdBanners(4200); this.markDirty(); });
    this.on('quest:updated', () => this.markDirty());
    this.on('item:gained', () => this.markDirty());
    this.on('mesos:gained', ({ amount }) => { if (amount > 0) this.bump(COUNTER.mesosEarned, amount); });
    this.on('map:changed', ({ mapId }) => {
      this.holdBanners(BANNER_AFTER_MAP_MS);
      this.lichFirstHit.clear();
      if (Registry.map(mapId)) this.set(COUNTER.visited(mapId), 1);
    });
    this.on('ui:dialog', ({ npcId }) => this.onTalk(npcId));
    this.on('ui:shop', ({ npcId }) => this.onTalk(npcId));
    this.on('player:changed', () => this.onPlayerChanged());
  }

  private on<K extends keyof GameEvents>(ev: K, fn: (p: GameEvents[K]) => void) {
    this.unsubs.push(bus.on(ev, (p) => {
      if (this.destroyed) return;
      try { this.ensureStarted(); fn(p); } catch (e) { console.warn(`[honors] ${String(ev)} handler failed`, e); }
    }));
  }

  private get state(): PlayerState { return this.services.progression.state; }
  private get honors(): HonorsState { return ensureHonors(this.state); }

  // ─────────────────────────── counters ───────────────────────────

  private bump(key: string, n = 1) {
    const c = this.honors.counters;
    c[key] = (c[key] ?? 0) + n;
    this.dirty = true;
  }

  private set(key: string, n: number) {
    const c = this.honors.counters;
    if ((c[key] ?? 0) === n) return;
    c[key] = n;
    this.dirty = true;
  }

  private atLeast(key: string, n: number) {
    if (!(n > 0)) return;
    const c = this.honors.counters;
    if ((c[key] ?? 0) < n) { c[key] = n; this.dirty = true; }
  }

  private markDirty() { this.dirty = true; }

  private holdBanners(ms: number) { this.bannersHeldUntil = Math.max(this.bannersHeldUntil, this.clock + ms); }

  private onKill(monster: GameEvents['monster:killed']['monster']) {
    const def = monster?.def;
    if (!def) return;
    let mapId = this.state.mapId;
    try { mapId = this.services.game?.currentMap()?.def.id ?? mapId; } catch { /* keep state.mapId */ }
    this.bump(COUNTER.kills);
    this.bump(COUNTER.killsOnMap(mapId));
    this.bump(COUNTER.killsOf(def.id));
    if (def.id === 'moss_snail' && this.state.level >= 40) this.set(COUNTER.lateSnail, 1);
    if (def.id === LICH_ID) {
      const first = this.lichFirstHit.get(monster.uid);
      this.lichFirstHit.delete(monster.uid);
      if (first !== undefined) {
        const ms = Math.max(1, Math.round(this.clock - first));
        const best = this.honors.counters[COUNTER.lichBestMs] ?? 0;
        if (!best || ms < best) this.set(COUNTER.lichBestMs, ms);
      }
    }
  }

  private onTalk(npcId: string) {
    if (npcId && Registry.npc(npcId)) this.set(COUNTER.talked(npcId), 1);
  }

  private skillSum(): number {
    let n = 0;
    for (const lv of Object.values(this.state.skills ?? {})) n += lv > 0 ? lv : 0;
    return n;
  }

  /** Merits earned / spent and respecs are read from state changes (no dedicated events exist). */
  private onPlayerChanged() {
    const merits = this.state.merits ?? 0;
    if (this.granting) this.lastMerits = merits;
    else if (merits !== this.lastMerits) {
      const d = merits - this.lastMerits;
      this.lastMerits = merits;
      if (d > 0) this.bump(COUNTER.meritsEarned, d); else this.bump(COUNTER.meritsSpent, -d);
    }
    // Skill levels only ever go down through a Tome of Unlearning (Progression.respecTier).
    const sum = this.skillSum();
    if (sum < this.lastSkillSum) this.bump(COUNTER.respecs);
    this.lastSkillSum = sum;
  }

  // ─────────────────────────── start / backfill ───────────────────────────

  private ensureStarted() {
    if (this.started || this.destroyed) return;
    const st = this.services.progression?.state;
    if (!st) return;
    this.started = true;
    const legacy = !st.honors;
    ensureHonors(st);
    this.backfill(legacy);
    this.lastMerits = st.merits ?? 0;
    this.lastSkillSum = this.skillSum();
    this.validateTitle();
    this.dirty = true;
    if (legacy) { try { this.services.progression.save(); } catch { /* ignore */ } }
  }

  /** Derive what the save already proves. Idempotent: only ever raises counters. */
  private backfill(legacy: boolean) {
    const st = this.state;
    if (Registry.map(st.mapId)) this.atLeast(COUNTER.visited(st.mapId), 1);
    const spawnMaps = (monsterId: string) => Registry.maps().filter(m => m.spawns?.some(s => s.monsterId === monsterId)).map(m => m.id);
    let questKills = 0;
    for (const [qid, prog] of Object.entries(st.quests ?? {})) {
      const q = Registry.quest(qid);
      if (!q || !prog) continue;
      if (Registry.npc(q.giver)) this.atLeast(COUNTER.talked(q.giver), 1);
      q.objectives.forEach((o, i) => {
        if (o.kind !== 'kill') return;
        const n = Math.min(o.count, prog.status === 'turned_in' ? o.count : prog.counts?.[i] ?? 0);
        if (n <= 0) return;
        questKills += n;
        this.atLeast(COUNTER.killsOf(o.monsterId), n);
        const fb = FIELD_BOSSES[o.monsterId];
        if (fb) this.atLeast(COUNTER.visited(fb.mapId), 1);
        else for (const m of spawnMaps(o.monsterId)) this.atLeast(COUNTER.visited(m), 1);
      });
    }
    if (st.quests?.[GRADUATION_QUEST_ID]?.status === 'turned_in') {
      this.atLeast(COUNTER.killsOf(LICH_ID), 1);
      this.atLeast(COUNTER.visited('arcane_sanctum'), 1);
    }
    if ((st.arenaBest ?? 0) > 0) this.atLeast(COUNTER.visited('trial_hall'), 1);
    if (legacy) {
      // Lower bounds only: the old save never counted these.
      this.atLeast(COUNTER.kills, questKills);
      let earned = st.merits ?? 0;
      if (st.quests?.[GRADUATION_QUEST_ID]?.status === 'turned_in') earned = Math.max(earned, GRADUATION_MERITS);
      this.atLeast(COUNTER.meritsEarned, earned);
      this.atLeast(COUNTER.mesosEarned, st.mesos ?? 0);
    }
  }

  private validateTitle() {
    const h = this.honors;
    if (h.title && !earnedTitles(this.state).includes(h.title)) delete h.title;
  }

  // ─────────────────────────── evaluation ───────────────────────────

  private evaluate() {
    const view = honorView(this.state);
    const h = view.honors;
    const earned: HonorDef[] = [];
    for (const def of availableHonors()) {
      if (h.done[def.id]) continue;
      let ok = false;
      try { ok = def.measure(view) >= def.target(view); } catch { ok = false; }
      if (!ok) continue;
      h.done[def.id] = Date.now();   // recorded first: never double-awarded
      earned.push(def);
    }
    const summary = this.firstPass && earned.length >= SUMMARY_AT;
    this.firstPass = false;
    if (!earned.length) return;
    this.grant(earned, summary);
  }

  private grant(earned: HonorDef[], summary: boolean) {
    const total = earned.reduce((n, d) => n + Math.max(0, d.reward), 0);
    for (const d of earned) {
      bus.emit('ui:log', {
        text: `Honor earned: ${d.name}${d.reward ? ` (+${d.reward} Merits)` : ''}${d.title ? ` — title unlocked: "${d.title}"` : ''}`,
        color: HONOR_COLOR,
      });
    }
    if (total > 0) {
      this.granting = true;
      try { this.services.progression.addMerits(total); } catch (e) { console.warn('[honors] addMerits failed', e); }
      finally { this.granting = false; this.lastMerits = this.state.merits ?? 0; }
    }
    if (summary) {
      this.banners.push({ text: `${earned.length} Academy Honors earned!`, sub: `+${total.toLocaleString()} Merits · see your Honors`, color: HONOR_COLOR });
    } else {
      for (const d of earned) {
        const sub = [d.reward ? `+${d.reward} Merits` : '', d.title ? `Title: ${d.title}` : ''].filter(Boolean).join(' · ') || d.description;
        this.banners.push({ text: `Honor earned: ${d.name}`, sub, color: HONOR_COLOR });
      }
    }
    try { this.services.progression.save(); } catch { /* ignore */ }
    bus.emit('player:changed', {});
  }

  private flushBanner() {
    if (!this.banners.length || this.clock < this.nextBannerAt || this.clock < this.bannersHeldUntil) return;
    const b = this.banners.shift()!;
    bus.emit('ui:banner', b);
    try { this.services.audio?.play('quest_complete'); } catch { /* ignore */ }
    this.nextBannerAt = this.clock + BANNER_GAP_MS;
  }

  update(_time: number, delta: number) {
    if (this.destroyed) return;
    try {
      this.ensureStarted();
      if (!this.started) return;
      this.clock += Math.max(0, Math.min(1000, Number.isFinite(delta) ? delta : 0));
      if (this.hurtPending) {
        this.hurtPending = false;
        const p = this.services.progression;
        const max = p.derived().maxHp;
        if (!p.isDead() && this.state.hp > 0 && this.state.hp <= max * 0.05) this.set(COUNTER.closeCall, 1);
      }
      if (this.clock >= this.nextPeriodic) {
        this.nextPeriodic = this.clock + EVAL_PERIOD_MS;
        this.dirty = true;
        let field = false;
        try { const m = this.services.game?.currentMap()?.def; field = !!m && !m.safe && m.id !== 'trial_hall'; } catch { field = false; }
        if (field && getSettings().familiar) this.set(COUNTER.pipTrip, 1);
      }
      if (this.dirty && this.clock >= this.nextEval) {
        this.dirty = false;
        this.nextEval = this.clock + EVAL_THROTTLE_MS;
        this.evaluate();
      }
      this.flushBanner();
    } catch (e) {
      console.warn('[honors] update failed', e);
    }
  }

  // ─────────────────────────── debug ───────────────────────────

  /** `arcana.honors` helpers (dev console). */
  debugApi() {
    return {
      list: () => availableHonors().map(d => {
        const v = honorView(this.state);
        return { id: d.id, done: !!v.honors.done[d.id], progress: `${safeNum(() => d.measure(v))}/${safeNum(() => d.target(v))}` };
      }),
      state: () => this.state.honors,
      /** Force-award one honor through the normal path (merits, banner, save). */
      grant: (id: string) => {
        const d = honorDef(id);
        const h = this.honors;
        if (!d || h.done[id]) return false;
        h.done[id] = Date.now();
        this.grant([d], false);
        return true;
      },
      counter: (key: string, n: number) => { this.set(key, n); return this.honors.counters[key]; },
      evaluate: () => { this.dirty = true; this.nextEval = 0; },
    };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const u of this.unsubs) { try { u(); } catch { /* ignore */ } }
    this.unsubs = [];
    this.banners = [];
    this.lichFirstHit.clear();
  }
}

function safeNum(fn: () => number): number { try { return fn(); } catch { return 0; } }
