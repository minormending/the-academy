// Asset manifest for the ui art domain (owned by PX5, pixel UI).
//
// Most UI art is used directly by the DOM: 9-slice frames in public/assets/ui/golden/ via CSS border-image
// (src/ui/ui.css) and the pixel fonts in public/assets/ui/fonts/ via @font-face. The icon sheet is read by
// src/art/icons.ts through its own HTMLImageElement (iconDataUrl is synchronous and runs before Phaser
// loads anything); it is listed here as well so BootScene preloads it into the browser cache / texture
// manager. See public/assets/ui/CREDITS.md for sources and licenses.
import type { AssetEntry } from '../assets';
export const UI_ASSETS: AssetEntry[] = [
  { key: 'src_ui_icons_7soul1', path: 'ui/icons/rpg_icons_7soul1.png', type: 'image' },
];
