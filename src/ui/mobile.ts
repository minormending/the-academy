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
