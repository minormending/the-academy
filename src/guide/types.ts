// The handbook's content contract (docs/GUIDE.md). Writers fill src/guide/walkthrough.ts with Sections;
// the page (src/guide/) renders them, expanding the data blocks (`zone`, `quest`, `boss`…) from the game's own
// modules so tables, pictures and numbers never drift from the build. Never type a number a block can show.

import type { School } from '../data/jobs';

/** One block of a walkthrough section, rendered in order. */
export type Block =
  /** A paragraph. Inline: **bold** and [[text|#anchor]] links. */
  | { p: string }
  /** A boxed hint (strategy, missables, shortcuts). */
  | { tip: string; title?: string }
  /** A bullet list. */
  | { list: string[] }
  /** "Before you move on" checklist. */
  | { checklist: string[] }
  /**
   * A zone panel built from the map data: the map drawn from its platforms, ropes, portals, NPCs and spawns,
   * its level range, where its portals lead, and every monster with its level, HP, EXP and drops.
   */
  | { zone: string; note?: string }
  /** A quest card: giver, level, prerequisite step, objectives and rewards (story steps, exams, assignments). */
  | { quest: string; note?: string }
  /** A compact table of quests (assignments, bounties). */
  | { quests: string[]; title?: string }
  /** A boss card: sprite, stats, matchups, drops, its attacks and a strategy (field bosses and the Lich Archon). */
  | { boss: string; note?: string }
  /** A Year-end Exam table for every School (Year 3 or Year 4). */
  | { exams: 3 | 4 }
  /** The five Schools side by side: Year 2–4 titles and portraits, Professor, identity. */
  | { schools: true }
  /** One School's identity card (portraits per Year, Professor, link to its spell tables). */
  | { school: School }
  /** Training planner: every zone and monster worth hunting between these levels, ranked by EXP per HP. */
  | { training: [number, number] }
  /** A staff member: portrait, title, where they stand and what they offer. */
  | { npc: string; note?: string }
  /** A shop's stock and prices: Quartermaster Bram, Armorer Tilda, or the Merit Exchange. */
  | { shop: 'bram' | 'tilda' | 'merit' }
  /** A picture from the game (path under public/guide/). */
  | { image: string; alt: string; caption?: string };

export interface Section {
  /** Stable anchor, e.g. "y1-orientation" (lower case, digits and hyphens, unique). */
  id: string;
  /** Part heading this section belongs to, e.g. "Year 1 · Apprentice". */
  part: string;
  title: string;
  blocks: Block[];
}
