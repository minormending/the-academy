// `{key:action}` placeholders in player-facing text follow the live bindings.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubStorage } from './support/storage';

type Bind = typeof import('../src/core/bindings');
type KT = typeof import('../src/data/keyText');
let bind: Bind, kt: KT;

beforeEach(async () => {
  vi.resetModules();
  stubStorage();
  bind = await import('../src/core/bindings');
  kt = await import('../src/data/keyText');
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('keyText', () => {
  it('leaves text without tokens untouched (same string back)', () => {
    expect(kt.keyText('Hello there.')).toBe('Hello there.');
    expect(kt.keyText('')).toBe('');
    expect(kt.keyText('braces {like} {this}')).toBe('braces {like} {this}');
  });

  it('substitutes the current key for each token', () => {
    expect(kt.keyText('Cast Arcane Bolt ({key:slot0}), pick up ({key:pickup}).')).toBe('Cast Arcane Bolt (Q), pick up (Z).');
    expect(kt.keyText('{key:skills}{key:skills}')).toBe('KK');
    expect(kt.keyText('Press {key:interact} or {key:jump}')).toBe('Press ↑ or Space');
  });

  it('follows a rebind (and a swap) without any module reload', () => {
    bind.setBinding('slot0', 116);           // F5
    expect(kt.keyText('{key:slot0}')).toBe('F5');
    bind.setBinding('pickup', 87);           // W, swapping with slot1
    expect(kt.keyText('{key:pickup}/{key:slot1}')).toBe('W/Z');
  });

  it('shows (unbound) for a cleared key', () => {
    bind.setBinding('menu', 81);             // displaces slot0 to unbound
    expect(kt.keyText('{key:slot0}')).toBe('(unbound)');
    expect(kt.keyName('slot0')).toBe('(unbound)');
  });

  it('leaves an unknown action as written', () => {
    expect(kt.keyText('Press {key:teleport} now')).toBe('Press {key:teleport} now');
    expect(kt.keyText('{key:} {key: slot0}')).toBe('{key:} {key: slot0}');
  });

  it('is case-sensitive about action ids (they are camelCase)', () => {
    expect(kt.keyText('{key:hotbarPage}')).toBe('Tab');
    expect(kt.keyText('{key:hotbarpage}')).toBe('{key:hotbarpage}');
  });
});

describe('every {key:...} in the source names a real action', () => {
  function files(dir: string, out: string[] = []): string[] {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) files(p, out);
      else if (/\.(ts|html|md)$/.test(e.name)) out.push(p);
    }
    return out;
  }

  it('across src/', () => {
    const ids = new Set(bind.ACTIONS.map(a => a.id));
    // `{key:action}` / `{key:yourAction}` are the documentation's own placeholders, not real references.
    const placeholders = new Set(['action', 'yourAction']);
    const bad: string[] = [];
    let n = 0;
    for (const f of files(join(process.cwd(), 'src'))) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/\{key:([A-Za-z][A-Za-z0-9]*)\}/g)) {
        n++;
        if (!ids.has(m[1] as never) && !placeholders.has(m[1])) bad.push(`${f.slice(process.cwd().length + 1)}: {key:${m[1]}}`);
      }
    }
    expect(n, 'no tokens found; the scan is broken').toBeGreaterThan(5);
    expect(bad).toEqual([]);
  });
});
