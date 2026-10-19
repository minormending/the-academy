// Story-mode guidance: a bobbing gold arrow + "→ <map>" label above the portal that leads toward the player's
// active mission when its target is on another map. The same answer feeds the minimap's gold portal marker.
// Created/destroyed by MapInstance; recomputed on map:changed / quest:updated / course:updated.
import type Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import { bus } from '../core/events';
import { Registry } from '../core/registry';
import { maybeServices } from '../core/services';
import type { PortalDef } from '../core/types';
import { missionTargetMap, nextPortalToward } from './route';

export interface GuidePortal { portal: PortalDef; /** Name of the map the mission wants you to reach. */ target: string }

const GOLD = 0xffd24a;
const ARROW_DY = 172, LABEL_DY = 200;

let dirty = true;
let cacheMap = '';
let cache: GuidePortal[] = [];
let listening = false;

function listen() {
  if (listening) return;
  listening = true;
  const mark = () => { dirty = true; };
  bus.on('map:changed', mark); bus.on('quest:updated', mark); bus.on('course:updated', mark);
}

/** Portals on `mapId` that lead toward an active mission's target map (one per distinct portal, mission order). */
export function guidePortals(mapId: string, force = false): GuidePortal[] {
  listen();
  if (!force && !dirty && cacheMap === mapId) return cache;
  const out: GuidePortal[] = [];
  try {
    const missions = maybeServices()?.courses?.activeMissions?.() ?? [];
    for (const { mission } of missions) {
      const target = missionTargetMap(mission);
      if (!target || target === mapId) continue;
      const portal = nextPortalToward(mapId, target);
      if (!portal || out.some(g => g.portal.id === portal.id)) continue;
      out.push({ portal, target: Registry.map(target)?.name ?? target });
    }
  } catch { /* guidance is optional: never break the map */ }
  cache = out; cacheMap = mapId; dirty = false;
  return out;
}

export class MissionGuide {
  private objs: { arrow: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform; label: Phaser.GameObjects.Text; baseY: number }[] = [];
  private off: (() => void)[] = [];
  private destroyed = false;

  constructor(private scene: Phaser.Scene, private mapId: string) {
    const re = () => this.rebuild();
    this.off = [bus.on('map:changed', re), bus.on('quest:updated', re), bus.on('course:updated', re)];
    this.rebuild();
  }

  private clear() {
    for (const o of this.objs) { try { o.arrow.destroy(); o.label.destroy(); } catch { /* ignore */ } }
    this.objs = [];
  }

  private rebuild() {
    if (this.destroyed) return;
    this.clear();
    const s = this.scene;
    for (const { portal, target } of guidePortals(this.mapId, true)) {
      try {
        const x = Math.round(portal.x), y = portal.y - ARROW_DY;
        let arrow: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;
        if (s.textures.exists('w_hint_arrow')) {
          arrow = s.add.image(x, y, 'w_hint_arrow').setFlipY(true).setTint(GOLD).setDepth(DEPTH.PORTAL + 0.4);
        } else {
          arrow = s.add.triangle(x, y, 0, 0, 24, 0, 12, 20, GOLD).setDepth(DEPTH.PORTAL + 0.4);
        }
        const label = s.add.text(x, portal.y - LABEL_DY, `→ ${target}`, {
          fontFamily: '"Kenney Pixel", monospace', fontSize: '16px', color: '#ffe08a', stroke: '#3a2a00', strokeThickness: 4,
        }).setOrigin(0.5, 1).setDepth(DEPTH.PORTAL + 0.4);
        this.objs.push({ arrow, label, baseY: y });
      } catch (e) { console.warn('[guide] arrow failed', e); }
    }
  }

  update(time: number) {
    const t = time / 1000;
    // Pixel-stepped bob (2 px steps) to match the portal hint arrow.
    const dy = Math.round(Math.sin(t * 5) * 3) * 2;
    for (const o of this.objs) o.arrow.y = o.baseY + dy;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const f of this.off) f();
    this.off = [];
    this.clear();
  }
}
