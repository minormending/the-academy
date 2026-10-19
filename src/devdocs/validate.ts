// Fragment validation for src/devdocs/sections/*.html (CONTRACT.md).
//
// Pure string scanning, no DOM and no imports, so the same checks run in the
// browser at load (dev), in `node src/devdocs/check.mjs` and in the build
// (the devdocsSource plugin in vite.config.ts).

export interface Fragment { file: string; html: string }
export interface Problem { file: string; message: string }

export interface Tag {
  name: string;
  close: boolean;
  attrs: Record<string, string>;
  /** Offset in the comment-stripped source. */
  index: number;
}

/** Elements a fragment may use. Anything else is usually an unescaped `<` in code (`Map<string, T>`). */
const ALLOWED = new Set([
  "section", "h2", "h3", "h4", "p", "a", "ul", "ol", "li", "pre", "code", "figure", "figcaption",
  "details", "summary", "aside", "dfn", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  "colgroup", "col", "em", "strong", "b", "i", "u", "s", "kbd", "samp", "var", "br", "hr", "span", "div",
  "dl", "dt", "dd", "sup", "sub", "small", "abbr", "blockquote", "q", "cite", "mark", "time", "wbr", "del", "ins",
]);
/** Elements that are never allowed (CONTRACT.md: plain HTML, no scripts, no embeds, no images). */
const FORBIDDEN = new Set([
  "script", "style", "iframe", "object", "embed", "link", "meta", "base", "form", "input", "button", "textarea",
  "select", "frame", "frameset", "noscript", "template", "svg", "math", "canvas", "video", "audio", "img", "picture",
]);

const ID_RE = /^[a-z][a-z0-9-]*$/;
/** `src/core/balance.ts`, optionally followed by `#L7` or `#L7-L12`. */
const SRC_RE = /^([^#]+?)(?:#L(\d+)(?:-L(\d+))?)?$/;

export const stripComments = (html: string) => html.replace(/<!--[\s\S]*?-->/g, (m) => " ".repeat(m.length));

/** Every start and end tag, with attributes (values unescaped only for `&amp;`). */
export function scanTags(html: string): Tag[] {
  const src = stripComments(html);
  const out: Tag[] = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>/"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*)\s*\/?>/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const attrs: Record<string, string> = {};
    const ar = /([^\s=>/"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;
    for (let a = ar.exec(m[3]); a; a = ar.exec(m[3])) {
      attrs[a[1].toLowerCase()] = (a[2] ?? a[3] ?? a[4] ?? "").replace(/&amp;/g, "&");
    }
    out.push({ name: m[2].toLowerCase(), close: m[1] === "/", attrs, index: m.index });
  }
  return out;
}

/** Split a `data-src` value into its path and optional line range. */
export function parseSrc(value: string): { path: string; from?: number; to?: number } | null {
  const m = SRC_RE.exec(value.trim());
  if (!m) return null;
  return { path: m[1], from: m[2] ? Number(m[2]) : undefined, to: m[3] ? Number(m[3]) : undefined };
}

export interface ValidateOptions {
  /** Chart names the page can draw. */
  chartNames: readonly string[];
  /** Code languages the highlighter knows. */
  codeLangs: readonly string[];
  /** Names a `data-stat` span may use (names.ts). Omit to skip the check. */
  statNames?: readonly string[];
  /** Ids the shell creates (links may target them; fragments must not reuse them). */
  shellIds?: readonly string[];
  /**
   * Line count of a repository file, or undefined if it does not exist. Omit to skip
   * `data-src` existence and line-range checks.
   */
  fileLines?: (path: string) => number | undefined;
}

/** All problems across the fragments, in file order. An empty list means the page will build cleanly. */
export function validateFragments(frags: readonly Fragment[], opts: ValidateOptions): Problem[] {
  const problems: Problem[] = [];
  const shell = new Set(opts.shellIds ?? []);
  const charts = new Set(opts.chartNames);
  const langs = new Set(opts.codeLangs);
  const idOwner = new Map<string, string>();
  const links: { file: string; target: string }[] = [];

  for (const { file, html } of frags) {
    const bad = (message: string) => problems.push({ file, message });
    if (!/^\d{2}-[a-z0-9-]+\.html$/.test(file)) bad(`file name should look like "03-boot.html"`);
    const tags = scanTags(html);
    const opens = tags.filter((t) => !t.close);

    // One <section id data-title> wrapping everything.
    const sections = opens.filter((t) => t.name === "section");
    if (sections.length !== 1) bad(`needs exactly one <section>, found ${sections.length}`);
    const sec = sections[0];
    if (sec) {
      const stripped = stripComments(html);
      const lastClose = stripped.lastIndexOf("</section>");
      if (stripped.slice(0, sec.index).trim() || (lastClose >= 0 && stripped.slice(lastClose + 10).trim())) {
        bad("everything must be inside the <section>");
      }
      if (!sec.attrs.id) bad("<section> has no id");
      else if (!ID_RE.test(sec.attrs.id)) bad(`section id "${sec.attrs.id}" should be lower case letters, digits and hyphens`);
      if (!sec.attrs["data-title"]?.trim()) bad("<section> has no data-title");
      if (!sec.attrs["data-summary"]?.trim()) bad("<section> has no data-summary");
    }
    const sectionId = sec?.attrs.id ?? "";

    const count = (n: string) => opens.filter((t) => t.name === n).length;
    if (count("h2") !== 1) bad(`needs exactly one <h2> (the section title), found ${count("h2")}`);
    for (const h of ["h1", "h5", "h6"]) if (count(h)) bad(`<${h}> is not allowed (use h2 once, then h3/h4)`);
    if (!opens.some((t) => t.name === "details" && (t.attrs.class ?? "").split(/\s+/).includes("advanced"))) {
      bad('needs at least one <details class="advanced"> block');
    }

    for (const t of opens) {
      if (FORBIDDEN.has(t.name)) bad(`<${t.name}> is not allowed`);
      else if (!ALLOWED.has(t.name)) bad(`unknown element <${t.name}> (an unescaped "<" in code? write &lt;)`);
      for (const [k, v] of Object.entries(t.attrs)) {
        if (k.startsWith("on")) bad(`inline event handler ${k}= on <${t.name}>`);
        if (k === "style") bad(`inline style= on <${t.name}> (the shell styles everything)`);
        if ((k === "href" || k === "src") && /^\s*javascript:/i.test(v)) bad(`javascript: URL on <${t.name}>`);
      }

      const id = t.attrs.id;
      if (id !== undefined && t.name !== "section") {
        if (!ID_RE.test(id)) bad(`id "${id}" should be lower case letters, digits and hyphens`);
        if ((t.name === "h3" || t.name === "h4") && sectionId && !id.startsWith(`${sectionId}-`)) {
          bad(`heading id "${id}" should start with "${sectionId}-"`);
        }
      }
      if (id !== undefined) {
        if (shell.has(id)) bad(`id "${id}" is reserved by the page shell`);
        const prev = idOwner.get(id);
        if (prev) bad(`duplicate id "${id}" (also in ${prev})`);
        else idOwner.set(id, file);
      }

      if (t.attrs["data-chart"] !== undefined && !charts.has(t.attrs["data-chart"])) {
        bad(`unknown chart "${t.attrs["data-chart"]}" (see CONTRACT.md § Charts)`);
      }
      const stat = t.attrs["data-stat"];
      if (stat !== undefined && opts.statNames && !opts.statNames.includes(stat)) bad(`unknown data-stat "${stat}" (see CONTRACT.md § Live numbers)`);
      const href = t.attrs.href;
      if (t.name === "a" && href !== undefined && href.startsWith("#")) links.push({ file, target: decodeURIComponent(href.slice(1)) });
      const ds = t.attrs["data-src"];
      if (ds !== undefined) {
        const parsed = parseSrc(ds);
        if (!parsed || !parsed.path || parsed.path.startsWith("/") || parsed.path.split("/").includes("..") || /^[a-z]+:/i.test(parsed.path) || parsed.path.includes("#")) {
          bad(`data-src "${ds}" must be a repository-relative path, optionally followed by #L<n> or #L<a>-L<b>`);
        } else if (opts.fileLines) {
          const lines = opts.fileLines(parsed.path);
          if (lines === undefined) bad(`data-src "${ds}": ${parsed.path} does not exist in the repository`);
          else if ((parsed.from && parsed.from > lines) || (parsed.to && parsed.to > lines)) bad(`data-src "${ds}": ${parsed.path} has only ${lines} lines`);
          else if (parsed.from && parsed.to && parsed.to < parsed.from) bad(`data-src "${ds}": the range runs backwards`);
        }
      }
    }

    // Mermaid blocks must have a body; code must be escaped and use a known language.
    const stripped = stripComments(html);
    const mre = /<pre\s+class="mermaid"\s*>([\s\S]*?)<\/pre>/g;
    for (let m = mre.exec(stripped); m; m = mre.exec(stripped)) {
      if (!m[1].trim()) bad("empty mermaid diagram");
      else if (/<(?!br\s*\/?>)/.test(m[1])) bad(`unescaped "<" in a mermaid diagram (write &lt;): ${JSON.stringify(m[1].slice(m[1].indexOf("<"), m[1].indexOf("<") + 24))}`);
    }
    const cre = /<code\b([^>]*)>([\s\S]*?)<\/code>/g;
    for (let m = cre.exec(stripped); m; m = cre.exec(stripped)) {
      const cls = /class="([^"]*)"/.exec(m[1])?.[1] ?? "";
      const lang = cls.split(/\s+/).find((c) => c.startsWith("lang-"));
      if (lang && !langs.has(lang.slice(5))) bad(`unknown code language "${lang}" (${[...langs].map((l) => `lang-${l}`).join(", ")})`);
      if (/<(?!\/?(?:span|em|strong|b|i|mark|br)\b)/.test(m[2])) bad(`unescaped "<" in code: ${JSON.stringify(m[2].slice(m[2].indexOf("<"), m[2].indexOf("<") + 24))} (write &lt;)`);
      if (/&(?![a-zA-Z]+;|#\d+;|#x[\da-fA-F]+;)/.test(m[2])) bad(`unescaped "&" in code: ${JSON.stringify(m[2].slice(m[2].search(/&(?![a-zA-Z]+;|#)/), m[2].search(/&(?![a-zA-Z]+;|#)/) + 24))} (write &amp;)`);
    }
  }

  for (const { file, target } of links) {
    if (!target) continue;
    if (!idOwner.has(target) && !shell.has(target)) problems.push({ file, message: `broken link #${target}` });
  }
  return problems;
}

export const formatProblems = (ps: readonly Problem[]) => ps.map((p) => `${p.file}: ${p.message}`).join("\n");
