// Year 2 classes and their missions. See src/data/courses/README.md for the rules.
import type { CourseDef, QuestDef, YearPlan } from '../../core/types';

export const YEAR_2: YearPlan = {
  year: 2, title: 'Year 2', intro: '', badgesToPass: 1, required: ['core'], outro: '',
};

export const COURSES_Y2: CourseDef[] = [];

/** New missions for this Year (ids `m2_<course>_<n>`). Existing quest ids may also be listed in a course's missions. */
export const MISSIONS_Y2: QuestDef[] = [];
