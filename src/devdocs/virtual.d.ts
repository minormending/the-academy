// The build-time modules served by vite.config.ts (devdocsSource). Only the docs page imports them.
declare module "virtual:devdocs-source" {
  const stats: import("./charts/sourceStats").SourceStats;
  export default stats;
}
declare module "virtual:devdocs-files" {
  /** Repository-relative path → line count, for every text file (dev-only checks of data-src links). */
  const lines: Record<string, number>;
  export default lines;
}
