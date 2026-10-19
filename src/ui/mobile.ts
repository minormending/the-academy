/**
 * Mobile layout switch (Phase 11). One definition shared by the game view, HUD and windows:
 * phones get a zoomed-in world, a phone-sized UI scale and full-screen sheets instead of desktop windows.
 */
import { getSettings, onSettingsChanged } from '../core/settings';

/** Logical UI size used on phones (the DOM overlay is laid out at this size, then scaled to the screen). */
export const MOBILE_UI = { w: 720, h: 405 } as const;
/** Camera zoom applied to the game world on phones. */
export const MOBILE_CAMERA_ZOOM = 1.8;

const listeners = new Set<(on: boolean) => void>();
let last: boolean | null = null;

function touchActive(): boolean {
  try {
    const t = (getSettings() as { touch?: string }).touch ?? 'auto';
    if (t === 'off') return false;
    if (t === 'on') return true;
  } catch { /* ignore */ }
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

/** True on phone-sized touch screens (short side under 600 CSS px). */
export function isMobileLayout(): boolean {
  if (typeof window === 'undefined') return false;
  const short = Math.min(window.innerWidth, window.innerHeight);
  return touchActive() && short < 600;
}

/** Subscribe to mobile layout changes (resize, rotation, Touch setting). Returns an unsubscribe. */
export function onMobileLayoutChanged(cb: (on: boolean) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function check() {
  const now = isMobileLayout();
  if (now === last) return;
  last = now;
  document.documentElement.classList.toggle('ax-mobile', now);
  for (const cb of [...listeners]) { try { cb(now); } catch (e) { console.warn('[mobile] listener failed', e); } }
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', check);
  window.addEventListener('orientationchange', check);
  window.addEventListener('touchstart', check, { passive: true, once: true });
  try { onSettingsChanged(check); } catch { /* ignore */ }
  check();
}

/** Desktop / base logical game size (16:9). */
const BASE_W = 1280, BASE_H = 720;
/** Widest aspect we stretch to on phones (very tall-notch phones are ~2.2:1). */
const MAX_ASPECT = 2.4;

/**
 * Logical game width for the current layout. Desktop: always 1280 (16:9, letterboxed by FIT). Phones in
 * landscape: logical height stays 720 and the width grows to the device aspect, so the canvas fills the screen
 * with no letterbox bars. Portrait phones keep 1280 (the rotate prompt covers them).
 */
export function gameLogicalWidth(): number {
  if (!isMobileLayout()) return BASE_W;
  const el = document.getElementById('game');
  const r = el?.getBoundingClientRect();
  const vw = r && r.width > 1 ? r.width : window.innerWidth;
  const vh = r && r.height > 1 ? r.height : window.innerHeight;
  const aspect = vw / Math.max(1, vh);
  if (!(aspect > BASE_W / BASE_H)) return BASE_W;
  return Math.round(BASE_H * Math.min(aspect, MAX_ASPECT) / 2) * 2;
}

/** Current logical size of #ui-root: MOBILE_UI height (405) widened with the canvas on phones, 1280×720 otherwise. */
export function uiLogicalSize(): { w: number; h: number } {
  if (!isMobileLayout()) return { w: BASE_W, h: BASE_H };
  // Follow the canvas's actual logical width when the game exists, so #ui-root always matches it exactly.
  const g = (window as unknown as { game?: { scale?: { width?: number } } }).game;
  const gw = g?.scale?.width && g.scale.width >= BASE_W ? g.scale.width : gameLogicalWidth();
  return { w: Math.round(MOBILE_UI.h * gw / BASE_H), h: MOBILE_UI.h };
}

/** Camera zoom for the current layout (1 on desktop). */
export function cameraZoom(): number {
  return isMobileLayout() ? MOBILE_CAMERA_ZOOM : 1;
}

/**
 * Place a `setScrollFactor(0)` object at screen position (sx, sy) with on-screen scale `s`, undoing the camera
 * zoom (Phaser zooms scroll-factor-0 objects around the camera centre too).
 */
export function pinToScreen(obj: { setPosition(x: number, y: number): unknown; setScale(s: number): unknown },
  cam: { width: number; height: number; zoom: number }, sx: number, sy: number, s = 1) {
  const z = cam.zoom || 1, cx = cam.width / 2, cy = cam.height / 2;
  obj.setPosition(cx + (sx - cx) / z, cy + (sy - cy) / z);
  obj.setScale(s / z);
}
