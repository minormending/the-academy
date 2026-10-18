// Asset manifest for the characters art domain (owned by that domain's art agent).
// Sources (both CC0, see public/assets/characters/CREDITS.md):
//   pointy_hat_mage/* — Foozle "Pointy Hat Mage" (player + most NPCs, palette-swapped per job/NPC)
//   purple_mage/*     — Foozle "Purple Mage" (old sage NPCs: Elder Maelis, Bram)
import type { AssetEntry } from '../assets';

const img = (key: string, path: string): AssetEntry => ({ key, path, type: 'image' });

export const CHARACTER_ASSETS: AssetEntry[] = [
  img('src_char_witch_idle', 'characters/pointy_hat_mage/idle.png'),
  img('src_char_witch_walk', 'characters/pointy_hat_mage/walk.png'),
  img('src_char_witch_jump', 'characters/pointy_hat_mage/jump.png'),
  img('src_char_witch_attack', 'characters/pointy_hat_mage/attack.png'),
  img('src_char_witch_climb', 'characters/pointy_hat_mage/climb.png'),
  img('src_char_witch_hurt', 'characters/pointy_hat_mage/hurt.png'),
  img('src_char_witch_death', 'characters/pointy_hat_mage/death.png'),
  img('src_char_sage_idle', 'characters/purple_mage/idle.png'),
];
