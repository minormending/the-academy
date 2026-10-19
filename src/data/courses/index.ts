// Story mode: every Year's classes, missions and plan. Aggregated by the Registry.
import type { CourseDef, QuestDef, YearNo, YearPlan } from '../../core/types';
import { COURSES_Y1, MISSIONS_Y1, YEAR_1 } from './year1';
import { COURSES_Y2, MISSIONS_Y2, YEAR_2 } from './year2';
import { COURSES_Y3, MISSIONS_Y3, YEAR_3 } from './year3';
import { COURSES_Y4, MISSIONS_Y4, YEAR_4 } from './year4';
import { COURSES_Y5, MISSIONS_Y5, YEAR_5 } from './year5';
import { COURSES_Y2_MAJORS, MISSIONS_Y2_MAJORS } from './year2majors';
import { COURSES_Y3_MAJORS, MISSIONS_Y3_MAJORS } from './year3majors';
import { COURSES_Y4_MAJORS, MISSIONS_Y4_MAJORS } from './year4majors';
import { COURSES_Y5_MAJORS, MISSIONS_Y5_MAJORS } from './year5majors';

export const COURSES: CourseDef[] = [
  ...COURSES_Y1,
  ...COURSES_Y2, ...COURSES_Y2_MAJORS,
  ...COURSES_Y3, ...COURSES_Y3_MAJORS,
  ...COURSES_Y4, ...COURSES_Y4_MAJORS,
  ...COURSES_Y5, ...COURSES_Y5_MAJORS,
];
export const MISSIONS: QuestDef[] = [
  ...MISSIONS_Y1,
  ...MISSIONS_Y2, ...MISSIONS_Y2_MAJORS,
  ...MISSIONS_Y3, ...MISSIONS_Y3_MAJORS,
  ...MISSIONS_Y4, ...MISSIONS_Y4_MAJORS,
  ...MISSIONS_Y5, ...MISSIONS_Y5_MAJORS,
];
export const YEAR_PLANS: Record<YearNo, YearPlan> = { 1: YEAR_1, 2: YEAR_2, 3: YEAR_3, 4: YEAR_4, 5: YEAR_5 };
