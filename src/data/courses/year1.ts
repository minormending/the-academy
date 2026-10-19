// Year 1 classes and their missions. See src/data/courses/README.md for the rules.
import type { CourseDef, QuestDef, YearPlan } from '../../core/types';

export const YEAR_1: YearPlan = {
  year: 1, title: 'Year 1', intro: '', badgesToPass: 1, required: ['core'], outro: '',
};

export const COURSES_Y1: CourseDef[] = [];

/** New missions for this Year (ids `m1_<course>_<n>`). Existing quest ids may also be listed in a course's missions. */
export const MISSIONS_Y1: QuestDef[] = [];
