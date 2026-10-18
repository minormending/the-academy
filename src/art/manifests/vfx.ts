// Asset manifest for the vfx art domain (owned by PX4 / pixel VFX).
// Every file is a pre-trimmed horizontal strip (see PX_SHEETS in src/art/particles.ts for frame sizes),
// except the Emcee Flesher 16x16 sheet, which is sliced by rectangle at boot. Credits: public/assets/vfx/CREDITS.md.
import type { AssetEntry } from '../assets';

const img = (key: string, path: string): AssetEntry => ({ key: `src_vfx_${key}`, path: `vfx/${path}`, type: 'image' });

export const VFX_ASSETS: AssetEntry[] = [
  // CodeManu — Free Pixel Effects Pack (CC0)
  img('cm_flamelash', 'codemanu/flamelash.png'),
  img('cm_firespin', 'codemanu/firespin.png'),
  img('cm_shield', 'codemanu/protectioncircle.png'),
  img('cm_brightfire', 'codemanu/brightfire.png'),
  img('cm_ring', 'codemanu/weaponhit.png'),
  img('cm_fire', 'codemanu/fire.png'),
  img('cm_nebula', 'codemanu/nebula.png'),
  img('cm_vortex', 'codemanu/vortex.png'),
  img('cm_sunburn', 'codemanu/sunburn.png'),
  img('cm_midnight', 'codemanu/midnight.png'),
  img('cm_freezing', 'codemanu/freezing.png'),
  // ansimuz — Gothicvania Magic Pack 9 + Animated Explosions (CC0)
  img('g9_lightning', 'ansimuz_magic9/lightning.png'),
  img('g9_darkbolt', 'ansimuz_magic9/darkbolt.png'),
  img('g9_firebomb', 'ansimuz_magic9/firebomb.png'),
  img('g9_spark', 'ansimuz_magic9/spark.png'),
  img('ex1', 'ansimuz_explosions/explosion-1.png'),
  img('ex2', 'ansimuz_explosions/explosion-2.png'),
  img('ex3', 'ansimuz_explosions/explosion-3.png'),
  img('ex4', 'ansimuz_explosions/explosion-4.png'),
  img('ex6', 'ansimuz_explosions/explosion-6.png'),
  // StarsteelGaming — Spell Effects (CC0)
  img('ss_fireball', 'starsteel/fireball.png'),
  img('ss_icespear', 'starsteel/icespear.png'),
  img('ss_thunder', 'starsteel/thundersphere.png'),
  // Creatures for summons
  img('phoenix', 'chasersgaming_phoenix/phoenix_fly.png'),      // Chasersgaming (CC0)
  img('komodo', 'teasloth_komodo/komodo.png'),                  // teasloth (CC0)
  img('icegolem', 'tautomer_icegolem/icegolem.png'),            // tautomer (CC0)
  img('icecrystal', 'ouren_ice_elemental/crystal.png'),         // Ouren (CC-BY 3.0)
  // kurohina — Spark effect (CC0)
  img('spark', 'kurohina_spark/spark.png'),
  // Emcee Flesher — 16x16 Simple Fantasy RPG FX (CC0), sliced by rect
  img('simplefx', 'emceeflesher_simplefx/simplefx.png'),
];
