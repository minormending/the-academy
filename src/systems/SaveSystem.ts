// OWNER: A9 (progression); save slots by P7a. New character + localStorage persistence (versioned, defensive, 6 slots).
import type { BaseStats, EquipSlot, HonorsState, ItemStack, JobId, PlayerState, QuestProgress } from '../core/types';
import { HOTBAR_PAGE_SIZE, HOTBAR_SIZE } from '../core/types';
import { MAX_LEVEL, SAVE_KEY, START_MAP, TOWN_MAP } from '../core/constants';
import { Registry } from '../core/registry';
import { computeDerived, deathExpLoss } from './progression/stats';
import { isSchool, SCHOOL_NAME, yearOfTier, type School } from '../data/jobs';

const SAVE_FORMAT = 1;
const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'hat', 'robe', 'shoes', 'gloves', 'ring', 'amulet'];

let uidCounter = 0;
/** Unique id for an inventory stack. */
export function newUid(): string {
  uidCounter = (uidCounter + 1) % 1e6;
  return `i${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}${uidCounter.toString(36)}`;
}

export function newPlayerState(name: string): PlayerState {
  const hotbar: (string | null)[] = new Array(HOTBAR_SIZE).fill(null);
  hotbar[0] = 'app_arcane_bolt';
  // Potions on the 1 / 2 keys of every page, so they still work after flipping hotbar pages.
  for (let p = 0; p * HOTBAR_PAGE_SIZE < HOTBAR_SIZE; p++) {
    hotbar[p * HOTBAR_PAGE_SIZE + 10] = 'item:red_potion';
    hotbar[p * HOTBAR_PAGE_SIZE + 11] = 'item:blue_potion';
  }
  const state: PlayerState = {
    version: 1,
    name: (name || 'Apprentice').slice(0, 16),
    level: 1,
    exp: 0,
    job: 'apprentice',
    base: { str: 4, dex: 4, int: 10, luk: 6 },
    ap: 0,
    sp: 3,
    hp: 1,
    mp: 1,
    skills: { app_arcane_bolt: 1 },
    hotbar,
    inventory: [
      { uid: newUid(), itemId: 'red_potion', qty: 10 },
      { uid: newUid(), itemId: 'blue_potion', qty: 10 },
    ],
    equipment: {
      weapon: { uid: newUid(), itemId: 'oak_wand', qty: 1 },
      robe: { uid: newUid(), itemId: 'apprentice_robe', qty: 1 },
    },
    mesos: 50,
    mapId: START_MAP,
    quests: {},
    playTimeMs: 0,
    honors: { done: {}, counters: {} },
  };
  fillVitals(state);
  return state;
}

function fillVitals(state: PlayerState) {
  try {
    const d = computeDerived(state);
    state.hp = d.maxHp;
    state.mp = d.maxMp;
  } catch {
    state.hp = 80; state.mp = 64;
  }
}

function storage(): Storage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

// ─────────────────────────── Save slots ───────────────────────────
//
// Storage layout (localStorage):
//   `${SAVE_KEY}:slot0` … `${SAVE_KEY}:slot5`  one envelope per slot: { format, savedAt, slot, state }
//   `${SAVE_KEY}:meta`                         SlotsMeta: last played slot + a cached summary per slot
//   `${SAVE_KEY}`                              legacy single save; migrated into slot 0 on first run and
//                                              kept as a backup until slot 0 is successfully re-written
//                                              (or the player deletes slot 0).
// The slot envelopes are the source of truth; the meta summaries are a cache (used to label a slot that
// has since become unreadable). The legacy exports (hasSave/loadSave/writeSave/deleteSave) act on the
// *active* slot, which the title screen sets before starting the game.

export const SAVE_SLOTS = 6;
const META_KEY = `${SAVE_KEY}:meta`;
const slotKey = (i: number) => `${SAVE_KEY}:slot${i}`;

interface SlotMetaEntry { name: string; level: number; job: string; mapId: string; playTimeMs: number; savedAt: number }
interface SlotsMeta {
  v: 1;
  lastSlot: number | null;
  /** Legacy single save copied into slot 0 but not yet confirmed by a real write. */
  legacyPending?: boolean;
  migratedAt?: number;
  slots: (SlotMetaEntry | null)[];
}

export type SlotStatus = 'empty' | 'ok' | 'damaged';
export interface SlotSummary {
  index: number;
  status: SlotStatus;
  /** True for the slot Continue would load (most recently played). */
  last: boolean;
  name: string;
  level: number;
  job: JobId;
  jobName: string;
  year: number;
  school: School | null;
  /** "Fire", "Ice"… or "Core Curriculum" before a School is declared. */
  schoolName: string;
  mapId: string;
  mapName: string;
  playTimeMs: number;
  /** ms epoch of the last write (0 if unknown). */
  savedAt: number;
  /** Damaged slots: why, plus whatever the meta cache remembers about who was there. */
  error?: string;
  previous?: { name: string; level: number; job: string };
}

const validSlot = (i: unknown): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < SAVE_SLOTS;

let activeSlot = 0;
let inited = false;

function readMeta(): SlotsMeta | null {
  try {
    const raw = storage()?.getItem(META_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as Partial<SlotsMeta> | null;
    if (!m || typeof m !== 'object') return null;
    const slots: (SlotMetaEntry | null)[] = [];
    for (let i = 0; i < SAVE_SLOTS; i++) {
      const e = Array.isArray(m.slots) ? m.slots[i] : null;
      slots.push(e && typeof e === 'object' && typeof (e as SlotMetaEntry).name === 'string' ? e as SlotMetaEntry : null);
    }
    return { v: 1, lastSlot: validSlot(m.lastSlot) ? m.lastSlot : null, legacyPending: !!m.legacyPending, migratedAt: m.migratedAt, slots };
  } catch { return null; }
}

function emptyMeta(): SlotsMeta { return { v: 1, lastSlot: null, slots: new Array(SAVE_SLOTS).fill(null) }; }

function writeMeta(m: SlotsMeta): boolean {
  try { storage()?.setItem(META_KEY, JSON.stringify(m)); return true; } catch (e) { console.warn('[save] meta write failed', e); return false; }
}

function metaEntry(state: PlayerState, savedAt: number): SlotMetaEntry {
  return { name: state.name, level: state.level, job: state.job, mapId: state.mapId, playTimeMs: Math.floor(state.playTimeMs), savedAt };
}

/** Raw slot read: null = empty; otherwise the parsed candidate state, or an error when unreadable. */
function readSlotRaw(i: number): { candidate: unknown; savedAt: number } | { error: string } | null {
  let raw: string | null | undefined;
  try { raw = storage()?.getItem(slotKey(i)); } catch { return { error: 'Storage unavailable' }; }
  if (raw === null || raw === undefined || raw === '') return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { error: 'Save data is corrupt' }; }
  if (!parsed || typeof parsed !== 'object') return { error: 'Save data is corrupt' };
  // Envelope { format, savedAt, state } — or a bare PlayerState from older builds.
  const env = parsed as Record<string, unknown>;
  const candidate = 'state' in env ? env.state : parsed;
  if (!candidate || typeof candidate !== 'object') return { error: 'Save data is corrupt' };
  const c = candidate as Record<string, unknown>;
  if (typeof c.name !== 'string' || typeof c.level !== 'number' || !isFinite(c.level) || typeof c.job !== 'string') {
    return { error: 'Character data is missing' };
  }
  const savedAt = typeof env.savedAt === 'number' && isFinite(env.savedAt) ? env.savedAt : 0;
  return { candidate, savedAt };
}

/** First-run setup: legacy single-save migration + active slot from the meta. Idempotent. */
function ensureInit() {
  if (inited) return;
  inited = true;
  const st = storage();
  if (!st) return;
  try {
    let meta = readMeta();
    if (!meta) {
      meta = emptyMeta();
      let anySlot = false;
      for (let i = 0; i < SAVE_SLOTS; i++) {
        const r = readSlotRaw(i);
        if (!r) continue;
        anySlot = true;
        if ('candidate' in r) {
          const c = r.candidate as PlayerState;
          meta.slots[i] = { name: c.name, level: c.level, job: c.job, mapId: String(c.mapId ?? ''), playTimeMs: Number(c.playTimeMs) || 0, savedAt: r.savedAt };
        }
      }
      // Migrate the pre-slots single save into slot 0 — only on a truly fresh slot store, so a lost
      // meta key never duplicates a character that was already migrated.
      const legacy = st.getItem(SAVE_KEY);
      if (!anySlot && legacy) {
        st.setItem(slotKey(0), legacy);
        if (st.getItem(slotKey(0)) === legacy) {
          meta.legacyPending = true;
          meta.migratedAt = Date.now();
          meta.lastSlot = 0;
          const r = readSlotRaw(0);
          if (r && 'candidate' in r) {
            const c = r.candidate as PlayerState;
            meta.slots[0] = { name: c.name, level: c.level, job: c.job, mapId: String(c.mapId ?? ''), playTimeMs: Number(c.playTimeMs) || 0, savedAt: r.savedAt };
          }
          console.info('[save] migrated legacy save into slot 1');
        }
      }
      if (meta.lastSlot === null) {
        let best = -1, bestAt = -1;
        meta.slots.forEach((e, i) => { if (e && e.savedAt > bestAt) { best = i; bestAt = e.savedAt; } });
        if (best >= 0) meta.lastSlot = best;
      }
      writeMeta(meta);
    }
    activeSlot = meta.lastSlot ?? 0;
  } catch (e) {
    console.warn('[save] slot init failed', e);
  }
}

function summarize(i: number, meta: SlotsMeta | null): SlotSummary {
  const base: SlotSummary = {
    index: i, status: 'empty', last: !!meta && meta.lastSlot === i, name: '', level: 0, job: 'apprentice', jobName: '',
    year: 1, school: null, schoolName: '', mapId: '', mapName: '', playTimeMs: 0, savedAt: 0,
  };
  const r = readSlotRaw(i);
  if (!r) return { ...base, last: false };
  if ('error' in r) {
    const prev = meta?.slots[i];
    return { ...base, status: 'damaged', error: r.error, previous: prev ? { name: prev.name, level: prev.level, job: prev.job } : undefined };
  }
  try {
    const s = repairState(r.candidate);
    const jd = Registry.job(s.job);
    const school = jd && isSchool(jd.branch) ? jd.branch : null;
    const map = Registry.map(s.mapId);
    return {
      ...base, status: 'ok', name: s.name, level: s.level, job: s.job, jobName: jd?.name ?? s.job,
      year: yearOfTier(jd?.tier ?? 1), school, schoolName: school ? SCHOOL_NAME[school] : 'Core Curriculum',
      mapId: s.mapId, mapName: map?.name ?? s.mapId, playTimeMs: s.playTimeMs, savedAt: r.savedAt || meta?.slots[i]?.savedAt || 0,
    };
  } catch (e) {
    return { ...base, status: 'damaged', error: 'Character data could not be repaired' };
  }
}

/** One summary per slot (always SAVE_SLOTS entries). Never throws. */
export function listSlots(): SlotSummary[] {
  ensureInit();
  const meta = readMeta();
  const out: SlotSummary[] = [];
  for (let i = 0; i < SAVE_SLOTS; i++) {
    try { out.push(summarize(i, meta)); } catch {
      out.push({ index: i, status: 'damaged', last: false, name: '', level: 0, job: 'apprentice', jobName: '', year: 1, school: null,
        schoolName: '', mapId: '', mapName: '', playTimeMs: 0, savedAt: 0, error: 'Save data is corrupt' });
    }
  }
  return out;
}

export function getActiveSlot(): number { ensureInit(); return activeSlot; }

/** Point hasSave/loadSave/writeSave/deleteSave (and so Progression's autosave) at slot `i`. */
export function setActiveSlot(i: number): void {
  ensureInit();
  if (!validSlot(i)) { console.warn('[save] bad slot', i); return; }
  activeSlot = i;
}

/** Slot Continue should load: the most recently played slot (if it still holds a readable save). */
export function lastPlayedSlot(): number | null {
  ensureInit();
  const meta = readMeta();
  const last = meta?.lastSlot;
  if (validSlot(last)) { const r = readSlotRaw(last); if (r && 'candidate' in r) return last; }
  return null;
}

/** Lowest-numbered empty slot, or null when all are taken (damaged slots count as taken). */
export function firstEmptySlot(): number | null {
  ensureInit();
  for (let i = 0; i < SAVE_SLOTS; i++) if (readSlotRaw(i) === null) return i;
  return null;
}

/** The character in slot `i`, repaired; null if the slot is empty or unreadable. */
export function loadSlot(i: number): PlayerState | null {
  ensureInit();
  if (!validSlot(i)) return null;
  const r = readSlotRaw(i);
  if (!r) return null;
  if ('error' in r) { console.warn(`[save] slot ${i} unreadable: ${r.error}`); return null; }
  return repairState(r.candidate);
}

export function deleteSlot(i: number): void {
  ensureInit();
  if (!validSlot(i)) return;
  const st = storage();
  try { st?.removeItem(slotKey(i)); } catch { /* ignore */ }
  const meta = readMeta() ?? emptyMeta();
  meta.slots[i] = null;
  if (meta.lastSlot === i) meta.lastSlot = null;
  // The player deleted the migrated character on purpose: drop its legacy backup too.
  if (i === 0 && meta.legacyPending) { try { st?.removeItem(SAVE_KEY); } catch { /* ignore */ } meta.legacyPending = false; }
  writeMeta(meta);
}

export function hasSave(): boolean {
  ensureInit();
  const r = readSlotRaw(activeSlot);
  return !!r && 'candidate' in r;
}

/** Active slot's character (repaired), or null when it is empty or unreadable. */
export function loadSave(): PlayerState | null {
  return loadSlot(getActiveSlot());
}

/**
 * Persist into the active slot (Progression autosave / manual save / map change all land here).
 * Returns false when nothing was written (storage unavailable, quota exceeded, …).
 */
export function writeSave(state: PlayerState): boolean {
  ensureInit();
  const st = storage();
  if (!st) return false;
  const slot = activeSlot;
  const savedAt = Date.now();
  try {
    const raw = JSON.stringify({ format: SAVE_FORMAT, savedAt, slot, state });
    st.setItem(slotKey(slot), raw);
    const meta = readMeta() ?? emptyMeta();
    meta.slots[slot] = metaEntry(state, savedAt);
    meta.lastSlot = slot;
    if (slot === 0 && meta.legacyPending && st.getItem(slotKey(0)) === raw) {
      try { st.removeItem(SAVE_KEY); } catch { /* ignore */ }
      meta.legacyPending = false;
    }
    writeMeta(meta);
    return true;
  } catch (e) {
    console.warn('[save] write failed', e);
    return false;
  }
}

/** Delete the active slot. */
export function deleteSave(): void {
  deleteSlot(getActiveSlot());
}

// ─────────────────────────── Repair ───────────────────────────

const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

function repairStack(v: unknown): ItemStack | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Partial<ItemStack>;
  if (typeof s.itemId !== 'string') return null;
  const def = Registry.item(s.itemId);
  if (!def) return null;
  const qty = Math.floor(num(s.qty, 1, 1, def.maxStack));
  return { uid: typeof s.uid === 'string' && s.uid ? s.uid : newUid(), itemId: s.itemId, qty };
}

/**
 * Academy Honors: keep only well-formed entries. Absent (pre-honors save) stays undefined so HonorsSystem can backfill
 * from the rest of the save; unknown honor ids are kept (they may come from a newer build).
 */
function repairHonors(v: unknown): HonorsState | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const h = v as Partial<HonorsState>;
  const done: Record<string, number> = {};
  const counters: Record<string, number> = {};
  if (h.done && typeof h.done === 'object') {
    for (const [id, at] of Object.entries(h.done as Record<string, unknown>)) {
      if (id && typeof at === 'number' && isFinite(at) && at > 0) done[id] = Math.floor(at);
    }
  }
  if (h.counters && typeof h.counters === 'object') {
    for (const [k, n] of Object.entries(h.counters as Record<string, unknown>)) {
      if (k && typeof n === 'number' && isFinite(n) && n > 0) counters[k] = Math.min(1e12, n);
    }
  }
  const out: HonorsState = { done, counters };
  if (typeof h.title === 'string' && h.title.trim()) out.title = h.title.slice(0, 40);
  return out;
}

/**
 * Coerce anything into a valid PlayerState. Missing/invalid fields fall back to new-character
 * values; unknown items are dropped; unknown skills refund their SP. Never throws.
 */
export function repairState(input: unknown): PlayerState {
  const fresh = newPlayerState('Apprentice');
  if (!input || typeof input !== 'object') return fresh;
  const s = input as Partial<PlayerState> & Record<string, unknown>;
  try {
    const out: PlayerState = { ...fresh };
    out.version = 1;
    out.name = typeof s.name === 'string' && s.name.trim() ? s.name.slice(0, 16) : fresh.name;
    out.level = Math.floor(num(s.level, 1, 1, MAX_LEVEL));
    out.exp = Math.floor(num(s.exp, 0, 0));
    out.job = typeof s.job === 'string' && Registry.jobs().some(j => j.id === s.job) ? s.job as JobId : 'apprentice';

    const b = (s.base && typeof s.base === 'object' ? s.base : {}) as Partial<BaseStats>;
    out.base = {
      str: Math.floor(num(b.str, fresh.base.str, 1)), dex: Math.floor(num(b.dex, fresh.base.dex, 1)),
      int: Math.floor(num(b.int, fresh.base.int, 1)), luk: Math.floor(num(b.luk, fresh.base.luk, 1)),
    };
    out.ap = Math.floor(num(s.ap, 0, 0));
    out.sp = Math.floor(num(s.sp, 0, 0));
    out.mesos = Math.floor(num(s.mesos, 0, 0));
    out.playTimeMs = num(s.playTimeMs, 0, 0);
    out.merits = Math.floor(num(s.merits, 0, 0));
    out.arenaBest = Math.floor(num(s.arenaBest, 0, 0));
    const honors = repairHonors(s.honors);
    if (honors) out.honors = honors; else delete out.honors;
    out.mapId = typeof s.mapId === 'string' && Registry.map(s.mapId) ? s.mapId : START_MAP;
    if (typeof s.mapId === 'string' && Registry.maps().length === 0) out.mapId = s.mapId; // maps not loaded yet: keep

    // Skills: keep known ones (clamped to max level); refund SP for unknown/excess when the skill data is present.
    out.skills = {};
    const skillsLoaded = Registry.skills().length > 0;
    if (s.skills && typeof s.skills === 'object') {
      for (const [id, lvRaw] of Object.entries(s.skills as Record<string, unknown>)) {
        const lv = Math.floor(num(lvRaw, 0, 0));
        if (lv <= 0) continue;
        const def = Registry.skill(id);
        if (!def) {
          if (skillsLoaded) out.sp += lv; else out.skills[id] = lv;
          continue;
        }
        const capped = Math.min(lv, def.maxLevel);
        out.sp += lv - capped;
        out.skills[id] = capped;
      }
    }

    out.hotbar = new Array(HOTBAR_SIZE).fill(null);
    if (Array.isArray(s.hotbar)) {
      for (let i = 0; i < HOTBAR_SIZE; i++) {
        const e = s.hotbar[i];
        let v = typeof e === 'string' && e ? e : null;
        // Drop entries pointing at items/skills that no longer exist (their SP was refunded above).
        if (v?.startsWith('item:') && !Registry.item(v.slice(5))) v = null;
        else if (v && !v.startsWith('item:') && skillsLoaded && !out.skills[v]) v = null;
        out.hotbar[i] = v;
      }
    }

    out.inventory = [];
    if (Array.isArray(s.inventory)) {
      const seen = new Set<string>();
      for (const v of s.inventory) {
        const st = repairStack(v);
        if (!st) continue;
        if (seen.has(st.uid)) st.uid = newUid();
        seen.add(st.uid);
        out.inventory.push(st);
        if (out.inventory.length >= 48) break;
      }
    }

    out.equipment = {};
    if (s.equipment && typeof s.equipment === 'object') {
      const eq = s.equipment as Record<string, unknown>;
      for (const slot of EQUIP_SLOTS) {
        const st = repairStack(eq[slot]);
        if (!st) continue;
        const def = Registry.item(st.itemId);
        if (def?.equip?.slot !== slot) continue;
        st.qty = 1;
        out.equipment[slot] = st;
      }
    }

    out.quests = {};
    if (s.quests && typeof s.quests === 'object') {
      for (const [id, qRaw] of Object.entries(s.quests as Record<string, unknown>)) {
        if (!qRaw || typeof qRaw !== 'object') continue;
        const q = qRaw as Partial<QuestProgress>;
        const def = Registry.quest(id);
        if (!def) continue;
        const status = q.status === 'active' || q.status === 'complete' || q.status === 'turned_in' ? q.status : 'active';
        const counts = def.objectives.map((_, i) => Math.floor(num(Array.isArray(q.counts) ? q.counts[i] : 0, 0, 0)));
        out.quests[id] = { status, counts };
      }
    }

    // Vitals: clamp to derived max.
    const d = computeDerived(out);
    out.hp = Math.floor(num(s.hp, d.maxHp, 1, d.maxHp));
    out.mp = Math.floor(num(s.mp, d.maxMp, 0, d.maxMp));
    // Saved while dead (closed/reloaded before pressing respawn): apply the normal respawn —
    // EXP penalty, 50% HP/MP, back in town — instead of reviving in place on a hostile map.
    if (typeof s.hp === 'number' && s.hp <= 0) {
      out.exp -= deathExpLoss(out.level, out.exp);
      out.hp = Math.max(1, Math.ceil(d.maxHp * 0.5));
      out.mp = Math.max(out.mp, Math.ceil(d.maxMp * 0.5));
      if (Registry.map(TOWN_MAP) || Registry.maps().length === 0) out.mapId = TOWN_MAP;
    }
    return out;
  } catch (e) {
    console.warn('[save] repair failed, starting fresh', e);
    return fresh;
  }
}
