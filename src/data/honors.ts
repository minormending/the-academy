// OWNER: honors agent (F). Academy Honors: achievements + titles.
//
// Every honor is a pure function of (PlayerState, honor counters): `measure(v)` returns current progress and the honor is
// earned when it reaches `target(v)`. HonorsSystem keeps the counters (kills, casts, visits, talks…) and awards honors;
// the Honors window draws the same numbers as progress bars. Ids are persisted in saves: never rename one.
import type { HonorsState, IconSpec, PlayerState } from '../core/types';
import { Registry } from '../core/registry';
import { MAX_LEVEL } from '../core/constants';
import { FIELD_BOSSES } from './monsters';
import { JOB_ADVANCEMENT_QUESTS } from './quests';
import { GRADUATION_QUEST_ID } from './storyQuests';
import { SCHOOLS, SCHOOL_NAME, type School } from './jobs';

export type HonorCategory = 'studies' | 'schools' | 'field' | 'trial' | 'life' | 'secret';

export const HONOR_CATEGORIES: { id: HonorCategory; name: string }[] = [
  { id: 'studies', name: 'Studies' },
  { id: 'schools', name: 'Schools' },
  { id: 'field', name: 'Field Work' },
  { id: 'trial', name: 'Trial Hall' },
  { id: 'life', name: 'Academy Life' },
  { id: 'secret', name: 'Secret' },
];

export type { HonorsState };

/** What an honor's measure can read. */
export interface HonorView {
  state: PlayerState;
  honors: HonorsState;
  c(key: string): number;
}

export interface HonorDef {
  id: string;
  name: string;
  description: string;
  category: HonorCategory;
  icon: IconSpec;
  /** Merits granted when earned. */
  reward: number;
  /** Title unlocked by this honor (shown under the name tag when chosen). */
  title?: string;
  /** Hidden ("???") until earned; `hint` is shown instead of the description. */
  secret?: boolean;
  hint?: string;
  /** Map ids that must exist for this honor to be offered (branch zones added later). */
  requiresMaps?: string[];
  target(v: HonorView): number;
  measure(v: HonorView): number;
  /** Optional extra line for the window (e.g. a best time). */
  detail?(v: HonorView): string | null;
}

// ───────────────────────────── counters ─────────────────────────────

/** Counter keys used by HonorsSystem (and the measures below). */
export const COUNTER = {
  kills: 'kills',
  killsOnMap: (mapId: string) => `kills:map:${mapId}`,
  killsOf: (monsterId: string) => `kills:mon:${monsterId}`,
  casts: 'casts',
  deaths: 'deaths',
  respecs: 'respecs',
  mesosEarned: 'mesosEarned',
  meritsEarned: 'meritsEarned',
  meritsSpent: 'meritsSpent',
  visited: (mapId: string) => `visit:${mapId}`,
  talked: (npcId: string) => `talk:${npcId}`,
  lichBestMs: 'lichBestMs',
  closeCall: 'closeCall',
  pipTrip: 'pipTrip',
  lateSnail: 'lateSnail',
} as const;

/** The three branch zones (being added by the world agent). Honors that need them stay hidden until they exist. */
export const BRANCH_ZONES = ['moonlit_marsh', 'glacier_grotto', 'restricted_stacks'] as const;
/** The three Year 5 endgame maps (Forbidden Wing, past the Arcane Sanctum). */
export const ENDGAME_MAPS = ['astral_observatory', 'void_rift', 'archon_spire'] as const;
export const LICH_ID = 'lich_archon';
export const LICH_FAST_MS = 3 * 60 * 1000;

// ───────────────────────────── helpers ─────────────────────────────

const fixed = (n: number) => () => n;
const icon = (glyph: IconSpec['glyph'], color: number, color2?: number): IconSpec => ({ glyph, color, color2, bg: 0x1a1b45 });

function learnedSkills(s: PlayerState): string[] {
  return Object.entries(s.skills ?? {}).filter(([, lv]) => (lv ?? 0) > 0).map(([id]) => id);
}

function isMaxed(s: PlayerState, id: string): boolean {
  const def = Registry.skill(id);
  return !!def && (s.skills[id] ?? 0) >= def.maxLevel;
}

function tierOfSkill(id: string): number {
  const def = Registry.skill(id);
  return def ? Registry.job(def.job)?.tier ?? 0 : 0;
}

function maxedInSchool(s: PlayerState, school: School): number {
  return learnedSkills(s).filter(id => {
    const def = Registry.skill(id);
    return !!def && Registry.job(def.job)?.branch === school && isMaxed(s, id);
  }).length;
}

function tier(s: PlayerState): number { return Registry.job(s.job)?.tier ?? 1; }

function turnedIn(s: PlayerState, questId: string): boolean { return s.quests?.[questId]?.status === 'turned_in'; }

/** Every regular (non-boss) monster that actually spawns on a map. */
export function fieldMonsterIds(): string[] {
  const ids = new Set<string>();
  for (const m of Registry.maps()) {
    if (m.id === 'trial_hall') continue;
    for (const sp of m.spawns ?? []) {
      const def = Registry.monster(sp.monsterId);
      if (def && !def.boss) ids.add(def.id);
    }
  }
  return [...ids];
}

/** NPCs placed on any map (the ones a student can actually talk to). */
export function placedNpcIds(): string[] {
  const ids = new Set<string>();
  for (const m of Registry.maps()) for (const n of m.npcs ?? []) if (Registry.npc(n.npcId)) ids.add(n.npcId);
  return [...ids];
}

const countWhere = (ids: string[], v: HonorView, key: (id: string) => string) => ids.filter(id => v.c(key(id)) > 0).length;

function fmtTime(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ───────────────────────────── the honors ─────────────────────────────

const STUDIES: HonorDef[] = [
  { id: 'study_learn_10', name: 'Diligent Student', description: 'Learn 10 different spells.', category: 'studies',
    icon: icon('book', 0x9be7ff), reward: 20, target: fixed(10), measure: v => learnedSkills(v.state).length },
  { id: 'study_learn_25', name: 'Well Read', description: 'Learn 25 different spells.', category: 'studies',
    icon: icon('book', 0xc89bff, 0xffd447), reward: 60, target: fixed(25), measure: v => learnedSkills(v.state).length },
  { id: 'study_learn_40', name: 'Bookworm', description: 'Learn 40 different spells.', category: 'studies',
    icon: icon('book', 0xffd447, 0xff8a00), reward: 150, title: 'Bookworm', target: fixed(40), measure: v => learnedSkills(v.state).length },
  { id: 'study_max_one', name: 'Perfect Marks', description: 'Raise any spell to its maximum level.', category: 'studies',
    icon: icon('arcane_star', 0xffd447), reward: 30, target: fixed(1),
    measure: v => (learnedSkills(v.state).some(id => isMaxed(v.state, id)) ? 1 : 0) },
  { id: 'study_every_year', name: 'Full Transcript', description: 'Know at least one spell from every Year (1 through 4).', category: 'studies',
    icon: icon('scroll', 0xdeeed6, 0xd27d2c), reward: 80, target: fixed(4),
    measure: v => new Set(learnedSkills(v.state).map(tierOfSkill).filter(t => t >= 1 && t <= 4)).size },
  { id: 'study_respec', name: 'Revision', description: 'Unlearn a Year of spells with a Tome of Unlearning.', category: 'studies',
    icon: icon('book', 0x8f6bd8, 0xffd447), reward: 20, target: fixed(1), measure: v => v.c(COUNTER.respecs) },
  { id: 'study_level_25', name: 'Upperclassman', description: 'Reach level 25.', category: 'studies',
    icon: icon('hat', 0x6b4fa0, 0xd4af37), reward: 40, target: fixed(25), measure: v => v.state.level },
  { id: 'study_level_max', name: 'Top of the Class', description: `Reach level ${MAX_LEVEL}.`, category: 'studies',
    icon: icon('hat', 0xffd447, 0xff5a1f), reward: 300, title: 'Top of the Class', target: fixed(MAX_LEVEL), measure: v => v.state.level },
];

const SCHOOL_TITLES: Record<School, { name: string; title: string; glyph: IconSpec['glyph']; color: number; color2: number }> = {
  fire: { name: 'Master of Fire', title: 'Pyromancer of the Year', glyph: 'flame', color: 0xff7a2a, color2: 0xffd447 },
  ice: { name: 'Master of Ice', title: 'Frost Laureate', glyph: 'snowflake', color: 0x8fe3ff, color2: 0xffffff },
  lightning: { name: 'Master of Storms', title: 'Storm Savant', glyph: 'bolt', color: 0xffe14d, color2: 0xb58cff },
  holy: { name: 'Master of Light', title: 'Lightbearer', glyph: 'halo', color: 0xfff3a0, color2: 0xe8b93a },
  shadow: { name: 'Master of Shadow', title: 'Umbral Scholar', glyph: 'skull', color: 0x8dff6a, color2: 0x9a5cff },
};

const year3Exams = new Set(['q_job_flamebinder', 'q_job_frostbinder', 'q_job_stormbinder', 'q_job_priest', 'q_job_necromancer']);
const examIds = () => Object.values(JOB_ADVANCEMENT_QUESTS).filter((x): x is string => !!x);

const SCHOOLS_HONORS: HonorDef[] = [
  { id: 'school_declare', name: 'Declared', description: 'Declare a School at the end of Year 1.', category: 'schools',
    icon: icon('wand', 0xe8d36a, 0x9be7ff), reward: 25, target: fixed(1), measure: v => (tier(v.state) >= 2 ? 1 : 0) },
  { id: 'school_exam_y3', name: 'Year 3 Exam: Passed', description: 'Pass your Year 3 Exam.', category: 'schools',
    icon: icon('scroll', 0xa8ff9b, 0xd27d2c), reward: 60, target: fixed(1),
    measure: v => (tier(v.state) >= 3 || examIds().some(q => year3Exams.has(q) && turnedIn(v.state, q)) ? 1 : 0) },
  { id: 'school_exam_y4', name: 'Final Year', description: 'Pass your Year 4 Exam.', category: 'schools',
    icon: icon('scroll', 0xffd447, 0xd27d2c), reward: 120, target: fixed(1),
    measure: v => (tier(v.state) >= 4 || examIds().some(q => !year3Exams.has(q) && turnedIn(v.state, q)) ? 1 : 0) },
  { id: 'school_graduate', name: 'Commencement', description: 'Graduate from the Academy.', category: 'schools',
    icon: icon('hat', 0x14101c, 0xffd447), reward: 250, title: 'Alumnus', target: fixed(1),
    measure: v => (turnedIn(v.state, GRADUATION_QUEST_ID) ? 1 : 0) },
  ...SCHOOLS.map((school): HonorDef => {
    const t = SCHOOL_TITLES[school];
    return {
      id: `school_master_${school}`, name: t.name, description: `Raise 8 spells of the ${SCHOOL_NAME[school]} School to their maximum level.`,
      category: 'schools', icon: icon(t.glyph, t.color, t.color2), reward: 250, title: t.title, target: fixed(8),
      measure: v => maxedInSchool(v.state, school),
    };
  }),
];

const ZONES: { map: string; label: string; name: string; glyph: IconSpec['glyph']; color: number; kills: number }[] = [
  { map: 'whisperwood', label: 'Whisperwood', name: 'Woodland Steward', glyph: 'shell', color: 0xb8f07a, kills: 150 },
  { map: 'shroom_hollow', label: 'Shroom Hollow', name: 'Spore Sweeper', glyph: 'mushroom', color: 0xffb04a, kills: 150 },
  { map: 'frostfang_cliffs', label: 'Frostfang Cliffs', name: 'Cliffside Survivor', glyph: 'fur', color: 0x9fe6ff, kills: 150 },
  { map: 'cinder_caverns', label: 'the Cinder Caverns', name: 'Ember Tamer', glyph: 'ember', color: 0xff7a2a, kills: 150 },
  { map: 'stormspire_peak', label: 'Stormspire Peak', name: 'Storm Chaser', glyph: 'feather', color: 0xd8b4ff, kills: 150 },
  { map: 'arcane_sanctum', label: 'the Arcane Sanctum', name: 'Warden of the Forbidden Wing', glyph: 'crystal', color: 0xb58cff, kills: 100 },
  { map: 'moonlit_marsh', label: 'the Moonlit Marsh', name: 'Marsh Lantern', glyph: 'eye', color: 0x9bffd0, kills: 150 },
  { map: 'glacier_grotto', label: 'the Glacier Grotto', name: 'Grotto Delver', glyph: 'ice_shard', color: 0x7fe3ff, kills: 150 },
  { map: 'restricted_stacks', label: 'the Restricted Stacks', name: 'Restricted Reader', glyph: 'scroll', color: 0xc89bff, kills: 150 },
];

const FIELD: HonorDef[] = [
  { id: 'field_kills_100', name: 'Field Practicum', description: 'Defeat 100 monsters.', category: 'field',
    icon: icon('claw', 0xdeeed6), reward: 15, target: fixed(100), measure: v => v.c(COUNTER.kills) },
  { id: 'field_kills_1000', name: 'Seasoned Fieldworker', description: 'Defeat 1,000 monsters.', category: 'field',
    icon: icon('claw', 0xffd447), reward: 75, target: fixed(1000), measure: v => v.c(COUNTER.kills) },
  { id: 'field_kills_5000', name: 'Field Marshal', description: 'Defeat 5,000 monsters.', category: 'field',
    icon: icon('claw', 0xff5a1f, 0xffd447), reward: 250, title: 'Field Marshal', target: fixed(5000), measure: v => v.c(COUNTER.kills) },
  ...ZONES.map((z): HonorDef => ({
    id: `field_zone_${z.map}`, name: z.name, description: `Defeat ${z.kills} monsters in ${z.label}.`, category: 'field',
    icon: icon(z.glyph, z.color), reward: 40, requiresMaps: [z.map], target: fixed(z.kills), measure: v => v.c(COUNTER.killsOnMap(z.map)),
  })),
  { id: 'field_every_monster', name: 'Naturalist', description: 'Defeat at least one of every kind of monster in the field.', category: 'field',
    icon: icon('eye', 0x8ed65a, 0xffd447), reward: 150, title: 'Naturalist',
    target: () => Math.max(1, fieldMonsterIds().length), measure: v => countWhere(fieldMonsterIds(), v, COUNTER.killsOf) },
  { id: 'field_bounty_hunter', name: 'Bounty Hunter', description: 'Defeat every field boss.', category: 'field',
    icon: icon('skull', 0xffb04a, 0xff5a1f), reward: 200, title: 'Bounty Hunter',
    target: () => Math.max(1, Object.keys(FIELD_BOSSES).length), measure: v => countWhere(Object.keys(FIELD_BOSSES), v, COUNTER.killsOf) },
  { id: 'field_wyrmslayer', name: 'Wyrmslayer', description: 'Defeat the Tempest Wyrm atop Stormspire Peak.', category: 'field',
    icon: icon('storm', 0xd8b4ff, 0xffe14d), reward: 100, title: 'Wyrmslayer', target: fixed(1), measure: v => Math.min(1, v.c(COUNTER.killsOf('tempest_wyrm'))) },
  { id: 'field_lich', name: 'Thesis Defended', description: 'Defeat the Lich Archon.', category: 'field',
    icon: icon('ghost', 0xc89bff, 0x8dff6a), reward: 200, title: 'Lichbane', target: fixed(1), measure: v => Math.min(1, v.c(COUNTER.killsOf(LICH_ID))) },
  { id: 'field_lich_fast', name: 'Speed Thesis', description: `Defeat the Lich Archon within ${LICH_FAST_MS / 60000} minutes of your first strike.`, category: 'field',
    icon: icon('teleport', 0xffd447, 0xc89bff), reward: 300, title: 'the Swift', target: fixed(1),
    measure: v => { const ms = v.c(COUNTER.lichBestMs); return ms > 0 && ms <= LICH_FAST_MS ? 1 : 0; },
    detail: v => { const ms = v.c(COUNTER.lichBestMs); return ms > 0 ? `Best: ${fmtTime(ms)}` : null; } },
];

const TRIAL: HonorDef[] = [5, 10, 15, 20].map((w): HonorDef => ({
  id: `trial_wave_${w}`,
  name: w === 5 ? 'Proving Grounds' : w === 10 ? 'Trial by Fire' : w === 15 ? 'Unbroken' : 'Champion of the Trial Hall',
  description: `Clear wave ${w} in the Trial Hall.`, category: 'trial',
  icon: icon('shield', w >= 20 ? 0xffd447 : w >= 15 ? 0xdeeed6 : w >= 10 ? 0xd27d2c : 0x8fa0ff, 0x140c1c),
  reward: w * 10, title: w === 20 ? 'Champion of the Trial Hall' : undefined,
  // arenaBest = the best wave cleared (ArenaSystem records it as each wave is beaten).
  target: fixed(w), measure: v => Math.max(0, v.state.arenaBest ?? 0),
}));

const assignmentsDone = (s: PlayerState) => Object.values(s.quests ?? {}).filter(q => q?.status === 'turned_in').length;

const LIFE: HonorDef[] = [
  { id: 'life_talk_all', name: "Teacher's Pet", description: 'Talk to everyone on campus and in the field.', category: 'life',
    icon: icon('heart', 0xff7a9a), reward: 60, title: "Teacher's Pet",
    target: () => Math.max(1, placedNpcIds().length), measure: v => countWhere(placedNpcIds(), v, COUNTER.talked) },
  { id: 'life_assign_5', name: 'Getting Involved', description: 'Complete 5 assignments.', category: 'life',
    icon: icon('scroll', 0xdeeed6), reward: 20, target: fixed(5), measure: v => assignmentsDone(v.state) },
  { id: 'life_assign_15', name: 'Dependable', description: 'Complete 15 assignments.', category: 'life',
    icon: icon('scroll', 0xa8ff9b), reward: 50, target: fixed(15), measure: v => assignmentsDone(v.state) },
  { id: 'life_assign_30', name: "Prefect's Favourite", description: 'Complete 30 assignments.', category: 'life',
    icon: icon('scroll', 0xffd447, 0xa8ff9b), reward: 120, title: "Prefect's Favourite", target: fixed(30), measure: v => assignmentsDone(v.state) },
  { id: 'life_merits_500', name: 'Merit Badge', description: 'Earn 500 Academy Merits (honors not included).', category: 'life',
    icon: icon('coin', 0xffd76a), reward: 25, target: fixed(500), measure: v => v.c(COUNTER.meritsEarned) },
  { id: 'life_merits_5000', name: 'Scholarship', description: 'Earn 5,000 Academy Merits (honors not included).', category: 'life',
    icon: icon('coin', 0xffd76a, 0xff8a00), reward: 150, title: 'Scholar', target: fixed(5000), measure: v => v.c(COUNTER.meritsEarned) },
  { id: 'life_merits_spend', name: 'Exchange Student', description: "Spend Academy Merits at Bram's Merit Exchange.", category: 'life',
    icon: icon('gem', 0x7fe07f), reward: 10, target: fixed(1), measure: v => Math.min(1, v.c(COUNTER.meritsSpent)) },
  { id: 'life_tome_3', name: 'Indecisive', description: 'Use three Tomes of Unlearning.', category: 'life',
    icon: icon('book', 0x8f6bd8, 0xff7a6e), reward: 30, target: fixed(3), measure: v => v.c(COUNTER.respecs) },
  { id: 'life_pip', name: 'Owl Companion', description: 'Take Pip, your familiar, on a field trip.', category: 'life',
    icon: icon('feather', 0xedaa39, 0xfff1aa), reward: 10, target: fixed(1), measure: v => Math.min(1, v.c(COUNTER.pipTrip)) },
  { id: 'life_cartographer', name: 'Cartographer', description: 'Visit every map in the Academy and beyond.', category: 'life',
    icon: icon('wind', 0x9fdcff, 0xdeeed6), reward: 120, title: 'Cartographer',
    target: () => Math.max(1, Registry.maps().length), measure: v => countWhere(Registry.maps().map(m => m.id), v, COUNTER.visited) },
  { id: 'life_branch_zones', name: 'Off the Beaten Path', description: 'Visit the Moonlit Marsh, the Glacier Grotto and the Restricted Stacks.', category: 'life',
    icon: icon('teleport', 0x9bffd0, 0xc89bff), reward: 60, requiresMaps: [...BRANCH_ZONES],
    target: fixed(BRANCH_ZONES.length), measure: v => countWhere([...BRANCH_ZONES], v, COUNTER.visited) },
  { id: 'life_mesos', name: 'Allowance', description: 'Earn 100,000 mesos.', category: 'life',
    icon: icon('coin', 0xffe08a, 0xd27d2c), reward: 30, target: fixed(100000), measure: v => v.c(COUNTER.mesosEarned) },
  { id: 'life_casts_1000', name: 'Spellslinger', description: 'Cast 1,000 spells.', category: 'life',
    icon: icon('missile', 0xb58cff), reward: 30, target: fixed(1000), measure: v => v.c(COUNTER.casts) },
  { id: 'life_casts_10000', name: 'Arcane Overdrive', description: 'Cast 10,000 spells.', category: 'life',
    icon: icon('orb', 0xb58cff, 0xffd447), reward: 150, title: 'Spellstorm', target: fixed(10000), measure: v => v.c(COUNTER.casts) },
];

const SECRET: HonorDef[] = [
  { id: 'secret_first_fall', name: 'Learning Experience', description: 'Fall in battle for the first time.', category: 'secret', secret: true,
    hint: 'Every student does it eventually.', icon: icon('heart', 0x854c30), reward: 5, target: fixed(1), measure: v => Math.min(1, v.c(COUNTER.deaths)) },
  { id: 'secret_falls_25', name: 'Frequent Faller', description: 'Fall in battle 25 times.', category: 'secret', secret: true,
    hint: 'Practice makes… practice.', icon: icon('ghost', 0xa3abd8), reward: 25, title: 'Accident-Prone', target: fixed(25), measure: v => v.c(COUNTER.deaths) },
  { id: 'secret_close_call', name: 'By a Whisker', description: 'Survive a hit with 5% HP or less.', category: 'secret', secret: true,
    hint: 'Live dangerously.', icon: icon('heart', 0xd04648, 0xffd447), reward: 20, target: fixed(1), measure: v => Math.min(1, v.c(COUNTER.closeCall)) },
  { id: 'secret_late_snail', name: 'Snail Mail', description: 'Defeat a Moss Snail at level 40 or higher.', category: 'secret', secret: true,
    hint: 'Revisit your roots.', icon: icon('shell', 0xb8f07a, 0xffd447), reward: 15, title: 'Snailbane', target: fixed(1), measure: v => Math.min(1, v.c(COUNTER.lateSnail)) },
  { id: 'secret_night_owl', name: 'Night Owl', description: 'Spend 10 hours at the Academy.', category: 'secret', secret: true,
    hint: 'Burn the midnight oil.', icon: icon('eye', 0xfff1aa, 0x796199), reward: 50, title: 'Night Owl',
    target: fixed(10 * 60), measure: v => Math.floor((v.state.playTimeMs ?? 0) / 60000) },
  { id: 'secret_pack_rat', name: 'Pack Rat', description: 'Fill every slot of your bag.', category: 'secret', secret: true,
    hint: 'Never throw anything away.', icon: icon('paw', 0xd27d2c), reward: 15, target: fixed(48), measure: v => (v.state.inventory ?? []).length },
];

const YEAR5: HonorDef[] = [
  { id: 'y5_archon', name: 'Fellowship Granted', description: 'Pass the Fellowship Exam and become an Archon (Year 5).', category: 'schools',
    icon: icon('arcane_star', 0xffd447, 0xb58cff), reward: 200, title: 'Archon', target: fixed(1), measure: v => (tier(v.state) >= 5 ? 1 : 0) },
  { id: 'y5_spells_8', name: 'Postgraduate Reading', description: 'Learn all 8 Year 5 spells of your School.', category: 'studies',
    icon: icon('book', 0xffd447, 0xb58cff), reward: 150, title: 'Archivist',
    target: fixed(8), measure: v => learnedSkills(v.state).filter(id => tierOfSkill(id) === 5).length },
  { id: 'y5_level_60', name: 'Postdoctoral Fellow', description: 'Reach level 60.', category: 'studies',
    icon: icon('hat', 0xb58cff, 0xffd447), reward: 100, target: fixed(60), measure: v => v.state.level },
  { id: 'y5_endgame_maps', name: 'Beyond the Forbidden Wing', description: 'Visit the Astral Observatory, the Void Rift and the Archon Spire.', category: 'field',
    icon: icon('teleport', 0xb58cff, 0x9be7ff), reward: 100, requiresMaps: [...ENDGAME_MAPS],
    target: fixed(ENDGAME_MAPS.length), measure: v => countWhere([...ENDGAME_MAPS], v, COUNTER.visited) },
  { id: 'y5_proofreader', name: 'Proofreader', description: 'Defeat 100 Unwritten Pages.', category: 'field',
    icon: icon('scroll', 0xffffff, 0xb58cff), reward: 120, requiresMaps: ['archon_spire'],
    target: fixed(100), measure: v => v.c(COUNTER.killsOf('unwritten_page')) },
  { id: 'y5_unwritten', name: 'The Final Chapter', description: 'Defeat The Unwritten at the top of the Archon Spire.', category: 'field',
    icon: icon('skull', 0xffffff, 0xffd447), reward: 500, title: 'Author of the End', requiresMaps: ['archon_spire'],
    target: fixed(1), measure: v => Math.min(1, v.c(COUNTER.killsOf('the_unwritten'))) },
];

const META: HonorDef[] = [
  { id: 'meta_honor_20', name: 'Honor Student', description: 'Earn 20 other honors.', category: 'life',
    icon: icon('arcane_star', 0xdad45e, 0xb58cff), reward: 100, title: 'Honor Student', target: fixed(20),
    measure: v => Object.keys(v.honors.done).filter(id => !id.startsWith('meta_')).length },
  { id: 'meta_valedictorian', name: 'Valedictorian', description: 'Earn every honor that is not secret (one School mastery is enough).', category: 'life',
    icon: icon('sunburst', 0xffd447, 0xffffff), reward: 500, title: 'Valedictorian',
    target: () => valedictorianPool().length + 1,
    measure: v => valedictorianPool().filter(h => v.honors.done[h.id]).length + (SCHOOLS.some(sc => v.honors.done[`school_master_${sc}`]) ? 1 : 0) },
];

/** Every honor, meta honors last (they read how many others are done). */
export const HONORS: HonorDef[] = [...STUDIES, ...SCHOOLS_HONORS, ...FIELD, ...YEAR5, ...TRIAL, ...LIFE, ...SECRET, ...META];

const BY_ID = new Map(HONORS.map(h => [h.id, h]));
export function honorDef(id: string): HonorDef | undefined { return BY_ID.get(id); }

/** Honors offered in this build (branch-zone honors only once their maps exist). */
export function availableHonors(): HonorDef[] {
  return HONORS.filter(h => !h.requiresMaps || h.requiresMaps.every(m => !!Registry.map(m)));
}

/** Non-secret, non-meta honors needed for Valedictorian (plus any one School mastery, counted separately). */
function valedictorianPool(): HonorDef[] {
  return availableHonors().filter(h => !h.secret && !h.id.startsWith('meta_') && !h.id.startsWith('school_master_'));
}

/** Every title and the honor that grants it. */
export function honorTitles(): { title: string; honorId: string }[] {
  return HONORS.filter(h => h.title).map(h => ({ title: h.title!, honorId: h.id }));
}
