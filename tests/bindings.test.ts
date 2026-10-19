// Key bindings: defaults, swap / unbind rules, Esc, persistence and corrupt-store recovery.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubStorage } from './support/storage';

type B = typeof import('../src/core/bindings');
const STORE = 'academy-bindings-v1';

let B: B;
async function fresh(seed?: unknown): Promise<B> {
  vi.resetModules();
  stubStorage(seed === undefined ? {} : { [STORE]: typeof seed === 'string' ? seed : JSON.stringify(seed) });
  B = await import('../src/core/bindings');
  return B;
}
afterEach(() => { vi.unstubAllGlobals(); });

const K = { Q: 81, W: 87, E: 69, A: 65, Z: 90, ESC: 27, TAB: 9, SPACE: 32, UP: 38, LEFT: 37, DOWN: 40, F5: 116 };

describe('defaults', () => {
  beforeEach(async () => { await fresh(); });

  it('every action has a bound, bindable default', () => {
    for (const a of B.ACTIONS) {
      const code = B.getBinding(a.id);
      expect(code, a.id).toBeGreaterThan(0);
      if (a.id !== 'menu') expect(B.isBindableKey(code), `${a.id} default ${code}`).toBe(true);
    }
  });

  it('only Up is shared (climb / interact); every other key has exactly one action', () => {
    const byKey = new Map<number, string[]>();
    for (const a of B.ACTIONS) byKey.set(B.getBinding(a.id), [...(byKey.get(B.getBinding(a.id)) ?? []), a.id]);
    for (const [code, ids] of byKey) {
      if (ids.length > 1) expect(ids.sort(), `key ${code}`).toEqual(['interact', 'up']);
    }
  });

  it('lists each action once and covers the 12 hotbar slots', () => {
    const ids = B.ACTIONS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter(i => i.startsWith('slot'))).toHaveLength(12);
    expect(B.SLOT_ACTIONS).toHaveLength(12);
  });

  it('matches the original controls', () => {
    expect(B.getBinding('slot0')).toBe(K.Q);
    expect(B.getBinding('skills')).toBe(75);       // K
    expect(B.getBinding('menu')).toBe(K.ESC);
    expect(B.getBinding('hotbarPage')).toBe(K.TAB);
    expect(B.getBinding('jump')).toBe(K.SPACE);
    expect(B.getBinding('pickup')).toBe(K.Z);
    expect(B.actionsForKey(K.UP).sort()).toEqual(['interact', 'up']);
  });
});

describe('setBinding', () => {
  beforeEach(async () => { await fresh(); });

  it('rebinding to a free key just moves the action', () => {
    expect(B.setBinding('slot0', K.F5)).toEqual({ ok: true });
    expect(B.getBinding('slot0')).toBe(K.F5);
    expect(B.actionsForKey(K.Q)).toEqual([]);
  });

  it('rebinding to a key another action uses swaps the two', () => {
    const res = B.setBinding('slot0', K.W);      // slot0 was Q, slot1 was W
    expect(res).toEqual({ ok: true, swapped: 'slot1' });
    expect(B.getBinding('slot0')).toBe(K.W);
    expect(B.getBinding('slot1')).toBe(K.Q);
  });

  it('binding an action to its own key is a harmless no-op', () => {
    expect(B.setBinding('slot0', K.Q)).toEqual({ ok: true });
    expect(B.getBinding('slot0')).toBe(K.Q);
  });

  it('never leaves two actions on one key (after many random rebinds)', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const ids = B.ACTIONS.map(a => a.id);
    for (let i = 0; i < 400; i++) B.setBinding(ids[Math.floor(rnd() * ids.length)], 48 + Math.floor(rnd() * 60));
    const seen = new Map<number, string[]>();
    for (const a of ids) if (B.getBinding(a)) seen.set(B.getBinding(a), [...(seen.get(B.getBinding(a)) ?? []), a]);
    for (const [code, acts] of seen) if (acts.length > 1) expect(acts.sort(), `key ${code}`).toEqual(['interact', 'up']);
  });

  it('binding another action to Up displaces both climb and interact; they move together and still share the old key', () => {
    B.setBinding('slot0', K.UP);
    expect(B.getBinding('slot0')).toBe(K.UP);
    expect(B.actionsForKey(K.UP)).toEqual(['slot0']);
    // up and interact are share-partners, so both can take slot0's old key (Q).
    expect([B.getBinding('up'), B.getBinding('interact')]).toEqual([K.Q, K.Q]);
  });

  it('moving "up" off Up leaves "interact" on Up', () => {
    B.setBinding('up', K.F5);
    expect(B.getBinding('up')).toBe(K.F5);
    expect(B.getBinding('interact')).toBe(K.UP);
  });

  it('putting another action on a key held by a share-partner pair unbinds what it displaces rather than double-booking', () => {
    B.setBinding('up', K.F5);                      // up -> F5, interact keeps Up
    B.setBinding('left', K.UP);                    // left takes Up from interact; interact gets Left
    expect(B.getBinding('left')).toBe(K.UP);
    expect(B.getBinding('interact')).toBe(K.LEFT);
  });

  describe('Esc', () => {
    it('can never be assigned to an action', () => {
      expect(B.setBinding('slot0', K.ESC)).toEqual({ ok: false });
      expect(B.getBinding('slot0')).toBe(K.Q);
      expect(B.getBinding('menu')).toBe(K.ESC);
    });

    it('is not bindable, nor are meta/IME/lock keys, junk or out-of-range codes', () => {
      for (const code of [0, 27, 91, 92, 93, 224, 229, 20, 144, 145, -1, 256, 1000, 3.5, NaN]) expect(B.isBindableKey(code), String(code)).toBe(false);
      for (const code of [8, 9, 13, 32, 65, 112]) expect(B.isBindableKey(code), String(code)).toBe(true);
    });

    it('moving the menu off Esc never hands Esc to the action it displaces: that action is unbound', () => {
      const res = B.setBinding('menu', K.Q);       // Q was slot0
      expect(res).toEqual({ ok: true, unbound: 'slot0' });
      expect(B.getBinding('menu')).toBe(K.Q);
      expect(B.getBinding('slot0')).toBe(0);
      expect(B.actionsForKey(K.ESC)).toEqual([]);   // nothing else ever holds Esc
    });

    it('rejects an unknown action or key', () => {
      expect(B.setBinding('nope' as never, K.F5)).toEqual({ ok: false });
      expect(B.setBinding('slot0', 0)).toEqual({ ok: false });
    });
  });

  it('actionsForKey(0) never matches the unbound actions', () => {
    B.setBinding('menu', K.Q);
    expect(B.actionsForKey(0)).toEqual([]);
  });
});

describe('resetBindings, listeners and persistence', () => {
  it('resetBindings restores every default and clears the store', async () => {
    const st = stubStorage();
    vi.resetModules();
    B = await import('../src/core/bindings');
    B.setBinding('slot0', K.F5);
    B.setBinding('menu', K.Q);
    expect(st.getItem(STORE)).not.toBeNull();
    B.resetBindings();
    expect(B.getBindings()).toEqual(B.DEFAULT_BINDINGS);
    expect(st.getItem(STORE)).toBeNull();
  });

  it('notifies listeners on change, supports unsubscribe, and survives a throwing listener', async () => {
    await fresh();
    const calls: number[] = [];
    B.onBindingsChanged(() => { throw new Error('bad listener'); });
    const off = B.onBindingsChanged(() => calls.push(1));
    B.setBinding('slot0', K.F5);
    expect(calls).toHaveLength(1);
    off();
    B.setBinding('slot0', K.Z);
    expect(calls).toHaveLength(1);
  });

  it('persists, and a fresh load reads the same bindings back', async () => {
    const st = await (async () => { await fresh(); return stubStorage(); })();
    void st;
    vi.resetModules();
    const s2 = stubStorage();
    B = await import('../src/core/bindings');
    B.setBinding('slot0', K.W);
    const saved = s2.getItem(STORE)!;
    const expected = B.getBindings();
    vi.resetModules();
    stubStorage({ [STORE]: saved });
    const again = await import('../src/core/bindings');
    expect(again.getBindings()).toEqual(expected);
  });

  it('ignores a corrupt or malicious store and falls back to defaults', async () => {
    for (const junk of ['{nope', 'null', '"str"', '[]', JSON.stringify({ map: 'x' }), JSON.stringify({ map: { slot0: 'Q', left: 27, right: 99999, jump: -4 } })]) {
      const b = await fresh(junk);
      expect(b.getBindings(), junk).toEqual(b.DEFAULT_BINDINGS);
    }
  });

  it('a stored duplicate is repaired by unbinding the later action', async () => {
    const b = await fresh({ v: 1, map: { slot0: K.W } });  // slot1 still defaults to W
    expect(b.getBinding('slot0')).toBe(K.W);
    expect(b.getBinding('slot1')).toBe(0);
  });

  it('keeps a valid stored unbinding (0)', async () => {
    const b = await fresh({ v: 1, map: { slot3: 0 } });
    expect(b.getBinding('slot3')).toBe(0);
  });
});

describe('key names', () => {
  beforeEach(async () => { await fresh(); });

  it('keyLabel names common keys and marks unbound', () => {
    expect(B.keyLabel(0)).toBe('—');
    expect(B.keyLabel(81)).toBe('Q');
    expect(B.keyLabel(49)).toBe('1');
    expect(B.keyLabel(32)).toBe('Space');
    expect(B.keyLabel(38)).toBe('↑');
    expect(B.keyLabel(116)).toBe('F5');
    expect(B.keyLabel(97)).toBe('Num1');
    expect(B.keyLabel(254)).toBe('#254');
  });

  it('eventKeyCode prefers keyCode, then falls back to code', () => {
    expect(B.eventKeyCode({ keyCode: 81, which: 0, code: '' } as KeyboardEvent)).toBe(81);
    expect(B.eventKeyCode({ keyCode: 0, which: 0, code: 'KeyQ' } as KeyboardEvent)).toBe(81);
    expect(B.eventKeyCode({ keyCode: 0, which: 0, code: 'Digit4' } as KeyboardEvent)).toBe(52);
    expect(B.eventKeyCode({ keyCode: 0, which: 0, code: 'ShiftRight' } as KeyboardEvent)).toBe(16);
    expect(B.eventKeyCode({ keyCode: 0, which: 0, code: 'Space' } as KeyboardEvent)).toBe(32);
    expect(B.eventKeyCode({ keyCode: 0, which: 0, code: '' } as KeyboardEvent)).toBe(0);
  });

  it('keyEventInit produces the matching key / code', () => {
    expect(B.keyEventInit(81)).toEqual({ key: 'q', code: 'KeyQ' });
    expect(B.keyEventInit(32)).toEqual({ key: ' ', code: 'Space' });
    expect(B.keyEventInit(53)).toEqual({ key: '5', code: 'Digit5' });
  });
});
