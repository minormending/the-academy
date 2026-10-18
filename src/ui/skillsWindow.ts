/** Skills window (K): tabs per job in the lineage + locked previews of future jobs. */
import type { JobDef, JobId, SkillDef } from '../core/types';
import { Registry } from '../core/registry';
import type { UICtx } from './context';
import { h, safe } from './dom';
import { BRANCH_COLORS, BRANCH_NAMES, skillTooltip } from './info';
import { iconEl } from './uiIcons';
import { UIWindow, tabStrip } from './window';

interface TabDef { id: string; label: string; jobs: JobDef[]; locked: boolean; note?: string }

const KIND_TAG: Record<SkillDef['kind'], string> = { attack: 'Attack', buff: 'Buff', passive: 'Passive', movement: 'Move', summon: 'Summon' };

export class SkillsWindow extends UIWindow {
  private tab = '';

  constructor(ctx: UICtx) {
    super(ctx, 'skills', 'Skills', { width: 392, x: 120, y: 90, className: 'ax-skills-win' });
  }

  private allJobs(): JobDef[] { return safe(() => Registry.jobs(), [] as JobDef[]).filter(Boolean); }

  private descendants(id: JobId): JobDef[] {
    const out: JobDef[] = [];
    const walk = (pid: JobId) => {
      for (const j of this.allJobs()) if (j.parent === pid) { out.push(j); walk(j.id); }
    };
    walk(id);
    return out.sort((a, b) => a.tier - b.tier);
  }

  private tabs(): TabDef[] {
    const st = this.ctx.s.progression.state;
    const lineage = safe(() => Registry.jobLineage(st.job), [] as JobDef[]);
    const tabs: TabDef[] = lineage.map(j => ({ id: j.id, label: j.name, jobs: [j], locked: false }));
    if (!tabs.length) tabs.push({ id: st.job, label: st.job, jobs: [], locked: false });
    const cur = lineage[lineage.length - 1];
    if (cur && cur.tier === 1) {
      // Apprentice: preview each branch (all of its tiers) as a locked tab.
      for (const j of this.allJobs().filter(x => x.parent === cur.id)) {
        tabs.push({
          id: `preview:${j.branch}`, label: BRANCH_NAMES[j.branch] ?? j.name, locked: true,
          jobs: [j, ...this.descendants(j.id)],
          note: `Choose this path at Lv ${j.requiredLevel} by speaking to Elder Maelis in Mistvale.`,
        });
      }
    } else if (cur) {
      for (const j of this.descendants(cur.id)) {
        tabs.push({ id: `preview:${j.id}`, label: j.name, jobs: [j], locked: true, note: `Unlocks at Lv ${j.requiredLevel} — advance through Elder Maelis.` });
      }
    }
    return tabs;
  }

  protected signature(): string {
    const p = this.ctx.s.progression;
    const st = p.state;
    const learnable = Registry.skills().filter(s => safe(() => p.canLearn(s.id), false)).map(s => s.id).join(',');
    return JSON.stringify([this.tab, st.job, st.level, st.sp, st.skills, learnable, st.hotbar]);
  }

  protected render() {
    const p = this.ctx.s.progression;
    const st = p.state;
    const tabs = this.tabs();
    if (!tabs.find(t => t.id === this.tab)) {
      // default to the current (deepest unlocked) job
      const unlocked = tabs.filter(t => !t.locked);
      this.tab = (unlocked[unlocked.length - 1] ?? tabs[0]).id;
    }
    const tab = tabs.find(t => t.id === this.tab)!;
    this.titleExtra.replaceChildren(h('span', { class: `ax-pill${st.sp > 0 ? ' ax-glow' : ''}` }, `SP ${st.sp}`));
    const matk = safe(() => p.derived().matk, 0);

    const list = h('div', { class: 'ax-skill-list' });
    if (tab.locked && tab.note) list.appendChild(h('div', { class: 'ax-locked-note' }, h('span', { class: 'ax-lock' }), tab.note));
    for (const job of tab.jobs) {
      const skills = safe(() => Registry.skillsForJob(job.id), [] as SkillDef[]);
      if (tab.jobs.length > 1 || tab.locked) {
        list.appendChild(h('div', { class: 'ax-skill-group', style: `--accent:${BRANCH_COLORS[job.branch] ?? '#c9b8ff'}` },
          h('b', null, job.name), h('span', null, ` · Tier ${job.tier} · Lv ${job.requiredLevel}`),
          job.description ? h('div', { class: 'ax-skill-group-desc' }, job.description) : null));
      }
      if (!skills.length) list.appendChild(h('div', { class: 'ax-empty-note' }, 'No skills recorded for this job yet.'));
      for (const def of skills) list.appendChild(this.row(def, tab.locked, matk));
    }

    const footer = h('div', { class: 'ax-win-footer' },
      h('span', { class: 'ax-dim' }, tab.locked ? 'Preview — not yet available' : 'Drag skills onto the hotbar. Right-click a slot to clear.'),
      h('span', { class: 'ax-sp' }, 'Skill Points: ', h('b', null, String(st.sp))));
    this.body.replaceChildren(
      tabStrip(tabs.map(t => ({ id: t.id, label: t.label, locked: t.locked, title: t.locked ? t.note : '' })), this.tab, (id) => { this.tab = id; this.invalidate(); this.ctx.sfx('ui_click'); }),
      list, footer);
  }

  private row(def: SkillDef, locked: boolean, matk: number): HTMLElement {
    const p = this.ctx.s.progression;
    const lv = locked ? 0 : p.state.skills[def.id] ?? 0;
    const canLearn = !locked && lv < def.maxLevel && safe(() => p.canLearn(def.id), false);
    const draggable = !locked && lv > 0 && def.kind !== 'passive';
    const icon = h('div', { class: `ax-skill-icon${draggable ? ' ax-draggable' : ''}${lv === 0 ? ' ax-unlearned' : ''}` }, iconEl(def.icon, 34, def.name));
    if (draggable) this.ctx.drag.bind(icon, () => ({ entry: def.id, icon: def.icon, label: def.name }));
    const reqMissing = (def.requires ?? []).filter(r => (p.state.skills[r.skillId] ?? 0) < r.level);
    const plus = h('button', {
      class: 'ax-plus', disabled: !canLearn, title: canLearn ? 'Learn / level up (1 SP)' : '',
      onclick: () => {
        if (safe(() => p.learnSkill(def.id), false)) { this.ctx.sfx('ui_click'); this.invalidate(); this.ctx.tooltip.refresh(); }
        else this.ctx.sfx('ui_error');
      },
    }, '+');
    const pct = Math.round((lv / Math.max(1, def.maxLevel)) * 100);
    const row = h('div', { class: `ax-skill-row${locked ? ' ax-locked' : ''}${lv >= def.maxLevel ? ' ax-maxed' : ''}` },
      icon,
      h('div', { class: 'ax-skill-main' },
        h('div', { class: 'ax-skill-name' }, def.name, h('span', { class: `ax-kind ax-kind-${def.kind}` }, KIND_TAG[def.kind] ?? def.kind)),
        h('div', { class: 'ax-skill-lv' },
          h('div', { class: 'ax-mini-bar' }, h('div', { style: `width:${pct}%` })),
          h('span', null, `Lv ${lv} / ${def.maxLevel}`)),
        !locked && reqMissing.length ? h('div', { class: 'ax-skill-req' },
          'Requires ' + reqMissing.map(r => `${Registry.skill(r.skillId)?.name ?? r.skillId} Lv ${r.level}`).join(', ')) : null),
      locked ? h('span', { class: 'ax-lock ax-lock-lg' }) : plus);
    this.ctx.tooltip.attach(row, () => skillTooltip(def, {
      level: locked ? 0 : (this.ctx.s.progression.state.skills[def.id] ?? 0), matk,
      locked: locked ? `Locked — ${Registry.job(def.job)?.name ?? def.job} skill` : undefined,
    }));
    return row;
  }
}
