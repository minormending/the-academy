// Node-side checks for the developer docs (docs/DEVDOCS.md).
//
//   node src/devdocs/check.mjs     → validates every section fragment against
//                                     CONTRACT.md, including that each data-src
//                                     path exists and its #L line is in range.
//
// vite.config.ts (the devdocsSource plugin) imports these helpers too: the same
// checks run on `npm run build` (warnings; DEVDOCS_STRICT=1 makes them errors),
// and repoFiles() feeds the line counts the dev page uses for the same checks.
// Node 22.6+ loads the imported .ts files by stripping their types.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { CHART_NAMES, CODE_LANGS, SHELL_IDS } from "./names.ts";
import { formatProblems, validateFragments } from "./validate.ts";

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".claude", ".vite"]);
const TEXT_EXT = /\.(?:ts|mjs|js|json|md|html|css|yml|yaml|txt)$/;

/** Every text file in the repository (relative POSIX path → text), minus build output and dependencies. */
export function repoFiles(root) {
  const out = {};
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name));
      } else if (entry.isFile() && TEXT_EXT.test(entry.name)) {
        const full = join(dir, entry.name);
        out[relative(root, full).split(sep).join("/")] = readFileSync(full, "utf8");
      }
    }
  };
  walk(root);
  return out;
}

/** Line count as an editor shows it (a trailing newline does not start a new line). */
export const lineCount = (text) => text.split("\n").length - (text.endsWith("\n") ? 1 : 0);

/** The section fragments in file-name order, as { file, html }. */
export function sectionFragments(root) {
  const dir = join(root, "src/devdocs/sections");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".html"))
    .sort()
    .map((file) => ({ file, html: readFileSync(join(dir, file), "utf8") }));
}

/** Every contract problem across the sections, with data-src paths and line ranges checked against the repo. */
export function checkDocs(root, files = repoFiles(root)) {
  return validateFragments(sectionFragments(root), {
    chartNames: CHART_NAMES,
    codeLangs: CODE_LANGS,
    shellIds: SHELL_IDS,
    fileLines: (p) => (p in files ? lineCount(files[p]) : undefined),
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const frags = sectionFragments(root);
  const problems = checkDocs(root);
  if (problems.length) {
    console.error(`${problems.length} problem(s) in src/devdocs/sections:\n${formatProblems(problems)}`);
    process.exit(1);
  }
  console.log(`src/devdocs/sections: ${frags.length} fragment(s), no problems.`);
}
