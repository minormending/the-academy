// The walkthrough: the five school Years of story mode in play order. Each Year opens with its plan and its classes
// (read from the course data by the `year` and `classes` blocks); the sections after that follow the road the
// classes send you down. Writers supply the prose and say WHICH zone, quest, boss or shop to show; the blocks print
// every number from the game's data (docs/GUIDE.md). Prose tokens such as {key:skills}, {joblv:2},
// {qlv:story_violet_thorns}, {mlv:moss_snail} and {zlv:whisperwood} expand from the data too.

import { Registry } from '../core/registry';
import { MAX_LEVEL } from '../core/constants';
import type { YearNo } from '../core/types';
import type { Section } from './types';

/** Part headings are the Years' own titles ("Year 1 · The Apprentice Term"). */
const year = (n: YearNo) => Registry.yearPlan(n)?.title ?? `Year ${n}`;
const Y1 = year(1);
const Y2 = year(2);
const Y3 = year(3);
const Y4 = year(4);
const Y5 = year(5);
const AFTER = 'After the story';

export const WALKTHROUGH: Section[] = [
  // ───────────────────────────── Year 1 ─────────────────────────────
  {
    id: 'y1-enrolment', part: Y1, title: 'Enrolment Day',
    blocks: [
      { p: '**Design your mage.** Choose New Game and name your student, then pick a **Skin**, **Hair** and **Accent** colour from the swatches, or press Randomize until a look suits you. The preview animates your Apprentice as you choose, and a strip beneath it shows the same student in each School\'s Year 2 robes: the look you pick here carries into every School robe you will ever wear.' },
      { image: 'title.jpg', alt: 'The title screen: the Academy logo beside the Headmistress\'s tower under a crescent moon', caption: 'Pick New Game, name and design your student, and you are enrolled. Six save slots live under Character Select.' },
      { p: 'Every student starts in the same place: the **Academy Grounds**, a long campus walk from the armory in the west to the east gate. You arrive as an **Apprentice** with Arcane Bolt on {key:slot0}, a Red Potion on {key:slot10} and a Blue Potion on {key:slot11}. Your starting kit is in [[How to play|#how-to-play]].' },
      { p: 'From west to east you will pass Tilda\'s armory, Bram\'s quartermaster counter, the dormitory fountain, the **Headmistress\'s tower** and the five School halls with a Professor in front of each. Most of them teach a class this Year. The east gate leads to Whisperwood.' },
      { zone: 'mistvale', note: 'Campus is a safe zone: no monsters, and HP and MP recover faster here than in the field.' },
      { tip: 'The Trial Hall door is on the Headmistress\'s tower balcony: climb the ladder at the foot of the tower and press {key:interact} at the door. It is open from day one, but wait until you have a few spells.', title: 'Spot the Trial Hall' },
    ],
  },
  {
    id: 'y1-term', part: Y1, title: 'How a Year works',
    blocks: [
      { p: 'The Academy runs on **classes**. Each Year is a term: the teachers on campus each offer one or more classes, a class is a short chain of **missions**, and handing in its last mission **passes** the class. The teacher then pays the class rewards and pins its **badge** on you. Collect enough badges, including the required ones, and Headmistress Maelis moves you on to the next Year.' },
      { list: [
        '**Teachers.** Talk to a teacher ({key:interact}) and open their **Classes** register: it offers the next mission of each of their classes, takes hand-ins and awards badges. A yellow **!** over someone means they have something for you.',
        '**One mission at a time.** A class\'s missions unlock in order, each with its own level. A mission above your level is listed as coming soon. A few missions are handed out by someone other than the teacher, and the register says who.',
        '**Three kinds of class.** The **core** class is the Headmistress\'s story class and is always required. From Year 2 your **major**, taught by your own School\'s Professor, is required too. **Electives** make up the rest, and you pick which.',
        '**The Classes window** ({key:quests}) is your report card: this Year\'s classes, every mission\'s objectives, your badge case, and an Assignments tab for the few quests that belong to no class.',
        '**The tracker** in the top-right corner of the screen shows your next missions and their progress; click it to open Classes. When a mission wants you on another map, a gold arrow hangs over the portal that leads there and the minimap marks the same portal.',
        '**The report card.** Maelis reads it to you whenever you ask. Once the Year is passed she offers the next step: declaring your major in Year 1, a promotion ceremony after that.',
      ] },
      { year: 1 },
      { classes: 1 },
      { tip: 'Only Orientation is required this Year, so the other badges can be any mix of the five School samplers and Prefect Finn\'s Field Practicum. Taking several samplers is the best way to choose your major.', title: 'Which classes?' },
      { tip: 'Students who finished Years before story mode existed get credit for them: the core class, the major and enough electives of every finished Year are marked passed (the badge case shows them), so a Year 3 student carries on with Year 3\'s classes.', title: 'Coming back to an older save' },
    ],
  },
  {
    id: 'y1-orientation', part: Y1, title: 'Orientation',
    blocks: [
      { p: 'Talk to **Headmistress Maelis** in front of her tower to begin. Orientation is the Year 1 core class: four short lessons, each unlocking the next, then a last walk around the practicum trail before term ends. The first two lessons are just conversations that hand themselves in.' },
      { quest: 'story_orientation' },
      { quest: 'story_office_hours', note: 'Each Professor teaches a different lesson here (spending SP, spending AP, the second hotbar page, campus regeneration, what happens when you fall). Pick whichever School you are curious about; it does not commit you to anything.' },
      { quest: 'story_supplies', note: 'Bram\'s counter is the first menu option. Buy the scroll, then talk to him again to hand it in. You get it back with interest.' },
      { quest: 'story_first_practicum' },
      { tip: 'Hold {key:pickup} rather than tapping it: you scoop up everything in reach, one item after another. Pip, your owl familiar, also flies over and grabs drops near you.', title: 'Looting' },
      { quest: 'm1_orientation_5', note: 'This is where the story starts. Hand it in to Maelis and she passes Orientation and awards its crest.' },
    ],
  },
  {
    id: 'y1-whisperwood', part: Y1, title: 'Whisperwood and the Field Practicum',
    blocks: [
      { p: 'Whisperwood (levels {zlv:whisperwood}) is the Academy\'s outdoor classroom, and nearly every Year 1 class sends you here. Moss Snails are slow and never start a fight; Puff Slimes hop; Cap Shrooms on the upper ledges hit back. Climb the ropes with {key:up} to reach the upper tiers.' },
      { zone: 'whisperwood' },
      { p: 'Prefect Finn stands by the west portal and teaches the **Field Practicum**, an elective of three practicums and a bounty. Each practicum overlaps with what the samplers ask you to hunt, so run them side by side.' },
      { quests: ['q_finn_snails', 'q_finn_jelly', 'q_finn_shrooms'], title: 'Field Practicum: the first three missions' },
      { training: [1, 9] },
      { p: 'Every few minutes the ground starts flashing red: the **Mossback Matriarch** has woken. She is the Year 1 field boss and a real fight at her level. Her bounty is the practicum\'s last mission, so take it from Finn before you hunt her.' },
      { boss: 'mossback_matriarch' },
      { quest: 'q_bounty_mossback_matriarch' },
    ],
  },
  {
    id: 'y1-samplers', part: Y1, title: 'The School samplers',
    blocks: [
      { p: 'Each Professor teaches a Year 1 **sampler** of their School: three missions in Whisperwood and Shroom Hollow, with a little SP and some gear or potions for passing. They are electives open to every first-year. Pyra\'s is about fuel and fire, Glacius\'s about patience, Voltis\'s about speed, Seraphine\'s about looking after people and Morvane\'s is held after curfew. The missions for each are in the class lists above.' },
      { tip: 'Several sampler missions suggest the matching Year 1 primer spell (Frost Primer, Spark Primer, Practice Ward, Vital Ink). They live in the Year 1 spellbook; see [[the Year 1 Core Curriculum|#core]].', title: 'Primers' },
      { p: 'A sampler tells you more about a School than its spell list does. Its Professor also hints at what is going on in the Forbidden Wing, and Morvane\'s last mission is not the only one that glances at its doors.' },
    ],
  },
  {
    id: 'y1-shroom-hollow', part: Y1, title: 'Shroom Hollow',
    blocks: [
      { p: 'The end of Orientation and the later sampler missions walk you east of Whisperwood into **Shroom Hollow** (levels {zlv:shroom_hollow}). It is dark, crowded and full of mushrooms that fight back. Cap Shrooms carpet the west; Thorn Shrooms hold the middle; Stump Golems guard the east end, hit hard and are slow. Year 2 starts here too.' },
      { zone: 'shroom_hollow' },
      { quests: ['q_bram_spores'], title: 'Assignment (no class)' },
      { p: 'Bram\'s spore run belongs to no class. It pays like any mission but earns no badge, and it waits in the Assignments tab of the Classes window.' },
    ],
  },
  {
    id: 'y1-declaration', part: Y1, title: 'Declare your major',
    blocks: [
      { p: 'When your report card shows the Year passed and you are level {joblv:2} or higher, Headmistress Maelis offers **Declare my major**. Your major is your School: the spellbook you will study for the rest of your time at the Academy. The choice is for life and there are no transfers, so **talk to the Professors first** if you have not. The [[Five Schools|#schools]] chapter has every spell; here is the short version.' },
      { schools: true },
      { p: 'Declaring makes you a Year 2 student of that School, with its first title and bonus SP. Its Professor teaches your major class from now on, and every teacher\'s register fills with Year 2 classes.' },
      { tip: 'Spend your Year 1 SP before you declare. The core curriculum never stops being useful: Blink, Mana Font and Scholar\'s Insight help every School, and Arcane Bolt stays a fine opener.', title: 'Unspent SP' },
      { tip: 'Saves that picked up the old Declaration Day step before story mode can still finish it: Maelis hands over its cap and mesos when you declare. New students never see it.', title: 'Declaration Day' },
      { checklist: ['Orientation passed and the Year\'s badges in your case', 'Arcane Bolt trained up and a Blink learned', 'A stack of Red and Blue Potions on the hotbar', 'Your School chosen after its sampler, or at least a talk with its Professor'] },
    ],
  },

  // ───────────────────────────── Year 2 ─────────────────────────────
  {
    id: 'y2-term', part: Y2, title: 'The Year 2 term',
    blocks: [
      { p: 'Year 2 adds your **major**: one class per School, taught by its Professor, and you only see your own. It is required alongside the Headmistress\'s core class, which picks up the violet glow where Orientation left it. The electives are Finn\'s second field course, Tilda\'s first Artificing class and Bram\'s Alchemy.' },
      { year: 2 },
      { classes: 2 },
    ],
  },
  {
    id: 'y2-declared', part: Y2, title: 'Your first School spells',
    blocks: [
      { p: 'Open the spellbook ({key:skills}) and spend your new SP: every School\'s Year 2 page has several spells with no prerequisite at all, so you can pick a direction right away. Traps, marks and combo spells show up here too: a spell that cashes in a status says so in its effects ("removes it"). Each School in [[the Five Schools|#schools]] ends with suggested builds that fit real SP budgets.' },
      { p: 'Tilda now stocks your School\'s staff, and the ones for other Schools stay off her racks. A School staff adds that element\'s damage on top of Magic ATK. Classes pay gear too: the class table shows which.' },
      { shop: 'tilda' },
    ],
  },
  {
    id: 'y2-violet-thorns', part: Y2, title: 'Violet Thorns',
    blocks: [
      { p: 'The core class begins back in Shroom Hollow: the glow has left the Forbidden Wing\'s corridor and reached the mushrooms, and Finn has the first lead.' },
      { quest: 'story_violet_thorns' },
      { p: 'Finn\'s **Field Studies** elective starts in the same place: the Stump Golems at the east end of the Hollow, then its field boss. The **Shroom Monarch** is weak to Fire and Holy and does not care about poison.' },
      { quests: ['q_finn_stumps'], title: 'Field Studies: first mission' },
      { boss: 'shroom_monarch' },
      { quest: 'q_bounty_shroom_monarch' },
    ],
  },
  {
    id: 'y2-moonlit-marsh', part: Y2, title: 'The Moonlit Marsh',
    blocks: [
      { p: 'A side path off Shroom Hollow\'s upper ledges leads to the **Moonlit Marsh** (levels {zlv:moonlit_marsh}), a night-study bog of hummocks and rope-linked ledges. Field Studies spends two missions here and Bram\'s Alchemy class starts here. Bog Toads hop the ground, Thorn Shrooms squat beside them and Will-o\'-Wisps drift over the upper ledges. Wisps shrug off fire and poison; Holy and Lightning do the work. You return by the same portal.' },
      { zone: 'moonlit_marsh' },
      { quests: ['q_finn_lanterns'], title: 'Field Studies mission' },
    ],
  },
  {
    id: 'y2-frostfang', part: Y2, title: 'Frostfang Cliffs',
    blocks: [
      { p: 'Frostfang Cliffs (levels {zlv:frostfang_cliffs}) is a long climb of cliff steps and ice ledges, and the second half of most Year 2 classes happens here. Frost Bats flit along the lower ledges, Snow Yetis hold the ground, and Ice Wisps drift on the upper ledges. Fire is welcome everywhere here.' },
      { zone: 'frostfang_cliffs' },
      { training: [15, 25] },
      { image: 'frostfang-pillar.jpg', alt: 'A Flamebinder casting Inferno Pillar on two Snow Yetis on Frostfang Cliffs', caption: 'A Year 3 Flamebinder\'s Inferno Pillar on the Snow Yetis of Frostfang Cliffs.' },
      { quests: ['q_tilda_wings'], title: 'Artificing mission' },
      { p: 'At level {qlv:story_pages_in_snow}, Professor Glacius has the core class\'s next step: the faculty\'s sealed notes are missing pages, and the Ice Wisps here drank their ink.' },
      { quest: 'story_pages_in_snow' },
      { p: 'The **Frostfang Alpha** is the cliffs\' field boss. Its bounty belongs to no class this time, so it pays but earns no badge.' },
      { boss: 'frostfang_alpha' },
      { quest: 'q_bounty_frostfang_alpha' },
    ],
  },
  {
    id: 'y2-finals', part: Y2, title: 'Major finals and promotion',
    blocks: [
      { p: 'Your major ends with a final set by your Professor: a collection run, mostly on Frostfang Cliffs (Ice students head one zone further east to the Cinder Caverns). Hand it in and your Professor passes your major on the spot.' },
      { finals: 2 },
      { tip: 'Collection items stack in your bag before you take the mission, so anything you looted on the way counts the moment you accept it.', title: 'Head start' },
      { p: 'With the core class, your major and enough electives passed, and at level {joblv:3} or higher, Maelis holds your **promotion ceremony**. You take your School\'s Year 3 title and its bonus SP.' },
    ],
  },

  // ───────────────────────────── Year 3 ─────────────────────────────
  {
    id: 'y3-term', part: Y3, title: 'The Year 3 term',
    blocks: [
      { p: 'Year 3 sends you further out: Glacier Grotto under the cliffs, the Cinder Caverns, the Restricted Stacks above the Headmistress\'s tower and finally Stormspire Peak. Maelis teaches two classes this Year, the core seminar and Library Sciences.' },
      { year: 3 },
      { classes: 3 },
    ],
  },
  {
    id: 'y3-faculty', part: Y3, title: 'The Faculty Meeting',
    blocks: [
      { p: 'The core seminar opens with an invitation to the faculty table. Maelis finally tells the story of the Forbidden Wing: the Archmage who wanted magic that never forgets, the Lich that came back, and the five-verse seal every Professor keeps.' },
      { quest: 'story_faculty_meeting' },
    ],
  },
  {
    id: 'y3-glacier-grotto', part: Y3, title: 'The Glacier Grotto',
    blocks: [
      { p: 'A cave mouth on the ice step in Frostfang Cliffs leads down to the **Glacier Grotto** (levels {zlv:glacier_grotto}), blue ice under the range. Advanced Bestiary starts here, and Applied Economics comes down for its second mission. Crystal Crabs scuttle the floor and steps, Ice Wisps and Frost Shades haunt the ledges above. Crabs are weak to Lightning and resist frost, so Cryomancers bring a second spell. You return by the same portal.' },
      { zone: 'glacier_grotto' },
      { quests: ['q_glacius_geodes'], title: 'Assignment (no class)' },
    ],
  },
  {
    id: 'y3-cinder', part: Y3, title: 'Cinder Caverns',
    blocks: [
      { p: 'Cinder Caverns (levels {zlv:cinder_caverns}) is hot, tall and dangerous. Ember Imps hop around the west, Lava Salamanders run the middle, and Magma Golems wall off the east. Everything here resists Fire: Fire students should bring Mana Elixirs and patience, Ice students will feel at home.' },
      { zone: 'cinder_caverns' },
      { training: [25, 35] },
      { quest: 'story_ash_and_ink' },
      { quests: ['q_maelis_scales', 'q_bram_cores'], title: 'Elective missions here' },
      { p: '**Magmaw** is the Caverns\' field boss, and its bounty is a mission of Finn\'s Advanced Bestiary.' },
      { boss: 'magmaw' },
      { quest: 'q_bounty_magmaw' },
    ],
  },
  {
    id: 'y3-restricted-stacks', part: Y3, title: 'The Restricted Stacks',
    blocks: [
      { p: 'The Academy\'s forbidden library is reached by a portal at the top of the Headmistress\'s tower on the Academy Grounds. Library Sciences lives here, and the core seminar ends here. Nothing locks it, but the shelves are tuned for levels {zlv:restricted_stacks}. Animated Tomes fly the aisles, Ink Golems hold the floor and Void Wisps float under the vaults. Shadow students bring curses; Fire and Holy shine. You return by the same portal.' },
      { zone: 'restricted_stacks' },
      { quests: ['q_maelis_overdue'], title: 'Library Sciences mission' },
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
    id: 'y3-finals', part: Y3, title: 'Major finals and promotion',
    blocks: [
      { p: 'Your Year 3 major ends with a hunt and a collection on Stormspire Peak or in the Cinder Caverns. Pass it, pass the seminar and enough electives, reach level {joblv:4}, and Maelis promotes you into the Final Year with your graduate title.' },
      { finals: 3 },
    ],
  },

  // ───────────────────────────── Year 4 ─────────────────────────────
  {
    id: 'y4-term', part: Y4, title: 'The Final Year term',
    blocks: [
      { p: 'The Final Year\'s core class is your **Final Thesis**: into the Forbidden Wing, the Lich Archon, and Commencement. Graduating is part of the class, not the end of the game. Your major ends with the Fellowship Exam, which only graduates may sit.' },
      { year: 4 },
      { classes: 4 },
    ],
  },
  {
    id: 'y4-tempest', part: Y4, title: 'The Tempest Wyrm',
    blocks: [
      { p: 'The last field boss circles the top of Stormspire Peak. It is the toughest of the five, drops a rare Seal Fragment besides its trophy, and its bounty closes Finn\'s Stormspire practicum.' },
      { boss: 'tempest_wyrm' },
      { quest: 'q_bounty_tempest_wyrm' },
      { quests: ['q_tilda_drakes'], title: 'Storm-Forged Artificing mission' },
    ],
  },
  {
    id: 'y4-forbidden', part: Y4, title: 'The Forbidden Wing',
    blocks: [
      { p: 'Professor Morvane holds the only key. Past Stormspire Peak lies the **Arcane Sanctum** (levels {zlv:arcane_sanctum}): a short hall of violet glass with Void Wisps on every ledge and the Lich Archon in the middle of the floor. A portal at its east end leads straight home to campus.' },
      { zone: 'arcane_sanctum' },
      { quest: 'story_forbidden_wing' },
      { quests: ['q_maelis_void'], title: 'Sanctum Containment mission' },
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
  {
    id: 'grad-commencement', part: Y4, title: 'Commencement',
    blocks: [
      { p: 'Bring the Sigil to Maelis and she calls the whole Academy together. Step forward to graduate: the credits roll, and the faculty votes you a pile of Academy Merits to spend at Bram\'s Merit Exchange. Commencement is the thesis class\'s last mission, so it also passes the core class.' },
      { quest: 'story_commencement' },
    ],
  },
  {
    id: 'y4-finals', part: Y4, title: 'The Fellowship Exam',
    blocks: [
      { p: 'Your Final Year major ends with the postgraduate **Fellowship Exam**. It opens at level {joblv:5} and only for graduates, and its targets live in the Fellowship\'s maps past the Arcane Sanctum (below). Pass it and the rest of the Year, and Maelis promotes you to **Archon**, the fifth and last title of your School. The level cap is ' + MAX_LEVEL + '.' },
      { finals: 4 },
      { training: [46, 55] },
    ],
  },

  // ───────────────────────────── Year 5 ─────────────────────────────
  {
    id: 'y5-term', part: Y5, title: 'The Fellowship term',
    blocks: [
      { p: 'The Archon\'s book was never finished, and the Fellowship\'s classes go after it, up through the Astral Observatory, the Void Rift and the Archon Spire. Your Archon title adds a new page of spells to your School; see [[the Five Schools|#schools]] for every table.' },
      { year: 5 },
      { classes: 5 },
    ],
  },
  {
    id: 'y5-observatory', part: Y5, title: 'The Astral Observatory',
    blocks: [
      { p: 'A portal in the Arcane Sanctum climbs above the clouds to the **Astral Observatory** (levels {zlv:astral_observatory}). Astral Sentinels hold the floor and the dais, and Star Moths drift over the high ledges.' },
      { zone: 'astral_observatory' },
      { training: [50, 57] },
    ],
  },
  {
    id: 'y5-rift', part: Y5, title: 'The Void Rift',
    blocks: [
      { p: 'East of the Observatory the world is torn open. The **Void Rift** (levels {zlv:void_rift}) is floating shards and broken ledges: Rift Stalkers prowl the floor, Null Wisps drift over the ledges, and Shard Horrors guard the shard rocks.' },
      { zone: 'void_rift' },
      { training: [57, 64] },
    ],
  },
  {
    id: 'y5-spire', part: Y5, title: 'The Archon Spire and The Unwritten',
    blocks: [
      { p: 'The last portal leads to the **Archon Spire** (levels {zlv:archon_spire}), a gold-and-violet tower. Archon Knights and Unwritten Pages hold the galleries; at the top, across one wide arena floor, waits the raid boss **The Unwritten**. Defeating it is the Fellowship core class\'s last mission. A portal on the east side leads back to campus.' },
      { zone: 'archon_spire' },
      { training: [64, 70] },
      { boss: 'the_unwritten', note: 'It is weak to nothing and resists nothing, so every School is a valid answer.' },
      { checklist: ['Archon title and your newest spells trained', 'Potions on both hotbar pages', 'Every ultimate off cooldown', 'The galleries cleared of Pages before you reach the arena'] },
    ],
  },
  {
    id: 'y5-finale', part: Y5, title: 'The last ceremony',
    blocks: [
      { p: 'Pass the Fellowship\'s core class and enough other badges and the report card is complete. Maelis then offers **The Fellowship\'s last ceremony**: she calls the faculty together one more time and names you a Fellow of your School. The ceremony counts once per save, and with it the story is complete.' },
    ],
  },

  // ───────────────────────────── After the story ─────────────────────────────
  {
    id: 'grad-after', part: AFTER, title: 'After the story',
    blocks: [
      { p: 'Neither graduation nor the Fellowship ends the save. The Lich Archon returns some minutes after he falls, and Maelis keeps a repeatable bounty on him. Prefect Finn re-posts every Field Bounty you hand in. And the [[Trial Hall|#trial-hall]] keeps paying Merits for every wave you clear, for the Merit Exchange\'s rare field-boss accessories.' },
      { quests: ['q_maelis_archon'], title: 'Repeatable' },
      { shop: 'merit' },
      { tip: 'Want to try another build? A Tome of Unlearning refunds one Year of spells. See [[Respec|#respec]].', title: 'Rebuild' },
    ],
  },
];
