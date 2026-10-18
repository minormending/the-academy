/** DOM icon/portrait elements built on A10's painters, with graceful CSS fallbacks. */
import type { CharacterLook, IconSpec } from '../core/types';
import { iconDataUrl, onPixelIconsReady } from '../art/icons';
import { portraitDataUrl } from '../art/characters';
import { cssColor, h, shade } from './dom';

const iconCache = new Map<string, string>();
const portraitCache = new Map<string, string>();
/** Specs of icons currently rendered as <img data-ik>, so they can be swapped to pixel art once the sheet loads. */
const liveSpecs = new Map<string, IconSpec>();

onPixelIconsReady(() => {
  iconCache.clear();
  try {
    document.querySelectorAll<HTMLImageElement>('img.ax-icon[data-ik]').forEach(img => {
      const spec = liveSpecs.get(img.dataset.ik ?? '');
      const size = Number(img.dataset.sz) || 32;
      if (spec) { const url = iconUrl(spec, size); if (url) img.src = url; }
    });
  } catch { /* DOM unavailable */ }
});

export function iconUrl(spec: IconSpec | undefined, size: number): string {
  if (!spec) return '';
  const px = Math.min(128, Math.round(size * 2));
  const key = `${spec.glyph}|${spec.color}|${spec.color2 ?? ''}|${spec.bg ?? ''}|${px}`;
  const hit = iconCache.get(key);
  if (hit !== undefined) return hit;
  let url = '';
  try { url = iconDataUrl(spec, px) || ''; } catch { url = ''; }
  iconCache.set(key, url);
  return url;
}

/** Square icon element. `label` provides the fallback initial when no painter output exists. */
export function iconEl(spec: IconSpec | undefined, size: number, label = '?', extraClass = ''): HTMLElement {
  const url = iconUrl(spec, size);
  const st = `width:${size}px;height:${size}px;`;
  if (url && spec) {
    const ik = `${spec.glyph}|${spec.color}|${spec.color2 ?? ''}|${spec.bg ?? ''}`;
    if (!liveSpecs.has(ik)) liveSpecs.set(ik, spec);
    const img = h('img', { class: `ax-icon ${extraClass}`, src: url, draggable: false, alt: '', style: st, 'data-ik': ik, 'data-sz': String(size) });
    return img;
  }
  const c = spec?.color ?? 0x8fa0ff;
  const bg = spec?.bg;
  const style = st + `font-size:${Math.max(10, Math.round(size * 0.48))}px;` +
    `background:${bg !== undefined ? `radial-gradient(circle at 35% 30%, ${shade(bg, 0.25)}, ${cssColor(bg)} 70%)` :
      `radial-gradient(circle at 35% 30%, ${shade(c, 0.55)}, ${cssColor(c)} 55%, ${shade(c, -0.45)} 100%)`};` +
    `color:${bg !== undefined ? cssColor(c) : '#fff'};`;
  return h('div', { class: `ax-icon ax-icon-fallback ${extraClass}`, style }, (label.trim()[0] ?? '?').toUpperCase());
}

export function portraitUrl(look: CharacterLook | undefined, size: number): string {
  if (!look) return '';
  const key = JSON.stringify(look) + '|' + size;
  const hit = portraitCache.get(key);
  if (hit !== undefined) return hit;
  let url = '';
  try { url = portraitDataUrl(look, size) || ''; } catch { url = ''; }
  portraitCache.set(key, url);
  return url;
}

/** NPC / player portrait with a robe-coloured silhouette fallback. */
export function portraitEl(look: CharacterLook | undefined, size: number, name = ''): HTMLElement {
  const url = portraitUrl(look, Math.round(size * 1.5));
  const wrap = h('div', { class: 'ax-portrait', style: `width:${size}px;height:${size}px;` });
  if (url) {
    wrap.appendChild(h('img', { src: url, draggable: false, alt: name }));
    return wrap;
  }
  const robe = look?.robe ?? 0x4a5bd4, hat = look?.hat ?? robe, skin = look?.skin ?? 0xffd9b8, trim = look?.hatTrim ?? 0xe8d36a;
  const style = look?.hatStyle ?? 'pointed';
  wrap.classList.add('ax-portrait-fallback');
  wrap.appendChild(h('div', { class: 'ax-pf-body', style: `background:linear-gradient(${shade(robe, 0.2)}, ${cssColor(robe)} 60%, ${shade(robe, -0.4)})` }));
  wrap.appendChild(h('div', { class: 'ax-pf-head', style: `background:radial-gradient(circle at 40% 35%, ${shade(skin, 0.3)}, ${cssColor(skin)})` }));
  if (style !== 'none') {
    wrap.appendChild(h('div', { class: `ax-pf-hat ax-pf-${style}`, style: `--hat:${cssColor(hat)};--trim:${cssColor(trim)}` }));
  }
  return wrap;
}
