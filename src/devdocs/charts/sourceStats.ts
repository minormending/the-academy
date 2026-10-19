// Source statistics for the `module-graph` and `content-counts` charts.
//
// Pure: takes { path, text } pairs. vite.config.ts (the devdocsSource plugin)
// runs it over src/**/*.ts at build (and dev) time and serves the small result
// as the virtual module "virtual:devdocs-source", so the page never ships the
// source itself. No imports, so vite.config.ts can load it directly.

export interface SourceFile { path: string; text: string }

export interface FolderStats {
  /** Top-level folder under src/ ("systems"), or "main" for src/main.ts and other root files. */
  folder: string;
  files: number;
  lines: number;
}

export interface ImportEdge { from: string; to: string; count: number }

export interface SourceStats {
  folders: FolderStats[];
  /** Imports between different top-level folders (static and dynamic, type-only included). */
  edges: ImportEdge[];
  /** Folders left out because they are the documentation pages, not the game. */
  excluded: string[];
}

/** The docs pages import the game; they are not part of it. */
export const DOC_FOLDERS = ["devdocs", "guide"];

/** "src/systems/skill/AttackRunner.ts" -> "systems"; "src/main.ts" -> "main". Null outside src/. */
export function folderOf(path: string): string | null {
  const p = path.replace(/^\/+/, "").replace(/^\.\//, "");
  if (!p.startsWith("src/")) return null;
  const rest = p.slice(4).split("/");
  return rest.length > 1 ? rest[0] : "main";
}

/** Resolve a relative specifier against the importing file's directory (POSIX paths). */
export function resolveRelative(fromPath: string, spec: string): string {
  const parts = fromPath.split("/").slice(0, -1);
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

/** Relative module specifiers a file imports or re-exports (static, dynamic and side-effect imports). */
export function importSpecifiers(text: string): string[] {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
  const out: string[] = [];
  const res = [
    /\b(?:import|export)\s[^"'`;]*?\bfrom\s*["'](\.{1,2}\/[^"']+)["']/g,
    /\bimport\s*["'](\.{1,2}\/[^"']+)["']/g,
    /\bimport\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g,
  ];
  for (const re of res) for (let m = re.exec(code); m; m = re.exec(code)) out.push(m[1]);
  return out;
}

export function sourceStats(files: readonly SourceFile[]): SourceStats {
  const folders = new Map<string, FolderStats>();
  const edges = new Map<string, ImportEdge>();
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const skip = new Set(DOC_FOLDERS);
  for (const f of sorted) {
    const folder = folderOf(f.path);
    if (!folder || skip.has(folder) || !f.path.endsWith(".ts") || f.path.endsWith(".d.ts")) continue;
    const st = folders.get(folder) ?? { folder, files: 0, lines: 0 };
    folders.set(folder, st);
    st.files++;
    st.lines += f.text.split("\n").length - (f.text.endsWith("\n") ? 1 : 0);
    for (const spec of importSpecifiers(f.text)) {
      const to = folderOf(resolveRelative(f.path, spec));
      if (!to || to === folder || skip.has(to)) continue;
      const key = `${folder}>${to}`;
      const e = edges.get(key) ?? { from: folder, to, count: 0 };
      e.count++;
      edges.set(key, e);
    }
  }
  return {
    folders: [...folders.values()].sort((a, b) => a.folder.localeCompare(b.folder)),
    edges: [...edges.values()].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
    excluded: DOC_FOLDERS,
  };
}
