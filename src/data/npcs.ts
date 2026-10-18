// OWNER: A9 (progression). NPC definitions (names, titles, looks). Placement lives in maps (A7).
import type { NpcDef } from '../core/types';

export const NPCS: NpcDef[] = [
  {
    id: 'elder_maelis', name: 'Elder Maelis', title: 'Archmage',
    look: { robe: 0xf2efe6, robeTrim: 0xd4af37, hat: 0x6b4fa0, hatTrim: 0xd4af37, hair: 0xe4e4e4, skin: 0xf1c9a5, staffGem: 0xc89bff, hatStyle: 'pointed' },
  },
  {
    id: 'pyra', name: 'Pyra', title: 'Fire Instructor',
    look: { robe: 0xd94f2b, robeTrim: 0xffc04d, hat: 0xffc04d, hatTrim: 0xff6a3d, hair: 0xff5a2a, skin: 0xf5c6a0, staffGem: 0xff8a00, hatStyle: 'circlet' },
  },
  {
    id: 'glacius', name: 'Glacius', title: 'Ice Instructor',
    look: { robe: 0xdff4ff, robeTrim: 0x7fd8ff, hat: 0xbfe9ff, hatTrim: 0xffffff, hair: 0xcfe6f2, skin: 0xe8d5c8, staffGem: 0x8fe3ff, hatStyle: 'hood' },
  },
  {
    id: 'voltis', name: 'Voltis', title: 'Lightning Instructor',
    look: { robe: 0x4b2a8a, robeTrim: 0xffe14d, hat: 0x3a1f6e, hatTrim: 0xffe14d, hair: 0x2a2a3a, skin: 0xd9a77c, staffGem: 0xfff066, hatStyle: 'pointed' },
  },
  {
    id: 'merchant_bram', name: 'Bram', title: 'Potion Merchant',
    look: { robe: 0x7a5a3a, robeTrim: 0xd9b36c, hat: 0x5a3f28, hatTrim: 0xd9b36c, hair: 0x8a5a2b, skin: 0xf0c090, staffGem: 0x7fe07f, hatStyle: 'none' },
  },
  {
    id: 'smith_tilda', name: 'Tilda', title: 'Blacksmith',
    look: { robe: 0x5a6470, robeTrim: 0xc87f3a, hat: 0x3f4650, hatTrim: 0xc87f3a, hair: 0xb5532a, skin: 0xe6b48a, staffGem: 0xff9f43, hatStyle: 'none' },
  },
  {
    id: 'scout_finn', name: 'Finn', title: 'Forest Scout',
    look: { robe: 0x3f7a3a, robeTrim: 0xa9d36b, hat: 0x2f5e2c, hatTrim: 0xa9d36b, hair: 0xd9a441, skin: 0xf5d0a9, staffGem: 0x9bff9b, hatStyle: 'hood' },
  },
];
