// OWNER: A9 (progression). New character + localStorage persistence (versioned, defensive).
import type { BaseStats, EquipSlot, ItemStack, JobId, PlayerState, QuestProgress } from '../core/types';
import { HOTBAR_SIZE } from '../core/types';
import { MAX_LEVEL, SAVE_KEY, START_MAP, TOWN_MAP } from '../core/constants';
import { Registry } from '../core/registry';
import { computeDerived, deathExpLoss } from './progression/stats';

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
  hotbar[10] = 'item:red_potion';
  hotbar[11] = 'item:blue_potion';
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

export function hasSave(): boolean {
  try {
    const raw = storage()?.getItem(SAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!parsed && typeof parsed === 'object';
  } catch { return false; }
}

export function loadSave(): PlayerState | null {
  let raw: string | null | undefined;
  try { raw = storage()?.getItem(SAVE_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Envelope { format, savedAt, state } — or a bare PlayerState from older builds.
    const candidate = parsed && typeof parsed === 'object' && 'state' in parsed ? parsed.state : parsed;
    return repairState(candidate);
  } catch (e) {
    console.warn('[save] corrupt save, starting fresh', e);
    return newPlayerState('Apprentice');
  }
}

export function writeSave(state: PlayerState): void {
  try {
    storage()?.setItem(SAVE_KEY, JSON.stringify({ format: SAVE_FORMAT, savedAt: Date.now(), state }));
  } catch (e) {
    console.warn('[save] write failed', e);
  }
}

export function deleteSave(): void {
  try { storage()?.removeItem(SAVE_KEY); } catch { /* ignore */ }
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
