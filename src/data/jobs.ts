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
    description: 'A fresh student of the arcane, staff still warm from the academy kiln. Raw magic, boundless potential, questionable aim.',
    look: look({ robe: 0x4a5bd4, robeTrim: 0xe8d36a, hat: 0x37419e, hatTrim: 0xe8d36a, staffGem: 0x9be7ff, hatStyle: 'pointed' }),
  },

  // ── Fire ──
  {
    id: 'pyromancer', name: 'Pyromancer', branch: 'fire', tier: 2, requiredLevel: JOB_LEVELS[2], parent: 'apprentice',
    description: 'Fire answers those bold enough to call it. Pyromancers hurl fireballs and leave burning ground behind — reckless, radiant, unstoppable.',
    look: look({ robe: 0xc0392b, robeTrim: 0xf39c12, hat: 0x9e2a1f, hatTrim: 0xf5b041, staffGem: 0xff7a2a, hatStyle: 'pointed' }),
  },
  {
    id: 'flamebinder', name: 'Flamebinder', branch: 'fire', tier: 3, requiredLevel: JOB_LEVELS[3], parent: 'pyromancer',
    description: 'No longer merely calling fire but binding it. Flamebinders shape infernos into chains, walls and explosions that bloom on command.',
    look: look({ robe: 0xa3161f, robeTrim: 0xffb627, hat: 0xffb627, hatTrim: 0xff5a1f, staffGem: 0xff4a12, hatStyle: 'circlet' }),
  },
  {
    id: 'inferno_sage', name: 'Inferno Sage', branch: 'fire', tier: 4, requiredLevel: JOB_LEVELS[4], parent: 'flamebinder',
    description: 'A living sunrise. Inferno Sages rain meteors and summon phoenixes; where they walk, winter forgets itself.',
    look: look({ robe: 0x7d0a12, robeTrim: 0xffd447, hat: 0xffd447, hatTrim: 0xff3b1f, staffGem: 0xfff0a0, hatStyle: 'crown', hair: 0x3a1a10 }),
  },

  // ── Ice ──
  {
    id: 'cryomancer', name: 'Cryomancer', branch: 'ice', tier: 2, requiredLevel: JOB_LEVELS[2], parent: 'apprentice',
    description: 'Patient as a glacier, sharp as an icicle. Cryomancers slow, freeze and shatter their foes — control first, then the killing frost.',
    look: look({ robe: 0xe8f6ff, robeTrim: 0x5cc8f0, hat: 0xcfeeff, hatTrim: 0x5cc8f0, staffGem: 0x7fe3ff, hatStyle: 'hood' }),
  },
  {
    id: 'frostbinder', name: 'Frostbinder', branch: 'ice', tier: 3, requiredLevel: JOB_LEVELS[3], parent: 'cryomancer',
    description: 'They weave winter into armor and blades. Frostbinders lock whole crowds in ice and break them with a single word.',
    look: look({ robe: 0xd6eefc, robeTrim: 0xb8c4d0, hat: 0x9fd8f5, hatTrim: 0xe6edf3, staffGem: 0x4fd6ff, hatStyle: 'hood' }),
  },
  {
    id: 'glacial_sage', name: 'Glacial Sage', branch: 'ice', tier: 4, requiredLevel: JOB_LEVELS[4], parent: 'frostbinder',
    description: 'The stillness at the heart of a blizzard. Glacial Sages call down storms of ice and stop time itself in a ring of frost.',
    look: look({ robe: 0xf7fcff, robeTrim: 0xc0d4e4, hat: 0xd8e6f0, hatTrim: 0x6fe0ff, staffGem: 0xbff4ff, hatStyle: 'circlet', hair: 0xdfe8ee }),
  },

  // ── Lightning ──
  {
    id: 'stormcaller', name: 'Stormcaller', branch: 'lightning', tier: 2, requiredLevel: JOB_LEVELS[2], parent: 'apprentice',
    description: 'Fast hands, faster bolts. Stormcallers fling chain lightning that leaps from foe to foe — perfect for crowded cliffs.',
    look: look({ robe: 0x4b2a8a, robeTrim: 0xffe14d, hat: 0x3a1f6e, hatTrim: 0xffe14d, staffGem: 0xfff066, hatStyle: 'pointed' }),
  },
  {
    id: 'stormbinder', name: 'Stormbinder', branch: 'lightning', tier: 3, requiredLevel: JOB_LEVELS[3], parent: 'stormcaller',
    description: 'They carry a thunderhead on their shoulders. Stormbinders stun, shock and blink through the battlefield on arcs of light.',
    look: look({ robe: 0x3a1773, robeTrim: 0xffd700, hat: 0x2a0f58, hatTrim: 0xfff36b, staffGem: 0xfff9a8, hatStyle: 'hood' }),
  },
  {
    id: 'tempest_sage', name: 'Tempest Sage', branch: 'lightning', tier: 4, requiredLevel: JOB_LEVELS[4], parent: 'stormbinder',
    description: 'The storm wears a face. Tempest Sages summon thunder from clear skies and answer every question with a lightning strike.',
    look: look({ robe: 0x24104f, robeTrim: 0xfff36b, hat: 0xffe14d, hatTrim: 0xb46bff, staffGem: 0xffffff, hatStyle: 'crown', hair: 0x1c1430 }),
  },
];

/** Tier-2 job for each branch (what Elder Maelis offers at level 10). */
export const BRANCH_ROOT_JOB: Record<'fire' | 'ice' | 'lightning', JobId> = {
  fire: 'pyromancer', ice: 'cryomancer', lightning: 'stormcaller',
};
