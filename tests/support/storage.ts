// In-memory localStorage for the Node tests (the modules under test read `localStorage` lazily and guard for it being absent).
import { vi } from 'vitest';

export class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
}

/** Install a fresh storage as the global and return it. Pair with `vi.unstubAllGlobals()` in afterEach. */
export function stubStorage(seed: Record<string, string> = {}): MemoryStorage {
  const s = new MemoryStorage();
  for (const [k, v] of Object.entries(seed)) s.setItem(k, v);
  vi.stubGlobal('localStorage', s);
  return s;
}
