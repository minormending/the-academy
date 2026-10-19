// Class badges (story mode): 16x16 pixel-art medals scaled up nearest-neighbour.
// Each badge = dark outline, gold rim, 3-tone body ramp from the badge colour (light from the top-left), a small
// highlight, a ribbon tail on shield/crest shapes, and a glyph picked by a hash of the badge id so badges differ.
import type { BadgeDef, BadgeShape } from '../core/types';

const N = 16;
type Px = string | null;

const cache = new Map<string, string>();

// ───────────────────────────── shapes ─────────────────────────────

/** Inclusive [left, right] pixel spans per row (null = empty row). */
type Rows = ([number, number] | [number, number][] | null)[];

const SHIELD: Rows = [[2, 13], [1, 14], [1, 14], [1, 14], [1, 14], [1, 14], [1, 14], [2, 13], [3, 12], [4, 11], [5, 10], [6, 9], [7, 8]];
const CREST: Rows = [[[1, 4], [11, 14]], [[0, 6], [9, 15]], [0, 15], [1, 14], [1, 14], [1, 14], [1, 14], [2, 13], [3, 12], [4, 11], [5, 10], [6, 9], [7, 8]] as Rows;
/** Ribbon tails hang behind shield/crest bodies. */
const TAILS: Rows = [null, null, null, null, null, null, null, null, null, null,
  [[3, 6], [9, 12]], [[3, 6], [9, 12]], [[2, 5], [10, 13]], [[2, 5], [10, 13]], [[2, 5], [10, 13]], [[2, 3], [12, 13]]] as Rows;

function fromRows(rows: Rows): boolean[] {
  const m = new Array<boolean>(N * N).fill(false);
  rows.forEach((r, y) => {
    if (!r) return;
    const spans = (typeof r[0] === 'number' ? [r as [number, number]] : r as [number, number][]);
    for (const [a, b] of spans) for (let x = a; x <= b; x++) m[y * N + x] = true;
  });
  return m;
}

function fromTest(test: (x: number, y: number) => boolean): boolean[] {
  const m = new Array<boolean>(N * N).fill(false);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) m[y * N + x] = test(x + 0.5 - N / 2, y + 0.5 - N / 2);
  return m;
}

function inPoly(px: number, py: number, pts: [number, number][]): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const STAR_PTS: [number, number][] = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4.7 : 8.4;
  return [Math.cos(a) * r, Math.sin(a) * r + 0.5] as [number, number];
});

function shapeMask(shape: BadgeShape): { body: boolean[]; ribbon: boolean[] | null; cx: number; cy: number } {
  switch (shape) {
    case 'circle': return { body: fromTest((x, y) => x * x + y * y <= 7.9 * 7.9), ribbon: null, cx: 7.5, cy: 7.5 };
    case 'diamond': return { body: fromTest((x, y) => Math.abs(x) + Math.abs(y) <= 8.2), ribbon: null, cx: 7.5, cy: 7.5 };
    case 'star': return { body: fromTest((x, y) => inPoly(x, y, STAR_PTS)), ribbon: null, cx: 7.5, cy: 8 };
    case 'crest': return { body: fromRows(CREST), ribbon: fromRows(TAILS), cx: 7.5, cy: 6 };
    case 'shield':
    default: return { body: fromRows(SHIELD), ribbon: fromRows(TAILS), cx: 7.5, cy: 6 };
  }
}

// ───────────────────────────── glyphs ─────────────────────────────

const GLYPHS: string[][] = [
  ['..##..', '######', '.####.', '.####.', '##..##', '#....#'], // star
  ['...##.', '..##..', '.####.', '..##..', '.##...', '##....'], // bolt
  ['..##..', '..##..', '######', '######', '..##..', '..##..'], // cross
  ['.####.', '######', '######', '.####.', '..##..', '..##..'], // gem
  ['..#...', '..##..', '.####.', '######', '######', '.####.'], // flame
  ['.####.', '###...', '##....', '##....', '###...', '.####.'], // moon
  ['.####.', '##..##', '#....#', '#....#', '##..##', '.####.'], // ring
  ['..##..', '.####.', '######', '..##..', '..##..', '..##..'], // arrow
];
/** Small 3x3 glyphs for the star badge, whose body is too small for the big ones. */
const MINI: string[][] = [['.#.', '###', '.#.'], ['#.#', '.#.', '#.#'], ['###', '#.#', '###'], ['.#.', '#.#', '.#.']];

export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ───────────────────────────── colour helpers ─────────────────────────────

const hex = (n: number) => `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;
function mix(a: number, b: number, t: number): string {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return hex((ch(16) << 16) | (ch(8) << 8) | ch(0));
}

// ───────────────────────────── drawing ─────────────────────────────

/** The 16x16 badge as CSS colours (row-major, null = transparent). Pure, so it works without a DOM. */
export function badgeGrid(badge: BadgeDef, dim = false): Px[] {
  const out: Px[] = new Array<Px>(N * N).fill(null);
  const { body, ribbon, cx, cy } = shapeMask(badge.shape);
  const at = (m: boolean[], x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && m[y * N + x];
  const edge = (m: boolean[], x: number, y: number) =>
    !at(m, x - 1, y) || !at(m, x + 1, y) || !at(m, x, y - 1) || !at(m, x, y + 1);

  const OUT = dim ? '#0d0b16' : '#1a1020';
  const dark = mix(badge.color, 0x000000, 0.4), mid = hex(badge.color), light = mix(badge.color, 0xffffff, 0.38);
  const rdark = mix(badge.color, 0x000000, 0.6), rmid = mix(badge.color, 0x000000, 0.28);
  const goldL = '#ffe9a0', goldM = '#f0b429', goldD = '#a86e14';

  // ribbon tails first (the body paints over them)
  if (ribbon) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!ribbon[y * N + x]) continue;
      out[y * N + x] = dim ? '#211c33' : edge(ribbon, x, y) ? OUT : (x + y) % 5 === 0 ? rdark : rmid;
    }
  }

  // body: outline -> gold rim -> shaded fill
  let hx = -1, hy = -1, best = Infinity;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!body[y * N + x]) continue;
    const i = y * N + x;
    if (edge(body, x, y)) { out[i] = OUT; continue; }
    const t = ((x - cx) + (y - cy)) / (2 * 8);           // light from the top-left
    const rim = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => at(body, x + dx, y + dy) && edge(body, x + dx, y + dy));
    if (dim) { out[i] = rim ? '#3b3558' : '#2a2540'; continue; }
    if (rim) { out[i] = t < -0.16 ? goldL : t > 0.16 ? goldD : goldM; continue; }
    out[i] = t < -0.2 ? light : t > 0.2 ? dark : mid;
    if (x + y < best) { best = x + y; hx = x; hy = y; }
  }
  if (dim) return out;

  // small highlight on the upper-left of the body
  if (hx >= 0) {
    const hl = mix(badge.color, 0xffffff, 0.8);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) {
      const i = (hy + dy) * N + hx + dx;
      if (out[i] && out[i] !== OUT && at(body, hx + dx, hy + dy) && !edge(body, hx + dx, hy + dy)) out[i] = hl;
    }
  }

  // glyph (cream, with a dark drop shadow), only on body-fill pixels
  const h = hashId(badge.id);
  const isStar = badge.shape === 'star';
  const glyph = isStar ? MINI[h % MINI.length] : GLYPHS[h % GLYPHS.length];
  const gw = glyph[0].length, gh = glyph.length;
  const gx = Math.round(cx - gw / 2 + 0.01), gy = Math.round(cy - gh / 2 + 0.01) + (isStar ? 0 : 0);
  const isFill = (x: number, y: number) => at(body, x, y) && !edge(body, x, y);
  const put = (x: number, y: number, c: string) => { if (isFill(x, y)) out[y * N + x] = c; };
  const bits: [number, number][] = [];
  glyph.forEach((row, r) => { for (let c = 0; c < gw; c++) if (row[c] === '#') bits.push([gx + c, gy + r]); });
  const set = new Set(bits.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of bits) if (!set.has(`${x + 1},${y + 1}`)) put(x + 1, y + 1, dark);
  for (const [x, y] of bits) put(x, y, '#fff6d6');
  return out;
}

/** Pixel badge as a data URL, `size` px square, cached per badge + size. `dim` draws the not-yet-earned silhouette. */
export function badgeDataUrl(badge: BadgeDef, size = 32, dim = false): string {
  if (typeof document === 'undefined') return '';
  const key = `${badge.id}:${badge.shape}:${badge.color}:${size}:${dim ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const px = document.createElement('canvas');
    px.width = px.height = N;
    const pg = px.getContext('2d');
    if (!pg) return '';
    const grid = badgeGrid(badge, dim);
    for (let i = 0; i < grid.length; i++) {
      const c = grid[i];
      if (!c) continue;
      pg.fillStyle = c;
      pg.fillRect(i % N, Math.floor(i / N), 1, 1);
    }
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    if (!g) return '';
    g.imageSmoothingEnabled = false;
    g.drawImage(px, 0, 0, size, size);
    const url = c.toDataURL();
    cache.set(key, url);
    return url;
  } catch {
    return '';
  }
}
