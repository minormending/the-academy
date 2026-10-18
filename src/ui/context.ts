/** Shared context handed to every UI component. */
import type { GameServices, SfxKey } from '../core/types';
import type { DragManager } from './drag';
import type { UIScaler } from './scaler';
import type { Tooltip } from './tooltip';
import { loadJson, saveJson } from './dom';

export type WindowName = 'skills' | 'inventory' | 'stats' | 'quests' | 'jobs' | 'menu' | 'help';

export interface UICtx {
  root: HTMLElement;
  s: GameServices;
  scaler: UIScaler;
  tooltip: Tooltip;
  drag: DragManager;
  layout: Layout;
  nextZ(): number;
  sfx(key: SfxKey): void;
  log(text: string, color?: string): void;
  openWindow(name: WindowName): void;
  toggleWindow(name: WindowName): void;
}

const LAYOUT_KEY = 'arcana-ui-layout-v1';

/** Persisted window positions + misc UI prefs. */
export class Layout {
  private data: Record<string, unknown>;
  constructor() { this.data = loadJson<Record<string, unknown>>(LAYOUT_KEY, {}); if (typeof this.data !== 'object') this.data = {}; }
  getPos(id: string): { x: number; y: number } | null {
    const v = this.data[`pos:${id}`] as { x?: unknown; y?: unknown } | undefined;
    if (v && typeof v.x === 'number' && typeof v.y === 'number' && Number.isFinite(v.x) && Number.isFinite(v.y)) return { x: v.x, y: v.y };
    return null;
  }
  setPos(id: string, x: number, y: number) { this.data[`pos:${id}`] = { x: Math.round(x), y: Math.round(y) }; this.flush(); }
  getFlag(key: string, fallback: boolean): boolean { const v = this.data[`flag:${key}`]; return typeof v === 'boolean' ? v : fallback; }
  setFlag(key: string, v: boolean) { this.data[`flag:${key}`] = v; this.flush(); }
  private flush() { saveJson(LAYOUT_KEY, this.data); }
}
