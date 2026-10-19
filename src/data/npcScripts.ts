// OWNER: A9 (progression). NPC conversation scripts. Each script emits 'ui:dialog' / 'ui:shop' on the bus.
// The Academy: Headmistress Maelis lets Year 1 students declare one of five Schools at level 10; each School's
// Professor runs its Year 3 and Year 4 Exams and the Year 5 Fellowship Exam (the job-advancement quests). NPC ids are unchanged.
import type { DialogOption, GameServices, JobId, QuestDef } from '../core/types';
import { bus } from '../core/events';
import { Registry } from '../core/registry';
import { JOB_LEVELS } from '../core/constants';
import { BRANCH_ROOT_JOB, FELLOWSHIP_YEAR, FINAL_YEAR, SCHOOLS, SCHOOL_NAME, SCHOOL_PROFESSOR, isSchool, yearOfTier, type School } from './jobs';
import { FIELD_BOUNTY_QUEST_IDS, JOB_ADVANCEMENT_QUESTS, JOB_QUEST_IDS } from './quests';
import { GRADUATION_QUEST_ID, STORY_FLOW, STORY_QUESTS, STORY_QUEST_IDS, storyStepUnlocked, type StoryStateView } from './storyQuests';
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

/** "Welcome to Year 3!" / final-year line shown after an advancement (graduation itself is Commencement). */
function yearLine(job: JobId): string {
  const def = Registry.job(job);
  const year = yearOfTier(def?.tier ?? 1);
  if (year >= FELLOWSHIP_YEAR) return 'Welcome to the Fellowship, Archon. Year 5 has no syllabus — the stars are the syllabus now. (+3 SP)';
  return year >= FINAL_YEAR
    ? 'Welcome to Year 4, your final year! Wear the title well — your Final Thesis awaits. (+3 SP)'
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
  // Story quests (main line + orientation) have their own dialog and gating — see the Story section.
  return Registry.quests().filter(q => q.giver === npcId && !JOB_QUEST_IDS.has(q.id) && !STORY_QUEST_IDS.has(q.id));
}

/** Dialog options for this NPC's Assignments (available / in progress / ready). */
function questOptions(c: Ctx, back: () => void): DialogOption[] {
  const out: DialogOption[] = [];
  for (const q of sideQuestsFor(c.npcId)) {
    if (supersededByStory(c.p, q.id)) continue;
    const st = c.p.questStatus(q.id);
    if (st === 'available') out.push(go(`[Assignment] ${q.name}`, () => offerQuest(c, q, back)));
    else if (st === 'complete') out.push(go(`[Hand in] ${q.name}`, () => turnIn(c, q, back)));
    else if (st === 'active') out.push(go(`[In progress] ${q.name}`, () => say(c, `${q.name}\n\n${objectivesText(c.p, q)}\n\nNo rush — but the deadline is real, you know.`, [go('Back', back), bye('I\'m on it.')])));
  }
  return out;
}

/** Optional giver voice for an Assignment's accept / hand-in lines (falls back to the generic ones). */
const ASSIGNMENT_LINES: Record<string, { accept: string; done: string }> = {
  q_finn_lanterns: {
    accept: 'Great! Follow the lights that run away from you, not the ones that wait. The waiting ones are hungry.',
    done: 'Twelve lanterns! The night walk is back on — and nobody ends up in the reeds this year. Probably.',
  },
  q_glacius_geodes: {
    accept: 'Good. Strike them with lightning. Frost only feeds them, and they will thank you for it by growing.',
    done: 'Look at these rings... four hundred winters, give or take. The grotto is older than the Academy. Excellent fieldwork.',
  },
  q_maelis_overdue: {
    accept: 'Thank you, {name}. Mind the ones with red ribbons. They were restricted for a reason.',
    done: 'Twenty-five back on their shelves, and the aisles are quiet again. Now — let us find out which ones were not there to return.',
  },
};

function offerQuest(c: Ctx, q: QuestDef, back: () => void) {
  say(c, `Assignment: ${q.name}\n\n${q.description}\n\n${objectivesText(c.p, q)}\n${rewardsText(q)}`, [
    go('Accept', () => {
      c.p.acceptQuest(q.id);
      const line = ASSIGNMENT_LINES[q.id]?.accept;
      say(c, line ? fill(c, line) : pick(['Wonderful! Off you go, then.', 'I knew I could count on you!', 'Splendid. Hand it in when it\'s done.']), [bye('Will do!')]);
    }),
    go('Not right now.', back),
  ]);
}

function turnIn(c: Ctx, q: QuestDef, back: () => void) {
  if (c.p.turnInQuest(q.id)) {
    const line = ASSIGNMENT_LINES[q.id]?.done;
    say(c, `${line ? fill(c, line) : 'Full marks! Thank you, truly.'}\n\n${rewardsText(q)}`, [go('Anything else?', back), bye('Happy to help.')]);
  } else {
    say(c, 'Hmm, your satchel is bursting at the seams. Make a little room and come back.', [bye('Okay.')]);
  }
}

// ─────────────────────────── Story: main questline + Year 1 orientation ───────────────────────────
// Quest data + chain rules live in storyQuests.ts. Each step's offer / progress / hand-in lines live here.

type StoryStatus = 'locked' | 'soon' | 'available' | 'active' | 'complete' | 'turned_in';

function storyView(p: Progression): StoryStateView {
  return { level: p.state.level, tier: p.jobDef().tier, quests: p.state.quests };
}

function storyStatus(p: Progression, q: QuestDef): StoryStatus {
  const pr = p.state.quests[q.id];
  if (pr) return pr.status;
  if (!storyStepUnlocked(storyView(p), q.id)) return 'locked';
  return p.questStatus(q.id) === 'available' ? 'available' : 'soon';
}

/** Does this NPC run (offer + hand in) this story step? */
function storyHandles(npcId: string, q: QuestDef): boolean {
  return q.giver === npcId || (!!STORY_FLOW[q.id]?.anyProfessor && !!PROFESSOR_SCHOOL[npcId]);
}

function storyNotice(p: Progression, npcId: string): NpcNotice {
  let notice: NpcNotice = null;
  for (const q of STORY_QUESTS) {
    if (!storyHandles(npcId, q)) continue;
    const st = storyStatus(p, q);
    if (st === 'complete') return 'turnin';
    if (st === 'available') notice = 'new';
  }
  return notice;
}

/** The student's School (null for Year 1 apprentices). */
function schoolOf(p: Progression): School | null {
  const b = p.jobDef().branch;
  return isSchool(b) ? b : null;
}

/** A professor's reaction to the student's School; `none` covers undeclared students. */
type SchoolReact = Record<School | 'none', string>;
function react(c: Ctx, r: SchoolReact): string {
  return r[schoolOf(c.p) ?? 'none'];
}

/** Template fill: {name} {job} {aJob} {school} {professor}. */
function fill(c: Ctx, text: string): string {
  const sc = schoolOf(c.p);
  const job = c.p.jobDef().name;
  return text
    .replace(/\{name\}/g, c.p.state.name)
    .replace(/\{job\}/g, job)
    .replace(/\{aJob\}/g, aJob(job))
    .replace(/\{school\}/g, sc ? SCHOOL_NAME[sc] : 'Arcane')
    .replace(/\{professor\}/g, sc ? professorName(sc) : 'your Professor');
}

interface StoryLines {
  offer: (c: Ctx) => string;
  /** Accept button label. */
  accept?: string;
  /** Said right after accepting (non-talk steps). */
  accepted?: (c: Ctx) => string;
  progress: (c: Ctx) => string;
  done: (c: Ctx) => string;
  /** Extra options offered alongside "accepted" / "in progress" (e.g. open the shop). */
  extra?: (c: Ctx) => DialogOption[];
  /** Runs once after a successful hand-in. */
  after?: (c: Ctx) => void;
  /** Options after the hand-in text (default: "Anything else?" + goodbye). */
  next?: (c: Ctx, back: () => void) => DialogOption[];
}

const bramShop = (c: Ctx): DialogOption =>
  ({ label: 'Let me see the counter.', closes: true, action: () => bus.emit('ui:shop', { npcId: c.npcId, npcName: c.npcName, items: shopEntries(POTION_SHOP) }) });

/** Your own Professor's farewell after office hours (by the professor's School, not the student's). */
const OFFICE_HOURS: Record<School, { offer: string; done: string }> = {
  fire: {
    offer: 'A first-year at office hours! Keen — I like that. Professor Pyra, Head of Pyromancy. At level 10 you\'ll declare a School with the Headmistress. Pick fire. Or don\'t! But pick fire.\n\nStudy tip: every level gives you 3 SP. Press {key:skills} to open your spellbook and spend them — Arcane Bolt gets hotter with every point.',
    done: 'There. Now you know where the warm office is.',
  },
  ice: {
    offer: 'Professor Glacius, Cryomancy. Sit. Breathe. Good — most first-years forget the second part.\n\nStudy tip: each level also gives you AP. Press {key:stats} for your stats and put them into INT, which strengthens every spell. The Auto button will do it for you, if you trust it.',
    done: 'Calm, attentive, punctual. You will do well here.',
  },
  lightning: {
    offer: 'Professor Voltis, Storm Magic! You\'re here! You\'re early! I LOVE early!\n\nStudy tip: your hotbar has two pages — press {key:hotbarPage} to flip between them. More slots for spells, more slots for ZAP.',
    done: 'Great chat! Quick chat! Best kind of chat!',
  },
  holy: {
    offer: 'Professor Seraphine, Holy Magic. Welcome, little lamp — have a biscuit.\n\nStudy tip: rest on campus between practicums. Your HP and MP recover three times faster here than out in the field.',
    done: 'Come by any time. The biscuits are a permanent fixture.',
  },
  shadow: {
    offer: 'Professor Morvane, Shadow Magic. You found my office. Most first-years get lost on the way. Some on purpose.\n\nStudy tip: fall in the field and you wake up back on campus, a little poorer in EXP. Keep potions on your hotbar and you need never find out.',
    done: 'You may go. Don\'t touch the jars on the way out.',
  },
};

/** The professor for an `anyProfessor` step is whoever you are talking to. */
function npcSchool(c: Ctx): School { return PROFESSOR_SCHOOL[c.npcId] ?? 'fire'; }

const STORY_SCRIPT: Record<string, StoryLines> = {
  // ───── Year 1 · Orientation ─────
  story_orientation: {
    offer: c => fill(c, 'Welcome, welcome! I am Headmistress Maelis, and this is the Academy. Before your first lesson, {name}, the basics:\n\n• {key:left} / {key:right} walk. {key:jump} (or {key:jump2}) jumps — hold {key:down} and jump to drop through a ledge.\n• Press {key:interact} to talk to people, climb ropes and ladders, and step through glowing portals.\n• Press {key:help} any time for the full list of controls.'),
    accept: 'Walk, jump, {key:interact} to talk. Got it!',
    progress: () => '{key:left} / {key:right} to walk, {key:jump} to jump, {key:interact} to talk.',
    done: () => 'Splendid! Here is a little pocket money — every first-year needs it.\n\nOur Professors keep office hours along the east hall. Walk over, pick any one of them, and say hello.',
  },
  story_office_hours: {
    offer: c => OFFICE_HOURS[npcSchool(c)].offer,
    accept: 'Pleased to meet you, Professor!',
    progress: () => 'Say hello to any Professor.',
    done: c => `${OFFICE_HOURS[npcSchool(c)].done}\n\nNext, see Bram, our quartermaster, at the west end of campus. Nobody leaves for a practicum without supplies.`,
  },
  story_supplies: {
    offer: () => 'First trip off campus, eh? Rule one: always carry a Return Scroll. Buy one from my counter — 150 mesos — and show it to me.\n\nRule two, free of charge: your Red Potions sit on key {key:slot10} and Blue on key {key:slot11}. Open your bag ({key:inventory}) and drag any potion onto a hotbar slot to keep it handy. Low on HP? Tap the key and drink.',
    accepted: () => 'Return Scrolls are on the counter. Go on, have a look.',
    progress: () => 'One Return Scroll, 150 mesos. Got the coin? The Headmistress gave every first-year a little.',
    extra: c => [bramShop(c)],
    done: c => {
      const potionOnBar = c.p.state.hotbar.some(e => !!e && e.startsWith('item:'));
      return `That's the one! Here it is back, with two more on the house and a stack of Red Potions.${potionOnBar ? '' : '\n\nOh, and your hotbar has no potions on it! Open your bag ({key:inventory}), go to the Use tab and drag a potion onto a slot.'}\n\nPrefect Finn is waiting just past the east gate, in Whisperwood, for your first practicum.`;
    },
  },
  story_first_practicum: {
    offer: () => 'Prefect Finn, field practicums! Lesson one: Moss Snails.\n\nFace one and press {key:slot0} to cast Arcane Bolt. Defeat 3 of them, then hold {key:pickup} near what they drop to scoop it up. I need 2 Snail Shells.',
    accepted: () => '{key:slot0} to cast, {key:pickup} to loot. The snails are the slow green ones. Go!',
    progress: () => '{key:slot0} to cast, hold {key:pickup} to loot! Snails won\'t bite. Much.',
    done: () => 'Textbook! Take these sandals — the trail gets muddy.\n\nFrom here, Year 1 is about practice: my field practicums, assignments from the staff, and levels. The Headmistress has your next assignment — head back to campus and see her.',
  },
  story_declaration: {
    offer: c => fill(c, 'You survived orientation, {name}! Now the real work begins. Study, practise, and reach level 10. Then come back to me and declare your School.\n\nPrefect Finn\'s practicums in Whisperwood will get you there, and Bram, Tilda and the Professors always need a hand.'),
    accepted: () => 'Off you go. And do talk to the Professors before you choose.',
    progress: c => `Level ${c.p.state.level} of 10. Keep at it — Finn always has work for willing hands.`,
    done: c => c.p.jobDef().tier === 1
      ? fill(c, 'Level 10. Your Year 1 studies are complete, {name}. This cap marks you as an upperclassman.\n\nNow, the declaration.')
      : fill(c, 'Declared already, I see! Eager. Take your upperclassman\'s cap all the same, {job}.'),
    next: (c, back) => c.p.jobDef().tier === 1
      ? [go('I am ready to declare.', () => chooseSchool(c)), go('Tell me about the Schools.', () => explainSchools(c, back)), bye('I need a moment.')]
      : [go('Anything else?', back), bye('Thank you, Headmistress!')],
  },

  // ───── Year 2 ─────
  story_violet_thorns: {
    offer: c => fill(c, '{aJob}! Look at you. Listen — the Thorn Shrooms in Shroom Hollow are growing thorns of violet light. I\'ve only seen that colour in one other place: under the doors of the Forbidden Wing.\n\nThin out 15 and bring me 6 Thorn Spores. Shroom Hollow is east of here.'),
    accepted: () => 'The violet ones glow. You can\'t miss them.',
    progress: () => 'The violet ones glow in the dark. Not that you want to be in there after dark.',
    done: () => 'These spores are humming. Spores don\'t hum.\n\nI\'ll send samples to the faculty. Professor Glacius knows old magic. When you reach level 21, go and see him on campus.',
  },
  story_pages_in_snow: {
    offer: c => `${react(c, {
      ice: 'A word of warning, my student: Ice Wisps are made of what we wield. They resist our frost. Chill them, be patient, and strike while they slow.',
      fire: 'Pyra\'s student. Your fire will melt them beautifully. Try not to enjoy it more than is seemly.',
      lightning: 'Voltis\'s students are quick. The wisps are quicker. Prove me wrong.',
      holy: 'Seraphine says lost lights go home when they are shown the way. Show them, kindly.',
      shadow: 'Morvane\'s pupil. There is little life in a wisp for your curses to feed on, but they will still feel it.',
      none: 'You are early for this.',
    })}\n\nThe faculty keep sealed notes on the Forbidden Wing. Pages are missing from all five Schools' copies, mine included. Their ink-magic drifted to Frostfang Cliffs, and the Ice Wisps there drank it. Bring me 10 Wisp Essences and I will read what they remember.`,
    accepted: () => 'Frostfang Cliffs, past Shroom Hollow. Dress warmly.',
    progress: () => 'The essences are cold and patient. Be the same.',
    done: () => '...I see a hall of violet glass. Wisps carrying pages, one by one, into the dark. And a voice, counting them.\n\nThe Headmistress must hear this. Pass your Year 3 Exam first — at level 25 — so she can seat you at the faculty table.',
  },

  // ───── Year 3 ─────
  story_faculty_meeting: {
    offer: c => fill(c, 'Sit, {name}. You have earned a seat at this table.\n\nForty years ago the Academy\'s Archmage, Valdris, wanted magic that never forgets. He bound himself to the ley-heart beneath the east wing, and what came back was a Lich. We sealed the Forbidden Wing with five verses, one from each School, and every Professor has kept their verse ever since.\n\nSomeone is stealing those verses, page by page. The Archon is reading his way out.'),
    accept: 'Then we stop him.',
    progress: () => 'The faculty is waiting.',
    done: () => 'We will. Professor Pyra has a lead in the Cinder Caverns. Speak with her when you reach level 27.',
  },
  story_ash_and_ink: {
    offer: c => `${react(c, {
      fire: 'Fair warning, kid: imps drink fire. Hit them hotter than they can swallow.',
      ice: 'An ice student! Oh, the imps are going to HATE you. Go be hated.',
      lightning: 'Imps hop, you zap. Simple. I like simple.',
      holy: 'Light scrubs ash clean. Seraphine\'s kids always leave a place tidier.',
      shadow: 'Poison works on imps. Gross. Effective. Morvane would be proud — don\'t tell them I said that.',
      none: 'You\'re early for this one.',
    })}\n\nThe stolen pages are being burned in the Cinder Caverns. The Ember Imps come home with parchment ash caked on their horns. Defeat 20 imps and bring me 8 horns. I can read smoke. Comes with the job.`,
    accepted: () => 'Cinder Caverns, east of Frostfang. Bring potions. Lots.',
    progress: () => 'Twenty imps, eight horns. Don\'t let them hop off with my homework!',
    done: () => '...The smoke spells out the seal\'s verses. Someone is reading them to the wind, and the wind carries them north to Stormspire.\n\nSeraphine will know what that does to the seal. See her at level 38.',
  },
  story_crack_in_seal: {
    offer: c => `${react(c, {
      holy: 'Our light holds the seal together. You will feel the fragments warm in your hand, like a candle that remembers you.',
      shadow: 'Harpies wither beautifully under your curses, Morvane tells me. They sounded proud. Don\'t tell them I said so.',
      lightning: 'Harpies ride the storm. And you ARE the storm now, aren\'t you?',
      fire: 'Pyra\'s student! Please try not to singe the fragments.',
      ice: 'Clip their wings with frost, and catch the fragments as they fall.',
      none: 'You are early, dear.',
    })}\n\nEvery verse he reads loosens the seal, and the pieces blow out over Stormspire Peak. The harpies carry them to the Thunder Drakes' nests. Ground 20 Storm Harpies and bring me 4 Seal Fragments. I'll mend what I can.`,
    accepted: () => 'Seal Fragments glow gold. You will know them.',
    progress: () => 'Drakes hoard shiny things, and the fragments are very shiny. Check the nests.',
    done: () => 'Four pieces... I can mend a crack, not a ruin. Time is short.\n\nOnce you are a Year 4 student and level 45, Professor Morvane will open the Forbidden Wing for you. Yes — Morvane has the key. Don\'t ask why.',
  },

  // ───── Year 4 ─────
  story_forbidden_wing: {
    offer: c => `${react(c, {
      shadow: 'A warning, my student. The void is already empty, so your curses will find little to feed on. Bring patience and a great many potions.',
      holy: 'Ah. Seraphine\'s little lamp. The wisps will hate you. Good.',
      fire: 'Burn them. The Sanctum hasn\'t been warm in forty years.',
      ice: 'Freeze the whispers mid-sentence. I would pay to see it.',
      lightning: 'Fast hands. You will need them. Wisps don\'t fly in straight lines.',
      none: 'Not yet, child.',
    })}\n\nYes, I have the key. It's a long story, and it ends in detention. The Forbidden Wing is the Arcane Sanctum, past Stormspire Peak. The Void Wisps inside are his whispers; every page that left this Academy went in on their backs. Silence 15 of them.`,
    accepted: () => 'The door is unlocked. Mind the draught.',
    progress: () => 'Fifteen whispers. Count them. He certainly does.',
    done: () => 'Quieter. You can hear him now, can\'t you? Breathing in the dark.\n\nGo and tell the Headmistress you are ready for your Final Thesis.',
  },
  story_final_thesis: {
    offer: c => `${fill(c, 'Every graduate writes a thesis, {name}. Yours is one line long: the Lich Archon falls.\n\nHe waits at the heart of the Arcane Sanctum. Defeat him and bring me his Archon Sigil, the seal that holds every spell he stole.')}\n\n${react(c, {
      holy: 'Your light is the one thing he truly fears. Shine.',
      shadow: 'Your shadow only feeds him. Lean on poison and patience, not curses, and keep your potions close.',
      fire: 'Burn bright, and burn long. He has had forty years to grow cold.',
      ice: 'Slow him, still him, and let him feel time pass again.',
      lightning: 'Strike fast and keep moving. He is old; you are quick.',
      none: '',
    })}`,
    accepted: () => 'Go with potions, go with friends, and go with my blessing.',
    progress: () => 'The Sanctum lies past Stormspire Peak. He will be waiting. He always is.',
    done: c => fill(c, 'The Sigil... it is warm. All those spells, all those students — coming home at last.\n\nYou did it, {name}. Come. There is one more thing to do, and it involves a very large hat.'),
    after: c => retireSideArchon(c.p),
    next: (c, back) => [go('One more thing?', back), bye('Later, Headmistress.')],
  },
  [GRADUATION_QUEST_ID]: {
    offer: c => fill(c, 'Students! Professors! Prefect Finn, put down the snail.\n\nToday we graduate {aJob} of the {school} School, who walked into this Academy smelling of kiln smoke and walked out of the Forbidden Wing carrying forty years of stolen magic.\n\n{name}, step forward.'),
    accept: 'Step forward.',
    progress: () => 'The ceremony awaits.',
    done: c => fill(c, 'By the authority of the Academy, I name you {job}, graduate of the {school} School.\n\nThis amulet is the Academy\'s star; wear it everywhere. And the faculty has voted you 1,000 Academy Merits. Spend them at Bram\'s Merit Exchange.\n\nCongratulations, graduate.'),
    after: c => {
      c.p.addMerits(GRADUATION_MERITS);
      bus.emit('ui:banner', { text: 'Graduation Day!', sub: `${c.p.jobDef().name} of the Academy`, color: '#ffd76a' });
    },
    next: () => [bye('Thank you — for everything.')],
  },
};

/**
 * The old side quest "Final Thesis: The Lich Archon" is the same deed as the main line's Final Thesis.
 * While the main-line step is open, the untouched side quest is hidden; handing in the main line retires it.
 */
const SIDE_ARCHON_QUEST = 'q_maelis_archon';
function supersededByStory(p: Progression, questId: string): boolean {
  if (questId !== SIDE_ARCHON_QUEST || p.state.quests[questId]) return false;
  const q = Registry.quest('story_final_thesis');
  if (!q) return false;
  const st = storyStatus(p, q);
  return st === 'available' || st === 'active' || st === 'complete' || st === 'turned_in';
}
function retireSideArchon(p: Progression) {
  if (!Registry.quest(SIDE_ARCHON_QUEST) || p.state.quests[SIDE_ARCHON_QUEST]) return;
  p.state.quests[SIDE_ARCHON_QUEST] = { status: 'turned_in', counts: [1] };
  bus.emit('quest:updated', { questId: SIDE_ARCHON_QUEST });
}

/** Merits the faculty awards at graduation. */
export const GRADUATION_MERITS = 1000;

function storyOffer(c: Ctx, q: QuestDef, back: () => void) {
  const L = STORY_SCRIPT[q.id];
  const talk = !!STORY_FLOW[q.id]?.talk;
  const text = [L ? L.offer(c) : q.description, talk ? '' : objectivesText(c.p, q), rewardsText(q)].filter(Boolean).join('\n\n');
  say(c, text, [
    go(L?.accept ?? 'Accept', () => {
      c.p.acceptQuest(q.id);
      const st = c.p.questStatus(q.id);
      if (st === 'complete') { storyTurnIn(c, q, back); return; }
      if (st !== 'active') { say(c, 'Hmm, not quite yet. Come back a little later.', [go('Back', back), bye()]); return; }
      say(c, L?.accepted?.(c) ?? pick(['Wonderful! Off you go, then.', 'I knew I could count on you!']), [...(L?.extra?.(c) ?? []), bye('On my way!')]);
    }),
    go('Not right now.', back),
  ]);
}

function storyProgress(c: Ctx, q: QuestDef, back: () => void) {
  const L = STORY_SCRIPT[q.id];
  say(c, `${q.name}\n\n${L ? L.progress(c) : q.description}\n\n${objectivesText(c.p, q)}`, [...(L?.extra?.(c) ?? []), go('Back', back), bye('I\'m on it.')]);
}

function storyTurnIn(c: Ctx, q: QuestDef, back: () => void) {
  if (!c.p.turnInQuest(q.id)) {
    say(c, 'Your satchel is bursting at the seams. Make a little room and come back.', [bye('Okay.')]);
    return;
  }
  const L = STORY_SCRIPT[q.id];
  if (L?.after) {
    try { L.after(c); } catch (e) { console.warn('[story] after-hook failed', e); }
    // turnInQuest already saved 'turned_in'; persist what the hook granted (e.g. graduation merits) right away.
    try { c.p.save(); } catch { /* ignore */ }
  }
  const rewards = rewardsText(q);
  say(c, `${L ? L.done(c) : 'Well done!'}${rewards ? `\n\n${rewards}` : ''}`,
    L?.next?.(c, back) ?? [go('Anything else?', back), bye('Thank you!')]);
}

/** Story options for this NPC: available / in progress / ready to hand in, plus a level-gated teaser. */
function storyOptions(c: Ctx, back: () => void): DialogOption[] {
  const out: DialogOption[] = [];
  for (const q of STORY_QUESTS) {
    if (!storyHandles(c.npcId, q)) continue;
    const st = storyStatus(c.p, q);
    const tag = STORY_FLOW[q.id]?.tag ?? 'Story';
    if (st === 'available') out.push(go(`[${tag}] ${q.name}`, () => storyOffer(c, q, back)));
    else if (st === 'complete') out.push(go(`[Hand in] ${q.name}`, () => storyTurnIn(c, q, back)));
    else if (st === 'active') out.push(go(`[In progress] ${q.name}`, () => storyProgress(c, q, back)));
    else if (st === 'soon') {
      out.push(go(`[${tag}] ${q.name} (Lv ${q.minLevel})`, () => say(c,
        `${q.name}\n\n${q.description}\n\nCome back at level ${q.minLevel} — you are level ${c.p.state.level}.`, [go('Back', back), bye()])));
    }
  }
  return out;
}

/** Where the main line stands, for Professors' Forbidden Wing small talk. */
function storyPhase(p: Progression): 'y2' | 'y3' | 'y4' | 'grad' | null {
  const done = (id: string) => p.state.quests[id]?.status === 'turned_in';
  if (done(GRADUATION_QUEST_ID)) return 'grad';
  if (done('story_crack_in_seal')) return 'y4';
  if (done('story_faculty_meeting')) return 'y3';
  if (p.state.quests['story_violet_thorns']) return 'y2';
  return null;
}

const FORBIDDEN_WING_CHAT: Record<School, Record<'y2' | 'y3' | 'y4' | 'grad', string>> = {
  fire: {
    y2: 'Violet light? In MY Academy? Fire doesn\'t burn violet, kid. Something old is awake down there.',
    y3: 'Valdris. I was a first-year when they sealed him in. Maelis carried me out of that hall on her back. I can still smell the smoke.',
    y4: 'Go and burn the dust off that Lich. Bring back the Academy\'s stolen magic — and my notes. I want my notes.',
    grad: 'You did it. The east wing is warm again. Honestly? Best student I ever had. Don\'t let it go to your head. Okay, a little.',
  },
  ice: {
    y2: 'The cold carries rumours. Lately it whispers of a wing that should be silent.',
    y3: 'Each School keeps one verse of the seal. Mine was the verse of stillness. Someone has been reading it aloud.',
    y4: 'The Archon fears nothing, except an ending. Be his ending.',
    grad: 'The Forbidden Wing is quiet. Truly quiet, for the first time in forty years. Thank you, my student.',
  },
  lightning: {
    y2: 'The observatory picked up weird readings. Violet static! Static should NOT be violet.',
    y3: 'Storm\'s verse of the seal is "quickness". Guess whose pages went first. ...Okay, I may have left my office unlocked.',
    y4: 'Go! Zap the Lich! I\'ll be watching from the observatory. With snacks.',
    grad: 'You zapped a LICH. A whole one! I\'m putting it in the brochure.',
  },
  holy: {
    y2: 'The chapel candles keep leaning toward the Forbidden Wing. Light leans toward whatever needs healing.',
    y3: 'Archmage Valdris wanted magic that never forgets. He forgot the one thing that matters most: how to let go.',
    y4: 'Bring him rest, not just ruin. Even a Lich was a student once.',
    grad: 'He is at rest now. You gave him that. I will light a candle for you both.',
  },
  shadow: {
    y2: 'Do not go near the Forbidden Wing. I say this as someone who very much went near the Forbidden Wing.',
    y3: 'Yes, I studied Valdris\'s work. Everyone in my School does. The difference is, we stopped reading before the last chapter.',
    y4: 'When the Archon offers you forever, decline politely. Then curse him.',
    grad: 'The dark is quieter without him. I find I almost miss the company. Almost.',
  },
};

function forbiddenWingOption(c: Ctx, sc: School, back: () => void): DialogOption[] {
  const phase = storyPhase(c.p);
  if (!phase || schoolOf(c.p) !== sc) return [];
  return [go('What do you make of the Forbidden Wing?', () => say(c, FORBIDDEN_WING_CHAT[sc][phase], [go('Back', back), bye()]))];
}

// ─────────────────────────── Year-end Exam logic ───────────────────────────

/** Graduated (Commencement handed in) — the Fellowship is postgraduate, so its exam waits for this. */
function hasGraduated(p: Progression): boolean {
  return p.state.quests[GRADUATION_QUEST_ID]?.status === 'turned_in';
}

/** The next job in this School the player is level-eligible for, and its Year-end Exam quest. */
function pendingExam(p: Progression, school: School): { job: JobId; questId: string } | null {
  const cur = p.jobDef();
  if (cur.branch !== school || cur.tier < 2 || cur.tier >= FELLOWSHIP_YEAR) return null;
  // Year 4 -> Year 5: the Fellowship Exam opens only to graduates.
  if (cur.tier >= FINAL_YEAR && !hasGraduated(p)) return null;
  const next = Registry.jobs().find(j => j.parent === cur.id);
  if (!next || p.state.level < next.requiredLevel) return null;
  const questId = JOB_ADVANCEMENT_QUESTS[next.id];
  return questId ? { job: next.id, questId } : null;
}

/** Whether the NPC has something new (yellow "!") or ready (turn-in) for the player. */
export function npcNotice(s: GameServices, npcId: string): NpcNotice {
  const p = prog(s);
  if (!p?.state) return null;
  let notice: NpcNotice = storyNotice(p, npcId);
  if (notice === 'turnin') return notice;
  for (const q of sideQuestsFor(npcId)) {
    if (supersededByStory(p, q.id)) continue;
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

function explainSchools(c: Ctx, back: () => void) {
  const again = () => explainSchools(c, back);
  say(c,
    'Every student begins Year 1 on the same core curriculum. At level 10 you declare a School, and it shapes the rest of your studies.\nWhich would you like to hear about?',
    [
      ...SCHOOLS.map(sc => go(`The ${SCHOOL_NAME[sc]} School.`, () => say(c, SCHOOL_INFO[sc], [go('And the others?', again), bye('Thank you, Headmistress.')]))),
      go('Back', back),
    ]);
}

/** The School declaration (Year 1 → Year 2 advancement). Also the hand-off from the "Declaration Day" story step. */
function chooseSchool(c: Ctx) {
  const p = c.p;
  const choose = () => chooseSchool(c);
  const confirmSchool = (sc: School) => {
    const target = BRANCH_ROOT_JOB[sc];
    say(c, `${SCHOOL_INFO[sc]}\n\nA declaration is for life — there are no transfers at this Academy. Will you begin Year 2 as ${aJob(jobName(target))}?`, [
      go(`Yes — I declare ${SCHOOL_NAME[sc]}!`, () => {
        if (p.advanceJob(target)) {
          // Declaring straight from the old flow still hands in "Declaration Day" (cap + mesos).
          let extra = '';
          const decl = Registry.quest('story_declaration');
          if (decl && p.questStatus(decl.id) === 'complete' && p.turnInQuest(decl.id)) extra = `\n\nAnd your upperclassman's cap — Declaration Day is complete. ${rewardsText(decl)}`;
          say(c, `It is done. Welcome to Year 2 and the ${SCHOOL_NAME[sc]} School, ${jobName(target)}.\n\n${professorName(sc)} will guide you from here and set your Year 3 Exam at level 25. You also have 3 bonus SP — open your spellbook with {key:skills}.${extra}\n\nOne more thing. Prefect Finn sent word of strange violet light in Shroom Hollow. At level 11, would you look into it for me?`, [bye('Thank you, Headmistress!')]);
        } else {
          say(c, 'Hmm. The registrar\'s ledger will not take the ink yet. Come back when you are ready.', [bye()]);
        }
      }),
      go('Let me reconsider.', choose),
    ]);
  };
  if (p.jobDef().tier !== 1 || p.state.level < 10) {
    say(c, 'You are not ready to declare just now.', [bye()]);
    return;
  }
  say(c, 'Five Schools, one declaration. Which will you study?', [
    ...SCHOOLS.map(sc => go(`The ${SCHOOL_NAME[sc]} School.`, () => confirmSchool(sc))),
    go('Tell me about them again.', () => explainSchools(c, choose)),
    bye('I need more time.'),
  ]);
}

function elderMaelis(c: Ctx) {
  const p = c.p;
  const job = p.jobDef();
  const lv = p.state.level;
  const home = () => elderMaelis(c);
  const schools = () => explainSchools(c, home);

  const quests = [...storyOptions(c, home), ...questOptions(c, home), ...archonRenewOptions(c, home)];

  if (job.tier === 1) {
    if (lv < 10) {
      if (p.questStatus('story_orientation') === 'available') {
        say(c, `A new face! Welcome to the Academy, ${p.state.name}. Classes start the moment you're ready — shall we begin with orientation?`,
          [...quests, go('Tell me about the Schools.', schools), bye('In a moment.')]);
        return;
      }
      say(c, pick([
        `Ah, ${p.state.name}. Your staff still smells of the Academy kiln. Finish your Year 1 studies — reach level 10 — and you may declare a School.`,
        'Patience, little spark. Prefect Finn\'s field practicums in Whisperwood will sharpen you. At level 10, come and see me.',
      ]), [...quests, go('Tell me about the Schools.', schools), bye()]);
      return;
    }
    // The story hand-in (if any) leads into the same declaration flow.
    const declareReady = p.questStatus('story_declaration') === 'complete';
    say(c, `Level ${lv}... yes, your Year 1 studies are complete, ${p.state.name}. It is time to declare your School.`, [
      ...(declareReady ? [] : [go('I am ready to declare.', () => chooseSchool(c))]),
      ...quests,
      go('Tell me about the Schools.', schools),
      bye('Not yet.'),
    ]);
    return;
  }

  const sc = isSchool(job.branch) ? job.branch : null;
  const professor = sc ? professorName(sc) : 'your Professor';
  if (job.tier >= FELLOWSHIP_YEAR) {
    say(c, pick([
      `Archon ${p.state.name}. The faculty still stands when you enter a room — I have stopped telling them not to.`,
      `A Fellow of the ${sc ? SCHOOL_NAME[sc] : 'Arcane'} School. The Observatory has been restless, ${job.name}. I am glad it is yours to watch now.`,
    ]), [...quests, bye('Goodbye, Headmistress.')]);
    return;
  }
  if (job.tier >= FINAL_YEAR) {
    const graduated = hasGraduated(p);
    const thesisDone = p.state.quests.story_final_thesis?.status === 'turned_in';
    const fellowship = !graduated ? ''
      : lv >= JOB_LEVELS[FELLOWSHIP_YEAR]
        ? `\n\nAnd ${p.state.name}: the Fellowship has asked for you. ${professor} sets the Fellowship Exam — Year 5, for those who graduate and are not finished.`
        : `\n\nWhen you reach level ${JOB_LEVELS[FELLOWSHIP_YEAR]}, come back to us. The Fellowship takes a handful of graduates each generation, and ${professor} has already said your name.`;
    say(c, (graduated
      ? pick([
        `Our graduate returns! The Forbidden Wing sleeps soundly, ${p.state.name}, and so do I. The Trial Hall still has plenty to teach a ${job.name}, if you miss the excitement.`,
        `${job.name}. I still have your thesis on my desk. It is one line long. It is my favourite.`,
      ])
      : thesisDone
        ? `${job.name}... the Lich Archon has fallen, ${p.state.name}, and the whole Academy knows it. Only the ceremony remains — the faculty is waiting.`
        : `${job.name}... I have watched many students graduate, ${p.state.name}, but few who shone like you. The Lich Archon still broods in the Arcane Sanctum. Consider it your final thesis.`) + fellowship,
    [...quests, bye(graduated ? 'Goodbye, Headmistress.' : thesisDone ? 'One moment.' : 'I will not fail.')]);
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

/** Year 5: each Professor's invitation to the Fellowship (for graduates) and their line for a Fellow. */
const FELLOWSHIP_LINES: Record<School, { invite: string; fellow: string[] }> = {
  fire: {
    invite: 'You graduated. Good. Now — ever wanted to set a star on fire? The Fellowship does that. I sit on the committee.',
    fellow: ['A Pyre Archon. I taught you to light a candle once. Look at you now, lighting the sky.'],
  },
  ice: {
    invite: 'Graduation is a pause, not an ending. The Fellowship studies the long winter between the stars. I would like you to join it.',
    fellow: ['Winter Archon. The Observatory has never been so quiet. I suspect that is your doing.'],
  },
  lightning: {
    invite: 'Graduated already? Then you\'re bored already. The Fellowship isn\'t boring. The Fellowship has a Rift.',
    fellow: ['A Storm Archon! The weather office has filed a complaint about you. I framed it.'],
  },
  holy: {
    invite: 'You have finished your studies, but not your calling. The Fellowship carries light where the Void has been. Will you carry it?',
    fellow: ['Light Archon. Wherever you walk now, the dark remembers its manners.'],
  },
  shadow: {
    invite: 'A graduate. How ordinary. The Fellowship is less ordinary — it goes to the places the Academy prefers not to map. I recommended you.',
    fellow: ['A Night Archon. I would say I am proud. I will settle for saying I am not surprised.'],
  },
};

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
    advanced: job => `Burn bright, ${job}! New spells await — check them with {key:skills}.`,
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
    advanced: job => `Welcome, ${job}. Let the world slow around you. Press {key:skills} to learn new spells.`,
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
    advanced: job => `Say hello to the new ${job}! Go check your spells — {key:skills}, quick!`,
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
    advanced: job => `Rise, ${job}. May your light never gutter. New spells await — press {key:skills}.`,
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
    advanced: job => `Welcome to the dark, ${job}. Press {key:skills} — your new spells are waiting, and they bite.`,
    graduate: ['An Umbral Sage. I taught you everything, and you still surprised me. Tell no one I said that.'],
  },
};

function professor(c: Ctx) {
  const sc = PROFESSOR_SCHOOL[c.npcId];
  const L = PROFESSOR_LINES[sc];
  const p = c.p;
  const job = p.jobDef();
  const home = () => professor(c);
  const quests = [...storyOptions(c, home), ...questOptions(c, home), ...forbiddenWingOption(c, sc, home)];

  if (job.tier === 1) { say(c, pick(L.apprentice), [...quests, bye()]); return; }

  if (job.branch !== sc) {
    const theirs = isSchool(job.branch) ? job.branch : null;
    const line = pick(L.otherSchool)
      .replace('{school}', theirs ? SCHOOL_NAME[theirs] : 'Arcane')
      .replace('{professor}', theirs ? professorName(theirs) : 'your Professor');
    say(c, line, [...quests, bye()]);
    return;
  }

  if (job.tier >= FELLOWSHIP_YEAR) { say(c, pick(FELLOWSHIP_LINES[sc].fellow), [...quests, bye()]); return; }

  const exam = pendingExam(p, sc);
  if (job.tier >= FINAL_YEAR && !exam) {
    // Graduates are invited to the Fellowship at level 55; before Commencement the thesis comes first.
    const invite = !hasGraduated(p) ? ''
      : `\n\n${FELLOWSHIP_LINES[sc].invite}\n\n(Come back at level ${JOB_LEVELS[FELLOWSHIP_YEAR]} for your Fellowship Exam.)`;
    say(c, `${pick(L.graduate)}${invite}`, [...quests, bye()]);
    return;
  }
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

const POTION_SHOP = ['red_potion', 'orange_potion', 'white_potion', 'blue_potion', 'mana_elixir', 'elixir', 'return_scroll', 'tome_of_unlearning'];

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
    ...storyOptions(c, home),
    { label: 'Let me see the supplies.', closes: true, action: () => bus.emit('ui:shop', { npcId: c.npcId, npcName: c.npcName, items: shopEntries(POTION_SHOP) }) },
    go('Merit Exchange', () => meritExchange(c, home)),
    ...questOptions(c, home),
    bye(),
  ]);
}

// ─────────────────────────── Academy Merit Exchange (Bram) ───────────────────────────
// The shop UI is mesos-only, so the exchange is a set of dialog pages: list → confirm → receipt.

interface MeritOffer { itemId: string; qty: number; cost: number }

/** Merit prices. Trial Hall pays 2 + 2×wave per wave cleared (boss waves double), so a solid run is ~100–200. */
export const MERIT_SHOP: { study: MeritOffer[]; trophies: MeritOffer[] } = {
  study: [
    { itemId: 'return_scroll', qty: 5, cost: 20 },
    { itemId: 'elixir', qty: 1, cost: 30 },
    { itemId: 'elixir', qty: 5, cost: 140 },
    { itemId: 'power_elixir', qty: 1, cost: 80 },
    { itemId: 'power_elixir', qty: 5, cost: 380 },
    { itemId: 'tome_of_unlearning', qty: 1, cost: 150 },
  ],
  // Field-boss uniques — normally rare drops, here for the dedicated.
  trophies: [
    { itemId: 'matriarch_ring', qty: 1, cost: 400 },
    { itemId: 'monarch_signet', qty: 1, cost: 700 },
    { itemId: 'alpha_fang_necklace', qty: 1, cost: 1200 },
    { itemId: 'magmaw_gauntlets', qty: 1, cost: 2000 },
    { itemId: 'wyrmheart_amulet', qty: 1, cost: 3000 },
  ],
};

const merits = (c: Ctx) => c.p.state.merits ?? 0;
const fmt = (n: number) => n.toLocaleString();

function meritOfferLabel(o: MeritOffer): string {
  const d = Registry.item(o.itemId);
  const lvl = d?.equip ? ` (Lv ${d.equip.reqLevel})` : '';
  return `${itemName(o.itemId)}${o.qty > 1 ? ` ×${o.qty}` : ''}${lvl} — ${fmt(o.cost)} Merits`;
}

function meritExchange(c: Ctx, back: () => void) {
  const home = () => meritExchange(c, back);
  say(c, `The Academy Merit Exchange! Earn Merits in the Trial Hall, spend them here. No mesos, no haggling, no refunds.\n\nYour Merits: ${fmt(merits(c))}`, [
    go('Study Aids (scrolls, elixirs, tomes)', () => meritPage(c, 'study', home)),
    go('Field Trophies (rare accessories)', () => meritPage(c, 'trophies', home)),
    go('How do I earn Merits?', () => say(c, 'Step into the Trial Hall on campus and survive the waves. Every wave you clear pays Merits, boss waves pay double, and you keep what you earn even if you fall. Graduates also get a generous bonus from the faculty.', [go('Back', home), bye()])),
    go('Back', back),
  ]);
}

function meritPage(c: Ctx, page: keyof typeof MERIT_SHOP, back: () => void) {
  const again = () => meritPage(c, page, back);
  const offers = MERIT_SHOP[page].filter(o => !!Registry.item(o.itemId));
  const intro = page === 'study'
    ? 'Study aids, freshly stocked. The tome is from the library\'s restricted shelf, so do return the favour by not mentioning it.'
    : 'Field trophies. Prefect Finn\'s field teams bring these back from the big troublemakers, and only Merits will buy them.';
  say(c, `${intro}\n\nYour Merits: ${fmt(merits(c))}`, [
    ...offers.map(o => go(meritOfferLabel(o), () => meritConfirm(c, o, again))),
    go('Back', back),
  ]);
}

function meritConfirm(c: Ctx, o: MeritOffer, back: () => void) {
  const def = Registry.item(o.itemId);
  if (!def) { back(); return; }
  const have = merits(c);
  const req = def.equip ? `\nRequires level ${def.equip.reqLevel}.` : '';
  const head = `${def.name}${o.qty > 1 ? ` ×${o.qty}` : ''}\n${def.description}${req}\n\nCost: ${fmt(o.cost)} Merits. You have ${fmt(have)}.`;
  if (have < o.cost) {
    say(c, `${head}\n\nNot quite enough Merits yet, I'm afraid. The Trial Hall's open all hours.`, [go('Back', back), bye()]);
    return;
  }
  say(c, `${head}\n\nShall I wrap it up?`, [
    go(`Exchange ${fmt(o.cost)} Merits`, () => {
      // Per-unit price; the bundle total is exact because every bundle cost divides by its qty.
      const ok = c.p.buyWithMerits(o.itemId, o.cost / o.qty, o.qty);
      if (ok) say(c, `${pick(['Pleasure doing business!', 'Spend it wisely. Or gloriously.', 'Earned, not bought. Well — both.'])}\n\nYou received ${def.name}${o.qty > 1 ? ` ×${o.qty}` : ''}. Merits left: ${fmt(merits(c))}`, [go('Keep browsing', back), bye('Thanks, Bram!')]);
      else say(c, c.p.roomFor(o.itemId) < o.qty
        ? 'Your bag\'s full to bursting. Make some room and come back.'
        : 'Hmm, the ledger doesn\'t add up. Come back in a moment.', [go('Back', back), bye()]);
    }),
    go('Not right now.', back),
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
    ...storyOptions(c, home),
    { label: 'Show me the armory.', closes: true, action: () => bus.emit('ui:shop', { npcId: c.npcId, npcName: c.npcName, items }) },
    ...questOptions(c, home),
    bye(),
  ]);
}

const FINN_TIPS = [
  'Hold {key:pickup} to scoop up loot and mesos. Monsters drop the goods; you just have to grab them.',
  'Press {key:interact} at a glowing portal to travel. East leads deeper into the wilds — and tougher monsters.',
  'Spend your AP in the Stats window ({key:stats}). INT makes your spells hit harder; LUK helps you crit.',
  'Put potions on your hotbar! Keys {key:slot10} and {key:slot11} are perfect for them.',
  'Ropes and ladders: walk up to one and press {key:up} to climb.',
  'Every School has favourite targets. Spells hit 50% harder on a weakness — and half as hard on a resistance.',
  'Every practicum zone has one big troublemaker that shows up now and then. When the ground starts flashing red, MOVE — then make it pay. I post Field Bounties for each of them.',
];

/**
 * Re-post handed-in repeatable quests (`turned_in` → acceptable again). `label` builds the dialog button text;
 * `eligible` adds extra gating on top of "handed in once and level-qualified".
 */
function renewOptions(
  c: Ctx, back: () => void, qids: readonly string[],
  label: (q: QuestDef) => string, eligible: () => boolean = () => true,
): DialogOption[] {
  const out: DialogOption[] = [];
  if (!eligible()) return out;
  for (const qid of qids) {
    const q = Registry.quest(qid);
    if (!q || c.p.questStatus(qid) !== 'turned_in' || c.p.state.level < q.minLevel) continue;
    out.push(go(label(q), () => {
      // Objectives as a fresh quest would show them (without the old turned-in counts).
      const old = c.p.state.quests[qid];
      delete c.p.state.quests[qid];
      const objectives = objectivesText(c.p, q);
      if (old) c.p.state.quests[qid] = old;
      say(c, `${pick(['Back for more? It\'s been seen again.', 'The board never stays empty for long.', 'Same beast, fresh bounty. Ready?'])}\n\n${q.description}\n\n${objectives}\n${rewardsText(q)}`, [
        go('Accept', () => {
          delete c.p.state.quests[qid]; // re-post: the quest becomes acceptable again
          c.p.acceptQuest(qid);
          say(c, 'Bounty posted in your name. Bring back the proof!', [bye('On it.')]);
        }),
        go('Not right now.', () => { back(); }),
      ]);
    }));
  }
  return out;
}

/** Field Bounties Finn will re-post once you've handed the last one in (they are repeatable). */
function bountyRenewOptions(c: Ctx, back: () => void): DialogOption[] {
  return renewOptions(c, back, FIELD_BOUNTY_QUEST_IDS, q => `[Field Bounty] ${q.name.replace(/^Field Bounty: /, '')} (again)`);
}

/** The Headmistress's Lich Archon bounty is repeatable once the main line's Final Thesis is handed in. */
function archonRenewOptions(c: Ctx, back: () => void): DialogOption[] {
  return renewOptions(c, back, [SIDE_ARCHON_QUEST],
    q => `[Repeat] ${q.name.replace(/^Bounty: /, '').replace(/ \(Repeat\)$/, '')} (again)`,
    () => c.p.state.quests.story_final_thesis?.status === 'turned_in');
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
  const quests = [...storyOptions(c, home), ...questOptions(c, home), ...bountyRenewOptions(c, home)];
  const firstYear = (Registry.job(c.p.state.job)?.tier ?? 1) <= 1;
  say(c, pick([
    'Prefect Finn, field practicums. Whisperwood is our classroom — stay on the path, mind the slimes, and don\'t eat the mushrooms.',
    'Shh — you hear that? Snails. Hundreds of them. Okay, maybe twelve. Practicum credit if you help?',
    firstYear ? `A first-year! ${c.p.state.name}, right? The practicum roster could use another pair of hands.`
      : `${c.p.state.name}! An upperclassman on my roster — the first-years will be thrilled.`,
  ]), [...quests, go(firstYear ? 'Any tips for a first-year?' : 'Any field tips?', tips), bye()]);
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
      const back = () => runNpcScript(s, npcId, portraitKey);
      const quests = [...storyOptions(c, back), ...questOptions(c, back)];
      say(c, 'Lovely weather for spellcasting, isn\'t it? Shouldn\'t you be in class?', [...quests, bye()]);
    }
  } catch (e) {
    console.warn(`[npc] script ${npcId} failed`, e);
    say(c, '...', [bye()]);
  }
}
