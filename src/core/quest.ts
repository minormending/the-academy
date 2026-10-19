/** Shared helpers for quest/mission objectives. Owned by the lead. */
import type { QuestObjective } from './types';

/** Count needed to complete an objective (level objectives count up to the level). */
export function objectiveGoal(o: QuestObjective): number {
  if (o.kind === 'level') return o.level;
  if (o.kind === 'visit' || o.kind === 'talk') return 1;
  return o.count;
}
