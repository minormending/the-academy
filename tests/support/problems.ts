// Collect every violation in a data sweep instead of stopping at the first, so one test run lists all of them.
import { expect } from 'vitest';

export interface Problems {
  /** Record `msg` when `cond` is false. Returns `cond` so callers can skip dependent checks. */
  check(cond: unknown, msg: string): boolean;
  /** Fail the test listing every recorded problem. */
  done(): void;
}

export function problems(): Problems {
  const bad: string[] = [];
  return {
    check(cond, msg) { if (!cond) bad.push(msg); return !!cond; },
    done() { expect(bad, `${bad.length} problem(s):\n  ${bad.join('\n  ')}`).toEqual([]); },
  };
}
