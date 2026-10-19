// Every VFX key a skill (or any playVfx('literal') call in the source) names must be registered.
// An unregistered key does not crash the game, it silently plays a white puff, so nothing else would catch it.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { AttackSpec, SkillDef } from '../src/core/types';
import { hasVfx } from '../src/core/vfx';
import { ALL_SKILLS, registerAllVfx } from '../src/skills';
import { problems } from './support/problems';

beforeAll(() => { registerAllVfx(); });

function skillVfxKeys(s: SkillDef): { where: string; key: string }[] {
  const out: { where: string; key: string }[] = [];
  const add = (where: string, key?: string) => { if (key) out.push({ where: `${s.id}.${where}`, key }); };
  const fromAttack = (prefix: string, a?: AttackSpec) => {
    if (!a) return;
    for (const [slot, key] of Object.entries(a.vfx)) add(`${prefix}.vfx.${slot}`, key);
  };
  fromAttack('attack', s.attack);
  add('buff.vfx', s.buff?.vfx);
  add('buff.auraVfx', s.buff?.auraVfx);
  add('movement.vfxIn', s.movement?.vfxIn);
  add('movement.vfxOut', s.movement?.vfxOut);
  add('summon.vfx', s.summon?.vfx);
  fromAttack('summon.attack', s.summon?.attack);
  return out;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('VFX registration', () => {
  it('registerAllVfx registers a healthy number of effects', () => {
    expect(['app_bolt', 'ice_hit', 'fire_hit'].filter(k => !hasVfx(k)), 'common keys missing').toEqual([]);
  });

  it('every VFX key referenced by a skill spec is registered', () => {
    const p = problems();
    let n = 0;
    for (const s of ALL_SKILLS) for (const { where, key } of skillVfxKeys(s)) { n++; p.check(hasVfx(key), `${where} -> "${key}" is not registered`); }
    expect(n, 'no keys found; the scan is broken').toBeGreaterThan(100);
    p.done();
  });

  it("every literal playVfx(scene, 'key', ...) in src/ is registered", () => {
    const p = problems();
    const re = /playVfx\(\s*[^,()]+(?:\([^)]*\))?[^,()]*,\s*(['"`])([A-Za-z0-9_]+)\1/g;
    let n = 0;
    for (const file of sourceFiles(join(process.cwd(), 'src'))) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(re)) { n++; p.check(hasVfx(m[2]), `${file.slice(process.cwd().length + 1)}: playVfx "${m[2]}" is not registered`); }
    }
    expect(n, 'no playVfx literals found; the scan is broken').toBeGreaterThan(30);
    p.done();
  });
});
