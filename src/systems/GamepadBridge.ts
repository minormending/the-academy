type KeyBinding = Readonly<{ key: string; code: string; keyCode: number }>;

const LEFT: KeyBinding = { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 };
const UP: KeyBinding = { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 };
const RIGHT: KeyBinding = { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 };
const DOWN: KeyBinding = { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 };
const letter = (key: string): KeyBinding => ({
  key: key.toLowerCase(), code: `Key${key}`, keyCode: key.charCodeAt(0),
});

// Standard Gamepad API button order, including the four D-pad buttons.
const BUTTON_KEYS: readonly KeyBinding[] = [
  { key: ' ', code: 'Space', keyCode: 32 },
  letter('Z'), letter('Q'), letter('W'), letter('E'), letter('R'), letter('A'), letter('S'),
  { key: 'Tab', code: 'Tab', keyCode: 9 },
  { key: 'Escape', code: 'Escape', keyCode: 27 },
  letter('K'), letter('I'), UP, DOWN, LEFT, RIGHT,
];
const STICK_KEYS = [letter('D'), letter('F'), letter('T'), letter('G')] as const;

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
    });
    window.dispatchEvent(event);
  }

  function releaseAll() {
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
    }
    if (!pad) return;

    // Leave typing alone. Disconnect/stop cleanup still releases outstanding keys.
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const next = new Map<string, KeyBinding>();
    const add = (binding: KeyBinding) => next.set(binding.code, binding);
    BUTTON_KEYS.forEach((binding, index) => {
      if (pad.buttons[index]?.pressed) add(binding);
    });

    const [leftX = 0, leftY = 0, rightX = 0, rightY = 0] = pad.axes;
    if (leftX < -0.4) add(LEFT);
    if (leftX > 0.4) add(RIGHT);
    if (leftY < -0.4) add(UP);
    if (leftY > 0.4) add(DOWN);
    if (rightX > 0.6) add(STICK_KEYS[0]);
    if (rightY > 0.6) add(STICK_KEYS[1]);
    if (rightX < -0.6) add(STICK_KEYS[2]);
    if (rightY < -0.6) add(STICK_KEYS[3]);

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
  };
}
