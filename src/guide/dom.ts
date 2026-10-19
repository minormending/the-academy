// A tiny DOM builder for the handbook page (no framework, no runtime dependencies).

export type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, string | number | boolean | null | undefined | ((e: Event) => void)>;

/** h("div.card#id", { title: "x" }, ...children). Class and id shorthands in the tag. */
export function h<T extends HTMLElement = HTMLElement>(tag: string, attrs?: Attrs | Child, ...children: Child[]): T {
  const m = /^([a-z0-9]+)((?:[.#][\w-]+)*)$/.exec(tag);
  const el = document.createElement(m ? m[1] : tag) as T;
  if (m?.[2]) {
    for (const part of m[2].match(/[.#][\w-]+/g) ?? []) {
      if (part[0] === '.') el.classList.add(part.slice(1));
      else el.id = part.slice(1);
    }
  }
  if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v);
      else if (k === 'class') el.className = [el.className, String(v)].filter(Boolean).join(' ');
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  } else if (attrs !== undefined) children.unshift(attrs as Child);
  append(el, children);
  return el;
}

export function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

/**
 * Inline handbook markup: **bold** and [[link text|#anchor]]. Everything else is plain text (never HTML),
 * so writers can't break the page.
 */
export function inline(text: string): Node[] {
  const out: Node[] = [];
  const re = /\*\*(.+?)\*\*|\[\[(.+?)\|(#[\w-]+)\]\]/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(document.createTextNode(text.slice(last, m.index)));
    if (m[1] !== undefined) {
      const b = document.createElement('strong');
      b.textContent = m[1];
      out.push(b);
    } else {
      const a = document.createElement('a');
      a.textContent = m[2];
      a.href = m[3];
      out.push(a);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(document.createTextNode(text.slice(last)));
  return out;
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
