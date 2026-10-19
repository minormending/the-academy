// A tiny, dependency-free highlighter for the docs' code blocks:
// keywords, strings, comments and numbers in TypeScript (and JavaScript),
// JSON, Bash, YAML, CSS and HTML. Text nodes only, never HTML.

export type TokenKind = "kw" | "str" | "com" | "num" | "lit" | "key" | "fn" | "op";
export interface Token { kind: TokenKind | null; text: string }

type Rule = [TokenKind | null, RegExp];

const words = (list: string) => new RegExp(`\\b(?:${list.trim().split(/\s+/).join("|")})\\b`, "y");

const NUM = /(?:0[xX][\da-fA-F_]+|0[bB][01_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?n?)\b/y;

const RULES: Record<string, Rule[]> = {
  ts: [
    ["com", /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y],
    ["str", /`(?:\\[\s\S]|[^\\`])*`?|"(?:\\.|[^\\"\n])*"?|'(?:\\.|[^\\'\n])*'?/y],
    ["kw", words(`
      abstract as async await break case catch class const continue debugger declare default delete do else enum
      export extends finally for from function get if implements import in infer instanceof interface is keyof let
      namespace new of private protected public readonly return satisfies set static super switch this throw try
      type typeof var void while with yield`)],
    ["lit", words("true false null undefined NaN Infinity")],
    ["num", NUM],
    ["fn", /[A-Za-z_$][\w$]*(?=\s*\()/y],
    [null, /[A-Za-z_$][\w$]*/y],
  ],
  json: [
    ["key", /"(?:\\.|[^\\"\n])*"(?=\s*:)/y],
    ["str", /"(?:\\.|[^\\"\n])*"?/y],
    ["lit", words("true false null")],
    ["num", /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y],
  ],
  bash: [
    ["com", /(?<![^\s;|&(])#[^\n]*/y],
    ["str", /"(?:\\.|[^\\"])*"?|'[^']*'?/y],
    ["kw", words("if then else elif fi for while until do done case esac function in select return export local set unset source exit")],
    ["op", /--?[A-Za-z][\w-]*/y],
    ["num", /\b\d+\b/y],
    [null, /[A-Za-z_][\w.-]*/y],
  ],
  yaml: [
    ["com", /(?<![^\s])#[^\n]*/y],
    ["key", /[\w.\/-]+(?=\s*:(?:\s|$))/y],
    ["str", /"(?:\\.|[^\\"\n])*"?|'[^'\n]*'?/y],
    ["lit", words("true false null yes no on off")],
    ["num", /\b\d+(?:\.\d+)?\b/y],
    ["op", /\$\{\{[^}]*\}\}/y],
    [null, /[A-Za-z_][\w-]*/y],
  ],
  css: [
    ["com", /\/\*[\s\S]*?(?:\*\/|$)/y],
    ["str", /"(?:\\.|[^\\"\n])*"?|'(?:\\.|[^\\'\n])*'?/y],
    ["key", /--[\w-]+|[a-z-]+(?=\s*:[^:])/y],
    ["kw", /@[\w-]+|![a-z]+/y],
    ["num", /#[\da-fA-F]{3,8}\b|-?\d*\.?\d+(?:px|em|rem|%|vh|vw|ms|s|fr|deg|ch)?\b/y],
    ["fn", /[\w-]+(?=\()/y],
    [null, /[\w-]+/y],
  ],
  html: [
    ["com", /<!--[\s\S]*?(?:-->|$)/y],
    ["kw", /<\/?[a-zA-Z][\w-]*|\/?>/y],
    ["str", /"[^"]*"?|'[^']*'?/y],
    ["key", /[\w:-]+(?==)/y],
    [null, /[^<"'=\s>/]+/y],
  ],
};

export const LANG_ALIASES: Record<string, string> = { typescript: "ts", js: "ts", javascript: "ts", sh: "bash", shell: "bash", yml: "yaml" };

/** Split `code` into tokens; joining every token's text gives `code` back exactly. */
export function tokenize(code: string, lang: string): Token[] {
  const rules = RULES[LANG_ALIASES[lang] ?? lang];
  if (!rules) return [{ kind: null, text: code }];
  const out: Token[] = [];
  let plain = "";
  let i = 0;
  const flush = () => { if (plain) { out.push({ kind: null, text: plain }); plain = ""; } };
  outer: while (i < code.length) {
    for (const [kind, re] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m && m[0].length > 0) {
        if (kind === null) plain += m[0];
        else { flush(); out.push({ kind, text: m[0] }); }
        i += m[0].length;
        continue outer;
      }
    }
    plain += code[i++];
  }
  flush();
  return out;
}

/** Replace a `<code>`'s text with highlighted spans (text nodes only; never HTML). */
export function highlightElement(el: HTMLElement, lang: string): void {
  const frag = document.createDocumentFragment();
  for (const t of tokenize(el.textContent ?? "", lang)) {
    if (!t.kind) { frag.append(t.text); continue; }
    const span = document.createElement("span");
    span.className = `tk-${t.kind}`;
    span.textContent = t.text;
    frag.append(span);
  }
  el.replaceChildren(frag);
}
