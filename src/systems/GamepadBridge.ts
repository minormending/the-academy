import { getBinding, keyEventInit, type ActionId } from '../core/bindings';

type KeyBinding = Readonly<{ key: string; code: string; keyCode: number }>;

/** One physical gamepad input → the game actions it presses (dispatched as the actions' *current* keys). */
export interface PadMapping {
  /** Human name of the input, e.g. "A / Cross", "D-pad ↑", "Right stick ←". */
  input: string;
  kind: 'button' | 'axis';
  /** Standard Gamepad API button index, or axis index. */
  index: number;
  /** Axis direction (axis inputs only). */
  dir?: -1 | 1;
  /** Axis deflection needed (axis inputs only). */
  threshold?: number;
  /**
   * Chord: this mapping only fires while the *modifier* button with this index is held, and it replaces the
   * modifier-less mapping of the same button while the modifier is down. The modifier's own mapping (if any) is
   * then deferred to a tap: it fires when the modifier is released without a chord having been used.
   */
  chord?: number;
  actions: readonly ActionId[];
}

/**
 * Standard-mapping gamepad layout. Buttons/sticks drive *actions*, so a pad follows keyboard rebinding
 * (the bridge dispatches whatever key each action is bound to). Exported for the Controls window.
 */
export const GAMEPAD_MAP: readonly PadMapping[] = [
  { input: 'A / Cross', kind: 'button', index: 0, actions: ['jump'] },
  { input: 'B / Circle', kind: 'button', index: 1, actions: ['pickup'] },
  { input: 'X / Square', kind: 'button', index: 2, actions: ['slot0'] },
  { input: 'Y / Triangle', kind: 'button', index: 3, actions: ['slot1'] },
  { input: 'LB / L1', kind: 'button', index: 4, actions: ['slot2'] },
  { input: 'RB / R1', kind: 'button', index: 5, actions: ['slot3'] },
  { input: 'LT / L2', kind: 'button', index: 6, actions: ['slot5'] },
  { input: 'RT / R2', kind: 'button', index: 7, actions: ['slot6'] },
  { input: 'Right stick →', kind: 'axis', index: 2, dir: 1, threshold: 0.6, actions: ['slot7'] },
  { input: 'Right stick ↓', kind: 'axis', index: 3, dir: 1, threshold: 0.6, actions: ['slot8'] },
  { input: 'Right stick ←', kind: 'axis', index: 2, dir: -1, threshold: 0.6, actions: ['slot4'] },
  { input: 'Right stick ↑', kind: 'axis', index: 3, dir: -1, threshold: 0.6, actions: ['slot9'] },
  // Back / Select is a chord modifier: tap it to flip the hotbar page, hold it for slots 10 / 11 (the potion keys).
  { input: 'Back / Select (tap)', kind: 'button', index: 8, actions: ['hotbarPage'] },
  { input: 'Back + X / Square', kind: 'button', index: 2, chord: 8, actions: ['slot10'] },
  { input: 'Back + Y / Triangle', kind: 'button', index: 3, chord: 8, actions: ['slot11'] },
  { input: 'Start / Options', kind: 'button', index: 9, actions: ['menu'] },
  { input: 'L3 (press stick)', kind: 'button', index: 10, actions: ['skills'] },
  { input: 'R3 (press stick)', kind: 'button', index: 11, actions: ['inventory'] },
  { input: 'D-pad ↑', kind: 'button', index: 12, actions: ['up', 'interact'] },
  { input: 'D-pad ↓', kind: 'button', index: 13, actions: ['down'] },
  { input: 'D-pad ←', kind: 'button', index: 14, actions: ['left'] },
  { input: 'D-pad →', kind: 'button', index: 15, actions: ['right'] },
  { input: 'Left stick ←', kind: 'axis', index: 0, dir: -1, threshold: 0.4, actions: ['left'] },
  { input: 'Left stick →', kind: 'axis', index: 0, dir: 1, threshold: 0.4, actions: ['right'] },
  { input: 'Left stick ↑', kind: 'axis', index: 1, dir: -1, threshold: 0.4, actions: ['up', 'interact'] },
  { input: 'Left stick ↓', kind: 'axis', index: 1, dir: 1, threshold: 0.4, actions: ['down'] },
];

/** Synthetic events carry this flag so the Controls window's key capture can ignore pad presses. */
export const GAMEPAD_EVENT_FLAG = '__academyGamepad';

/** Buttons that act as chord modifiers (some mapping names them in `chord`). */
const MODIFIERS: ReadonlySet<number> = new Set(GAMEPAD_MAP.flatMap(m => (m.chord === undefined ? [] : [m.chord])));

let activePad: { index: number; id: string } | undefined;

/** The gamepad the bridge is currently reading (standard mapping), if any. */
export function connectedGamepad(): { index: number; id: string } | null {
  if (activePad) return { ...activePad };
  try {
    for (const p of navigator.getGamepads?.() ?? []) if (p?.connected && p.mapping === 'standard') return { index: p.index, id: p.id };
  } catch { /* permissions policy */ }
  return null;
}

function bindingFor(action: ActionId): KeyBinding | null {
  const keyCode = getBinding(action);
  if (!keyCode) return null;
  return { ...keyEventInit(keyCode), keyCode };
}

/** Translate the first standard gamepad into the game's existing keyboard input. */
export function startGamepadBridge(): () => void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined'
    || typeof navigator.getGamepads !== 'function') return () => {};

  const held = new Map<string, KeyBinding>();
  const connected = new Map<number, string>();
  let selected: { index: number; id: string } | undefined;
  let stopped = false;
  let frame = 0;
  let lastFrame = performance.now();

  function dispatch(type: 'keydown' | 'keyup', binding: KeyBinding) {
    const event = new KeyboardEvent(type, {
      key: binding.key, code: binding.code, bubbles: true, cancelable: true, repeat: false,
    });
    // Phaser reads the legacy numeric fields; constructor support varies by browser.
    Object.defineProperties(event, {
      keyCode: { value: binding.keyCode },
      which: { value: binding.keyCode },
      [GAMEPAD_EVENT_FLAG]: { value: true },
    });
    window.dispatchEvent(event);
  }

  /** Modifier button index → whether a chord was used during the current hold. */
  const modifierHeld = new Map<number, { chorded: boolean }>();
  /** Taps of a modifier (released without a chord) → pressed for exactly one poll. */
  let pulses = new Map<string, KeyBinding>();

  function releaseAll() {
    modifierHeld.clear();
    pulses = new Map();
    const released = [...held.values()];
    held.clear();
    for (const binding of released) dispatch('keyup', binding);
  }

  function poll() {
    if (stopped) return;
    let pads: (Gamepad | null)[];
    try {
      pads = navigator.getGamepads();
    } catch {
      // Browsers may deny the API through their permissions policy.
      releaseAll();
      return;
    }

    let pad: Gamepad | undefined;
    const present = new Set<number>();
    for (const candidate of pads) {
      if (!candidate?.connected || candidate.mapping !== 'standard') continue;
      pad ??= candidate;
      present.add(candidate.index);
      if (connected.get(candidate.index) !== candidate.id) {
        connected.set(candidate.index, candidate.id);
        console.info(`[GamepadBridge] Connected: ${candidate.id}`);
      }
    }
    for (const index of connected.keys()) {
      if (!present.has(index)) connected.delete(index);
    }

    if (selected?.index !== pad?.index || selected?.id !== pad?.id) {
      releaseAll();
      selected = pad ? { index: pad.index, id: pad.id } : undefined;
      activePad = selected;
    }
    if (!pad) return;

    // Leave typing alone. Disconnect/stop cleanup still releases outstanding keys.
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const down = (i: number) => !!pad.buttons[i]?.pressed;

    // Chord modifiers: remember whether a chord fired during the hold; a clean tap fires the modifier's own action.
    for (const mod of MODIFIERS) {
      const st = modifierHeld.get(mod);
      if (down(mod)) {
        const entry = st ?? { chorded: false };
        if (GAMEPAD_MAP.some(m => m.chord === mod && down(m.index))) entry.chorded = true;
        modifierHeld.set(mod, entry);
      } else if (st) {
        modifierHeld.delete(mod);
        if (!st.chorded) {
          for (const m of GAMEPAD_MAP) {
            if (m.index !== mod || m.chord !== undefined || m.kind !== 'button') continue;
            for (const action of m.actions) {
              const binding = bindingFor(action);
              if (binding) pulses.set(String(binding.keyCode), binding);
            }
          }
        }
      }
    }

    // Keyed by keyCode: D-pad + stick (or two actions sharing Up) collapse into one held key.
    const next = new Map<string, KeyBinding>(pulses);
    pulses = new Map();
    for (const m of GAMEPAD_MAP) {
      if (m.kind === 'button') {
        if (m.chord !== undefined) { if (!down(m.chord)) continue; }
        else if (MODIFIERS.has(m.index)) continue; // a modifier's own action is deferred to its tap (above)
        else if ([...MODIFIERS].some(mod => down(mod) && GAMEPAD_MAP.some(c => c.chord === mod && c.index === m.index))) continue; // replaced by its chord
      }
      const on = m.kind === 'button'
        ? down(m.index)
        : (pad.axes[m.index] ?? 0) * (m.dir ?? 1) > (m.threshold ?? 0.5);
      if (!on) continue;
      for (const action of m.actions) {
        const binding = bindingFor(action);
        if (binding) next.set(String(binding.keyCode), binding);
      }
    }

    // Aggregate D-pad and stick first so either source can keep a direction held.
    for (const [code, binding] of held) {
      if (!next.has(code)) {
        held.delete(code);
        dispatch('keyup', binding);
      }
    }
    for (const [code, binding] of next) {
      if (stopped) return;
      if (!held.has(code)) {
        held.set(code, binding);
        dispatch('keydown', binding);
      }
    }
  }

  function onFrame() {
    if (stopped) return;
    lastFrame = performance.now();
    poll();
    if (!stopped) frame = window.requestAnimationFrame(onFrame);
  }

  function onDisconnect(event: GamepadEvent) {
    connected.delete(event.gamepad.index);
    if (selected?.index === event.gamepad.index) {
      selected = undefined;
      activePad = undefined;
      releaseAll();
    }
  }

  window.addEventListener('gamepaddisconnected', onDisconnect);
  frame = window.requestAnimationFrame(onFrame);
  // A watchdog keeps polling when rAF pauses or slows; browsers may throttle timers too.
  const interval = window.setInterval(() => {
    if (performance.now() - lastFrame >= 32) poll();
  }, 16);

  return () => {
    if (stopped) return;
    stopped = true;
    window.cancelAnimationFrame(frame);
    window.clearInterval(interval);
    window.removeEventListener('gamepaddisconnected', onDisconnect);
    releaseAll();
    connected.clear();
    activePad = undefined;
  };
}
