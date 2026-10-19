// Front matter: the cover, "How to play" and the table of contents. Keys come from the default bindings
// (src/core/bindings.ts) and the gamepad map (src/systems/GamepadBridge.ts); the starting kit from
// newPlayerState; stat effects by asking the stat formula what one more point of each stat does.

import type { BaseStatKey, DerivedStatKey, PlayerState } from '../core/types';
import { Registry } from '../core/registry';
import { ACTIONS, DEFAULT_BINDINGS, keyLabel, type ActionGroup, type ActionId } from '../core/bindings';
import { HOTBAR_PAGE_SIZE } from '../core/types';
import { JOB_LEVELS, MAX_LEVEL } from '../core/constants';
import { AP_PER_LEVEL, SP_PER_LEVEL } from '../core/balance';
import { GAMEPAD_MAP } from '../systems/GamepadBridge';
import { newPlayerState } from '../systems/SaveSystem';
import { baseDerived, computeDerived } from '../systems/progression/stats';
import { SCHOOLS } from '../data/jobs';
import { h } from './dom';
import { assetImage, guideAsset, jobImg } from './art';
import type { Guide } from './context';
import { schoolJobs } from './context';
import type { RefSection } from './reference';
import { STATUS_INFO, anchor, itemLink, keyName, num, pct, schoolName, spellLink, statusPill } from './ui';

// ─────────────────────────── cover ───────────────────────────

/** The title screen's night sky over the Headmistress's tower, composed from the same PNGs. */
function coverArt(): HTMLCanvasElement {
  const W = 400, H = 225;
  const c = h<HTMLCanvasElement>('canvas.cover-canvas.px', { width: W, height: H, role: 'img', 'aria-label': 'The Academy at night: the Headmistress\'s tower under a crescent moon' });
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0e0822';
  ctx.fillRect(0, 0, W, H);
  void (async () => {
    const [sky, stars, moon, far, mid, tower] = await Promise.all([
      assetImage('world/bg/sanctum_sky.png'), assetImage('world/fx/w_stars.png'), assetImage('world/fx/w_moon.png'),
      assetImage('world/bg/sanctum_far.png'), assetImage('world/bg/sanctum_mid.png'), assetImage('world/town/t_tower.png'),
    ]);
    if (sky) for (let x = 0; x < W; x += sky.naturalWidth) ctx.drawImage(sky, x, H - sky.naturalHeight);
    if (stars) { ctx.globalAlpha = 0.8; for (let x = 0; x < W; x += stars.naturalWidth) ctx.drawImage(stars, x, 0); ctx.globalAlpha = 1; }
    if (moon) ctx.drawImage(moon, W - 70, 22);
    if (far) for (let x = -40; x < W; x += far.naturalWidth) ctx.drawImage(far, x, H - far.naturalHeight + 40);
    if (mid) for (let x = -80; x < W; x += mid.naturalWidth) ctx.drawImage(mid, x, H - mid.naturalHeight + 60);
    if (tower) ctx.drawImage(tower, 0, 0, tower.naturalWidth, tower.naturalHeight, W - 150, H - tower.naturalHeight * 0.75, tower.naturalWidth * 0.75, tower.naturalHeight * 0.75);
  })();
  return c;
}

export function cover(g: Guide): HTMLElement {
  const grads = SCHOOLS.map(s => schoolJobs(s).at(-1)!).filter(Boolean);
  const spells = g.skills.length;
  return h('header.cover', { id: 'top' },
    coverArt(),
    h('div.cover-inner',
      h('div.logo',
        h('div.logo-orn', { 'aria-hidden': 'true' }),
        h('div.logo-the', 'The'),
        h('h1.logo-text', 'Academy'),
        h('div.logo-sub', 'Official Student Handbook'),
      ),
      h('p.tagline', 'The complete guide: a Year-by-Year walkthrough, all five Schools and every spell, the full bestiary, every map and every item, generated from the game itself.'),
      h('div.cover-class', h('figure', jobImg('apprentice', 1), h('figcaption', 'Apprentice')), grads.map(j => h('a', { href: `#${anchor.school(j.branch as never)}`, title: j.name }, h('figure', jobImg(j.id, 1), h('figcaption', j.name))))),
      h('p.cover-stats',
        `${SCHOOLS.length} Schools · ${spells} spells · ${g.monsters.length} monsters · ${g.maps.length} maps · ${g.items.length} items · ${g.quests.length} quests`),
      h('p.cover-play', h('a.button', { href: './' }, '▶ Play The Academy')),
    ),
  );
}

// ─────────────────────────── controls ───────────────────────────

const padFor = (a: ActionId) => GAMEPAD_MAP.filter(m => m.actions.includes(a)).map(m => m.input);
const keyOf = (a: ActionId) => keyLabel(DEFAULT_BINDINGS[a] ?? 0);

function controlsTable(): HTMLElement {
  const groups: ActionGroup[] = ['Movement', 'Actions', 'Windows'];
  return h('div.scroll', h('table.controls',
    h('thead', h('tr', h('th', 'Action'), h('th', 'Keyboard'), h('th', 'Gamepad'))),
    groups.map(gr => h('tbody',
      h('tr.group', h('th', { colspan: 3 }, gr)),
      ACTIONS.filter(a => a.group === gr).map(a => h('tr',
        h('td', a.label),
        h('td', h('kbd', keyOf(a.id))),
        h('td.small', padFor(a.id).join(' · ') || h('span.muted', '—')),
      )),
    )),
  ));
}

/** The hotbar as it sits on screen: top row and bottom row, each key with its gamepad input. */
function hotbarDiagram(): HTMLElement {
  const top = [0, 1, 2, 3, 4, 10], bottom = [5, 6, 7, 8, 9, 11];
  const slot = (i: number) => {
    const a = `slot${i}` as ActionId;
    const pad = padFor(a)[0];
    const what = i === 0 ? 'Arcane Bolt' : i === 10 ? 'Red Potion' : i === 11 ? 'Blue Potion' : '';
    return h('div.hb-slot', h('kbd', keyOf(a)), what ? h('small', what) : null, pad ? h('span.pad', pad.replace(/ \/.*$/, '')) : null);
  };
  return h('div.hotbar-diagram',
    h('div.hb-row', top.map(slot)),
    h('div.hb-row', bottom.map(slot)),
    h('p.small', `${HOTBAR_PAGE_SIZE} slots per page and two pages: `, h('kbd', keyOf('hotbarPage')), ' flips. The last two keys of each page start with potions, so they keep working after a flip.'),
  );
}

// ─────────────────────────── starting kit ───────────────────────────

function startingKit(): HTMLElement {
  const s: PlayerState = newPlayerState('Student');
  const d = computeDerived(s);
  const eq = Object.values(s.equipment).filter(Boolean);
  return h('div.kit',
    h('div.kit-art', jobImg('apprentice', 2)),
    h('dl.facts',
      h('dt', 'Level'), h('dd', `${s.level} ${Registry.job(s.job)?.name ?? ''}`),
      h('dt', 'Stats'), h('dd', `INT ${s.base.int} · LUK ${s.base.luk} · STR ${s.base.str} · DEX ${s.base.dex}`),
      h('dt', 'HP / MP'), h('dd', `${num(d.maxHp)} / ${num(d.maxMp)}`),
      h('dt', 'Magic ATK'), h('dd', num(d.matk)),
      h('dt', 'Spells'), h('dd', Object.entries(s.skills).map(([id, lv], i) => [i ? ', ' : '', spellLink(id), ` Lv ${lv}`]), ` and ${s.sp} SP to spend`),
      h('dt', 'Wearing'), h('dd', eq.map((st, i) => [i ? ', ' : '', itemLink(st!.itemId)])),
      h('dt', 'Bag'), h('dd', s.inventory.map((st, i) => [i ? ', ' : '', itemLink(st.itemId, true, st.qty)]), ` and ${num(s.mesos)} mesos`),
    ),
  );
}

/** What one more point of each stat buys, asked of the game's own stat formula. */
function apTable(): HTMLElement {
  const base = newPlayerState('Student');
  const b0 = baseDerived(base);
  const LABEL: Partial<Record<DerivedStatKey, [string, boolean]>> = {
    maxHp: ['Max HP', false], maxMp: ['Max MP', false], matk: ['Magic ATK', false], def: ['DEF', false],
    critRate: ['Crit rate', true], mastery: ['Mastery', true], hpRegen: ['HP regen', false], mpRegen: ['MP regen', false],
  };
  const stats: BaseStatKey[] = ['int', 'luk', 'dex', 'str'];
  return h('div.scroll', h('table.compact',
    h('thead', h('tr', h('th', '+1 point'), h('th', 'Gives'))),
    h('tbody', stats.map(k => {
      const st = { ...base, base: { ...base.base, [k]: base.base[k] + 1 } };
      const b1 = baseDerived(st);
      const parts = (Object.keys(LABEL) as DerivedStatKey[]).map(key => {
        const dlt = b1[key] - b0[key];
        if (Math.abs(dlt) < 1e-9) return null;
        const [lab, frac] = LABEL[key]!;
        return `${lab} +${frac ? pct(dlt, 1) : +dlt.toFixed(2)}`;
      }).filter(Boolean);
      return h('tr', h('th', k.toUpperCase()), h('td', parts.join(', ')));
    })),
  ));
}

export function howToPlay(g: Guide): HTMLElement {
  return h('section.how', { id: 'how-to-play' },
    h('h2', h('span.kicker', 'Before your first lesson'), 'How to play'),
    h('div.how-grid',
      h('div.card.wide',
        h('h3', 'Controls'),
        controlsTable(),
        h('p.small', 'Up both climbs and talks: stand at a rope, ladder, portal or person and press ', h('kbd', keyName('up')), '. Hold ', h('kbd', keyName('down')), ' and jump to drop through a ledge. Every key can be rebound in ', h('kbd', keyName('menu')), ' → Controls; a standard gamepad follows your bindings.'),
      ),
      h('div.card',
        h('h3', 'The hotbar'),
        hotbarDiagram(),
        h('p.small', 'Learning a new castable spell drops it on the first free slot. Drag spells from the spellbook and potions from the bag to rearrange. Spells repeat while you hold their key.'),
      ),
      h('div.card.wide',
        h('h3', 'The screen'),
        h('figure.shot.hud', h('img', { src: guideAsset('campus-hud.jpg'), alt: 'The game screen on campus: minimap top left, chat log and status bar along the bottom, quick menu and hotbar bottom right', loading: 'lazy', width: 800, height: 450 })),
        h('ul.list.small.hud-list',
          h('li', h('strong', 'Status bar'), ' (bottom): level, name and School title, HP and MP gauges, and the EXP bar along the very bottom.'),
          h('li', h('strong', 'Hotbar'), ' (bottom right): two rows of six, with potions on the last two keys.'),
          h('li', h('strong', 'Quick menu'), ' (beside the hotbar): character sheet, bag, spellbook, assignments, help and menu.'),
          h('li', h('strong', 'Buff tray'), ': active buffs with time left. A red vignette warns you when HP runs low.'),
          h('li', h('strong', 'Minimap'), ' (top left, ', h('kbd', keyName('minimap')), '): the map\'s shape, portals and where you are.'),
          h('li', h('strong', 'Chat log'), ' (bottom left): loot, EXP, level-ups and quest updates.'),
          h('li', h('strong', 'Pip'), ', your owl familiar, flutters at your shoulder and collects nearby loot.'),
          h('li', 'A yellow ', h('strong', '!'), ' over someone means they have something new for you; the hand-in mark means you can turn a quest in.'),
        ),
      ),
      h('div.card',
        h('h3', 'Your first day'),
        startingKit(),
      ),
      h('div.card',
        h('h3', 'Growing up'),
        h('ul.list.small',
          h('li', `Every level: ${SP_PER_LEVEL} SP for spells (`, h('kbd', keyName('skills')), `) and ${AP_PER_LEVEL} AP for stats (`, h('kbd', keyName('stats')), '). Auto puts AP into INT and LUK for you.'),
          h('li', `Level ${JOB_LEVELS[2]}: declare a School. Levels ${JOB_LEVELS[3]} and ${JOB_LEVELS[4]}: Year-end Exams. Level cap ${MAX_LEVEL}.`),
        ),
        apTable(),
      ),
      h('div.card',
        h('h3', 'How spells hit'),
        h('p.small', 'Each hit is your Magic ATK × the spell\'s damage % × a roll between your mastery and 100%, raised by your damage bonuses, then minus the monster\'s DEF. A critical hit adds your crit damage. A monster\'s weakness takes 50% more, a resistance half.'),
        h('p.small', 'Statuses:'),
        h('ul.plain.small', (Object.keys(STATUS_INFO) as (keyof typeof STATUS_INFO)[]).map(k => h('li', statusPill(k), ' ', STATUS_INFO[k].what))),
      ),
      h('div.card',
        h('h3', 'Study tips'),
        h('ul.list.small',
          h('li', 'Keep potions on the hotbar and drink early. Falling costs EXP and sends you back to campus.'),
          h('li', 'Rest on campus between outings: HP and MP come back faster there.'),
          h('li', 'Carry a Return Scroll. The walk home from the Cinder Caverns is long.'),
          h('li', 'Hunt monsters weak to your School. The Five Schools chapter lists them for each.'),
          h('li', 'When the ground flashes red, move. Every boss attack is marked before it lands.'),
          h('li', 'Collection quests count what is already in your bag, so loot everything.'),
        ),
      ),
    ),
  );
}

// ─────────────────────────── contents ───────────────────────────

export function partsOf(g: Guide): { part: string; id: string; sections: Guide['sections'] }[] {
  const parts: { part: string; id: string; sections: Guide['sections'] }[] = [];
  for (const s of g.sections) {
    let p = parts.find(x => x.part === s.part);
    if (!p) { p = { part: s.part, id: `part-${parts.length + 1}`, sections: [] }; parts.push(p); }
    p.sections.push(s);
  }
  return parts;
}

export function contents(g: Guide, refs: RefSection[]): HTMLElement {
  const parts = partsOf(g);
  return h('nav.toc', { id: 'contents', 'aria-label': 'Table of contents' },
    h('h2', h('span.kicker', 'Contents'), 'In this handbook'),
    h('div.toc-cols',
      h('div',
        h('h3', h('a', { href: '#how-to-play' }, 'How to play')),
        h('h3', h('a', { href: '#walkthrough' }, 'Walkthrough')),
        h('ol.toc-parts', parts.map(p => h('li',
          h('a.toc-part', { href: `#${p.id}` }, p.part),
          h('ol', p.sections.map(s => h('li', h('a', { href: `#${s.id}` }, s.title)))),
        ))),
      ),
      h('div',
        h('h3', 'Reference'),
        h('ol.toc-refs', refs.map(r => h('li', h('a', { href: `#${r.id}` }, r.title),
          r.id === 'schools' ? h('ol', SCHOOLS.map(s => h('li', h('a', { href: `#${anchor.school(s)}` }, `School of ${schoolName(s)}`)))) : null,
        ))),
      ),
    ),
  );
}
