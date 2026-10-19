/**
 * Runtime key bindings (P7b). Every rebindable action maps to one legacy DOM/Phaser `keyCode` (0 = unbound).
 * Persisted in localStorage (`academy-bindings-v1`). Defaults mirror the original hard-coded controls
 * (constants.ts HOTBAR_KEYS / CONTROL_KEYS / UI_KEYS + H for help).
 *
 * Consumers (Player, GameScene, UIRoot, HUD, GamepadBridge) read through `getBinding` and re-bind live via
 * `onBindingsChanged`. Assigning a key that another action already uses swaps the two actions.
 */
import { CONTROL_KEYS, HOTBAR_KEYS, UI_KEYS } from './constants';

export const SLOT_ACTIONS = [
  'slot0', 'slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8', 'slot9', 'slot10', 'slot11',
] as const;
export type SlotAction = typeof SLOT_ACTIONS[number];

export type ActionId =
  | 'left' | 'right' | 'up' | 'down' | 'jump' | 'jump2'
  | 'pickup' | 'interact' | 'hotbarPage'
  | SlotAction
  | 'skills' | 'inventory' | 'stats' | 'quests' | 'honors' | 'minimap' | 'help' | 'menu';

export type ActionGroup = 'Movement' | 'Actions' | 'Hotbar' | 'Windows';

export interface ActionInfo { id: ActionId; label: string; group: ActionGroup; }

/** Hotbar slot index → human label matching the on-screen layout (top row Q W E R T 1 / bottom A S D F G 2). */
function slotLabel(i: number): string {
  const top = [0, 1, 2, 3, 4, 10], bottom = [5, 6, 7, 8, 9, 11];
  const t = top.indexOf(i);
  return t >= 0 ? `Hotbar top ${t + 1}` : `Hotbar bottom ${bottom.indexOf(i) + 1}`;
}

/** Display order of the Controls window. */
export const ACTIONS: readonly ActionInfo[] = [
  { id: 'left', label: 'Move left', group: 'Movement' },
  { id: 'right', label: 'Move right', group: 'Movement' },
  { id: 'up', label: 'Up / climb', group: 'Movement' },
  { id: 'down', label: 'Down / prone', group: 'Movement' },
  { id: 'jump', label: 'Jump', group: 'Movement' },
  { id: 'jump2', label: 'Jump (alt)', group: 'Movement' },
  { id: 'interact', label: 'Portal / talk', group: 'Actions' },
  { id: 'pickup', label: 'Pick up', group: 'Actions' },
  { id: 'hotbarPage', label: 'Flip hotbar page', group: 'Actions' },
  ...[0, 1, 2, 3, 4, 10, 5, 6, 7, 8, 9, 11].map(i => ({ id: SLOT_ACTIONS[i], label: slotLabel(i), group: 'Hotbar' as const })),
  { id: 'skills', label: 'Spellbook', group: 'Windows' },
  { id: 'inventory', label: 'Inventory', group: 'Windows' },
  { id: 'stats', label: 'Character', group: 'Windows' },
  { id: 'quests', label: 'Assignments', group: 'Windows' },
  { id: 'honors', label: 'Academy Honors', group: 'Windows' },
  { id: 'minimap', label: 'Minimap', group: 'Windows' },
  { id: 'help', label: 'Help', group: 'Windows' },
  { id: 'menu', label: 'Menu / close', group: 'Windows' },
];

const ACTION_IDS = ACTIONS.map(a => a.id);

/** Phaser KeyCodes names used by constants.ts → legacy keyCode. */
function nameToCode(name: string): number {
  if (/^[A-Z]$/.test(name)) return name.charCodeAt(0);
  const digits = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
  const d = digits.indexOf(name);
  if (d >= 0) return 48 + d;
  const named: Record<string, number> = {
    SPACE: 32, ALT: 18, SHIFT: 16, CTRL: 17, TAB: 9, ENTER: 13, ESC: 27, BACKSPACE: 8,
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40,
  };
  return named[name] ?? 0;
}

function buildDefaults(): Record<ActionId, number> {
  const m = {
    left: 37, right: 39, up: 38, down: 40,
    jump: nameToCode(CONTROL_KEYS.jump[0]), jump2: nameToCode(CONTROL_KEYS.jump[1]),
    pickup: nameToCode(CONTROL_KEYS.pickup), interact: nameToCode(CONTROL_KEYS.interact),
    hotbarPage: nameToCode(CONTROL_KEYS.hotbarPage),
    skills: nameToCode(UI_KEYS.skills), inventory: nameToCode(UI_KEYS.inventory), stats: nameToCode(UI_KEYS.stats),
    quests: nameToCode(UI_KEYS.quests), honors: 79 /* O */, minimap: nameToCode(UI_KEYS.minimap), help: 72 /* H */, menu: nameToCode(UI_KEYS.menu),
  } as Record<ActionId, number>;
  SLOT_ACTIONS.forEach((a, i) => { m[a] = nameToCode(HOTBAR_KEYS[i] ?? ''); });
  return m;
}

export const DEFAULT_BINDINGS: Readonly<Record<ActionId, number>> = Object.freeze(buildDefaults());

/** Pairs allowed to share one key (Up both climbs and enters portals / talks, as in MapleStory). */
const SHARE_GROUPS: readonly (readonly ActionId[])[] = [['up', 'interact']];
function canShare(a: ActionId, b: ActionId): boolean {
  return SHARE_GROUPS.some(g => g.includes(a) && g.includes(b));
}

const STORE_KEY = 'academy-bindings-v1';

/** Keys that can never be bound: Esc cancels a capture (and always opens the menu), OS/meta keys, IME. */
const UNBINDABLE = new Set([0, 27, 91, 92, 93, 224, 229, 20, 144, 145]);
export function isBindableKey(code: number): boolean {
  return Number.isInteger(code) && code > 0 && code < 256 && !UNBINDABLE.has(code);
}

function load(): Record<ActionId, number> {
  const m = { ...DEFAULT_BINDINGS } as Record<ActionId, number>;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE_KEY) : null;
    if (!raw) return m;
    const data = JSON.parse(raw) as { map?: Record<string, unknown> } | null;
    const saved = data?.map;
    if (!saved || typeof saved !== 'object') return m;
    for (const id of ACTION_IDS) {
      const v = saved[id];
      if (typeof v === 'number' && (v === 0 || isBindableKey(v) || v === DEFAULT_BINDINGS[id])) m[id] = v;
    }
    // A corrupt save must not leave two actions on one key: unbind the later duplicates.
    for (let i = 0; i < ACTION_IDS.length; i++) {
      const a = ACTION_IDS[i];
      if (!m[a]) continue;
      for (let j = 0; j < i; j++) {
        const b = ACTION_IDS[j];
        if (m[b] === m[a] && !canShare(a, b)) { m[a] = 0; break; }
      }
    }
  } catch { /* storage unavailable / corrupt → defaults */ }
  return m;
}

let map: Record<ActionId, number> = load();
const listeners = new Set<() => void>();

function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, map })); } catch { /* storage unavailable */ }
}

function emit() {
  for (const cb of [...listeners]) {
    try { cb(); } catch (e) { console.warn('[bindings] listener failed', e); }
  }
}

/** keyCode bound to `action` (0 = unbound). */
export function getBinding(action: ActionId): number { return map[action] ?? 0; }

/** Snapshot of every binding. */
export function getBindings(): Readonly<Record<ActionId, number>> { return { ...map }; }

/** Actions currently bound to `keyCode` (usually one; Up can be both `up` and `interact`). */
export function actionsForKey(keyCode: number): ActionId[] {
  if (!keyCode) return [];
  return ACTION_IDS.filter(a => map[a] === keyCode);
}

function conflicts(action: ActionId, code: number): boolean {
  return ACTION_IDS.some(b => b !== action && map[b] === code && !canShare(action, b));
}

export interface BindResult { ok: boolean; swapped?: ActionId; unbound?: ActionId; }

/**
 * Bind `action` to `keyCode`. If another action already uses it, that action takes over `action`'s previous key
 * (a swap) — or becomes unbound when that key is still held by a share-partner (e.g. Up shared by up/interact).
 */
export function setBinding(action: ActionId, keyCode: number): BindResult {
  if (!ACTION_IDS.includes(action) || !isBindableKey(keyCode)) return { ok: false };
  const prev = map[action] ?? 0;
  if (prev === keyCode) return { ok: true };
  const displaced = ACTION_IDS.filter(b => b !== action && map[b] === keyCode && !canShare(action, b));
  map[action] = keyCode;
  const res: BindResult = { ok: true };
  for (const b of displaced) {
    // Only hand over the old key if it is itself bindable (Esc is reserved for the menu and never moves).
    if (prev && isBindableKey(prev) && !conflicts(b, prev)) { map[b] = prev; res.swapped = b; } else { map[b] = 0; res.unbound = b; }
  }
  persist();
  emit();
  return res;
}

/** Restore every default binding. */
export function resetBindings() {
  map = { ...DEFAULT_BINDINGS } as Record<ActionId, number>;
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
  emit();
}

/** Subscribe to binding changes; returns an unsubscribe function. */
export function onBindingsChanged(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function actionLabel(action: ActionId): string { return ACTIONS.find(a => a.id === action)?.label ?? action; }

// ───────────────────────────── key names ─────────────────────────────

const NAMED: Record<number, { label: string; key: string; code: string }> = {
  8: { label: 'Bksp', key: 'Backspace', code: 'Backspace' },
  9: { label: 'Tab', key: 'Tab', code: 'Tab' },
  13: { label: 'Enter', key: 'Enter', code: 'Enter' },
  16: { label: 'Shift', key: 'Shift', code: 'ShiftLeft' },
  17: { label: 'Ctrl', key: 'Control', code: 'ControlLeft' },
  18: { label: 'Alt', key: 'Alt', code: 'AltLeft' },
  19: { label: 'Pause', key: 'Pause', code: 'Pause' },
  27: { label: 'Esc', key: 'Escape', code: 'Escape' },
  32: { label: 'Space', key: ' ', code: 'Space' },
  33: { label: 'PgUp', key: 'PageUp', code: 'PageUp' },
  34: { label: 'PgDn', key: 'PageDown', code: 'PageDown' },
  35: { label: 'End', key: 'End', code: 'End' },
  36: { label: 'Home', key: 'Home', code: 'Home' },
  37: { label: '←', key: 'ArrowLeft', code: 'ArrowLeft' },
  38: { label: '↑', key: 'ArrowUp', code: 'ArrowUp' },
  39: { label: '→', key: 'ArrowRight', code: 'ArrowRight' },
  40: { label: '↓', key: 'ArrowDown', code: 'ArrowDown' },
  45: { label: 'Ins', key: 'Insert', code: 'Insert' },
  46: { label: 'Del', key: 'Delete', code: 'Delete' },
  106: { label: 'Num*', key: '*', code: 'NumpadMultiply' },
  107: { label: 'Num+', key: '+', code: 'NumpadAdd' },
  109: { label: 'Num-', key: '-', code: 'NumpadSubtract' },
  110: { label: 'Num.', key: '.', code: 'NumpadDecimal' },
  111: { label: 'Num/', key: '/', code: 'NumpadDivide' },
  186: { label: ';', key: ';', code: 'Semicolon' },
  187: { label: '=', key: '=', code: 'Equal' },
  188: { label: ',', key: ',', code: 'Comma' },
  189: { label: '-', key: '-', code: 'Minus' },
  190: { label: '.', key: '.', code: 'Period' },
  191: { label: '/', key: '/', code: 'Slash' },
  192: { label: '`', key: '`', code: 'Backquote' },
  219: { label: '[', key: '[', code: 'BracketLeft' },
  220: { label: '\\', key: '\\', code: 'Backslash' },
  221: { label: ']', key: ']', code: 'BracketRight' },
  222: { label: "'", key: "'", code: 'Quote' },
};

/** Short on-screen name for a keyCode ('Q', 'Space', '↑', 'F5', '—' when unbound). */
export function keyLabel(keyCode: number): string {
  if (!keyCode) return '—';
  if (NAMED[keyCode]) return NAMED[keyCode].label;
  if (keyCode >= 65 && keyCode <= 90) return String.fromCharCode(keyCode);
  if (keyCode >= 48 && keyCode <= 57) return String(keyCode - 48);
  if (keyCode >= 96 && keyCode <= 105) return `Num${keyCode - 96}`;
  if (keyCode >= 112 && keyCode <= 123) return `F${keyCode - 111}`;
  return `#${keyCode}`;
}

/** `key` / `code` strings for a synthetic KeyboardEvent carrying `keyCode` (used by GamepadBridge). */
export function keyEventInit(keyCode: number): { key: string; code: string } {
  if (NAMED[keyCode]) return { key: NAMED[keyCode].key, code: NAMED[keyCode].code };
  if (keyCode >= 65 && keyCode <= 90) { const c = String.fromCharCode(keyCode); return { key: c.toLowerCase(), code: `Key${c}` }; }
  if (keyCode >= 48 && keyCode <= 57) return { key: String(keyCode - 48), code: `Digit${keyCode - 48}` };
  if (keyCode >= 96 && keyCode <= 105) return { key: String(keyCode - 96), code: `Numpad${keyCode - 96}` };
  if (keyCode >= 112 && keyCode <= 123) return { key: `F${keyCode - 111}`, code: `F${keyCode - 111}` };
  return { key: 'Unidentified', code: `Key${keyCode}` };
}

/** Legacy keyCode of a DOM event (falls back to `code` for browsers that leave keyCode 0). */
export function eventKeyCode(e: KeyboardEvent): number {
  const kc = e.keyCode || e.which || 0;
  if (kc) return kc;
  const code = e.code || '';
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1].charCodeAt(0);
  m = /^Digit(\d)$/.exec(code);
  if (m) return 48 + Number(m[1]);
  const left = /^(Shift|Control|Alt)Right$/.test(code) ? code.replace(/Right$/, 'Left') : code;
  for (const [k, v] of Object.entries(NAMED)) if (v.code === left) return Number(k);
  return 0;
}
