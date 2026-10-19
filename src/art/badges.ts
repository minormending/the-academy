// Class badges (story mode). PLACEHOLDER: the art agent replaces the drawing; keep the signature.
import type { BadgeDef } from '../core/types';

const cache = new Map<string, string>();

/** Pixel badge as a data URL, `size` px square, cached per badge + size. `dim` draws the not-yet-earned silhouette. */
export function badgeDataUrl(badge: BadgeDef, size = 32, dim = false): string {
  const key = `${badge.id}:${size}:${dim ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined') return '';
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) return '';
  g.fillStyle = dim ? '#2a2540' : `#${badge.color.toString(16).padStart(6, '0')}`;
  g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2); g.fill();
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}
