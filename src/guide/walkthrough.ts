// The walkthrough: four school Years in play order. Writers supply the prose and say WHICH zone, quest, boss or
// shop to show; the blocks print every number from the game's data (docs/GUIDE.md). Prose tokens such as
// {key:skills}, {joblv:2}, {qlv:story_violet_thorns}, {mlv:moss_snail} and {zlv:whisperwood} expand from the data too.

import type { Section } from './types';

const Y1 = 'Year 1 · Apprentice';
const Y2 = 'Year 2 · Declared';
const Y3 = 'Year 3 · Binder';
const Y4 = 'Year 4 · Final Year';
const GRAD = 'Graduation and beyond';

export const WALKTHROUGH: Section[] = [
  // ───────────────────────────── Year 1 ─────────────────────────────
  {
    id: 'y1-enrolment', part: Y1, title: 'Enrolment Day',
    blocks: [
      { image: 'title.jpg', alt: 'The title screen: the Academy logo beside the Headmistress\'s tower under a crescent moon', caption: 'Pick New Game, name your student, and you are enrolled. Six save slots live under Character Select.' },
      { p: 'Every student starts in the same place: the **Academy Grounds**, a long campus walk from the armory in the west to the east gate. You arrive as an **Apprentice** with Arcane Bolt on {key:slot0}, a Red Potion on {key:slot10} and a Blue Potion on {key:slot11}. Your starting kit is in [[How to play|#how-to-play]].' },
      { p: 'From west to east you will pass Tilda\'s armory, Bram\'s quartermaster counter, the dormitory fountain, the **Headmistress\'s tower** and the five School halls with a Professor in front of each. The east gate leads to Whisperwood.' },
      { zone: 'mistvale', note: 'Campus is a safe zone: no monsters, and HP and MP recover faster here than in the field.' },
      { tip: 'The Trial Hall door is on the Headmistress\'s tower balcony: climb the ladder at the foot of the tower and press {key:interact} at the door. It is open from day one, but wait until you have a few spells.', title: 'Spot the Trial Hall' },
    ],
  },
  {
    id: 'y1-orientation', part: Y1, title: 'Orientation',
    blocks: [
      { p: 'Talk to **Headmistress Maelis** in front of her tower to begin. Orientation is four short lessons, each unlocking the next; the first two are just conversations that hand themselves in.' },
      { quest: 'story_orientation' },
      { quest: 'story_office_hours', note: 'Each Professor teaches a different lesson here (spending SP, spending AP, the second hotbar page, campus regeneration, what happens when you fall). Pick whichever School you are curious about; it does not commit you to anything.' },
      { quest: 'story_supplies', note: 'Bram\'s counter is the first menu option. Buy the scroll, then talk to him again to hand it in. You get it back with interest.' },
      { quest: 'story_first_practicum' },
      { tip: 'Hold {key:pickup} rather than tapping it: you scoop up everything in reach, one item after another. Pip, your owl familiar, also flies over and grabs drops near you.', title: 'Looting' },
    ],
  },
  {
    id: 'y1-whisperwood', part: Y1, title: 'Whisperwood practicums',
    blocks: [
      { p: 'Whisperwood (levels {zlv:whisperwood}) is the Academy\'s outdoor classroom. Moss Snails are slow and never start a fight; Puff Slimes hop; Cap Shrooms on the upper ledges hit back. Climb the ropes with {key:up} to reach the upper tiers.' },
      { zone: 'whisperwood' },
      { p: 'Prefect Finn stands by the west portal with three practicums. Take them all at once: they overlap with what you are hunting anyway.' },
      { quests: ['q_finn_snails', 'q_finn_jelly', 'q_finn_shrooms'], title: 'Prefect Finn\'s practicums' },
      { training: [1, 9] },
      { p: 'Every few minutes the ground starts flashing red: the **Mossback Matriarch** has woken. She is the Year 1 field boss and a real fight at her level. Finn posts a bounty for her; take it before you hunt her.' },
      { boss: 'mossback_matriarch' },
      { quest: 'q_bounty_mossback_matriarch' },
    ],
  },
  {
    id: 'y1-declaration', part: Y1, title: 'Shroom Hollow and Declaration Day',
    blocks: [
      { p: 'Back on campus, Maelis sets the last Year 1 step: reach level {joblv:2}. The quickest road is the tail of Whisperwood and the west half of **Shroom Hollow**, east of Whisperwood.' },
      { quest: 'story_declaration' },
      { p: 'Shroom Hollow (levels {zlv:shroom_hollow}) is dark, crowded and full of mushrooms that fight back. Cap Shrooms carpet the west; Thorn Shrooms hold the middle; Stump Golems guard the east end, hit hard and are slow.' },
      { zone: 'shroom_hollow' },
      { quests: ['q_bram_spores', 'q_finn_stumps'], title: 'Assignments for this stretch' },
      { p: 'At level {joblv:2}, hand in Declaration Day and Maelis offers the declaration straight away. **Talk to the Professors first** if you have not: the choice is for life, and there are no transfers. The [[Five Schools|#schools]] chapter has every spell; here is the short version.' },
      { schools: true },
      { tip: 'Spend your Year 1 SP before you declare. The core curriculum never stops being useful: Blink, Mana Font and Scholar\'s Insight help every School, and Arcane Bolt stays a fine opener.', title: 'Unspent SP' },
      { checklist: ['Arcane Bolt trained up and a Blink learned', 'A stack of Red and Blue Potions on the hotbar', 'Your School chosen after talking to its Professor'] },
    ],
  },

  // ───────────────────────────── Year 2 ─────────────────────────────
  {
    id: 'y2-declared', part: Y2, title: 'Your first School spells',
    blocks: [
      { p: 'Declaring makes you a Year 2 student with your School\'s first title and bonus SP. Open the spellbook ({key:skills}) and spend it: every School\'s Year 2 page has several spells with no prerequisite at all, so you can pick a direction right away. Traps, marks and combo spells show up here too: a spell that cashes in a status says so in its effects ("removes it"). Each School in [[the Five Schools|#schools]] ends with suggested builds that fit real SP budgets.' },
      { p: 'Tilda now stocks your School\'s staff, and the ones for other Schools stay off her racks. A School staff adds that element\'s damage on top of Magic ATK.' },
      { shop: 'tilda' },
    ],
  },
  {
    id: 'y2-violet-thorns', part: Y2, title: 'Violet Thorns',
    blocks: [
      { p: 'The main story begins: something in the Forbidden Wing is leaking violet light, and it has reached Shroom Hollow. Finn has the first lead.' },
      { quest: 'story_violet_thorns' },
      { p: 'While you are in Shroom Hollow, keep an eye out for its field boss. The **Shroom Monarch** is weak to Fire and Holy and does not care about poison.' },
      { boss: 'shroom_monarch' },
      { quest: 'q_bounty_shroom_monarch' },
    ],
  },
  {
    id: 'y2-moonlit-marsh', part: Y2, title: 'The Moonlit Marsh (optional)',
    blocks: [
      { p: 'Not every practicum is on the main road. A side path off Shroom Hollow\'s upper ledges leads to the **Moonlit Marsh** (levels {zlv:moonlit_marsh}), a night-study bog of hummocks and rope-linked ledges. Bog Toads hop the ground, Thorn Shrooms squat beside them and Will-o\'-Wisps drift over the upper ledges. Wisps shrug off fire and poison; Holy and Lightning do the work. You return by the same portal.' },
      { zone: 'moonlit_marsh' },
      { quests: ['q_finn_lanterns'], title: 'Assignment' },
    ],
  },
  {
    id: 'y2-frostfang', part: Y2, title: 'Frostfang Cliffs',
    blocks: [
      { p: 'Frostfang Cliffs (levels {zlv:frostfang_cliffs}) is a long climb of cliff steps and ice ledges. Frost Bats flit along the lower ledges, Snow Yetis hold the ground, and Ice Wisps drift on the upper ledges. Fire is welcome everywhere here.' },
      { zone: 'frostfang_cliffs' },
      { training: [15, 25] },
      { image: 'frostfang-pillar.jpg', alt: 'A Flamebinder casting Inferno Pillar on two Snow Yetis on Frostfang Cliffs', caption: 'A Year 3 Flamebinder\'s Inferno Pillar on the Snow Yetis of Frostfang Cliffs.' },
      { quests: ['q_tilda_wings'], title: 'Assignment' },
      { p: 'At level {qlv:story_pages_in_snow}, Professor Glacius has the next story step: the faculty\'s sealed notes are missing pages, and the Ice Wisps here drank their ink.' },
      { quest: 'story_pages_in_snow' },
      { boss: 'frostfang_alpha' },
      { quest: 'q_bounty_frostfang_alpha' },
    ],
  },
  {
    id: 'y2-glacier-grotto', part: Y2, title: 'The Glacier Grotto (optional)',
    blocks: [
      { p: 'A cave mouth on the ice step in Frostfang Cliffs leads down to the **Glacier Grotto** (levels {zlv:glacier_grotto}), blue ice under the range. Crystal Crabs scuttle the floor and steps, Ice Wisps and Frost Shades haunt the ledges above. Crabs are weak to Lightning and resist frost, so Cryomancers bring a second spell. You return by the same portal.' },
      { zone: 'glacier_grotto' },
      { quests: ['q_glacius_geodes'], title: 'Assignment' },
    ],
  },
  {
    id: 'y2-exam', part: Y2, title: 'Year 3 Exams',
    blocks: [
      { p: 'At level {joblv:3} your own Professor sets your Year 3 Exam. Each School\'s exam is a collection run; most of what they ask for drops on Frostfang Cliffs, and Ice students head one zone further east to the Cinder Caverns. Hand it in and say yes to advance.' },
      { exams: 3 },
      { tip: 'Exam items stack in your bag before you accept the exam, so anything you looted on the way counts the moment you take it.', title: 'Head start' },
    ],
  },

  // ───────────────────────────── Year 3 ─────────────────────────────
  {
    id: 'y3-faculty', part: Y3, title: 'The Faculty Meeting',
    blocks: [
      { p: 'As a Year 3 student you are invited to the faculty table. Maelis finally tells the story of the Forbidden Wing: the Archmage who wanted magic that never forgets, the Lich that came back, and the five-verse seal every Professor keeps.' },
      { quest: 'story_faculty_meeting' },
    ],
  },
  {
    id: 'y3-cinder', part: Y3, title: 'Cinder Caverns',
    blocks: [
      { p: 'Cinder Caverns (levels {zlv:cinder_caverns}) is hot, tall and dangerous. Ember Imps hop around the west, Lava Salamanders run the middle, and Magma Golems wall off the east. Everything here resists Fire: Fire students should bring Mana Elixirs and patience, Ice students will feel at home.' },
      { zone: 'cinder_caverns' },
      { training: [25, 35] },
      { quest: 'story_ash_and_ink' },
      { quests: ['q_maelis_scales', 'q_bram_cores'], title: 'Assignments' },
      { boss: 'magmaw' },
      { quest: 'q_bounty_magmaw' },
    ],
  },
  {
    id: 'y3-stormspire', part: Y3, title: 'Stormspire Peak and A Crack in the Seal',
    blocks: [
      { p: 'Stormspire Peak (levels {zlv:stormspire_peak}) is the observatory mountain. Storm Harpies wheel along the lower ledges, Crag Golems hold the ground and the plateau, and Thunder Drakes nest on the high platforms. Lightning makes short work of harpies and golems; drakes resist it.' },
      { zone: 'stormspire_peak' },
      { training: [35, 46] },
      { quest: 'story_crack_in_seal', note: 'Seal Fragments drop from Thunder Drakes, the Void Wisps of the Arcane Sanctum and the Tempest Wyrm. The drakes are the reliable source at this level.' },
    ],
  },
  {
    id: 'y3-restricted-stacks', part: Y3, title: 'The Restricted Stacks (optional)',
    blocks: [
      { p: 'The Academy\'s forbidden library is reached by a portal at the top of the Headmistress\'s tower on the Academy Grounds. Nothing locks it, but the shelves are tuned for levels {zlv:restricted_stacks}. Animated Tomes fly the aisles, Ink Golems hold the floor and Void Wisps float under the vaults. Shadow students bring curses; Fire and Holy shine. You return by the same portal.' },
      { zone: 'restricted_stacks' },
      { quests: ['q_maelis_overdue'], title: 'Assignment' },
    ],
  },
  {
    id: 'y3-exam', part: Y3, title: 'Year 4 Exams',
    blocks: [
      { p: 'At level {joblv:4} your Professor sets the final exam: a hunt and a collection on Stormspire Peak or in the Cinder Caverns. Pass it and you take your graduate title.' },
      { exams: 4 },
    ],
  },

  // ───────────────────────────── Year 4 ─────────────────────────────
  {
    id: 'y4-tempest', part: Y4, title: 'The Tempest Wyrm',
    blocks: [
      { p: 'The last field boss circles the top of Stormspire Peak. It is the toughest of the five and drops a rare Seal Fragment besides its trophy.' },
      { boss: 'tempest_wyrm' },
      { quest: 'q_bounty_tempest_wyrm' },
      { quests: ['q_tilda_drakes'], title: 'Assignment' },
    ],
  },
  {
    id: 'y4-forbidden', part: Y4, title: 'The Forbidden Wing',
    blocks: [
      { p: 'Professor Morvane holds the only key. Past Stormspire Peak lies the **Arcane Sanctum** (levels {zlv:arcane_sanctum}): a short hall of violet glass with Void Wisps on every ledge and the Lich Archon in the middle of the floor. A portal at its east end leads straight home to campus.' },
      { zone: 'arcane_sanctum' },
      { quest: 'story_forbidden_wing' },
      { quests: ['q_maelis_void'], title: 'Assignment' },
    ],
  },
  {
    id: 'y4-thesis', part: Y4, title: 'The Final Thesis',
    blocks: [
      { p: 'Tell the Headmistress you are ready. Your thesis is one line long.' },
      { quest: 'story_final_thesis' },
      { boss: 'lich_archon' },
      { image: 'sanctum-lich.jpg', alt: 'An Inferno Sage and a summoned phoenix fighting the Lich Archon under a rain of meteors in the Arcane Sanctum', caption: 'Meteor Storm and a Summon Phoenix against the Lich Archon. His HP bar sits at the top of the screen.' },
      { checklist: ['Potions on both hotbar pages', 'Your School\'s Year 4 staff (or better)', 'Every ultimate learned and off cooldown', 'Wisps on the ledges cleared before you engage'] },
    ],
  },

  // ───────────────────────────── Graduation ─────────────────────────────
  {
    id: 'grad-commencement', part: GRAD, title: 'Commencement',
    blocks: [
      { p: 'Bring the Sigil to Maelis and she calls the whole Academy together. Step forward to graduate: the credits roll, and the faculty votes you a pile of Academy Merits to spend at Bram\'s Merit Exchange.' },
      { quest: 'story_commencement' },
    ],
  },
  {
    id: 'grad-after', part: GRAD, title: 'After graduation',
    blocks: [
      { p: 'Graduation is not the end of the save. The Lich Archon returns some minutes after he falls, and Maelis keeps a repeatable bounty on him. Prefect Finn re-posts every Field Bounty you hand in. And the [[Trial Hall|#trial-hall]] keeps paying Merits for every wave you clear, for the Merit Exchange\'s rare field-boss accessories.' },
      { quests: ['q_maelis_archon'], title: 'Repeatable' },
      { shop: 'merit' },
      { tip: 'Want to try another build? A Tome of Unlearning refunds one Year of spells. See [[Respec|#respec]].', title: 'Rebuild' },
    ],
  },
];
