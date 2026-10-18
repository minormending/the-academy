// Asset manifest for the holy skill tree VFX (owned by the holy tree agent). Files under public/assets/vfx/holy/.
// Sliced / palette-swapped at boot by src/skills/holy/sheets.ts. Credits: public/assets/vfx/holy/CREDITS.md.
import type { AssetEntry } from '../assets';

const img = (key: string, path: string): AssetEntry => ({ key: `src_vfx_${key}`, path: `vfx/holy/${path}`, type: 'image' });

export const HOLY_ASSETS: AssetEntry[] = [
  img('holy_wings', 'cethiel_wings/wings_effect.png'),      // Cethiel — Angel Wings Effect (CC0), 5 × 94×38
  img('holy_angel', 'antumdeluge_angels/angel_side.png'),   // Cabbit & AntumDeluge — Angels (CC-BY 3.0 / OGA-BY 3.0), 3 × 48×64
  img('holy_wing', 'twiswist_wing/wing.png'),               // twiswist — white wing 32x32 (CC0), 2 × 32×32 (top row)
];
