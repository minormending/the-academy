import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APPEARANCE_OPTIONS, DEFAULT_APPEARANCE, appearanceKey, applyAppearance, randomAppearance, repairAppearance,
} from '../src/data/appearance';
import type { CharacterLook } from '../src/core/types';

const ROWS = ['skin', 'hair', 'accent'] as const;
const look = { robe: 1, robeTrim: 2, hat: 3, skin: 4, hair: 5, staffGem: 6 } as unknown as CharacterLook;

afterEach(() => vi.restoreAllMocks());

describe('appearance options', () => {
  for (const row of ROWS) {
    it(`${row}: non-empty, valid 0..0xffffff integers, unique`, () => {
      const xs = APPEARANCE_OPTIONS[row];
      expect(xs.length).toBeGreaterThan(0);
      for (const c of xs) { expect(Number.isInteger(c)).toBe(true); expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(0xffffff); }
      expect(new Set(xs).size).toBe(xs.length);
    });
    it(`${row}: default is one of the options`, () => {
      expect((APPEARANCE_OPTIONS[row] as readonly number[]).includes(DEFAULT_APPEARANCE[row])).toBe(true);
    });
  }

  it('randomAppearance picks only from the options (and reaches both ends of each row)', () => {
    for (let i = 0; i < 100; i++) {
      const a = randomAppearance();
      for (const row of ROWS) expect((APPEARANCE_OPTIONS[row] as readonly number[]).includes(a[row])).toBe(true);
    }
    const r = vi.spyOn(Math, 'random');
    r.mockReturnValue(0);
    expect(randomAppearance()).toEqual({ skin: APPEARANCE_OPTIONS.skin[0], hair: APPEARANCE_OPTIONS.hair[0], accent: APPEARANCE_OPTIONS.accent[0] });
    r.mockReturnValue(0.999999);
    const last = (xs: readonly number[]) => xs[xs.length - 1];
    expect(randomAppearance()).toEqual({ skin: last(APPEARANCE_OPTIONS.skin), hair: last(APPEARANCE_OPTIONS.hair), accent: last(APPEARANCE_OPTIONS.accent) });
  });
});

describe('applyAppearance', () => {
  it('sets skin, hair and staffGem and leaves the other look fields alone', () => {
    const out = applyAppearance(look, { skin: 0x111111, hair: 0x222222, accent: 0x333333 });
    expect(out).toMatchObject({ robe: 1, robeTrim: 2, hat: 3, skin: 0x111111, hair: 0x222222, staffGem: 0x333333 });
  });
  it('does not mutate its input', () => {
    const before = { ...look };
    const out = applyAppearance(look, DEFAULT_APPEARANCE);
    expect(look).toEqual(before);
    expect(out).not.toBe(look);
  });
  it('returns the look unchanged for null/undefined appearance', () => {
    expect(applyAppearance(look, null)).toBe(look);
    expect(applyAppearance(look)).toBe(look);
  });
});

describe('appearanceKey', () => {
  it('is "default" for null/undefined', () => {
    expect(appearanceKey(null)).toBe('default');
    expect(appearanceKey(undefined)).toBe('default');
  });
  it('is a stable 6-hex-per-channel key', () => {
    expect(appearanceKey(DEFAULT_APPEARANCE)).toBe('ffe0c4-5a3a22-7fe3ff');
    expect(appearanceKey(DEFAULT_APPEARANCE)).toBe(appearanceKey({ ...DEFAULT_APPEARANCE }));
    expect(appearanceKey({ skin: 0, hair: 0xff, accent: 0xffffff })).toBe('000000-0000ff-ffffff');
  });
  it('every option yields the 6-hex format and keys differ across options', () => {
    const keys = new Set<string>();
    for (const row of ROWS) for (const c of APPEARANCE_OPTIONS[row]) {
      const k = appearanceKey({ ...DEFAULT_APPEARANCE, [row]: c });
      expect(k).toMatch(/^[0-9a-f]{6}-[0-9a-f]{6}-[0-9a-f]{6}$/);
      keys.add(k);
    }
    expect(keys.size).toBeGreaterThan(1);
  });
});

describe('repairAppearance', () => {
  it('rejects non-objects, arrays and null', () => {
    for (const v of [null, undefined, 0, 'x', true, [], [1, 2, 3]]) expect(repairAppearance(v)).toBeNull();
  });
  it('keeps valid values', () => {
    expect(repairAppearance({ skin: 0x123456, hair: 0, accent: 0xffffff })).toEqual({ skin: 0x123456, hair: 0, accent: 0xffffff });
  });
  it('replaces missing or bad values with the defaults', () => {
    expect(repairAppearance({})).toEqual(DEFAULT_APPEARANCE);
    const bad = repairAppearance({ skin: -1, hair: 0x1000000, accent: NaN });
    expect(bad).toEqual(DEFAULT_APPEARANCE);
    expect(repairAppearance({ skin: '123', hair: Infinity, accent: null })).toEqual(DEFAULT_APPEARANCE);
  });
  it('floors fractional colours and only repairs the bad channel', () => {
    expect(repairAppearance({ skin: 10.9, hair: -5, accent: 20 })).toEqual({ skin: 10, hair: DEFAULT_APPEARANCE.hair, accent: 20 });
  });
});
