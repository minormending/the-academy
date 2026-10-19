// OWNER: A9 (progression). Job definitions: names, tiers, lineage, flavor and character looks.
import type { CharacterLook, JobDef, JobId } from '../core/types';
import { JOB_LEVELS } from '../core/constants';

const HAIR = 0x5a3a22;
const SKIN = 0xffd9b8;

function look(l: Omit<CharacterLook, 'hair' | 'skin'> & Partial<Pick<CharacterLook, 'hair' | 'skin'>>): CharacterLook {
  return { hair: HAIR, skin: SKIN, ...l };
}

export const JOBS: JobDef[] = [
  {
    id: 'apprentice', name: 'Apprentice', branch: 'none', tier: 1, requiredLevel: JOB_LEVELS[1], parent: null,
    description: 'Year 1 · Core Curriculum. A first-year at the Academy, staff still warm from the kiln. Raw magic, boundless potential, questionable aim.',
    look: look({ robe: 0x4a5bd4, robeTrim: 0xe8d36a, hat: 0x37419e, hatTrim: 0xe8d36a, staffGem: 0x9be7ff, hatStyle: 'pointed' }),
  },

  // ── Fire ──
  {
    id: 'pyromancer', name: 'Pyromancer', branch: 'fire', tier: 2, requiredLevel: JOB_LEVELS[2], parent: 'apprentice',
    description: 'Year 2 · School of Fire. Fire answers those bold enough to call it. Pyromancers hurl fireballs and leave burning ground behind — reckless, radiant, unstoppable.',
    look: look({ robe: 0xc0392b, robeTrim: 0xf39c12, hat: 0x9e2a1f, hatTrim: 0xf5b041, staffGem: 0xff7a2a, hatStyle: 'pointed' }),
  },
  {
    id: 'flamebinder', name: 'Flamebinder', branch: 'fire', tier: 3, requiredLevel: JOB_LEVELS[3], parent: 'pyromancer',
    description: 'Year 3 · School of Fire. No longer merely calling fire but binding it. Flamebinders shape infernos into chains, walls and explosions that bloom on command.',
    look: look({ robe: 0xa3161f, robeTrim: 0xffb627, hat: 0xffb627, hatTrim: 0xff5a1f, staffGem: 0xff4a12, hatStyle: 'circlet' }),
  },
  {
    id: 'inferno_sage', name: 'Inferno Sage', branch: 'fire', tier: 4, requiredLevel: JOB_LEVELS[4], parent: 'flamebinder',
    description: 'Year 4 · Graduate of Fire. A living sunrise. Inferno Sages rain meteors and summon phoenixes; where they walk, winter forgets itself.',
    look: look({ robe: 0x7d0a12, robeTrim: 0xffd447, hat: 0xffd447, hatTrim: 0xff3b1f, staffGem: 0xfff0a0, hatStyle: 'crown', hair: 0x3a1a10 }),
  },

  // ── Ice ──
  {
    id: 'cryomancer', name: 'Cryomancer', branch: 'ice', tier: 2, requiredLevel: JOB_LEVELS[2], parent: 'apprentice',
    description: 'Year 2 · School of Ice. Patient as a glacier, sharp as an icicle. Cryomancers slow, freeze and shatter their foes — control first, then the killing frost.',
    look: look({ robe: 0xe8f6ff, robeTrim: 0x5cc8f0, hat: 0xcfeeff, hatTrim: 0x5cc8f0, staffGem: 0x7fe3ff, hatStyle: 'hood' }),
  },
  {
    id: 'frostbinder', name: 'Frostbinder', branch: 'ice', tier: 3, requiredLevel: JOB_LEVELS[3], parent: 'cryomancer',
    description: 'Year 3 · School of Ice. They weave winter into armor and blades. Frostbinders lock whole crowds in ice and break them with a single word.',
    look: look({ robe: 0xd6eefc, robeTrim: 0xb8c4d0, hat: 0x9fd8f5, hatTrim: 0xe6edf3, staffGem: 0x4fd6ff, hatStyle: 'hood' }),
  },
  {
    id: 'glacial_sage', name: 'Glacial Sage', branch: 'ice', tier: 4, requiredLevel: JOB_LEVELS[4], parent: 'frostbinder',
    description: 'Year 4 · Graduate of Ice. The stillness at the heart of a blizzard. Glacial Sages call down storms of ice and stop time itself in a ring of frost.',
    look: look({ robe: 0xf7fcff, robeTrim: 0xc0d4e4, hat: 0xd8e6f0, hatTrim: 0x6fe0ff, staffGem: 0xbff4ff, hatStyle: 'circlet', hair: 0xdfe8ee }),
  },

  // ── Lightning ──
  {
    id: 'stormcaller', name: 'Stormcaller', branch: 'lightning', tier: 2, requiredLevel: JOB_LEVELS[2], parent: 'apprentice',
    description: 'Year 2 · School of Lightning. Fast hands, faster bolts. Stormcallers fling chain lightning that leaps from foe to foe — perfect for crowded cliffs.',
    look: look({ robe: 0x4b2a8a, robeTrim: 0xffe14d, hat: 0x3a1f6e, hatTrim: 0xffe14d, staffGem: 0xfff066, hatStyle: 'pointed' }),
  },
  {
    id: 'stormbinder', name: 'Stormbinder', branch: 'lightning', tier: 3, requiredLevel: JOB_LEVELS[3], parent: 'stormcaller',
    description: 'Year 3 · School of Lightning. They carry a thunderhead on their shoulders. Stormbinders stun, shock and blink through the battlefield on arcs of light.',
    look: look({ robe: 0x3a1773, robeTrim: 0xffd700, hat: 0x2a0f58, hatTrim: 0xfff36b, staffGem: 0xfff9a8, hatStyle: 'hood' }),
  },
  {
    id: 'tempest_sage', name: 'Tempest Sage', branch: 'lightning', tier: 4, requiredLevel: JOB_LEVELS[4], parent: 'stormbinder',
    description: 'Year 4 · Graduate of Lightning. The storm wears a face. Tempest Sages summon thunder from clear skies and answer every question with a lightning strike.',
    look: look({ robe: 0x24104f, robeTrim: 0xfff36b, hat: 0xffe14d, hatTrim: 0xb46bff, staffGem: 0xffffff, hatStyle: 'crown', hair: 0x1c1430 }),
  },

  // ── Holy ──
  {
    id: 'cleric', name: 'Cleric', branch: 'holy', tier: 2, requiredLevel: JOB_LEVELS[2], parent: 'apprentice',
    description: 'Year 2 · School of Holy Magic. Light given purpose. Clerics mend their own wounds between spells and smite the restless dead with radiant arrows.',
    look: look({ robe: 0xf4efe0, robeTrim: 0xe3b84a, hat: 0xfaf5e8, hatTrim: 0xe3b84a, staffGem: 0xfff3a0, hatStyle: 'hood' }),
  },
  {
    id: 'priest', name: 'Priest', branch: 'holy', tier: 3, requiredLevel: JOB_LEVELS[3], parent: 'cleric',
    description: 'Year 3 · School of Holy Magic. Their prayers are answered in blinding light. Priests bless themselves, stun crowds with sacred rays and call guardian spirits.',
    look: look({ robe: 0xfffaf0, robeTrim: 0xf2c94c, hat: 0xf6edd6, hatTrim: 0xf2c94c, staffGem: 0xfffbd0, hatStyle: 'pointed', hair: 0xc8a36a }),
  },
  {
    id: 'hierophant', name: 'Hierophant', branch: 'holy', tier: 4, requiredLevel: JOB_LEVELS[4], parent: 'priest',
    description: 'Year 4 · Graduate of Holy Magic. A living sanctuary. Hierophants open the heavens themselves, and nothing unholy survives the dawn they bring.',
    look: look({ robe: 0xffffff, robeTrim: 0xffd54a, hat: 0xffd54a, hatTrim: 0x7fe7ff, staffGem: 0xffffff, hatStyle: 'crown', hair: 0xf0e2b8 }),
  },

  // ── Shadow ──
  {
    id: 'occultist', name: 'Occultist', branch: 'shadow', tier: 2, requiredLevel: JOB_LEVELS[2], parent: 'apprentice',
    description: 'Year 2 · School of Shadow Magic. Students of the forbidden margins of the syllabus. Occultists poison, curse and wither — slow deaths for impatient foes.',
    look: look({ robe: 0x2e2440, robeTrim: 0x7cff6b, hat: 0x231b33, hatTrim: 0x7cff6b, staffGem: 0x9dff7a, hatStyle: 'hood', hair: 0x1f1a2a }),
  },
  {
    id: 'necromancer', name: 'Necromancer', branch: 'shadow', tier: 3, requiredLevel: JOB_LEVELS[3], parent: 'occultist',
    description: 'Year 3 · School of Shadow Magic. Death is a resource. Necromancers raise skeletal servants, drain life from the living and leave curses that linger.',
    look: look({ robe: 0x1d1626, robeTrim: 0x9a5cff, hat: 0x150f1f, hatTrim: 0x9a5cff, staffGem: 0xc59bff, hatStyle: 'pointed', hair: 0xe8e0f0, skin: 0xe9dcd2 }),
  },
  {
    id: 'umbral_sage', name: 'Umbral Sage', branch: 'shadow', tier: 4, requiredLevel: JOB_LEVELS[4], parent: 'necromancer',
    description: 'Year 4 · Graduate of Shadow Magic. They walk where light forgets to reach. Umbral Sages command a legion of shades and drown whole fields in night.',
    look: look({ robe: 0x120d1a, robeTrim: 0xb48cff, hat: 0x6a3fc2, hatTrim: 0x7dff5a, staffGem: 0x7dff5a, hatStyle: 'crown', hair: 0xf2f2f2, skin: 0xe4d6cc }),
  },
  // ── Year 5: the Fellowship (postgraduate) ──
  { id: 'pyre_archon', name: 'Pyre Archon', branch: 'fire', tier: 5, requiredLevel: JOB_LEVELS[5], parent: 'inferno_sage',
    description: 'Year 5 · Fellowship of Fire.', look: look({ robe: 0x7a1408, robeTrim: 0xffd447, hat: 0xffd447, hatTrim: 0xff5a1f, staffGem: 0xfff0a0, hatStyle: 'crown', hair: 0xff7a3d }) },
  { id: 'winter_archon', name: 'Winter Archon', branch: 'ice', tier: 5, requiredLevel: JOB_LEVELS[5], parent: 'glacial_sage',
    description: 'Year 5 · Fellowship of Ice.', look: look({ robe: 0xeaf6ff, robeTrim: 0x7fd8ff, hat: 0xbfe9ff, hatTrim: 0xffffff, staffGem: 0xdff8ff, hatStyle: 'crown', hair: 0xf2fbff }) },
  { id: 'storm_archon', name: 'Storm Archon', branch: 'lightning', tier: 5, requiredLevel: JOB_LEVELS[5], parent: 'tempest_sage',
    description: 'Year 5 · Fellowship of Storms.', look: look({ robe: 0x180a3a, robeTrim: 0xfff36b, hat: 0xfff36b, hatTrim: 0x9f6bff, staffGem: 0xffffff, hatStyle: 'crown', hair: 0xe8e0ff }) },
  { id: 'light_archon', name: 'Light Archon', branch: 'holy', tier: 5, requiredLevel: JOB_LEVELS[5], parent: 'hierophant',
    description: 'Year 5 · Fellowship of Light.', look: look({ robe: 0xfffdf4, robeTrim: 0xffc83d, hat: 0xffe27a, hatTrim: 0x7fe7ff, staffGem: 0xffffff, hatStyle: 'crown', hair: 0xfff0c0 }) },
  { id: 'night_archon', name: 'Night Archon', branch: 'shadow', tier: 5, requiredLevel: JOB_LEVELS[5], parent: 'umbral_sage',
    description: 'Year 5 · Fellowship of Shadow.', look: look({ robe: 0x07050c, robeTrim: 0x7dff5a, hat: 0x3a1f6e, hatTrim: 0x7dff5a, staffGem: 0xb48cff, hatStyle: 'crown', hair: 0x101010, skin: 0xd8cfc8 }) },
];

/** The five Schools a student can declare in Year 2 (job branches other than 'none'). */
export type School = 'fire' | 'ice' | 'lightning' | 'holy' | 'shadow';
export const SCHOOLS: School[] = ['fire', 'ice', 'lightning', 'holy', 'shadow'];

/** Year-2 job for each School (what Headmistress Maelis offers at level 10). */
export const BRANCH_ROOT_JOB: Record<School, JobId> = {
  fire: 'pyromancer', ice: 'cryomancer', lightning: 'stormcaller', holy: 'cleric', shadow: 'occultist',
};

/** Short School name ("Fire", "Holy"…) for player-facing text. */
export const SCHOOL_NAME: Record<School, string> = {
  fire: 'Fire', ice: 'Ice', lightning: 'Lightning', holy: 'Holy', shadow: 'Shadow',
};

/** NPC id of the Professor who heads each School (runs its Year 3/4 Exams). */
export const SCHOOL_PROFESSOR: Record<School, string> = {
  fire: 'pyra', ice: 'glacius', lightning: 'voltis', holy: 'seraphine', shadow: 'morvane',
};

export function isSchool(b: string | undefined | null): b is School {
  return !!b && (SCHOOLS as string[]).includes(b);
}

/** School Year for a job tier (Year 1 = Apprentice … Year 4 = graduate title). */
export function yearOfTier(tier: number): number { return Math.max(1, Math.min(4, tier | 0)); }
