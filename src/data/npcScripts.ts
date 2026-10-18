// OWNER: A9 (progression). NPC conversation scripts. Each script emits 'ui:dialog' / 'ui:shop' on the bus.
import type { Branch, DialogOption, GameServices, JobId, QuestDef } from '../core/types';
import { bus } from '../core/events';
import { Registry } from '../core/registry';
import { BRANCH_ROOT_JOB } from './jobs';
import { JOB_ADVANCEMENT_QUESTS, JOB_QUEST_IDS } from './quests';
import type { Progression } from '../systems/Progression';

type ElementalBranch = 'fire' | 'ice' | 'lightning';

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

/** Dialog options for this NPC's side quests (available / in progress / ready). */
function questOptions(c: Ctx, back: () => void): DialogOption[] {
  const out: DialogOption[] = [];
  for (const q of sideQuestsFor(c.npcId)) {
    const st = c.p.questStatus(q.id);
    if (st === 'available') out.push(go(`[Quest] ${q.name}`, () => offerQuest(c, q, back)));
    else if (st === 'complete') out.push(go(`[Complete] ${q.name}`, () => turnIn(c, q, back)));
    else if (st === 'active') out.push(go(`[In progress] ${q.name}`, () => say(c, `${q.name}\n\n${objectivesText(c.p, q)}\n\nNo rush — but don't dawdle, either.`, [go('Back', back), bye('I\'m on it.')])));
  }
  return out;
}

function offerQuest(c: Ctx, q: QuestDef, back: () => void) {
  say(c, `${q.name}\n\n${q.description}\n\n${objectivesText(c.p, q)}\n${rewardsText(q)}`, [
    go('Accept', () => {
      c.p.acceptQuest(q.id);
      say(c, pick(['Wonderful! Off you go, then.', 'I knew I could count on you!', 'Splendid. Come back when it\'s done.']), [bye('Will do!')]);
    }),
    go('Not right now.', back),
  ]);
}

function turnIn(c: Ctx, q: QuestDef, back: () => void) {
  if (c.p.turnInQuest(q.id)) {
    say(c, `You did it! Thank you, truly.\n\n${rewardsText(q)}`, [go('Anything else?', back), bye('Happy to help.')]);
  } else {
    say(c, 'Hmm, your pack is bursting at the seams. Make a little room and come back.', [bye('Okay.')]);
  }
}

// ─────────────────────────── Job advancement logic ───────────────────────────

const INSTRUCTOR_BRANCH: Record<string, ElementalBranch> = { pyra: 'fire', glacius: 'ice', voltis: 'lightning' };
const BRANCH_INSTRUCTOR: Record<ElementalBranch, string> = { fire: 'Pyra', ice: 'Glacius', lightning: 'Voltis' };
const BRANCH_LABEL: Record<ElementalBranch, string> = { fire: 'Fire', ice: 'Ice', lightning: 'Lightning' };

/** The next job in this branch the player is level-eligible for, and its trial quest. */
function pendingTrial(p: Progression, branch: Branch): { job: JobId; questId: string } | null {
  const cur = p.jobDef();
  if (cur.branch !== branch || cur.tier < 2 || cur.tier >= 4) return null;
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
  const br = INSTRUCTOR_BRANCH[npcId];
  if (br) {
    const t = pendingTrial(p, br);
    if (t) {
      const st = p.questStatus(t.questId);
      if (st === 'complete') return 'turnin';
      if (st === 'available' || st === 'turned_in') return 'new';
    }
  }
  return notice;
}

// ─────────────────────────── Elder Maelis ───────────────────────────

const PATHS: Record<ElementalBranch, string> = {
  fire: 'FIRE is passion given form. Pyromancers hurl fireballs, set the ground ablaze and leave enemies burning long after the spell is cast.\n\nPlaystyle: big explosive damage and burns over time. For mages who like to hit hard and keep pushing forward.',
  ice: 'ICE is patience made sharp. Cryomancers slow their foes, lock them in frost, then shatter them with a single word.\n\nPlaystyle: crowd control and safety — freeze the danger, then break it. For mages who like to be in command.',
  lightning: 'LIGHTNING is speed itself. Stormcallers fling bolts that leap from foe to foe and stun anything foolish enough to stand still.\n\nPlaystyle: fast, mobile, and wonderful against crowds. For mages who never like to wait.',
};

function elderMaelis(c: Ctx) {
  const p = c.p;
  const job = p.jobDef();
  const lv = p.state.level;
  const home = () => elderMaelis(c);

  const explainPaths = () => say(c,
    'Every mage begins as an Apprentice, but at level 10 the arcane asks you a question: fire, ice or lightning?\nWhich would you like to hear about?',
    [
      go('Tell me of Fire.', () => say(c, PATHS.fire, [go('And the others?', explainPaths), bye('Thank you, Elder.')])),
      go('Tell me of Ice.', () => say(c, PATHS.ice, [go('And the others?', explainPaths), bye('Thank you, Elder.')])),
      go('Tell me of Lightning.', () => say(c, PATHS.lightning, [go('And the others?', explainPaths), bye('Thank you, Elder.')])),
      go('Back', home),
    ]);

  const quests = questOptions(c, home);

  if (job.tier === 1) {
    if (lv < 10) {
      say(c, pick([
        `Ah, ${p.state.name}. Your staff still smells of the academy kiln. Come back to me at level 10 and we shall see which element answers your call.`,
        'Patience, little spark. Train in Whisperwood, and at level 10 I will help you choose your path.',
      ]), [go('Tell me about the three paths.', explainPaths), ...quests, bye()]);
      return;
    }
    const choose = () => say(c, 'The arcane is asking, and you must answer. Which path calls to you?', [
      ...(['fire', 'ice', 'lightning'] as ElementalBranch[]).map(br => go(`The path of ${BRANCH_LABEL[br]}.`, () => confirmPath(br))),
      go('Tell me about them again.', explainPaths),
      bye('I need more time.'),
    ]);
    const confirmPath = (br: ElementalBranch) => {
      const target = BRANCH_ROOT_JOB[br];
      say(c, `${PATHS[br]}\n\nOnce chosen, a path cannot be unwalked. Will you become a ${jobName(target)}?`, [
        go(`Yes — I choose ${BRANCH_LABEL[br]}!`, () => {
          if (p.advanceJob(target)) {
            say(c, `It is done. Feel that? That is ${BRANCH_LABEL[br].toLowerCase()} recognising you, ${jobName(target)}.\n\n${BRANCH_INSTRUCTOR[br]} will guide you from here. You also have 3 bonus SP — open your skills with K.`, [bye('Thank you, Elder!')]);
          } else {
            say(c, 'Hmm. The arcane does not answer yet. Come back when you are ready.', [bye()]);
          }
        }),
        go('Let me reconsider.', choose),
      ]);
    };
    say(c, `Level ${lv}... yes, I can feel it. The elements are restless around you, ${p.state.name}. It is time to choose your path.`, [
      go('I am ready to choose.', choose),
      go('Tell me about the three paths.', explainPaths),
      ...quests,
      bye('Not yet.'),
    ]);
    return;
  }

  const br = job.branch as ElementalBranch;
  const instructor = BRANCH_INSTRUCTOR[br] ?? 'your instructor';
  if (job.tier === 4) {
    say(c, `${job.name}... I have trained many mages, ${p.state.name}, but few who reached so high. The Lich Archon still broods in the Arcane Sanctum. Perhaps you are the one to end it.`, [...quests, bye('I will not fail.')]);
    return;
  }
  const nextLevel = job.tier === 2 ? 25 : 40;
  const hint = lv >= nextLevel
    ? `${instructor} has been asking after you. Your next trial awaits — go and see them.`
    : `Keep growing. At level ${nextLevel}, ${instructor} will have a trial for you.`;
  say(c, pick([
    `How fares the ${job.name}? ${hint}`,
    `The ${BRANCH_LABEL[br]?.toLowerCase() ?? 'arcane'} suits you, ${p.state.name}. ${hint}`,
  ]), [...quests, bye()]);
}

// ─────────────────────────── Instructors ───────────────────────────

interface InstructorLines {
  apprentice: string[];
  otherBranch: string[];
  ownChat: string[];
  offerTrial: (job: string) => string;
  trialProgress: string;
  trialDone: (job: string) => string;
  advanced: (job: string) => string;
  master: string[];
}

const INSTRUCTOR_LINES: Record<ElementalBranch, InstructorLines> = {
  fire: {
    apprentice: [
      'Oh, a fresh Apprentice! Don\'t touch the brazier. Or do — it builds character. Reach level 10 and talk to Elder Maelis if you want to learn real fire.',
      'Fire isn\'t about anger, kid. It\'s about commitment. Come back when you\'ve chosen your path.',
    ],
    otherBranch: [
      'You smell like {other}. No offence. Glad you found your element — mine is just better.',
      'Ah, one of {instructor}\'s students. Tell them they still owe me a rematch.',
    ],
    ownChat: [
      'Keep your fireballs moving and your enemies burning. Burn ticks add up!',
      'Fire hits harder on frosty foes. Frostfang Cliffs is a pyromancer\'s playground.',
      'Never fight in the Cinder Caverns with fire alone — those beasts drink flame. Bring potions.',
    ],
    offerTrial: job => `You've grown hot enough to forge. Prove it, and I'll make you a ${job}.`,
    trialProgress: 'Still working on it? Fire waits for no one — get moving!',
    trialDone: job => `Ha! Look at that haul! You've earned it. Ready to become a ${job}?`,
    advanced: job => `Burn bright, ${job}! New skills await — check them with K.`,
    master: ['An Inferno Sage. Honestly? I\'m a little jealous. Go melt something magnificent.'],
  },
  ice: {
    apprentice: [
      'Calm down, little one. Frost rewards patience. At level 10, seek out Elder Maelis.',
      'Every snowflake is different. So is every mage. Choose your path wisely.',
    ],
    otherBranch: [
      'You carry the scent of {other}. Interesting. Not wrong, merely... warmer.',
      '{instructor} trained you? Then you have learned speed. I hope you also learn stillness.',
    ],
    ownChat: [
      'Freeze first, shatter second. Frozen foes take far more from your next spell.',
      'Chill slows the swiftest beast. A slowed enemy is a defeated enemy.',
      'The Cinder Caverns melt fire mages. They do not melt us.',
    ],
    offerTrial: job => `Your frost has deepened. Complete my trial and I will name you ${job}.`,
    trialProgress: 'Patience. But not too much patience. The trial still waits.',
    trialDone: job => `Exquisite work. The cold is pleased. Shall I name you ${job}?`,
    advanced: job => `Welcome, ${job}. Let the world slow around you. Press K to learn new skills.`,
    master: ['A Glacial Sage stands before me. The stillness at the heart of the storm... is you.'],
  },
  lightning: {
    apprentice: [
      'Hey hey! Fast hands, I like it. Hit level 10, then go see Elder Maelis. Then come see ME.',
      'Lightning never strikes twice? Wrong. It strikes as often as I want.',
    ],
    otherBranch: [
      '{other}, huh? Cool. Cool cool cool. Not as cool as lightning, but cool.',
      'Tell {instructor} I said hi. Then run. Fast. Like lightning.',
    ],
    ownChat: [
      'Chain bolts love crowds! The more monsters, the more jumps.',
      'Stuns buy time — and time is the one thing lightning has too much of.',
      'Stormspire Peak is our home turf. Those harpies won\'t know what hit them.',
    ],
    offerTrial: job => `You're crackling, kid! Pass my trial and I'll make you a ${job}. Deal?`,
    trialProgress: 'Not done yet? Speed it up! Zip zap!',
    trialDone: job => `BOOM! That's what I'm talking about! Ready to become a ${job}?`,
    advanced: job => `Say hello to the new ${job}! Go check your skills — K, quick!`,
    master: ['A Tempest Sage. You ARE the storm now. Try not to set the town on fire. That\'s Pyra\'s job.'],
  },
};

function instructor(c: Ctx) {
  const br = INSTRUCTOR_BRANCH[c.npcId];
  const L = INSTRUCTOR_LINES[br];
  const p = c.p;
  const job = p.jobDef();
  const home = () => instructor(c);
  const quests = questOptions(c, home);

  if (job.tier === 1) { say(c, pick(L.apprentice), [...quests, bye()]); return; }

  if (job.branch !== br) {
    const other = BRANCH_LABEL[job.branch as ElementalBranch]?.toLowerCase() ?? 'arcana';
    const instr = BRANCH_INSTRUCTOR[job.branch as ElementalBranch] ?? 'your instructor';
    say(c, pick(L.otherBranch).replace('{other}', other).replace('{instructor}', instr), [...quests, bye()]);
    return;
  }

  if (job.tier === 4) { say(c, pick(L.master), [...quests, bye()]); return; }

  const trial = pendingTrial(p, br);
  if (!trial) {
    const next = job.tier === 2 ? 25 : 40;
    say(c, `${pick(L.ownChat)}\n\n(Come back at level ${next} for your next trial.)`, [...quests, bye()]);
    return;
  }

  const q = Registry.quest(trial.questId);
  const targetName = jobName(trial.job);
  const st = p.questStatus(trial.questId);

  const confirmAdvance = () => say(c, L.trialDone(targetName), [
    go(`Yes! Make me a ${targetName}.`, () => {
      if (p.advanceJob(trial.job)) say(c, L.advanced(targetName), [bye('Thank you!')]);
      else say(c, 'Something is off... come back to me in a moment.', [bye()]);
    }),
    bye('Not just yet.'),
  ]);

  if (st === 'turned_in') { confirmAdvance(); return; }
  if (!q) {
    // Data missing — don't soft-lock the player.
    confirmAdvance();
    return;
  }
  if (st === 'available') {
    say(c, `${L.offerTrial(targetName)}\n\n${q.name}\n${q.description}\n\n${objectivesText(p, q)}`, [
      go('I accept the trial.', () => {
        p.acceptQuest(q.id);
        say(c, 'Then go. I\'ll be right here.', [bye('Back soon!')]);
      }),
      ...quests,
      bye('Not yet.'),
    ]);
    return;
  }
  if (st === 'active') {
    say(c, `${L.trialProgress}\n\n${q.name}\n${objectivesText(p, q)}`, [...quests, bye('On my way.')]);
    return;
  }
  if (st === 'complete') {
    say(c, `${q.name}\n${objectivesText(p, q)}\n\nYou've done it! Hand them over?`, [
      go('Here you go.', () => {
        if (p.turnInQuest(q.id)) confirmAdvance();
        else say(c, 'Your bag is too full for your reward. Clear some space first.', [bye('Okay.')]);
      }),
      bye('One moment.'),
    ]);
    return;
  }
  say(c, pick(L.ownChat), [...quests, bye()]);
}

// ─────────────────────────── Town folk ───────────────────────────

const POTION_SHOP = ['red_potion', 'orange_potion', 'white_potion', 'blue_potion', 'mana_elixir', 'elixir', 'return_scroll'];

function shopEntries(ids: string[]) {
  return ids.map(id => Registry.item(id)).filter((d): d is NonNullable<typeof d> => !!d && d.price > 0)
    .map(d => ({ itemId: d.id, price: d.price }));
}

function merchantBram(c: Ctx) {
  const home = () => merchantBram(c);
  say(c, pick([
    'Potions! Fresh potions! Red for scrapes, blue for brain-fog, and a Return Scroll for when it all goes wrong.',
    'Welcome, welcome! Every bottle brewed this morning. Well. This week. Ish.',
    'Heading out? Never leave town without a stack of potions. Trust old Bram.',
  ]), [
    { label: 'Let me see your wares.', closes: true, action: () => bus.emit('ui:shop', { npcId: c.npcId, npcName: c.npcName, items: shopEntries(POTION_SHOP) }) },
    ...questOptions(c, home),
    bye(),
  ]);
}

function smithTilda(c: Ctx) {
  const home = () => smithTilda(c);
  const p = c.p;
  const branch = p.jobDef().branch;
  const lv = p.state.level;
  const items = Registry.items()
    .filter(d => d.type === 'equip' && d.equip && d.price > 0)
    .filter(d => d.equip!.reqLevel <= Math.max(10, lv + 8))
    .filter(d => !d.equip!.reqBranch || d.equip!.reqBranch === 'none' || d.equip!.reqBranch === branch)
    .sort((a, b) => a.equip!.reqLevel - b.equip!.reqLevel || a.price - b.price)
    .map(d => ({ itemId: d.id, price: d.price }));
  say(c, pick([
    'Staves, robes, boots — if a mage wears it, I forge it. Mind the sparks.',
    'Your gear\'s looking a bit singed. Let\'s fix that.',
    'I don\'t do magic. I do the things magic needs to not explode in your hands.',
  ]), [
    { label: 'Show me your equipment.', closes: true, action: () => bus.emit('ui:shop', { npcId: c.npcId, npcName: c.npcName, items }) },
    ...questOptions(c, home),
    bye(),
  ]);
}

function scoutFinn(c: Ctx) {
  const home = () => scoutFinn(c);
  const tips = () => say(c, pick([
    'Hold Z to scoop up loot and mesos. Monsters drop the goods; you just have to grab them.',
    'Press Up at a glowing portal to travel. East leads deeper into the wilds — and tougher monsters.',
    'Spend your AP in the Stats window (P). INT makes your spells hit harder; LUK helps you crit.',
    'Put potions on your hotbar! Keys 1 and 2 are perfect for them.',
    'Ropes and ladders: walk up to one and press Up to climb.',
  ]), [go('Another tip?', tips), go('Back', home), bye('Thanks!')]);
  const quests = questOptions(c, home);
  say(c, pick([
    'Shh — you hear that? Snails. Hundreds of them. Okay, maybe twelve. Want to help?',
    'Welcome to Whisperwood! Stay on the path, mind the slimes, and don\'t eat the mushrooms.',
    `A new face! ${c.p.state.name}, right? The forest could use another pair of hands.`,
  ]), [...quests, go('Any tips for a new mage?', tips), bye()]);
}

const SCRIPTS: Record<string, (c: Ctx) => void> = {
  elder_maelis: elderMaelis,
  pyra: instructor,
  glacius: instructor,
  voltis: instructor,
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
      say(c, 'Lovely weather for spellcasting, isn\'t it?', [...quests, bye()]);
    }
  } catch (e) {
    console.warn(`[npc] script ${npcId} failed`, e);
    say(c, '...', [bye()]);
  }
}
