// Year 5 classes and their missions. See src/data/courses/README.md for the rules.
import type { CourseDef, QuestDef, YearPlan } from '../../core/types';

export const YEAR_5: YearPlan = {
  year: 5, title: 'Year 5', intro: '', badgesToPass: 1, required: ['core'], outro: '',
};

export const COURSES_Y5: CourseDef[] = [];

/** New missions for this Year (ids `m5_<course>_<n>`). Existing quest ids may also be listed in a course's missions. */
export const MISSIONS_Y5: QuestDef[] = [];
