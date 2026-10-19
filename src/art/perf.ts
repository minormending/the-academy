/** Boot/generation timing marks (cheap: one performance.measure per call). Read with
 *  `performance.getEntriesByType('measure').filter(m => m.name.startsWith('gen:'))`. */
export function timed<T>(name: string, fn: () => T): T {
  const t0 = performance.now();
  try { return fn(); } finally {
    try { performance.measure(`gen:${name}`, { start: t0, end: performance.now() }); } catch { /* ignore */ }
  }
}
