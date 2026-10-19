/**
 * Graduation credits (Phase 6 UI wiring). Mounted by UIRoot; armed when the graduation quest is handed in for the
 * first time. A full-screen pixel overlay: logo -> "Graduation Day" -> the student's card -> a word from
 * Headmistress Maelis -> a slow credits roll (design & code, then every art credit parsed at runtime from the
 * CREDITS.md tables under /assets) -> "Thanks for playing" + Continue.
 *
 * Time is driven by `frame(delta)` (called from UIRoot.update), not CSS animations, so it follows the game loop.
 * Esc / Enter / the jump binding (and so gamepad A) skip to the end screen, then close it.
 */
import { clearLayoutFlags, type UICtx } from './context';
import { eventKeyCode, getBinding, keyLabel } from '../core/bindings';
import { MOBILE_UI, isMobileLayout } from './mobile';
import { Registry } from '../core/registry';
import { GRADUATION_QUEST_ID } from '../data/storyQuests';
import type { MusicKey } from '../core/types';
import { h, safe } from './dom';
import { jobName, schoolName } from './info';
import { portraitEl } from './uiIcons';
import { getActiveSlot } from '../systems/SaveSystem';

// ───────────────────────────── credits data ─────────────────────────────

/** Art credit folders under public/assets, in roll order. */
const CREDIT_SOURCES: { dir: string; title: string }[] = [
  { dir: 'characters', title: 'CHARACTERS' },
  { dir: 'monsters', title: 'MONSTERS' },
  { dir: 'world', title: 'WORLD' },
  { dir: 'vfx', title: 'SPELL EFFECTS' },
  { dir: 'vfx/holy', title: 'SPELL EFFECTS: HOLY' },
  { dir: 'ui', title: 'INTERFACE' },
];

export interface CreditLine { author: string; asset: string; license: string }
export interface CreditSection { title: string; lines: CreditLine[] }

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function stripMd(s: string): string {
  return s
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*`]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanAuthor(s: string): string {
  // "(fiverr.com/x)" style link parentheticals add nothing on screen.
  const t = stripMd(s).replace(/\s*\([^)]*[./][^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  return clip(t.replace(/\s+,/g, ','), 240);
}

function cleanAsset(s: string): string {
  let t = stripMd(s);
  const dash = t.indexOf(' — ');            // "Pack name — folder/ (sheets…)" → the pack name
  if (dash > 0) t = t.slice(0, dash);
  t = t.replace(/\s*\([^)]{26,}\)/g, '');   // long parenthetical lists of sheet names
  if (t.length > 60) {                        // a list of sheets rather than a pack name: keep the first item
    let depth = 0, cut = -1;
    for (let i = 0; i < t.length && cut < 0; i++) {
      if (t[i] === '(') depth++;
      else if (t[i] === ')') depth = Math.max(0, depth - 1);
      else if (t[i] === ',' && depth === 0) cut = i;
    }
    if (cut > 0) t = `${t.slice(0, cut)} & more`;
  }
  return clip(t.trim(), 80);
}

function cleanLicense(s: string): string {
  const t = stripMd(s);
  const m = /^(CC0(?: 1\.0)?|CC-BY(?:[- ]?SA)?[ -]?[\d.]*\+?|OGA-BY[ \d.+]*)/i.exec(t);
  if (m) return m[1].trim();
  return clip(t.split(/ — | \(/)[0].trim(), 40);
}

const splitRow = (line: string) => line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());

/** Parse every markdown table with Author + License columns into credit lines (any column order). */
export function parseCreditsMarkdown(md: string): CreditLine[] {
  const out: CreditLine[] = [];
  let cols: { asset: number; author: number; license: number } | null = null;
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('|')) { cols = null; continue; }
    const cells = splitRow(line);
    if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue;
    const low = cells.map(c => stripMd(c).toLowerCase());
    const author = low.findIndex(c => c.startsWith('author'));
    const license = low.findIndex(c => c.startsWith('license'));
    if (author >= 0 && license >= 0) {
      cols = { author, license, asset: Math.max(0, low.findIndex(c => c.startsWith('asset'))) };
      continue;
    }
    if (!cols) continue;
    const a = cleanAuthor(cells[cols.author] ?? '');
    const n = cleanAsset(cells[cols.asset] ?? '');
    if (!a || !n || a === '—') continue;
    out.push({ author: a, asset: n, license: cleanLicense(cells[cols.license] ?? '') });
  }
  return out;
}

const assetsUrl = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;

let creditsCache: Promise<CreditSection[]> | null = null;

/** Fetch + parse every CREDITS.md; a missing / unreadable file is skipped (dev servers answer 404s with index.html). */
export function loadArtCredits(): Promise<CreditSection[]> {
  creditsCache ??= Promise.all(CREDIT_SOURCES.map(async (src): Promise<CreditSection> => {
    try {
      const res = await fetch(assetsUrl(`${src.dir}/CREDITS.md`));
      if (!res.ok) return { title: src.title, lines: [] };
      return { title: src.title, lines: parseCreditsMarkdown(await res.text()) };
    } catch { return { title: src.title, lines: [] }; }
  })).then(all => all.filter(s => s.lines.length));
  return creditsCache;
}

// ───────────────────────────── helpers ─────────────────────────────

const IN_MS = 1000;
const CARD_FADE_MS = 800;
const SCROLL_PX_PER_S = 52;
const KEY_GRACE_MS = 1500;
const VIEW_W = 1280;
const VIEW_H = 720;
/** Visible height of the roll: the phone UI is laid out at MOBILE_UI.h instead of 720. */
const viewH = () => (isMobileLayout() ? MOBILE_UI.h : VIEW_H);

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Opacity in coarse steps: matches the game's stepped, pixel-art transitions. */
const stepped = (v: number) => Math.round(clamp01(v) * 5) / 5;

function fmtPlayTime(ms: number): string {
  const mins = Math.max(0, Math.floor((ms || 0) / 60000));
  const hrs = Math.floor(mins / 60);
  return hrs ? `${hrs}h ${mins % 60}m` : `${mins}m`;
}

/** Deterministic starfield as one box-shadow list (2x2 px stars). */
function starShadow(seed: number, n: number, colors: string[]): string {
  let s = seed >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(`${Math.floor(rnd() * VIEW_W / 2) * 2}px ${Math.floor(rnd() * VIEW_H / 2) * 2}px 0 ${colors[i % colors.length]}`);
  return out.join(',');
}

interface Card { el: HTMLElement; hold: number }
type Phase = 'in' | 'cards' | 'roll' | 'end';

const creditsFlagPrefix = (slot: number) => `creditsSeen:${slot}:`;

/** Forget that anyone in `slot` has seen the credits (call when the slot is deleted or overwritten). */
export function forgetCreditsSeen(slot: number): void { clearLayoutFlags(creditsFlagPrefix(slot)); }

export class CreditsRoll {
  isOpen = false;
  private pending = false;
  private el: HTMLElement;
  private cardsEl: HTMLElement;
  private rollEl: HTMLElement;
  private rollInner: HTMLElement;
  private endEl: HTMLElement;
  private thanksEl: HTMLElement;
  private hintEl: HTMLElement;
  private starsA: HTMLElement;
  private starsB: HTMLElement;
  private cards: Card[] = [];
  private phase: Phase = 'in';
  private t = 0;
  private cardT = 0;
  private y = VIEW_H;
  private lastY = Number.NaN;
  private resumeMusic: MusicKey | null = null;
  private loaded = false;
  private destroyed = false;

  private readonly onKey = (e: KeyboardEvent) => this.keyDown(e);

  constructor(private ctx: UICtx) {
    this.starsA = h('div', { class: 'ax-cr-stars' });
    this.starsB = h('div', { class: 'ax-cr-stars ax-cr-stars-b' });
    this.cardsEl = h('div', { class: 'ax-cr-cards' });
    this.rollInner = h('div', { class: 'ax-cr-roll-inner' });
    this.thanksEl = h('div', { class: 'ax-cr-thanks' });
    this.rollEl = h('div', { class: 'ax-cr-roll' }, this.rollInner);
    this.hintEl = h('div', { class: 'ax-cr-hint' });
    this.endEl = h('div', { class: 'ax-cr-end' });
    this.el = h('div', { class: 'ax-credits', style: 'display:none' },
      this.starsA, this.starsB, this.cardsEl, this.rollEl,
      h('div', { class: 'ax-cr-fade ax-cr-fade-top' }), h('div', { class: 'ax-cr-fade ax-cr-fade-bot' }),
      this.endEl, this.hintEl);
    this.starsA.style.boxShadow = starShadow(7, 70, ['#deeed6', '#a3abd8', '#dad45e']);
    this.starsB.style.boxShadow = starShadow(91, 60, ['#deeed6', '#b58cff', '#a3abd8']);
    // Phones: a tap anywhere skips / continues (there is no Esc or Enter).
    this.el.addEventListener('click', (e) => {
      if (!this.isOpen || !isMobileLayout() || (e.target as HTMLElement).closest('button') || this.t < KEY_GRACE_MS) return;
      this.advance();
    });
    ctx.root.appendChild(this.el);
  }

  // ─────────────────────────── trigger ───────────────────────────

  /** Per save slot + name: two students with the same name in different slots each get their own roll. */
  private flagKey(): string {
    let slot = 0;
    try { slot = getActiveSlot(); } catch { /* ignore */ }
    return `${creditsFlagPrefix(slot)}${this.ctx.s.progression.state.name}`;
  }

  /** Has this character already seen the roll? (persisted per save slot + character name) */
  seen(): boolean { return this.ctx.layout.getFlag(this.flagKey(), false); }

  /**
   * Graduation was just handed in. The roll starts as soon as the Headmistress's closing dialog is dismissed;
   * does nothing if this character has already watched it.
   */
  arm() {
    if (this.destroyed || this.isOpen || this.pending || this.seen()) return;
    this.pending = true;
    // Kick the fetch off now so the credits are ready by the time the title cards have played.
    void loadArtCredits();
  }

  /** Per-frame hook from UIRoot. `canStart`: no dialog / shop / death prompt is in the way. */
  frame(delta: number, canStart: boolean) {
    if (this.destroyed) return;
    if (!this.isOpen) {
      if (this.pending && canStart) this.begin();
      return;
    }
    const dt = Math.min(Math.max(delta, 0), 100);
    this.t += dt;
    this.twinkle();
    switch (this.phase) {
      case 'in':
        this.el.style.opacity = String(stepped(this.t / IN_MS));
        if (this.t >= IN_MS) { this.phase = 'cards'; this.cardT = 0; }
        break;
      case 'cards': this.frameCards(dt); break;
      case 'roll': this.frameRoll(dt); break;
      case 'end': this.frameEnd(dt); break;
    }
  }

  // ─────────────────────────── lifecycle ───────────────────────────

  private begin() {
    this.pending = false;
    this.ctx.layout.setFlag(this.flagKey(), true);
    // Everything else steps aside: windows closed, gameplay input blocked (UIRoot.syncInputBlock reads isOpen).
    this.build();
    this.isOpen = true;
    this.phase = 'in';
    this.t = 0;
    this.cardT = 0;
    this.y = viewH();
    this.lastY = Number.NaN;
    this.el.style.display = '';
    this.el.style.opacity = '0';
    this.endEl.style.opacity = '0';
    this.endEl.style.pointerEvents = 'none';
    this.rollEl.style.visibility = 'hidden';   // the roll waits behind the title cards
    this.hintMode = null;
    this.endT = 0;
    this.loaded = false;
    this.setHint(true);
    window.addEventListener('keydown', this.onKey, true);
    // Music: the title theme for the roll, the map's own track afterwards.
    const audio = this.ctx.s.audio;
    this.resumeMusic = safe<MusicKey | null>(() => this.ctx.s.game.currentMap()?.def.music ?? null, null);
    try { audio?.playMusic('title'); } catch { /* ignore */ }
    void loadArtCredits().then(sections => {
      if (this.destroyed || this.loaded) return;
      this.loaded = true;
      this.buildRoll(sections);
    });
  }

  /** Close the overlay and hand control back. */
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.pending = false;
    window.removeEventListener('keydown', this.onKey, true);
    this.el.style.display = 'none';
    this.ctx.sfx('ui_close');
    const key = this.resumeMusic ?? 'town';
    this.resumeMusic = null;
    try { this.ctx.s.audio?.playMusic(key); } catch { /* ignore */ }
  }

  destroy() {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKey, true);
    this.isOpen = false;
    this.el.remove();
  }

  // ─────────────────────────── input ───────────────────────────

  private keyDown(e: KeyboardEvent) {
    if (!this.isOpen) return;
    // While the roll is up nothing else may see the key (hotbar, window toggles, Esc menu); key-ups still pass.
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat || this.t < KEY_GRACE_MS) return;
    const code = eventKeyCode(e);
    const jump = [getBinding('jump'), getBinding('jump2')].filter(Boolean);
    if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'NumpadEnter' || code === 27 || code === 13 || jump.includes(code)) this.advance();
  }

  /** First press skips ahead to the end screen; a press there continues. */
  private advance() {
    if (this.phase === 'end') { this.finish(); return; }
    this.skipToEnd();
  }

  private finish() {
    if (this.phase !== 'end' || this.endEl.style.pointerEvents === 'none') return;
    this.close();
  }

  private skipToEnd() {
    this.el.style.opacity = '1';
    this.rollEl.style.visibility = '';
    for (const c of this.cards) c.el.style.opacity = '0';
    this.phase = 'end';
    this.t = Math.max(this.t, IN_MS);
    this.endT = 0;
  }

  // ─────────────────────────── content ───────────────────────────

  private build() {
    const p = this.ctx.s.progression;
    const st = p.state;
    const def = safe(() => p.jobDef(), undefined);
    const title = def?.name ?? jobName(st.job);
    const school = def ? schoolName(def.branch) : 'the Academy';
    const maelis = Registry.npc('elder_maelis');
    const quest = Registry.quest(GRADUATION_QUEST_ID);

    const card = (cls: string, hold: number, ...kids: (HTMLElement | null)[]): Card => ({
      el: h('div', { class: `ax-cr-card ${cls}`, style: 'opacity:0' }, kids),
      hold,
    });
    const orn = () => h('div', { class: 'ax-cr-orn' }, h('i'), h('b'), h('i'));

    this.cards = [
      card('ax-cr-logo', 3600,
        h('div', { class: 'ax-cr-kicker' }, 'A tale of mages'),
        h('div', { class: 'ax-cr-title' }, 'THE ACADEMY'), orn()),
      card('ax-cr-grad', 3000,
        h('div', { class: 'ax-cr-big' }, 'Graduation Day'),
        orn(),
        h('div', { class: 'ax-cr-line' }, quest ? `${quest.name} · Year 4` : 'Commencement · Year 4')),
      card('ax-cr-student', 5600,
        h('div', { class: 'ax-cr-kicker' }, 'Graduate'),
        h('div', { class: 'ax-cr-name' }, st.name),
        h('div', { class: 'ax-cr-job' }, title),
        h('div', { class: 'ax-cr-line' }, school),
        orn(),
        h('div', { class: 'ax-cr-stats' },
          h('span', null, 'Level ', h('b', null, String(st.level))),
          h('span', null, 'Play time ', h('b', null, fmtPlayTime(st.playTimeMs))))),
      card('ax-cr-maelis', 8200,
        h('div', { class: 'ax-cr-portrait' }, portraitEl(maelis?.look, 96, maelis?.name ?? 'Headmistress Maelis')),
        h('div', { class: 'ax-cr-quote' },
          `${st.name}, forty years ago I carried a frightened first-year out of that east wing on my back. Today I watched another walk out of it on their own two feet, with every stolen spell coming home behind them.`,
          h('br'), h('br'),
          'The Academy was never the walls or the magic. It was the people who came back for one another. Your seat at the faculty table is yours for good. Come home whenever you like.'),
        h('div', { class: 'ax-cr-sign' }, `— ${maelis?.name ?? 'Headmistress Maelis'}`)),
    ];
    this.cardsEl.replaceChildren(...this.cards.map(c => c.el));

    this.thanksEl = h('div', { class: 'ax-cr-thanks' },
      orn(),
      h('div', { class: 'ax-cr-thanks-big' }, 'Thanks for playing'),
      h('div', { class: 'ax-cr-line' }, `Thank you, ${st.name}.`));
    this.buildRoll([]);

    this.endEl.replaceChildren(
      h('button', { class: 'ax-btn ax-btn-large ax-cr-continue', onclick: () => { this.ctx.sfx('ui_click'); this.finish(); } }, 'Continue'));
  }

  private buildRoll(art: CreditSection[]) {
    const head = (t: string) => h('div', { class: 'ax-cr-h' }, t);
    const blocks: HTMLElement[] = [
      h('div', { class: 'ax-cr-sec' },
        head('GAME DESIGN & CODE'),
        h('div', { class: 'ax-cr-credit' }, 'Built by a team of AI agents directed by Claude, with Codex')),
      h('div', { class: 'ax-cr-sec' },
        head('MUSIC & SOUND'),
        h('div', { class: 'ax-cr-credit' }, 'Synthesised live in your browser with the Web Audio API')),
      h('div', { class: 'ax-cr-sec' },
        head('ENGINE'),
        h('div', { class: 'ax-cr-credit' }, 'Phaser 3 · TypeScript · Vite')),
      h('div', { class: 'ax-cr-sec' },
        head('ART'),
        h('div', { class: 'ax-cr-credit ax-dim' }, 'Every sprite, tile, effect and icon here was made by these artists and shared freely. Thank you.')),
    ];
    const seen = new Set<string>();
    for (const sec of art) {
      const lines: HTMLElement[] = [];
      for (const l of sec.lines) {
        const key = `${l.author}|${l.asset}`;
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push(h('div', { class: 'ax-cr-credit' },
          h('span', { class: 'ax-cr-who' }, l.author), ' — ', l.asset,
          l.license ? [' — ', h('span', { class: 'ax-cr-lic' }, l.license)] : null));
      }
      if (lines.length) blocks.push(h('div', { class: 'ax-cr-sec' }, head(sec.title), lines));
    }
    this.rollInner.replaceChildren(...blocks, this.thanksEl);
    this.lastY = Number.NaN;
  }

  // ─────────────────────────── per-phase frames ───────────────────────────

  private frameCards(dt: number) {
    this.cardT += dt;
    let at = 0;
    let any = false;
    for (const c of this.cards) {
      const dur = CARD_FADE_MS * 2 + c.hold;
      const local = this.cardT - at;
      let o = 0;
      if (local >= 0 && local <= dur) {
        any = true;
        o = local < CARD_FADE_MS ? local / CARD_FADE_MS : local > dur - CARD_FADE_MS ? (dur - local) / CARD_FADE_MS : 1;
      }
      c.el.style.opacity = String(stepped(o));
      at += dur + 250;
    }
    if (!any && this.cardT > at) {
      this.phase = 'roll';
      this.y = viewH();
      this.applyY(this.y);
      this.rollEl.style.visibility = '';
      this.setHint(true);
    }
  }

  /** Where the roll stops: the "Thanks for playing" block centred on screen. */
  private stopY(): number {
    return Math.round(viewH() / 2 - this.thanksEl.offsetTop - this.thanksEl.offsetHeight / 2 - 40);
  }

  private frameRoll(dt: number) {
    if (!this.loaded) return;            // hold the roll just below the screen until the art credits arrive
    const stop = this.stopY();
    this.y = Math.max(stop, this.y - (SCROLL_PX_PER_S * dt) / 1000);
    this.applyY(this.y);
    if (this.y <= stop) { this.phase = 'end'; this.endT = 0; }
  }

  private endT = 0;

  private frameEnd(dt: number) {
    this.endT += dt;
    this.applyY(this.stopY());
    const o = stepped(this.endT / 900);
    this.endEl.style.opacity = String(o);
    if (o >= 1) this.endEl.style.pointerEvents = 'auto';
    this.setHint(false);
  }

  private applyY(y: number) {
    const v = Math.round(y / 2) * 2;     // whole 2px steps: the roll crawls in pixel increments
    if (v === this.lastY) return;
    this.lastY = v;
    this.rollInner.style.transform = `translateY(${v}px)`;
  }

  private twinkle() {
    const on = Math.floor(this.t / 700) % 2 === 0;
    this.starsB.style.opacity = on ? '1' : '0.15';
    this.starsA.style.opacity = on ? '0.7' : '1';
  }

  private hintMode: boolean | null = null;
  private setHint(skippable: boolean) {
    if (this.hintMode === skippable) return;
    this.hintMode = skippable;
    const jump = keyLabel(getBinding('jump'));
    this.hintEl.textContent = isMobileLayout() ? (skippable ? 'Tap to skip' : 'Tap Continue')
      : skippable ? `Esc / Enter / ${jump}: skip` : `Esc / Enter / ${jump}: continue`;
  }
}
