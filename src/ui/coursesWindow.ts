/**
 * Classes (J; the report card): this Year's classes with their missions, the Badge Case, and the leftover
 * Assignments (quests that belong to no class) as a second tab. Reads `services.courses` (story mode); until that
 * service exists a read-only fallback derives the same view from the Registry and the quest log.
 */
import type {
  Branch, CourseDef, CourseKind, GameServices, ICourses, QuestDef, QuestObjective, QuestProgress, YearNo, YearPlan,
} from '../core/types';
import { Registry } from '../core/registry';
import { STORY_QUEST_IDS, storyStepUnlocked } from '../data/storyQuests';
import { keyText } from '../data/keyText';
import { badgeDataUrl } from '../art/badges';
import type { UICtx } from './context';
import { cssColor, fmtNum, h, safe } from './dom';
import { UIWindow, tabStrip } from './window';

// ───────────────────────────── shared model (also used by the HUD tracker) ─────────────────────────────

/** The read-only part of ICourses the UI needs. */
export type CoursesView = Pick<ICourses, 'year' | 'plan' | 'catalogue' | 'status' | 'currentMission' | 'activeMissions' | 'badges' | 'yearProgress'>;

const clampYear = (n: number): YearNo => Math.max(1, Math.min(5, Math.floor(n) || 1)) as YearNo;

/** `services.courses`, or a Registry-backed fallback while the course system is not wired in yet. */
export function coursesOf(s: GameServices): CoursesView {
  if (s.courses) return s.courses;
  const p = s.progression;
  const qp = (id: string): QuestProgress | undefined => p.state.quests?.[id];
  const year = () => clampYear(safe(() => p.jobDef().tier, 1));
  const branch = () => safe<Branch>(() => p.jobDef().branch, 'none');
  const fallbackPlan = (y: YearNo): YearPlan => ({ year: y, title: `Year ${y}`, intro: '', badgesToPass: 4, required: ['core'], outro: '' });
  const plan = (y = year()) => safe(() => Registry.yearPlan(y), undefined) ?? fallbackPlan(y);
  const catalogue = (y = year()) => safe(() => Registry.courses(), [] as CourseDef[])
    .filter(c => c.year === y && (c.kind !== 'major' || c.school === branch()));
  const status = (id: string) => {
    const c = Registry.course(id);
    if (!c || !c.missions.length) return 'locked' as const;
    if (c.missions.every(m => qp(m)?.status === 'turned_in')) return 'passed' as const;
    return c.missions.some(m => qp(m)) ? 'enrolled' as const : 'open' as const;
  };
  const currentMission = (id: string) => {
    const c = Registry.course(id);
    const next = c?.missions.find(m => qp(m)?.status !== 'turned_in');
    return next ? Registry.quest(next) ?? null : null;
  };
  const badges = (y?: YearNo) => safe(() => Registry.courses(), [] as CourseDef[])
    .filter(c => (y === undefined || c.year === y) && status(c.id) === 'passed');
  return {
    year, plan, catalogue, status, currentMission, badges,
    activeMissions: () => catalogue().flatMap(course => {
      const mission = currentMission(course.id);
      const st = mission ? qp(mission.id)?.status : undefined;
      return mission && (st === 'active' || st === 'complete') ? [{ course, mission }] : [];
    }),
    yearProgress: () => {
      const pl = plan();
      const passed = catalogue().filter(c => status(c.id) === 'passed');
      const missing = pl.required.filter(k => !passed.some(c => c.kind === k));
      return { have: passed.length, need: pl.badgesToPass, missing, ready: passed.length >= pl.badgesToPass && !missing.length };
    },
  };
}

export const KIND_LABEL: Record<CourseKind, string> = { core: 'CORE', major: 'MAJOR', elective: 'ELECTIVE' };

const npcName = (id: string) => Registry.npc(id)?.name ?? id;

/** Map hosting an NPC (first placement found). */
export function npcMapId(npcId: string): string | undefined {
  return safe(() => Registry.maps(), []).find(m => m.npcs?.some(n => n.npcId === npcId))?.id;
}

/** Pick the best map among candidates: the current one if present, else the one that fits the player's level. */
function bestMap(ids: string[], curMapId: string | undefined, level: number): string | undefined {
  if (!ids.length) return undefined;
  if (curMapId && ids.includes(curMapId)) return curMapId;
  const maps = ids.map(id => Registry.map(id)).filter((m): m is NonNullable<typeof m> => !!m);
  const dist = (r: [number, number]) => (level < r[0] ? r[0] - level : level > r[1] ? level - r[1] : 0);
  maps.sort((a, b) => dist(a.levelRange) - dist(b.levelRange));
  return maps[0]?.id ?? ids[0];
}

function monsterMapIds(monsterId: string): string[] {
  return safe(() => Registry.maps(), []).filter(m => m.spawns?.some(sp => sp.monsterId === monsterId)).map(m => m.id);
}

/** Where an objective is done (undefined when it can be done anywhere). */
export function objectiveMapId(o: QuestObjective, curMapId: string | undefined, level: number): string | undefined {
  if (o.kind === 'visit') return o.mapId;
  if (o.kind === 'talk') return npcMapId(o.npcId);
  if (o.kind === 'kill') return bestMap(monsterMapIds(o.monsterId), curMapId, level);
  if (o.kind === 'collect') {
    const droppers = safe(() => Registry.monsters(), []).filter(m => m.drops?.some(d => d.itemId === o.itemId));
    return bestMap([...new Set(droppers.flatMap(m => monsterMapIds(m.id)))], curMapId, level);
  }
  return undefined;
}

export interface ObjView { label: string; have: number; need: number; done: boolean; mapId?: string }

/** Objective rows of a quest with live counts and where to go for each. */
export function objectiveViews(s: GameServices, q: QuestDef, curMapId?: string): ObjView[] {
  const p = s.progression;
  const pr = p.state.quests?.[q.id];
  return q.objectives.map((o, i) => {
    let have = pr?.counts?.[i] ?? 0, need = 1, label: string;
    if (o.kind === 'kill') { need = o.count; label = `Defeat ${Registry.monster(o.monsterId)?.name ?? o.monsterId}`; }
    else if (o.kind === 'collect') { need = o.count; have = Math.max(have, safe(() => p.countItem(o.itemId), 0)); label = `Collect ${Registry.item(o.itemId)?.name ?? o.itemId}`; }
    else if (o.kind === 'level') { need = o.level; have = p.state.level; label = `Reach level ${o.level}`; }
    else if (o.kind === 'visit') label = `Travel to ${Registry.map(o.mapId)?.name ?? o.mapId}`;
    else label = `Talk to ${npcName(o.npcId)}`;
    if (pr?.status === 'turned_in') have = need;
    have = Math.min(have, need);
    return { label, have, need, done: have >= need, mapId: objectiveMapId(o, curMapId, p.state.level) };
  });
}

export function currentMapId(s: GameServices): string | undefined {
  return safe(() => s.game.currentMap()?.def.id, undefined);
}

function objRow(o: ObjView): HTMLElement {
  const pct = Math.round((o.have / Math.max(1, o.need)) * 100);
  return h('div', { class: `ax-obj${o.done ? ' ax-done' : ''}` },
    h('div', { class: 'ax-obj-line' }, h('span', null, o.label), h('b', null, `${o.have} / ${o.need}`)),
    h('div', { class: 'ax-mini-bar' }, h('div', { style: `width:${pct}%` })));
}

function rewardText(r: { exp?: number; mesos?: number; sp?: number; items?: { itemId: string; qty: number }[] } | undefined): string {
  const out: string[] = [];
  if (r?.exp) out.push(`${fmtNum(r.exp)} EXP`);
  if (r?.mesos) out.push(`${fmtNum(r.mesos)} mesos`);
  if (r?.sp) out.push(`${r.sp} SP`);
  for (const it of r?.items ?? []) out.push(`${Registry.item(it.itemId)?.name ?? it.itemId}${it.qty > 1 ? ` ×${it.qty}` : ''}`);
  return out.join(' · ');
}

// ───────────────────────────── window ─────────────────────────────

type Tab = 'classes' | 'assignments';
type ATab = 'active' | 'available' | 'done';

export class CoursesWindow extends UIWindow {
  private tab: Tab = 'classes';
  private atab: ATab = 'active';
  private expanded = new Set<string>();

  constructor(ctx: UICtx) {
    super(ctx, 'courses', 'Classes', { width: 440, x: 500, y: 72, className: 'ax-courses-win' });
  }

  /** Open on a given tab (e.g. from the tracker). */
  openTab(tab: Tab) {
    if (this.tab !== tab) { this.tab = tab; this.invalidate(); }
    this.open();
  }

  protected signature(): string {
    const s = this.ctx.s;
    const st = s.progression.state;
    const cs = coursesOf(s);
    const courses = safe(() => cs.catalogue().map(c => `${c.id}:${cs.status(c.id)}:${cs.currentMission(c.id)?.id ?? ''}`).join(','), '');
    const badges = safe(() => cs.badges().map(c => c.id).join(','), '');
    return JSON.stringify([this.tab, this.atab, [...this.expanded], st.quests, st.level, st.job,
      st.inventory.map(x => x.itemId + x.qty), courses, badges, safe(() => cs.yearProgress(), null), currentMapId(s)]);
  }

  protected render() {
    const assignments = this.assignmentLists();
    const cs = coursesOf(this.ctx.s);
    const classCount = safe(() => cs.catalogue().length, 0);
    this.body.replaceChildren(
      tabStrip<Tab>([
        { id: 'classes', label: `Classes (${classCount})` },
        { id: 'assignments', label: `Assignments (${assignments.active.length})` },
      ], this.tab, (t) => { this.tab = t; this.invalidate(); this.ctx.sfx('ui_click'); }),
      this.tab === 'classes' ? this.renderClasses(cs) : this.renderAssignments(assignments));
  }

  // ─────────── Classes tab ───────────

  private renderClasses(cs: CoursesView): HTMLElement {
    const plan = safe(() => cs.plan(), undefined);
    const prog = safe(() => cs.yearProgress(), { have: 0, need: 0, missing: [] as CourseKind[], ready: false });
    const list = safe(() => cs.catalogue(), [] as CourseDef[]);
    const order: Record<string, number> = { enrolled: 0, open: 1, passed: 2, locked: 3 };
    const kindOrder: Record<CourseKind, number> = { core: 0, major: 1, elective: 2 };
    const sorted = [...list].sort((a, b) => (order[safe(() => cs.status(a.id), 'open')] - order[safe(() => cs.status(b.id), 'open')])
      || kindOrder[a.kind] - kindOrder[b.kind]);
    const pips = h('div', { class: 'ax-crs-pips' },
      Array.from({ length: Math.max(prog.need, prog.have) }, (_, i) => h('span', { class: `ax-crs-pip${i < prog.have ? ' ax-on' : ''}` })));
    const head = h('div', { class: 'ax-crs-head' },
      h('div', { class: 'ax-crs-year' }, plan?.title ?? `Year ${safe(() => cs.year(), 1)}`),
      h('div', { class: 'ax-crs-prog' },
        h('span', null, 'Badges '), h('b', null, `${prog.have} / ${prog.need}`), pips),
      prog.ready
        ? h('div', { class: 'ax-crs-ready' }, `Year complete! See ${npcName('elder_maelis')} to be promoted.`)
        : prog.missing.length
          ? h('div', { class: 'ax-crs-missing' }, 'Still required: ', prog.missing.map(k => h('span', { class: `ax-crs-kind ax-k-${k}` }, KIND_LABEL[k])))
          : null);
    const cards = h('div', { class: 'ax-quest-list ax-crs-list' },
      sorted.length ? sorted.map(c => this.courseCard(cs, c))
        : h('div', { class: 'ax-empty-note' }, 'No classes on the schedule yet. Check in with Headmistress Maelis.'),
      this.badgeCase(cs));
    return h('div', { class: 'ax-crs' }, head, cards);
  }

  private courseCard(cs: CoursesView, c: CourseDef): HTMLElement {
    const s = this.ctx.s;
    const status = safe(() => cs.status(c.id), 'open');
    const cur = safe(() => cs.currentMission(c.id), null);
    const qs = s.progression.state.quests ?? {};
    const open = this.expanded.has(c.id) !== (status === 'enrolled'); // in-progress classes start expanded
    const statusLabel = { locked: 'Locked', open: 'Not started', enrolled: 'In progress', passed: 'Passed' }[status];
    const ready = !!cur && qs[cur.id]?.status === 'complete';
    const steps = c.missions.map((mid, i) => {
      const q = Registry.quest(mid);
      const st = qs[mid]?.status;
      const isCur = cur?.id === mid && status !== 'passed';
      const state = st === 'turned_in' ? 'done' : isCur ? 'cur' : 'next';
      return h('div', { class: `ax-crs-step ax-s-${state}` },
        h('span', { class: 'ax-crs-step-n' }, state === 'done' ? '✓' : String(i + 1)),
        h('span', { class: 'ax-crs-step-name' }, q?.name ?? mid),
        isCur && st === 'complete' ? h('span', { class: 'ax-badge ax-badge-ready' }, 'Ready') : null);
    });
    let detail: HTMLElement | null = null;
    if (open && cur && status !== 'passed') {
      const st = qs[cur.id]?.status;
      const giver = npcName(cur.giver);
      const where = !st || st === 'complete' ? npcMapId(cur.giver) : undefined;
      detail = h('div', { class: 'ax-crs-mission' },
        h('div', { class: 'ax-crs-mission-name' }, cur.name),
        h('div', { class: 'ax-quest-desc' }, keyText(cur.description)),
        !st ? h('div', { class: 'ax-crs-hint' }, `Report to ${giver}${where ? ` (${Registry.map(where)?.name ?? where})` : ''} to begin.`)
          : st === 'complete' ? h('div', { class: 'ax-crs-hint ax-good' }, `Done! Return to ${giver}${where ? ` (${Registry.map(where)?.name ?? where})` : ''}.`) : null,
        st ? objectiveViews(s, cur, currentMapId(s)).map(objRow) : null);
    }
    const passed = status === 'passed';
    return h('div', { class: `ax-quest ax-crs-card ax-st-${status}${ready ? ' ax-ready' : ''}`, style: `--badge:${cssColor(c.badge.color)}` },
      h('div', { class: 'ax-quest-head ax-crs-card-head', onclick: () => { this.toggle_(c.id); } },
        h('img', { class: 'ax-crs-badge', src: badgeDataUrl(c.badge, 32, !passed), alt: c.badge.name, title: passed ? c.badge.name : `${c.badge.name} (not earned yet)`, draggable: false }),
        h('div', { class: 'ax-crs-titles' },
          h('div', { class: 'ax-crs-code' }, h('b', null, c.code), h('span', { class: `ax-crs-kind ax-k-${c.kind}` }, KIND_LABEL[c.kind])),
          h('div', { class: 'ax-quest-name' }, c.name),
          h('div', { class: 'ax-quest-giver' }, npcName(c.teacher))),
        h('span', { class: `ax-badge${passed ? ' ax-badge-done' : ready ? ' ax-badge-ready' : ''}` }, ready ? 'Ready' : statusLabel)),
      open ? h('div', { class: 'ax-quest-body' },
        h('div', { class: 'ax-quest-desc ax-crs-blurb' }, c.blurb),
        h('div', { class: 'ax-crs-steps' }, steps),
        detail,
        rewardText(c.rewards) ? h('div', { class: 'ax-quest-rewards' }, h('span', { class: 'ax-dim' }, 'On passing: '), rewardText(c.rewards)) : null) : null);
  }

  private toggle_(id: string) {
    if (this.expanded.has(id)) this.expanded.delete(id); else this.expanded.add(id);
    this.ctx.sfx('ui_click');
    this.invalidate();
  }

  private badgeCase(cs: CoursesView): HTMLElement {
    const earned = safe(() => cs.badges(), [] as CourseDef[]).slice().sort((a, b) => a.year - b.year);
    return h('div', { class: 'ax-crs-case' },
      h('div', { class: 'ax-crs-case-head' }, h('span', null, 'Badge Case'), h('b', null, String(earned.length))),
      earned.length
        ? h('div', { class: 'ax-crs-case-grid' }, earned.map(c => h('div', { class: 'ax-crs-case-item', title: `${c.badge.name} · ${c.code} ${c.name} (Year ${c.year})` },
          h('img', { src: badgeDataUrl(c.badge, 40), alt: c.badge.name, draggable: false }),
          h('span', null, c.code))))
        : h('div', { class: 'ax-crs-case-empty' }, 'Pass a class to pin its badge here.'));
  }

  // ─────────── Assignments tab (quests that belong to no class) ───────────

  private assignmentLists(): Record<ATab, QuestDef[]> {
    const p = this.ctx.s.progression;
    const st = p.state;
    const prog = (q: QuestDef) => st.quests?.[q.id];
    const all = safe(() => Registry.quests(), [] as QuestDef[]).filter(q => !safe(() => Registry.courseOfMission(q.id), undefined));
    const branch = safe<Branch>(() => p.jobDef().branch, 'none');
    const storyView = { level: st.level, tier: safe(() => p.jobDef().tier, 1), quests: st.quests ?? {} };
    const active = all.filter(q => { const s = prog(q)?.status; return s === 'active' || s === 'complete'; })
      .sort((a, b) => (prog(b)?.status === 'complete' ? 1 : 0) - (prog(a)?.status === 'complete' ? 1 : 0));
    const available = all.filter(q => !prog(q) && q.minLevel <= st.level
      && (!q.requiredJobBranch || q.requiredJobBranch === 'none' || q.requiredJobBranch === branch)
      && (!STORY_QUEST_IDS.has(q.id) || storyStepUnlocked(storyView, q.id)))
      .sort((a, b) => b.minLevel - a.minLevel);
    const done = all.filter(q => prog(q)?.status === 'turned_in');
    return { active, available, done };
  }

  private renderAssignments(lists: Record<ATab, QuestDef[]>): HTMLElement {
    const items = lists[this.atab];
    const chips = h('div', { class: 'ax-crs-chips' }, ([['active', 'In Progress'], ['available', 'Available'], ['done', 'Handed in']] as [ATab, string][])
      .map(([id, label]) => h('button', {
        class: `ax-chip${id === this.atab ? ' ax-active' : ''}`,
        onclick: () => { if (id !== this.atab) { this.atab = id; this.invalidate(); this.ctx.sfx('ui_click'); } },
      }, `${label} (${lists[id].length})`)));
    const list = h('div', { class: 'ax-quest-list' });
    if (!items.length) {
      list.appendChild(h('div', { class: 'ax-empty-note' },
        this.atab === 'active' ? 'No extra assignments in progress. Staff and students with a quest icon have odd jobs.'
          : this.atab === 'available' ? 'No new assignments for your level right now.' : 'No assignments handed in yet.'));
    }
    for (const q of items) list.appendChild(this.questCard(q));
    return h('div', null, chips, list);
  }

  private questCard(q: QuestDef): HTMLElement {
    const s = this.ctx.s;
    const status = s.progression.state.quests?.[q.id]?.status;
    const giver = npcName(q.giver);
    const key = `q:${q.id}`;
    const open = this.expanded.has(key) || this.atab === 'active';
    const badge = status === 'complete' ? h('span', { class: 'ax-badge ax-badge-ready' }, 'Ready')
      : status === 'turned_in' ? h('span', { class: 'ax-badge ax-badge-done' }, 'Done')
        : status === 'active' ? null : h('span', { class: 'ax-badge' }, `Lv ${q.minLevel}+`);
    const rewards = rewardText(q.rewards);
    return h('div', { class: `ax-quest${status === 'complete' ? ' ax-ready' : ''}` },
      h('div', { class: 'ax-quest-head', onclick: () => this.toggle_(key) },
        h('div', null, h('div', { class: 'ax-quest-name' }, q.name),
          h('div', { class: 'ax-quest-giver' }, status === 'complete' ? `Return to ${giver}` : `From ${giver}`)), badge),
      open ? h('div', { class: 'ax-quest-body' },
        h('div', { class: 'ax-quest-desc' }, keyText(q.description)),
        objectiveViews(s, q).map(objRow),
        rewards ? h('div', { class: 'ax-quest-rewards' }, h('span', { class: 'ax-dim' }, 'Rewards: '), rewards) : null) : null);
  }
}
