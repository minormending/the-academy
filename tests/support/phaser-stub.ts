// Stand-in for the `phaser` package in Node tests (see vitest.config.ts).
// Only what is touched at module load or during effect *registration* is real: the event emitter the bus
// is built on. Everything else is an inert, callable, constructible Proxy, so `class X extends
// Phaser.GameObjects.Container` and `Phaser.Math.Clamp(...)` at import time do not throw.
import { EventEmitter as NodeEmitter } from 'node:events';

class EventEmitter {
  private ee = new NodeEmitter();
  on(ev: string, fn: (...a: unknown[]) => void) { this.ee.on(ev, fn); return this; }
  once(ev: string, fn: (...a: unknown[]) => void) { this.ee.once(ev, fn); return this; }
  off(ev: string, fn?: (...a: unknown[]) => void) { if (fn) this.ee.off(ev, fn); else this.ee.removeAllListeners(ev); return this; }
  emit(ev: string, ...a: unknown[]) { return this.ee.emit(ev, ...a); }
  removeAllListeners(ev?: string) { if (ev === undefined) this.ee.removeAllListeners(); else this.ee.removeAllListeners(ev); return this; }
}

function inert(name: string): unknown {
  const target = function () { /* callable + constructible */ } as unknown as Record<string | symbol, unknown>;
  const cache = new Map<string | symbol, unknown>();
  return new Proxy(target, {
    get(t, prop) {
      if (prop === 'prototype') return t.prototype ?? (t.prototype = {});
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'then') return undefined; // never look like a thenable
      if (typeof prop === 'symbol') return undefined;
      if (!cache.has(prop)) cache.set(prop, inert(`${name}.${prop}`));
      return cache.get(prop);
    },
    apply: () => inert(`${name}()`),
    construct: () => inert(`new ${name}`) as object,
  });
}

const Phaser = new Proxy({} as Record<string, unknown>, {
  get(_t, prop) {
    if (prop === 'Events') return { EventEmitter };
    if (prop === '__esModule') return true;
    if (typeof prop === 'symbol') return undefined;
    return inert(`Phaser.${prop}`);
  },
}) as unknown as Record<string, unknown>;

export default Phaser;
