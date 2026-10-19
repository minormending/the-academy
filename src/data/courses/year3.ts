// Year 3 classes and their missions. See src/data/courses/README.md for the rules.
import type { CourseDef, QuestDef, YearPlan } from '../../core/types';

export const YEAR_3: YearPlan = {
  year: 3, title: 'Year 3', intro: '', badgesToPass: 1, required: ['core'], outro: '',
};

export const COURSES_Y3: CourseDef[] = [];

/** New missions for this Year (ids `m3_<course>_<n>`). Existing quest ids may also be listed in a course's missions. */
export const MISSIONS_Y3: QuestDef[] = [];
