/**
 * HUD mission tracker: up to two active class missions with their objective progress and "Go to: <map>" when the
 * objective is elsewhere. Top-right on desktop, a compact two-line strip on phones. Tap → Classes.
 */
import { Registry } from '../core/registry';
import type { UICtx } from './context';
import { h, safe } from './dom';
import { coursesOf, currentMapId, npcMapId, objectiveViews } from './coursesWindow';

const MAX = 2;

export class MissionTracker {
  readonly el: HTMLElement;
  private dirty = true;
  private sig = '';

  constructor(private ctx: UICtx) {
    this.el = h('div', {
      class: 'ax-tracker', hidden: true, role: 'button', title: 'Open Classes',
      onclick: () => { ctx.sfx('ui_click'); ctx.openWindow('courses'); },
    });
    ctx.root.appendChild(this.el);
  }

  markDirty() { this.dirty = true; }

  frame() {
    if (!this.dirty) return;
    this.dirty = false;
    const s = this.ctx.s;
    const missions = safe(() => coursesOf(s).activeMissions(), []).slice(0, MAX);
    const cur = currentMapId(s);
    const rows = missions.map(({ course, mission }) => {
      const st = s.progression.state.quests?.[mission.id]?.status;
      const giver = Registry.npc(mission.giver)?.name ?? mission.giver;
      let text: string, count = '', mapId: string | undefined, ready = false;
      if (!st || st === 'complete') {
        ready = st === 'complete';
        text = ready ? `Return to ${giver}` : `See ${giver}`;
        mapId = npcMapId(mission.giver);
      } else {
        const objs = objectiveViews(s, mission, cur);
        const o = objs.find(x => !x.done) ?? objs[0];
        text = o?.label ?? mission.name;
        if (o && o.need > 1) count = `${o.have}/${o.need}`;
        mapId = o?.mapId;
      }
      const go = mapId && mapId !== cur ? Registry.map(mapId)?.name ?? mapId : '';
      return { code: course.code, name: mission.name, text, count, go, ready };
    });
    const sig = JSON.stringify(rows);
    if (sig === this.sig) return;
    this.sig = sig;
    this.el.hidden = !rows.length;
    this.el.replaceChildren(...rows.map(r => h('div', { class: `ax-trk-row${r.ready ? ' ax-ready' : ''}` },
      h('div', { class: 'ax-trk-head' }, h('b', { class: 'ax-trk-code' }, r.code), h('span', { class: 'ax-trk-name' }, r.name)),
      h('div', { class: 'ax-trk-obj' },
        h('span', { class: 'ax-trk-text' }, r.text),
        r.count ? h('b', { class: 'ax-trk-count' }, r.count) : null,
        r.go ? h('span', { class: 'ax-trk-go' }, h('span', { class: 'ax-trk-go-lbl' }, 'Go to: '), r.go) : null))));
  }

  destroy() { this.el.remove(); }
}
