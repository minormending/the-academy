# UI art credits (PX5: pixel UI)

All UI art for Arcana Story's 16-bit look comes from the freely licensed packs below. Files were downloaded
into a scratch directory, nothing in them was executed, and only the PNG/TTF files (plus license text) that
the game uses were copied here. Some PNGs are crops or recolours of the originals (noted below).

| Asset | Author | Source | License | Used for |
|---|---|---|---|---|
| Kenney Fonts: **Kenney Pixel**, **Kenney Mini** (`fonts/KenneyPixel.ttf`, `fonts/KenneyMini.ttf`) | Kenney (kenney.nl) | https://kenney.nl/assets/kenney-fonts | CC0 1.0 (`fonts/License-Kenney-Fonts.txt`) | All DOM UI text (Kenney Pixel 16px = 1:1 pixels; Kenney Mini at 16/24/32/48/64px = 2×–8× pixels for titles, logo and banners), player/NPC name tags, damage-number digits (Kenney Pixel glyphs thresholded to 1-bit and integer-scaled) |
| **Golden UI** (`golden/panel.png`, `golden/button*.png`) | Buch (OpenGameArt user "Buch") | https://opengameart.org/content/golden-ui (file `ui_split.png`) | CC0 1.0 (stated on the page) | Window / hotbar / minimap / title-button 9-slice frame (pieces stitched, grey fill palette-swapped to indigo) and the gold buttons (normal / hover / pressed), drawn at 2× with `image-rendering: pixelated` |
| Hand-made 9-slices in the Golden UI (DawnBringer-16 style) palette (`golden/slot.png`, `slot_hover.png`, `well.png`, `tooltip.png`, `tab.png`, `track.png`) | PX5 (made for this project) | — | Same terms as the game | Hotbar/inventory slots, sunken wells, tooltips, tabs, gauge rims |
| **496 pixel art icons for medieval/fantasy RPG** (135 of them packed into `icons/rpg_icons_7soul1.png`, 12×12 grid of 34×34 cells) | Henrique Lazarini (7Soul1), submitted to OGA by gnola14 | https://opengameart.org/content/496-pixel-art-icons-for-medievalfantasy-rpg | CC0 1.0 (stated on the page) | Every skill and item icon (`IconGlyph` → icon mapping in `src/art/icons.ts`; some are palette-swapped to the skill's colour) and the quick-menu button icons |

Notes
- The title-screen backdrop is still the game's own procedural night sky + mage tower, now drawn with stepped
  colour bands and passed through Phaser's built-in Pixelate post-FX (4×4 pixel grid); no third-party image.
- Nothing here is NonCommercial or ripped from a commercial game.
