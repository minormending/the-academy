// Story mode: Years, classes (courses), missions and badges. See src/data/courses/README.md.
// A class is an ordered chain of missions (ordinary quests). Handing in every mission lets the teacher pass the
// class (passCourse), which pays the course rewards and awards its badge. Enough badges pass the Year; Year 1 ends
// by declaring a major (declareMajor), Years 2–5 by promotion (promote). Year = job tier.
import type {
  CourseDef, CourseKind, CourseProgress, GameServices, ICourses, PlayerState, QuestDef, YearNo, YearPlan,
} from '../core/types';
import { Registry } from '../core/registry';
import { bus } from '../core/events';
import { BRANCH_ROOT_JOB, FELLOWSHIP_YEAR, FINAL_YEAR, SCHOOL_NAME, isSchool, type School } from '../data/jobs';
import { GRADUATION_QUEST_ID } from '../data/storyQuests';

const LOG = { good: '#a8ff9b', warn: '#ff9b9b', quest: '#ffd36b' };

/** Year the finale fires as (`'year:promoted'` with this year once Year 5 is passed). */
export const FINALE_YEAR = 6;

// ─────────────────────────── Pure helpers (state + registry only) ───────────────────────────

/** The player's Year (= job tier, 1..5). */
export function yearOf(state: Pick<PlayerState, 'job'>): YearNo {
  const tier = Registry.job(state.job)?.tier ?? 1;
  return Math.max(1, Math.min(FELLOWSHIP_YEAR, tier)) as YearNo;
}

/** The player's School (null for an undeclared Year 1 student). */
export function schoolOf(state: Pick<PlayerState, 'job'>): School | null {
  const b = Registry.job(state.job)?.branch;
  return isSchool(b) ? b : null;
}

/** Graduated = Commencement handed in (the Fellowship is postgraduate). */
export function hasGraduated(state: Pick<PlayerState, 'quests'>): boolean {
  return state.quests?.[GRADUATION_QUEST_ID]?.status === 'turned_in';
}

/** Can this student take this class at all: its Year is not ahead of theirs, and a major must be their School. */
export function courseEligible(state: Pick<PlayerState, 'job'>, course: CourseDef): boolean {
  if (course.year > yearOf(state)) return false;
  if (course.kind === 'major' && course.school !== schoolOf(state)) return false;
  return true;
}

/**
 * Course rules for accepting a quest. Quests outside every class are unaffected (true). A class mission needs
 * the class to be eligible (Year ≤ the player's, majors only for their School) and every earlier mission of the
 * class handed in, i.e. it is that class's current mission.
 */
export function canAcceptMission(state: Pick<PlayerState, 'job' | 'quests'>, questId: string): boolean {
  const course = Registry.courseOfMission(questId);
  if (!course) return true;
  if (!courseEligible(state, course)) return false;
  const i = course.missions.indexOf(questId);
  for (let k = 0; k < i; k++) if (state.quests?.[course.missions[k]]?.status !== 'turned_in') return false;
  return true;
}

/** Full acceptability of a quest from state alone (mirrors Progression.canAcceptQuest). */
function questAcceptable(state: PlayerState, questId: string): boolean {
  const q = Registry.quest(questId);
  if (!q || state.quests[questId]) return false;
  if (state.level < q.minLevel) return false;
  const branch = Registry.job(state.job)?.branch;
  if (q.requiredJobBranch && q.requiredJobBranch !== 'none' && branch !== q.requiredJobBranch) return false;
  return canAcceptMission(state, questId);
}

function fallbackPlan(year: YearNo): YearPlan {
  return { year, title: `Year ${year}`, intro: '', badgesToPass: 0, required: [], outro: '' };
}

const KIND_LABEL: Record<CourseKind, string> = { core: 'core class', major: 'major', elective: 'elective' };

// ─────────────────────────── Service ───────────────────────────

export class CourseSystem implements ICourses {
  private offs: (() => void)[] = [];

  constructor(private services: GameServices) {
    this.grandfather();
    this.offs.push(bus.on('quest:updated', ({ questId }) => this.onQuestUpdated(questId)));
  }

  destroy() {
    for (const off of this.offs.splice(0)) { try { off(); } catch { /* ignore */ } }
  }

  private get state(): PlayerState { return this.services.progression.state; }

  // ── Queries ──

  year(): YearNo { return yearOf(this.state); }

  plan(year: YearNo = this.year()): YearPlan {
    return Registry.yearPlan(year) ?? fallbackPlan(year);
  }

  catalogue(year: YearNo = this.year()): CourseDef[] {
    const school = schoolOf(this.state);
    return Registry.courses().filter(c => c.year === year && (c.kind !== 'major' || c.school === school));
  }

  status(courseId: string): 'locked' | 'open' | 'enrolled' | 'passed' {
    const c = Registry.course(courseId);
    if (!c) return 'locked';
    if (this.isPassed(courseId)) return 'passed';
    if (!courseEligible(this.state, c)) return 'locked';
    if (c.missions.some(m => this.state.quests[m])) return 'enrolled';
    const first = c.missions[0];
    return first && questAcceptable(this.state, first) ? 'open' : 'locked';
  }

  currentMission(courseId: string): QuestDef | null {
    const c = Registry.course(courseId);
    if (!c || this.isPassed(courseId) || !courseEligible(this.state, c)) return null;
    // The first mission not handed in; by construction every earlier one is handed in.
    const id = c.missions.find(m => this.state.quests[m]?.status !== 'turned_in');
    return id ? Registry.quest(id) ?? null : null;
  }

  /** Every mission handed in, badge not yet awarded: the teacher can call passCourse. */
  readyToPass(courseId: string): boolean {
    const c = Registry.course(courseId);
    return !!c && !this.isPassed(courseId) && c.missions.length > 0
      && c.missions.every(m => this.state.quests[m]?.status === 'turned_in');
  }

  activeMissions(): { course: CourseDef; mission: QuestDef }[] {
    const out: { course: CourseDef; mission: QuestDef }[] = [];
    for (const course of Registry.courses()) {
      for (const id of course.missions) {
        const st = this.state.quests[id]?.status;
        if (st !== 'active' && st !== 'complete') continue;
        const mission = Registry.quest(id);
        if (mission) out.push({ course, mission });
      }
    }
    return out;
  }

  badges(year?: YearNo): CourseDef[] {
    return Registry.courses().filter(c => (year === undefined || c.year === year) && this.isPassed(c.id));
  }

  yearProgress(): { have: number; need: number; missing: CourseKind[]; ready: boolean } {
    const y = this.year();
    const plan = this.plan(y);
    const cat = this.catalogue(y);
    const passed = cat.filter(c => this.isPassed(c.id));
    // Only kinds this student is actually offered can be required (robust to a missing major).
    const offered = new Set(cat.map(c => c.kind));
    const missing = [...new Set(plan.required)].filter(k => offered.has(k) && !passed.some(c => c.kind === k));
    const need = Math.max(0, plan.badgesToPass | 0);
    const have = passed.length;
    return { have, need, missing, ready: cat.length > 0 && have >= need && missing.length === 0 };
  }

  // ── Actions ──

  passCourse(courseId: string): boolean {
    const c = Registry.course(courseId);
    if (!c || !this.readyToPass(courseId)) return false;
    const p = this.services.progression;
    const items = c.rewards.items ?? [];
    const fit = (p as { canFit?: (items: { itemId: string; qty: number }[]) => boolean }).canFit;
    if (items.length && typeof fit === 'function' && !fit.call(p, items)) {
      bus.emit('ui:log', { text: 'Make some room in your inventory first.', color: LOG.warn });
      return false;
    }
    const courses = this.ensureCourses();
    courses[courseId] = { status: 'passed', passedAt: Date.now() };
    bus.emit('ui:log', { text: `Class passed: ${c.code} ${c.name}. Badge earned: ${c.badge.name}.`, color: LOG.quest });
    if (c.rewards.mesos) p.addMesos(c.rewards.mesos);
    for (const r of items) p.addItem(r.itemId, r.qty);
    if (c.rewards.sp && c.rewards.sp > 0) {
      this.state.sp += Math.floor(c.rewards.sp);
      bus.emit('ui:log', { text: `+${Math.floor(c.rewards.sp)} SP`, color: LOG.good });
      p.invalidate();
    }
    if (c.rewards.exp) p.gainExp(c.rewards.exp);
    bus.emit('course:passed', { courseId, badgeId: c.badge.id });
    bus.emit('course:updated', { courseId });
    bus.emit('ui:banner', { text: 'CLASS PASSED', sub: c.badge.name, color: `#${(c.badge.color >>> 0).toString(16).padStart(6, '0').slice(-6)}` });
    const prog = this.yearProgress();
    if (prog.ready && c.year === this.year()) {
      const y = this.year();
      const text = y === 1 ? 'Year 1 passed! See Headmistress Maelis to declare your major.'
        : y >= FELLOWSHIP_YEAR ? 'Fellowship complete! See Headmistress Maelis.'
          : `Year ${y} passed! See Headmistress Maelis for your promotion.`;
      bus.emit('ui:log', { text, color: LOG.good });
    }
    bus.emit('player:changed', {});
    p.save();
    return true;
  }

  declareMajor(school: 'fire' | 'ice' | 'lightning' | 'holy' | 'shadow'): boolean {
    if (this.year() !== 1) return this.refuse('You have already declared your major.');
    if (!isSchool(school)) return false;
    if (!this.checkReady()) return false;
    const job = Registry.job(BRANCH_ROOT_JOB[school]);
    if (!job) return false;
    if (this.state.level < job.requiredLevel) return this.refuse(`Reach level ${job.requiredLevel} to declare the ${SCHOOL_NAME[school]} School.`);
    if (!this.services.progression.advanceJob(job.id)) return this.refuse('The registrar could not record your declaration.');
    this.promoted(2);
    return true;
  }

  promote(): boolean {
    const y = this.year();
    if (y === 1) return this.refuse('Year 1 students declare a major instead.');
    if (!this.checkReady()) return false;
    if (y >= FELLOWSHIP_YEAR) {
      if (this.state.storyComplete) return false; // the finale is held once per save
      this.state.storyComplete = true;
      this.promoted(FINALE_YEAR);
      return true;
    }
    if (y >= FINAL_YEAR && !hasGraduated(this.state)) return this.refuse('Graduate first: the Fellowship admits only graduates.');
    const next = Registry.jobs().find(j => j.parent === this.state.job);
    if (!next) return false;
    if (this.state.level < next.requiredLevel) return this.refuse(`Reach level ${next.requiredLevel} for Year ${next.tier}.`);
    if (!this.services.progression.advanceJob(next.id)) return this.refuse('The registrar could not record your promotion.');
    this.promoted(next.tier);
    return true;
  }

  // ── Internals ──

  private isPassed(courseId: string): boolean {
    return this.state.courses?.[courseId]?.status === 'passed';
  }

  private ensureCourses(): Record<string, CourseProgress> {
    if (!this.state.courses || typeof this.state.courses !== 'object') this.state.courses = {};
    return this.state.courses;
  }

  private refuse(text: string): false {
    bus.emit('ui:log', { text, color: LOG.warn });
    return false;
  }

  /** Year passed? Otherwise logs what is still missing. */
  private checkReady(): boolean {
    const pr = this.yearProgress();
    if (pr.ready) return true;
    if (!this.catalogue().length) return this.refuse('No classes are on the schedule for this Year yet.');
    const parts: string[] = [];
    if (pr.have < pr.need) parts.push(`${pr.need} badges (you have ${pr.have})`);
    for (const k of pr.missing) parts.push(`your ${KIND_LABEL[k]}`);
    return this.refuse(`To finish Year ${this.year()} you still need ${parts.join(' and ')}.`);
  }

  private promoted(year: number) {
    bus.emit('year:promoted', { year });
    this.services.progression.save();
  }

  /** Mark a class enrolled when one of its missions is first accepted; tell the UI about any mission change. */
  private onQuestUpdated(questId: string) {
    const course = Registry.courseOfMission(questId);
    if (!course) return;
    const courses = this.ensureCourses();
    if (!courses[course.id] && this.state.quests[questId]) courses[course.id] = { status: 'enrolled' };
    bus.emit('course:updated', { courseId: course.id });
  }

  /**
   * Saves from before story mode: credit every finished Year (core + major + enough electives) so a Year 3
   * student is not asked to sit Year 1 again.
   */
  private grandfather() {
    const st = this.state;
    if (st.courses && typeof st.courses === 'object') return;
    const out: Record<string, CourseProgress> = {};
    const now = Date.now();
    for (let y = 1; y < this.year(); y++) {
      const year = y as YearNo;
      const cat = this.catalogue(year);
      const picked = cat.filter(c => c.kind === 'core' || c.kind === 'major');
      const need = this.plan(year).badgesToPass;
      for (const c of cat) {
        if (picked.length >= need) break;
        if (c.kind === 'elective') picked.push(c);
      }
      for (const c of picked) out[c.id] = { status: 'passed', passedAt: now, credit: true };
    }
    st.courses = out;
  }
}
