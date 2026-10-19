// OWNER: A9 (progression). NPC conversation scripts. Each script emits 'ui:dialog' / 'ui:shop' on the bus.
// The Academy: Headmistress Maelis lets Year 1 students declare one of five Schools at level 10; each School's
// Professor runs its Year 3 and Year 4 Exams (the job-advancement quests). NPC ids are unchanged.
import type { DialogOption, GameServices, JobId, QuestDef } from '../core/types';
import { bus } from '../core/events';
import { Registry } from '../core/registry';
import { BRANCH_ROOT_JOB, SCHOOLS, SCHOOL_NAME, SCHOOL_PROFESSOR, isSchool, yearOfTier, type School } from './jobs';
import { FIELD_BOUNTY_QUEST_IDS, JOB_ADVANCEMENT_QUESTS, JOB_QUEST_IDS } from './quests';
import type { Progression } from '../systems/Progression';

interface Ctx {
  s: GameServices;
  p: Progression;
  npcId: string;
  npcName: string;
  portraitKey?: string;
}

export type NpcNotice = 'new' | 'turnin' | null;

// ─────────────────────────── Helpers ───────────────────────────

function say(c: Ctx, text: string, options: DialogOption[] = []) {
  bus.emit('ui:dialog', { npcId: c.npcId, npcName: c.npcName, portraitKey: c.portraitKey, text, options });
}
const go = (label: string, fn: () => void): DialogOption => ({ label, closes: false, action: fn });
const bye = (label = 'Goodbye.'): DialogOption => ({ label, closes: true });
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function prog(s: GameServices): Progression { return s.progression as unknown as Progression; }

function pretty(id: string) { return id.split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' '); }
function monsterName(id: string) { return Registry.monster(id)?.name ?? pretty(id); }
function itemName(id: string) { return Registry.item(id)?.name ?? pretty(id); }
function jobName(id: JobId) { return Registry.job(id)?.name ?? pretty(id); }
/** "a Flamebinder" / "an Inferno Sage". */
function aJob(name: string) { return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`; }

/** NPC id → the School that Professor heads. */
const PROFESSOR_SCHOOL: Record<string, School> = Object.fromEntries(
  SCHOOLS.map(sc => [SCHOOL_PROFESSOR[sc], sc]),
) as Record<string, School>;

/** "Professor Pyra" (falls back to a generic title if the NPC is missing). */
function professorName(sc: School): string {
  return Registry.npc(SCHOOL_PROFESSOR[sc])?.name ?? 'your Professor';
}

/** "Welcome to Year 3!" / graduation line shown after an advancement. */
function yearLine(job: JobId): string {
  const def = Registry.job(job);
  const year = yearOfTier(def?.tier ?? 1);
  return year >= 4
    ? 'You have graduated from the Academy. Wear the title well. (+3 SP)'
    : `Welcome to Year ${year}! (+3 SP)`;
}

function objectivesText(p: Progression, q: QuestDef): string {
  const pr = p.state.quests[q.id];
  return q.objectives.map((o, i) => {
    const have = pr ? (pr.counts[i] ?? 0) : null;
    if (o.kind === 'kill') return `• Defeat ${o.count} ${monsterName(o.monsterId)}${have !== null ? ` (${have}/${o.count})` : ''}`;
    if (o.kind === 'collect') {
      const n = have !== null ? have : Math.min(o.count, p.countItem(o.itemId));
      return `• Collect ${o.count} ${itemName(o.itemId)} (${n}/${o.count})`;
    }
    return `• Reach level ${o.level}`;
  }).join('\n');
}

function rewardsText(q: QuestDef): string {
  const parts: string[] = [];
  if (q.rewards.exp) parts.push(`${q.rewards.exp.toLocaleString()} EXP`);
  if (q.rewards.mesos) parts.push(`${q.rewards.mesos.toLocaleString()} mesos`);
  for (const it of q.rewards.items ?? []) parts.push(`${itemName(it.itemId)}${it.qty > 1 ? ` ×${it.qty}` : ''}`);
  return parts.length ? `Reward: ${parts.join(', ')}` : '';
}

function sideQuestsFor(npcId: string): QuestDef[] {
  return Registry.quests().filter(q => q.giver === npcId && !JOB_QUEST_IDS.has(q.id));
}

/** Dialog options for this NPC's Assignments (available / in progress / ready). */
function questOptions(c: Ctx, back: () => void): DialogOption[] {
  const out: DialogOption[] = [];
  for (const q of sideQuestsFor(c.npcId)) {
    const st = c.p.questStatus(q.id);
    if (st === 'available') out.push(go(`[Assignment] ${q.name}`, () => offerQuest(c, q, back)));
    else if (st === 'complete') out.push(go(`[Hand in] ${q.name}`, () => turnIn(c, q, back)));
    else if (st === 'active') out.push(go(`[In progress] ${q.name}`, () => say(c, `${q.name}\n\n${objectivesText(c.p, q)}\n\nNo rush — but the deadline is real, you know.`, [go('Back', back), bye('I\'m on it.')])));
  }
  return out;
}

function offerQuest(c: Ctx, q: QuestDef, back: () => void) {
  say(c, `Assignment: ${q.name}\n\n${q.description}\n\n${objectivesText(c.p, q)}\n${rewardsText(q)}`, [
    go('Accept', () => {
      c.p.acceptQuest(q.id);
      say(c, pick(['Wonderful! Off you go, then.', 'I knew I could count on you!', 'Splendid. Hand it in when it\'s done.']), [bye('Will do!')]);
    }),
    go('Not right now.', back),
  ]);
}

function turnIn(c: Ctx, q: QuestDef, back: () => void) {
  if (c.p.turnInQuest(q.id)) {
    say(c, `Full marks! Thank you, truly.\n\n${rewardsText(q)}`, [go('Anything else?', back), bye('Happy to help.')]);
  } else {
    say(c, 'Hmm, your satchel is bursting at the seams. Make a little room and come back.', [bye('Okay.')]);
  }
}

// ─────────────────────────── Year-end Exam logic ───────────────────────────

/** The next job in this School the player is level-eligible for, and its Year-end Exam quest. */
function pendingExam(p: Progression, school: School): { job: JobId; questId: string } | null {
  const cur = p.jobDef();
  if (cur.branch !== school || cur.tier < 2 || cur.tier >= 4) return null;
  const next = Registry.jobs().find(j => j.parent === cur.id);
  if (!next || p.state.level < next.requiredLevel) return null;
  const questId = JOB_ADVANCEMENT_QUESTS[next.id];
  return questId ? { job: next.id, questId } : null;
}

/** Whether the NPC has something new (yellow "!") or ready (turn-in) for the player. */
export function npcNotice(s: GameServices, npcId: string): NpcNotice {
  const p = prog(s);
  if (!p?.state) return null;
  let notice: NpcNotice = null;
  for (const q of sideQuestsFor(npcId)) {
    const st = p.questStatus(q.id);
    if (st === 'complete') return 'turnin';
    if (st === 'available') notice = 'new';
  }
  if (npcId === 'elder_maelis' && p.jobDef().tier === 1 && p.state.level >= 10) return 'new';
  const sc = PROFESSOR_SCHOOL[npcId];
  if (sc) {
    const t = pendingExam(p, sc);
    if (t) {
      const st = p.questStatus(t.questId);
      if (st === 'complete') return 'turnin';
      if (st === 'available' || st === 'turned_in') return 'new';
    }
  }
  return notice;
}

// ─────────────────────────── Headmistress Maelis ───────────────────────────

const SCHOOL_INFO: Record<School, string> = {
  fire: 'FIRE — the School of Pyromancy, under Professor Pyra. Fireballs, burning ground, and explosions that bloom on command.\n\nPlaystyle: big explosive damage and burns over time. For students who like to hit hard and keep pushing forward.',
  ice: 'ICE — the School of Cryomancy, under Professor Glacius. Slow your foes, lock them in frost, then shatter them with a single word.\n\nPlaystyle: crowd control and safety — freeze the danger, then break it. For students who like to be in command.',
  lightning: 'LIGHTNING — the School of Storm Magic, under Professor Voltis. Bolts that leap from foe to foe and stun anything foolish enough to stand still.\n\nPlaystyle: fast, mobile, and wonderful against crowds. For students who never like to wait.',
  holy: 'HOLY — the School of Holy Magic, under Professor Seraphine. Radiant arrows, sacred rays, and healing light between the blows.\n\nPlaystyle: sustain and control — mend your own wounds, stun crowds, and smite the undead and void-touched. For students who mean to outlast anything.',
  shadow: 'SHADOW — the School of Shadow Magic, under Professor Morvane. Poisons, curses, life drain, and skeletal servants who never skip class.\n\nPlaystyle: attrition — curse a foe so everything hurts more, let poison tick, and let your minions share the work. For patient, cunning students.',
};

function elderMaelis(c: Ctx) {
  const p = c.p;
  const job = p.jobDef();
  const lv = p.state.level;
  const home = () => elderMaelis(c);

  const explainSchools = () => say(c,
    'Every student begins Year 1 on the same core curriculum. At level 10 you declare a School, and it shapes the rest of your studies.\nWhich would you like to hear about?',
    [
      ...SCHOOLS.map(sc => go(`The ${SCHOOL_NAME[sc]} School.`, () => say(c, SCHOOL_INFO[sc], [go('And the others?', explainSchools), bye('Thank you, Headmistress.')]))),
      go('Back', home),
    ]);

  const quests = questOptions(c, home);

  if (job.tier === 1) {
    if (lv < 10) {
      say(c, pick([
        `Ah, ${p.state.name}. Your staff still smells of the Academy kiln. Finish your Year 1 studies — reach level 10 — and you may declare a School.`,
        'Patience, little spark. Prefect Finn\'s field practicums in Whisperwood will sharpen you. At level 10, come and see me.',
      ]), [go('Tell me about the Schools.', explainSchools), ...quests, bye()]);
      return;
    }
    const choose = () => say(c, 'Five Schools, one declaration. Which will you study?', [
      ...SCHOOLS.map(sc => go(`The ${SCHOOL_NAME[sc]} School.`, () => confirmSchool(sc))),
      go('Tell me about them again.', explainSchools),
      bye('I need more time.'),
    ]);
    const confirmSchool = (sc: School) => {
      const target = BRANCH_ROOT_JOB[sc];
      say(c, `${SCHOOL_INFO[sc]}\n\nA declaration is for life — there are no transfers at this Academy. Will you begin Year 2 as ${aJob(jobName(target))}?`, [
        go(`Yes — I declare ${SCHOOL_NAME[sc]}!`, () => {
          if (p.advanceJob(target)) {
            say(c, `It is done. Welcome to Year 2 and the ${SCHOOL_NAME[sc]} School, ${jobName(target)}.\n\n${professorName(sc)} will guide you from here and set your Year 3 Exam at level 25. You also have 3 bonus SP — open your spellbook with K.`, [bye('Thank you, Headmistress!')]);
          } else {
            say(c, 'Hmm. The registrar\'s ledger will not take the ink yet. Come back when you are ready.', [bye()]);
          }
        }),
        go('Let me reconsider.', choose),
      ]);
    };
    say(c, `Level ${lv}... yes, your Year 1 studies are complete, ${p.state.name}. It is time to declare your School.`, [
      go('I am ready to declare.', choose),
      go('Tell me about the Schools.', explainSchools),
      ...quests,
      bye('Not yet.'),
    ]);
    return;
  }

  const sc = isSchool(job.branch) ? job.branch : null;
  const professor = sc ? professorName(sc) : 'your Professor';
  if (job.tier >= 4) {
    say(c, `${job.name}... I have watched many students graduate, ${p.state.name}, but few who shone like you. The Lich Archon still broods in the Arcane Sanctum. Consider it your final thesis.`, [...quests, bye('I will not fail.')]);
    return;
  }
  const year = yearOfTier(job.tier);
  const nextLevel = job.tier === 2 ? 25 : 40;
  const hint = lv >= nextLevel
    ? `${professor} has your Year ${year + 1} Exam ready — go and see them.`
    : `Keep studying. At level ${nextLevel}, ${professor} will set your Year ${year + 1} Exam.`;
  say(c, pick([
    `How is Year ${year} treating our ${job.name}? ${hint}`,
    `The ${sc ? SCHOOL_NAME[sc] : 'arcane'} School suits you, ${p.state.name}. ${hint}`,
  ]), [...quests, bye()]);
}

// ─────────────────────────── Professors ───────────────────────────

interface ProfessorLines {
  apprentice: string[];
  /** {school} = the student's School name ("Holy"), {professor} = their Professor's name. */
  otherSchool: string[];
  ownChat: string[];
  offerExam: (job: string) => string;
  examProgress: string;
  examDone: (job: string) => string;
  advanced: (job: string) => string;
  graduate: string[];
}

const PROFESSOR_LINES: Record<School, ProfessorLines> = {
  fire: {
    apprentice: [
      'Oh, a first-year! Don\'t touch the brazier. Or do — it builds character. Reach level 10 and declare Fire with the Headmistress if you want to learn real pyromancy.',
      'Fire isn\'t about anger, kid. It\'s about commitment. Come back when you\'ve declared your School.',
    ],
    otherSchool: [
      'A {school} student, huh? No offence. Glad you found your element — mine is just better.',
      'Ah, one of {professor}\'s students. Tell them they still owe me a rematch.',
    ],
    ownChat: [
      'Keep your fireballs moving and your enemies burning. Burn ticks add up!',
      'Fire hits harder on frosty foes. Frostfang Cliffs is a pyromancer\'s playground.',
      'Never fight in the Cinder Caverns with fire alone — those beasts drink flame. Bring potions.',
    ],
    offerExam: job => `You've grown hot enough to forge. Pass my exam, and I'll make you ${aJob(job)}.`,
    examProgress: 'Still working on it? Fire waits for no one — get moving!',
    examDone: job => `Ha! Look at that haul! Top marks. Ready to become ${aJob(job)}?`,
    advanced: job => `Burn bright, ${job}! New spells await — check them with K.`,
    graduate: ['An Inferno Sage. Honestly? I\'m a little jealous. Go melt something magnificent.'],
  },
  ice: {
    apprentice: [
      'Calm down, little one. Frost rewards patience. At level 10, declare your School with the Headmistress.',
      'Every snowflake is different. So is every student. Declare your School wisely.',
    ],
    otherSchool: [
      'You study {school} magic. Interesting. Not wrong, merely... louder than I would choose.',
      '{professor} teaches you? Then you have learned much. I hope you also learn stillness.',
    ],
    ownChat: [
      'Freeze first, shatter second. Frozen foes take far more from your next spell.',
      'Chill slows the swiftest beast. A slowed enemy is a defeated enemy.',
      'The Cinder Caverns melt fire students. They do not melt us.',
    ],
    offerExam: job => `Your frost has deepened. Pass my exam and I will name you ${job}.`,
    examProgress: 'Patience. But not too much patience. The exam still waits.',
    examDone: job => `Exquisite work. The cold is pleased. Shall I name you ${job}?`,
    advanced: job => `Welcome, ${job}. Let the world slow around you. Press K to learn new spells.`,
    graduate: ['A Glacial Sage stands before me. The stillness at the heart of the storm... is you.'],
  },
  lightning: {
    apprentice: [
      'Hey hey! Fast hands, I like it. Hit level 10, declare Lightning with the Headmistress, then come see ME.',
      'Lightning never strikes twice? Wrong. It strikes as often as I want. Class dismissed.',
    ],
    otherSchool: [
      '{school}, huh? Cool. Cool cool cool. Not as cool as lightning, but cool.',
      'Tell {professor} I said hi. Then run. Fast. Like lightning.',
    ],
    ownChat: [
      'Chain bolts love crowds! The more monsters, the more jumps.',
      'Stuns buy time — and time is the one thing lightning has too much of.',
      'Stormspire Peak is our home turf. Those harpies won\'t know what hit them.',
    ],
    offerExam: job => `You're crackling, kid! Pass my exam and I'll make you ${aJob(job)}. Deal?`,
    examProgress: 'Not done yet? Speed it up! Zip zap!',
    examDone: job => `BOOM! That's an A-plus! Ready to become ${aJob(job)}?`,
    advanced: job => `Say hello to the new ${job}! Go check your spells — K, quick!`,
    graduate: ['A Tempest Sage. You ARE the storm now. Try not to set the campus on fire. That\'s Pyra\'s job.'],
  },
  holy: {
    apprentice: [
      'Welcome, little lamp. Every light starts small. At level 10 the Headmistress will ask you to declare a School — I do hope you\'ll consider ours.',
      'The Holy School teaches mending as well as smiting. Both matter. Mostly the smiting, on exam day.',
    ],
    otherSchool: [
      'A {school} student! The Academy needs every kind of light — even the kind that sets things on fire.',
      'Give {professor} my regards. And this biscuit. They never remember to eat.',
    ],
    ownChat: [
      'Heal between fights, not in the middle of a bad one. A calm cleric is a living cleric.',
      'Wisps and void-things fear holy light. So does a certain Lich in the Sanctum.',
      'A stun is a kindness: it gives your foe a moment to reconsider. Use that moment to hit it again.',
      'Stump and Crag Golems have no soul for light to reach — they shrug off holy magic. Bring patience, or go around.',
    ],
    offerExam: job => `Your light has grown steady. Pass this exam and you'll rise as ${aJob(job)}.`,
    examProgress: 'Take your time — but not too much. The chapel lamps won\'t light themselves.',
    examDone: job => `Oh, well done! Radiant work. Are you ready to become ${aJob(job)}?`,
    advanced: job => `Rise, ${job}. May your light never gutter. New spells await — press K.`,
    graduate: ['A Hierophant of the Academy. When the Lich Archon sees you coming, I hope it feels the sunrise.'],
  },
  shadow: {
    apprentice: [
      'A first-year. How... alive you look. Reach level 10, declare Shadow with the Headmistress, and we\'ll see about that.',
      'Don\'t touch the jars. Any of them. Especially the one that\'s looking at you.',
    ],
    otherSchool: [
      '{school} magic. A respectable choice, for someone who enjoys being seen.',
      'One of {professor}\'s students? Tell them their office plant is dying. I would know.',
    ],
    ownChat: [
      'Curse first, then strike. A cursed foe takes more from everything and hits back softer.',
      'Poison is patience with a sharper edge. Let the ticks do the work while you keep your distance.',
      'Living things wither best — yetis, salamanders, harpies. The void and the dead, however, are already empty. Don\'t waste your curses there.',
      'A skeleton servant is a friend who never complains. Learn to raise one.',
    ],
    offerExam: job => `You've become a respectable little menace. Pass my exam and I'll name you ${aJob(job)}.`,
    examProgress: 'Still at it? Good. Suffering builds character. Ideally someone else\'s.',
    examDone: job => `Oh, that is delightfully grim. Well done. Shall I make you ${aJob(job)}?`,
    advanced: job => `Welcome to the dark, ${job}. Press K — your new spells are waiting, and they bite.`,
    graduate: ['An Umbral Sage. I taught you everything, and you still surprised me. Tell no one I said that.'],
  },
};

function professor(c: Ctx) {
  const sc = PROFESSOR_SCHOOL[c.npcId];
  const L = PROFESSOR_LINES[sc];
  const p = c.p;
  const job = p.jobDef();
  const home = () => professor(c);
  const quests = questOptions(c, home);

  if (job.tier === 1) { say(c, pick(L.apprentice), [...quests, bye()]); return; }

  if (job.branch !== sc) {
    const theirs = isSchool(job.branch) ? job.branch : null;
    const line = pick(L.otherSchool)
      .replace('{school}', theirs ? SCHOOL_NAME[theirs] : 'Arcane')
      .replace('{professor}', theirs ? professorName(theirs) : 'your Professor');
    say(c, line, [...quests, bye()]);
    return;
  }

  if (job.tier >= 4) { say(c, pick(L.graduate), [...quests, bye()]); return; }

  const exam = pendingExam(p, sc);
  if (!exam) {
    const next = job.tier === 2 ? 25 : 40;
    say(c, `${pick(L.ownChat)}\n\n(Come back at level ${next} for your Year ${yearOfTier(job.tier) + 1} Exam.)`, [...quests, bye()]);
    return;
  }

  const q = Registry.quest(exam.questId);
  const targetName = jobName(exam.job);
  const st = p.questStatus(exam.questId);

  const confirmAdvance = (note = '') => say(c, `${L.examDone(targetName)}${note ? `\n\n${note}` : ''}`, [
    go(`Yes! Make me ${aJob(targetName)}.`, () => {
      if (p.advanceJob(exam.job)) say(c, `${L.advanced(targetName)}\n\n${yearLine(exam.job)}`, [bye('Thank you, Professor!')]);
      else say(c, 'Something is off with the paperwork... come back to me in a moment.', [bye()]);
    }),
    bye('Not just yet.'),
  ]);

  if (st === 'turned_in') { confirmAdvance(); return; }
  if (!q) {
    // Data missing — don't soft-lock the student.
    confirmAdvance();
    return;
  }
  if (st === 'available') {
    say(c, `${L.offerExam(targetName)}\n\n${q.name}\n${q.description}\n\n${objectivesText(p, q)}`, [
      go('I\'ll sit the exam.', () => {
        p.acceptQuest(q.id);
        say(c, 'Then go. I\'ll be right here, grading.', [bye('Back soon!')]);
      }),
      ...quests,
      bye('Not yet.'),
    ]);
    return;
  }
  if (st === 'active') {
    say(c, `${L.examProgress}\n\n${q.name}\n${objectivesText(p, q)}`, [...quests, bye('On my way.')]);
    return;
  }
  if (st === 'complete') {
    say(c, `${q.name}\n${objectivesText(p, q)}\n\nYou've done it! Hand in your exam?`, [
      go('Here you go.', () => {
        if (p.turnInQuest(q.id)) confirmAdvance(rewardsText(q));
        else say(c, 'Your satchel is too full for your reward. Clear some space first.', [bye('Okay.')]);
      }),
      bye('One moment.'),
    ]);
    return;
  }
  say(c, pick(L.ownChat), [...quests, bye()]);
}

// ─────────────────────────── Campus staff ───────────────────────────

const POTION_SHOP = ['red_potion', 'orange_potion', 'white_potion', 'blue_potion', 'mana_elixir', 'elixir', 'return_scroll'];

function shopEntries(ids: string[]) {
  return ids.map(id => Registry.item(id)).filter((d): d is NonNullable<typeof d> => !!d && d.price > 0)
    .map(d => ({ itemId: d.id, price: d.price }));
}

function merchantBram(c: Ctx) {
  const home = () => merchantBram(c);
  say(c, pick([
    'Quartermaster\'s counter! Red for scrapes, blue for exam-week brain-fog, and a Return Scroll for when it all goes wrong.',
    'Welcome, welcome! Every bottle brewed this morning. Well. This week. Ish. Don\'t tell the Headmistress.',
    'Heading out on a practicum? Never leave campus without a stack of potions. Trust old Bram.',
  ]), [
    { label: 'Let me see the supplies.', closes: true, action: () => bus.emit('ui:shop', { npcId: c.npcId, npcName: c.npcName, items: shopEntries(POTION_SHOP) }) },
    ...questOptions(c, home),
    bye(),
  ]);
}

function smithTilda(c: Ctx) {
  const home = () => smithTilda(c);
  const p = c.p;
  const branch = p.jobDef().branch;
  const lv = p.state.level;
  // School-locked staves/robes only show once you've declared that School.
  const items = Registry.items()
    .filter(d => d.type === 'equip' && d.equip && d.price > 0)
    .filter(d => d.equip!.reqLevel <= Math.max(10, lv + 8))
    .filter(d => !d.equip!.reqBranch || d.equip!.reqBranch === 'none' || d.equip!.reqBranch === branch)
    .sort((a, b) => a.equip!.reqLevel - b.equip!.reqLevel || a.price - b.price)
    .map(d => ({ itemId: d.id, price: d.price }));
  say(c, pick([
    'Academy armory. Staves, robes, boots — if a student wears it, I forge it. Mind the sparks.',
    'Your uniform\'s looking a bit singed. Practicum? Let\'s fix that.',
    'I don\'t do magic. I do the things magic needs to not explode in your hands.',
  ]), [
    { label: 'Show me the armory.', closes: true, action: () => bus.emit('ui:shop', { npcId: c.npcId, npcName: c.npcName, items }) },
    ...questOptions(c, home),
    bye(),
  ]);
}

const FINN_TIPS = [
  'Hold Z to scoop up loot and mesos. Monsters drop the goods; you just have to grab them.',
  'Press Up at a glowing portal to travel. East leads deeper into the wilds — and tougher monsters.',
  'Spend your AP in the Stats window (P). INT makes your spells hit harder; LUK helps you crit.',
  'Put potions on your hotbar! Keys 1 and 2 are perfect for them.',
  'Ropes and ladders: walk up to one and press Up to climb.',
  'Every School has favourite targets. Spells hit 50% harder on a weakness — and half as hard on a resistance.',
  'Every practicum zone has one big troublemaker that shows up now and then. When the ground starts flashing red, MOVE — then make it pay. I post Field Bounties for each of them.',
];

/** Field Bounties Finn will re-post once you've handed the last one in (they are repeatable). */
function bountyRenewOptions(c: Ctx, back: () => void): DialogOption[] {
  const out: DialogOption[] = [];
  for (const qid of FIELD_BOUNTY_QUEST_IDS) {
    const q = Registry.quest(qid);
    if (!q || c.p.questStatus(qid) !== 'turned_in' || c.p.state.level < q.minLevel) continue;
    out.push(go(`[Field Bounty] ${q.name.replace(/^Field Bounty: /, '')} (again)`, () => {
      // Objectives as a fresh bounty would show them (without the old turned-in counts).
      const old = c.p.state.quests[qid];
      delete c.p.state.quests[qid];
      const objectives = objectivesText(c.p, q);
      if (old) c.p.state.quests[qid] = old;
      say(c, `${pick(['Back for more? It\'s been seen again.', 'The board never stays empty for long.', 'Same beast, fresh bounty. Ready?'])}\n\n${q.description}\n\n${objectives}\n${rewardsText(q)}`, [
        go('Accept', () => {
          delete c.p.state.quests[qid]; // re-post: the bounty becomes acceptable again
          c.p.acceptQuest(qid);
          say(c, 'Bounty posted in your name. Bring back the trophy!', [bye('On it.')]);
        }),
        go('Not right now.', () => { back(); }),
      ]);
    }));
  }
  return out;
}
let lastFinnTip = -1;

function scoutFinn(c: Ctx) {
  const home = () => scoutFinn(c);
  const tips = () => {
    // Never the same tip twice in a row ("Another tip?" should give another tip).
    const first = lastFinnTip < 0;
    let i = Math.floor(Math.random() * (FINN_TIPS.length - (first ? 0 : 1)));
    if (!first && i >= lastFinnTip) i += 1;
    lastFinnTip = i;
    say(c, FINN_TIPS[i], [go('Another tip?', tips), go('Back', home), bye('Thanks!')]);
  };
  const quests = [...questOptions(c, home), ...bountyRenewOptions(c, home)];
  say(c, pick([
    'Prefect Finn, field practicums. Whisperwood is our classroom — stay on the path, mind the slimes, and don\'t eat the mushrooms.',
    'Shh — you hear that? Snails. Hundreds of them. Okay, maybe twelve. Practicum credit if you help?',
    `A first-year! ${c.p.state.name}, right? The practicum roster could use another pair of hands.`,
  ]), [...quests, go('Any tips for a first-year?', tips), bye()]);
}

const SCRIPTS: Record<string, (c: Ctx) => void> = {
  elder_maelis: elderMaelis,
  pyra: professor,
  glacius: professor,
  voltis: professor,
  seraphine: professor,
  morvane: professor,
  merchant_bram: merchantBram,
  smith_tilda: smithTilda,
  scout_finn: scoutFinn,
};

/** Run an NPC's conversation script. Unknown NPCs get a polite generic line. */
export function runNpcScript(s: GameServices, npcId: string, portraitKey?: string): void {
  const def = Registry.npc(npcId);
  const c: Ctx = { s, p: prog(s), npcId, npcName: def?.name ?? pretty(npcId), portraitKey };
  try {
    const fn = SCRIPTS[npcId];
    if (fn) fn(c);
    else {
      const quests = questOptions(c, () => runNpcScript(s, npcId, portraitKey));
      say(c, 'Lovely weather for spellcasting, isn\'t it? Shouldn\'t you be in class?', [...quests, bye()]);
    }
  } catch (e) {
    console.warn(`[npc] script ${npcId} failed`, e);
    say(c, '...', [bye()]);
  }
}
