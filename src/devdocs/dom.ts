// A tiny hyperscript helper for the shell: h("a.button.ghost", { href }, "text", child…).

type Attrs = Record<string, string | number | boolean | null | undefined>;
export type Child = Node | string | number | null | undefined | false | Child[];

export function h<T extends HTMLElement = HTMLElement>(tag: string, ...rest: (Attrs | Child)[]): T {
  const [name, ...classes] = tag.split(".");
  const el = document.createElement(name || "div") as T;
  if (classes.length) el.className = classes.join(" ");
  let kids = rest;
  const first = rest[0];
  if (first && typeof first === "object" && !(first instanceof Node) && !Array.isArray(first)) {
    for (const [k, v] of Object.entries(first as Attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "hidden") (el as HTMLElement).hidden = Boolean(v);
      else el.setAttribute(k, v === true ? "" : String(v));
    }
    kids = rest.slice(1);
  }
  const add = (c: Child) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c instanceof Node ? c : String(c));
  };
  (kids as Child[]).forEach(add);
  return el;
}
