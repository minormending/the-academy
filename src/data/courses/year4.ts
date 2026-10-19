// Year 4 classes and their missions. See src/data/courses/README.md for the rules.
import type { CourseDef, QuestDef, YearPlan } from '../../core/types';

export const YEAR_4: YearPlan = {
  year: 4, title: 'Year 4', intro: '', badgesToPass: 1, required: ['core'], outro: '',
};

export const COURSES_Y4: CourseDef[] = [];

/** New missions for this Year (ids `m4_<course>_<n>`). Existing quest ids may also be listed in a course's missions. */
export const MISSIONS_Y4: QuestDef[] = [];
