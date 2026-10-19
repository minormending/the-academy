// The Academy's Official Student Handbook (guide.html): the walkthrough in src/guide/walkthrough.ts, expanded
// with the game's own data and art, then the reference chapters. See docs/GUIDE.md.

import './guide.css';
import { Registry } from '../core/registry';
import { SCHOOLS } from '../data/jobs';
import { initArt, iconImg, monsterImg } from './art';
import { renderAllPending, renderBlock } from './blocks';
import { buildGuide, type Guide } from './context';
import { h } from './dom';
import { contents, cover, howToPlay, partsOf } from './front';
import { assignmentsSection, atlas, bestiary, honorsSection, itemsSection, progressionSection, staffSection, studentLife, trialHall, type RefSection } from './reference';
import { coreSection, schoolsSection } from './schools';
import { anchor, schoolName, sectionHeading } from './ui';
import { validate } from './validate';
import { WALKTHROUGH } from './walkthrough';

const THEME_KEY = 'academy.guide.theme';

function applyTheme(t: string | null) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

function themeToggle(): HTMLElement {
  let saved: string | null = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch { /* storage unavailable */ }
  applyTheme(saved);
  const b = h<HTMLButtonElement>('button.icon-btn', { type: 'button', 'aria-label': 'Switch between day and night', title: 'Day / night' });
  b.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M10.5 1.5a6.5 6.5 0 1 0 4 11.6A5.5 5.5 0 0 1 10.5 1.5z"/></svg>';
  b.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* storage unavailable */ }
  });
  return b;
}

// ─────────────────────────── search ───────────────────────────

interface Hit { label: string; kind: string; href: string; key: string; pic?: () => HTMLElement }

function searchIndex(g: Guide, refs: RefSection[]): Hit[] {
  const hits: Hit[] = [];
  const add = (label: string, kind: string, href: string, pic?: () => HTMLElement) => hits.push({ label, kind, href, key: label.toLowerCase(), pic });
  for (const m of g.monsters) add(m.name, m.boss ? 'Boss' : `Monster · Lv ${m.level}`, `#${anchor.monster(m.id)}`, () => monsterImg(m.id, 24));
  for (const i of g.items) add(i.name, i.type === 'equip' ? 'Equipment' : i.type === 'consumable' ? 'Consumable' : 'Material', `#${anchor.item(i.id)}`, () => iconImg(i.icon, 20));
  for (const s of g.skills) add(s.name, `Spell · ${Registry.job(s.job)?.name ?? ''}`, `#${anchor.spell(s.id)}`, () => iconImg(s.icon, 20));
  for (const m of g.maps) add(m.name, 'Map', `#${anchor.map(m.id)}`);
  for (const q of g.quests) add(q.name, 'Quest', `#${anchor.quest(q.id)}`);
  for (const n of g.npcs) add(n.name, n.title ?? 'Staff', `#${anchor.npc(n.id)}`);
  for (const j of g.jobs) if (j.tier > 1) add(j.name, `Year ${j.tier} title`, `#spells-${j.id}`);
  for (const s of SCHOOLS) add(`School of ${schoolName(s)}`, 'School', `#${anchor.school(s)}`);
  for (const s of g.sections) add(s.title, s.part, `#${s.id}`);
  for (const r of refs) add(r.title, 'Chapter', `#${r.id}`);
  return hits;
}

function searchBox(g: Guide, refs: RefSection[]): HTMLElement {
  const index = searchIndex(g, refs);
  const input = h<HTMLInputElement>('input.search', { type: 'search', placeholder: 'Search spells, monsters, items…', 'aria-label': 'Search the handbook', autocomplete: 'off' });
  const list = h('ul.search-results', { role: 'listbox', hidden: true });
  const go = (href: string) => {
    list.hidden = true; input.value = ''; input.blur();
    const el = document.getElementById(href.slice(1));
    if (el) { history.replaceState(null, '', href); el.scrollIntoView(); flash(el); }
  };
  const update = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { list.hidden = true; return; }
    const found = index.filter(x => x.key.includes(q) && document.getElementById(x.href.slice(1)))
      .sort((a, b) => Number(!a.key.startsWith(q)) - Number(!b.key.startsWith(q)) || a.key.localeCompare(b.key)).slice(0, 14);
    list.replaceChildren(...(found.length
      ? found.map(x => h('li', h('a', { href: x.href, role: 'option', onclick: (e: Event) => { e.preventDefault(); go(x.href); } },
        h('span.sr-pic', x.pic ? x.pic() : null), h('span.sr-label', x.label), h('small', x.kind))))
      : [h('li.muted', 'No matches')]));
    list.hidden = false;
  };
  input.addEventListener('input', update);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const a = list.querySelector('a'); if (a) go(a.getAttribute('href')!); }
    if (e.key === 'Escape') { input.value = ''; list.hidden = true; }
    if (e.key === 'ArrowDown') { (list.querySelector('a') as HTMLElement | null)?.focus(); e.preventDefault(); }
  });
  list.addEventListener('keydown', e => {
    const a = document.activeElement as HTMLElement | null;
    const li = a?.closest('li');
    if (e.key === 'ArrowDown') { (li?.nextElementSibling?.querySelector('a') as HTMLElement | null)?.focus(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { const prev = li?.previousElementSibling?.querySelector('a') as HTMLElement | null; (prev ?? input).focus(); e.preventDefault(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); input.focus(); }
  });
  document.addEventListener('click', e => { if (!(e.target as HTMLElement).closest('.search-wrap')) list.hidden = true; });
  return h('div.search-wrap', input, list);
}

/** Briefly highlight a jump target (opening its <details> on the way). */
function flash(el: HTMLElement) {
  el.closest('details')?.setAttribute('open', '');
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

function printButton(): HTMLElement {
  const b = h<HTMLButtonElement>('button.icon-btn', { type: 'button', title: 'Print the handbook (draws every map first)', 'aria-label': 'Print' });
  b.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6V2h8v4M4 12H2V6h12v6h-2M4 9h8v5H4z"/></svg>';
  b.addEventListener('click', async () => {
    b.disabled = true;
    await renderAllPending();
    b.disabled = false;
    print();
  });
  return b;
}

function topbar(g: Guide, refs: RefSection[]): HTMLElement {
  const quick: [string, string][] = [['#walkthrough', 'Walkthrough'], ['#schools', 'Schools'], ['#bestiary', 'Bestiary'], ['#atlas', 'Atlas'], ['#items', 'Items'], ['#trial-hall', 'Trial Hall']];
  return h('div.topbar',
    h('a.brand', { href: '#top' }, h('span.crest', { 'aria-hidden': 'true' }), h('span', 'The Academy'), h('small', 'Handbook')),
    h('nav.quick', { 'aria-label': 'Chapters' }, h('a', { href: '#contents' }, 'Contents'), quick.map(([href, label]) => h('a', { href }, label))),
    searchBox(g, refs),
    printButton(),
    themeToggle(),
  );
}

function walkthrough(g: Guide): HTMLElement {
  const parts = partsOf(g);
  return h('section.walkthrough', { id: 'walkthrough' },
    h('h2.part-title', h('span.kicker', 'Part one'), 'Walkthrough'),
    h('p.lead', 'Four school Years, from enrolment to the Final Thesis. Every table, map and number below is read from the game.'),
    parts.map(p => h('section.part', { id: p.id },
      h('h2.part-head', h('span.kicker', 'Walkthrough'), p.part),
      p.sections.map(s => h('section.wt', { id: s.id },
        sectionHeading(3, `${s.id}-h`, s.title),
        s.blocks.map(b => renderBlock(g, b)),
      )),
    )),
  );
}

async function boot() {
  const root = document.getElementById('guide')!;
  await initArt();
  const g = buildGuide(WALKTHROUGH);
  const refs: RefSection[] = [
    coreSection(g), schoolsSection(g), bestiary(g), atlas(g), staffSection(g), itemsSection(g), trialHall(g),
    studentLife(g), honorsSection(), assignmentsSection(g), progressionSection(),
  ];
  const problems = validate(g, WALKTHROUGH);
  if (problems.length) console.warn(`[guide] ${problems.length} problem(s):\n${problems.join('\n')}`);
  root.replaceChildren(
    topbar(g, refs),
    h('main.page',
      import.meta.env.DEV && problems.length ? h('div.dev-problems', h('strong', `Handbook check: ${problems.length} problem(s)`), h('ul', problems.map(p => h('li', p)))) : null,
      cover(g),
      contents(g, refs),
      howToPlay(g),
      walkthrough(g),
      h('div.reference', { id: 'reference' }, h('h2.part-title', h('span.kicker', 'Part two'), 'Reference'), refs.map(r => r.el)),
      h('footer.foot',
        h('p', 'Every table, picture and number in this handbook is generated in your browser from the game\'s own data modules and art, so it always matches the build.'),
        h('p', h('a', { href: './' }, 'Play The Academy'), ' · ', h('a', { href: './devdocs.html' }, 'Developer docs'), ' · ', h('a', { href: '#top' }, 'Back to top')),
      ),
    ),
  );
  addEventListener('beforeprint', () => {
    for (const d of Array.from(document.querySelectorAll('details'))) d.open = true;
  });
  addEventListener('hashchange', () => { const el = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el) flash(el); });
  // Honour a deep link now that the page exists.
  if (location.hash) {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el) { el.scrollIntoView(); flash(el); }
  }
}

boot().catch(e => {
  console.error(e);
  document.getElementById('guide')!.textContent = 'The handbook failed to load. Please reload the page.';
});
