// Pure helpers of ui/mobile.ts. The module wires window listeners on import, so each test stubs a tiny
// window/document/matchMedia first and re-imports it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function stubEnv(opts: { w: number; h: number; coarse: boolean } | null) {
  if (!opts) return;
  const toggles: Array<[string, boolean]> = [];
  vi.stubGlobal('window', { innerWidth: opts.w, innerHeight: opts.h, addEventListener: () => {} });
  vi.stubGlobal('document', { getElementById: () => null, documentElement: { classList: { toggle: (c: string, on: boolean) => { toggles.push([c, on]); } } } });
  vi.stubGlobal('matchMedia', () => ({ matches: opts.coarse }));
  return toggles;
}
async function load() { vi.resetModules(); return import('../src/ui/mobile'); }

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('mobile layout detection', () => {
  it('is desktop when there is no window', async () => {
    const m = await load();
    expect(m.isMobileLayout()).toBe(false);
    expect(m.uiLogicalSize()).toEqual({ w: 1280, h: 720 });
    expect(m.cameraZoom()).toBe(1);
  });
  it('is mobile on a small coarse-pointer screen', async () => {
    const toggles = stubEnv({ w: 800, h: 390, coarse: true });
    const m = await load();
    expect(m.isMobileLayout()).toBe(true);
    // Phone UI keeps its 405 logical height and widens with the screen's aspect (no letterbox bars).
    const ui = m.uiLogicalSize();
    expect(ui.h).toBe(m.MOBILE_UI.h);
    expect(ui.w).toBeGreaterThanOrEqual(m.MOBILE_UI.w);
    expect(m.cameraZoom()).toBe(m.MOBILE_CAMERA_ZOOM);
    expect(toggles).toContainEqual(['ax-mobile', true]);
  });
  it('is desktop for a coarse pointer on a big screen, or a fine pointer on a small one', async () => {
    stubEnv({ w: 1280, h: 800, coarse: true });
    expect((await load()).isMobileLayout()).toBe(false);
    stubEnv({ w: 800, h: 390, coarse: false });
    expect((await load()).isMobileLayout()).toBe(false);
  });
  it('treats a 600px short side as desktop', async () => {
    stubEnv({ w: 900, h: 600, coarse: true });
    expect((await load()).isMobileLayout()).toBe(false);
  });
  it('onMobileLayoutChanged returns an unsubscribe', async () => {
    stubEnv({ w: 800, h: 390, coarse: true });
    const m = await load();
    const off = m.onMobileLayoutChanged(() => {});
    expect(typeof off).toBe('function');
    off();
  });
});

describe('pinToScreen', () => {
  const mk = () => { const o = { x: 0, y: 0, s: 0, setPosition(x: number, y: number) { o.x = x; o.y = y; return o; }, setScale(s: number) { o.s = s; return o; } }; return o; };
  it('is the identity at zoom 1', async () => {
    const m = await load(); const o = mk();
    m.pinToScreen(o, { width: 1280, height: 720, zoom: 1 }, 100, 50);
    expect(o).toMatchObject({ x: 100, y: 50, s: 1 });
  });
  it('undoes the camera zoom around the centre', async () => {
    const m = await load(); const o = mk();
    m.pinToScreen(o, { width: 800, height: 400, zoom: 2 }, 400, 200, 3); // centre stays put
    expect(o).toMatchObject({ x: 400, y: 200, s: 1.5 });
    m.pinToScreen(o, { width: 800, height: 400, zoom: 2 }, 0, 0);
    expect(o).toMatchObject({ x: 200, y: 100, s: 0.5 });
  });
  it('treats zoom 0 as 1', async () => {
    const m = await load(); const o = mk();
    m.pinToScreen(o, { width: 100, height: 100, zoom: 0 }, 10, 10, 2);
    expect(o).toMatchObject({ x: 10, y: 10, s: 2 });
  });
});
