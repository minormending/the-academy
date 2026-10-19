// The section fragments, in file-name order (CONTRACT.md). Raw HTML strings,
// bundled at build time; the shell parses them into the page.

import type { Fragment } from "./validate";

const raw = import.meta.glob<string>("./sections/*.html", { query: "?raw", eager: true, import: "default" });

export const FRAGMENTS: Fragment[] = Object.keys(raw)
  .sort()
  .map((key) => ({ file: key.slice(key.lastIndexOf("/") + 1), html: raw[key] }));
