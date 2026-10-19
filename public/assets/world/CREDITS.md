# World art credits (16-bit pixel pivot)

All world art (terrain, parallax, decor, town, portal/ambient FX) is built from packs by
**Luis Zuno (@ansimuz)**, published on OpenGameArt.org under **CC0 1.0** (public domain dedication,
https://creativecommons.org/publicdomain/zero/1.0/). Credit is not required; we give it anyway.
Each pack's own license text is kept in `licenses/`.

The PNGs in this folder are derived from those packs: sliced, recomposed and palette-swapped
(1× source pixels; the game integer-scales them ×2 at boot). A few small pieces were hand-pixelled
to match the packs' palettes (giant mushrooms, snowman, icicles, braziers, fountain, bench, fence,
bunting, rope, portal swirl, particles, sun/moon/stars, waterfall/lava strips).

| Asset | Author | Source URL | License | Used for |
|---|---|---|---|---|
| Sunny Land (2D pixel art pack) | Luis Zuno (@ansimuz) | https://opengameart.org/content/sunny-land-2d-pixel-art-pack | CC0 | Terrain kit for every theme (grass/dirt tiles, log beams, ladder; palette-swapped per theme), cottage → all six NPC buildings (roof/wall recolours, widened), bush, rock, shrooms, sign, tree (blossom tree), stump, log, tufts/flowers |
| Sunny Land Woods | Luis Zuno (@ansimuz) | https://opengameart.org/content/sunnyland-woods | CC0 | Town sky/clouds, mountains, tree-line parallax; snow sky + icy mountains (recoloured); forest mid layer |
| Sunnyland Expansion Pack: Trees | Luis Zuno (@ansimuz) | https://opengameart.org/content/sunnyland-expansion-pack-trees | CC0 | Oak / dark oak / dead tree, pines (snowy, wind-swept, burnt) |
| Magical Road environment | Luis Zuno (@ansimuz) | https://opengameart.org/content/magical-road-pixel-art-environment | CC0 | Tall snowy pine |
| Country-side platform tiles | Luis Zuno (@ansimuz) | https://opengameart.org/content/country-side-platform-tiles | CC0 | Forest sky + far pine forest; round tree; snow near pine-line (recoloured) |
| Tall Forest environment | Luis Zuno (@ansimuz) | https://opengameart.org/content/sunnyland-tall-forest-environment | CC0 | Big rock, moss tuft |
| Magic Cliffs environment | Luis Zuno (@ansimuz) | https://opengameart.org/content/magic-cliffs-environment | CC0 | Storm sky, storm cloud bank, storm mid hills (recoloured) |
| Mountain at Dusk background | Luis Zuno (@ansimuz) | https://opengameart.org/content/mountain-at-dusk-background | CC0 | Volcano sky (moon removed, recoloured); storm far mountains + tree-line |
| Gothicvania Town | Luis Zuno (@ansimuz) | https://opengameart.org/content/gothicvania-town | CC0 | Town skyline parallax (recoloured), street lamps, well, barrel, crate, hanging shop signs |
| Gothicvania Church | Luis Zuno (@ansimuz) | https://opengameart.org/content/gothicvania-church-pack | CC0 | Sanctum pillars (whole / broken) |
| Fort of Illusion | Luis Zuno (@ansimuz) | https://opengameart.org/content/fort-of-illusion | CC0 | Mage tower (cone roof + stone body, recoloured, stretched), tower windows, town gate arch, guild-hall banners, storm/town flags, sanctum sky + far mountains, snow far mountains |
| Warped Caves | Luis Zuno (@ansimuz) | https://opengameart.org/content/warped-caves-pixel-art-pack | CC0 | Shroom Hollow sky + cave parallax (recoloured), glow fungus, lava spire (from stalactite), runestone |
| Super Grotto Escape (Warped) | Luis Zuno (@ansimuz) | https://opengameart.org/content/warped-super-grotto-escape-pack | CC0 | Sanctum floating-ruin layer, broken storm pillar (recoloured) |
| Gothicvania Rocky Pass | Luis Zuno (@ansimuz) | https://opengameart.org/content/gothicvania-rocky-pass-environment | CC0 | Volcano far + near rock layers (recoloured), ice crystals / obsidian (recoloured crystals) |

## Theme → source mapping

| Theme (map) | Terrain | Parallax (back → front) | Notable decor |
|---|---|---|---|
| town (Academy campus, map id `mistvale`) | Sunny Land, wooden log-beam platforms | Woods clouds → Woods mountains → Gothicvania town skyline (blue haze) → Woods tree-line | Sunny Land cottages ×6 (recoloured, widened, element banners), Fort tower, Gothicvania lamps/well/signs, Fort gate |
| forest (Whisperwood) | Sunny Land (greener grass) | Country-side sky → Country-side pine forest → Woods tree-line | Sunnyland trees, country tree, bushes, flowers, waterfall |
| mushroom (Shroom Hollow) | Sunny Land → purple soil / teal moss | Warped forest silhouettes → Warped cave (night purple + teal) + stars | hand-pixelled giant mushrooms, Warped glow fungus, vines |
| snow (Frostfang Cliffs) | Sunny Land → snow / ice-slate | Woods clouds (cool) → Fort mountains (icy) → Woods mountains (snow) → Country pines (frosted) | Magical Road + Sunnyland pines with snow caps, Rocky Pass crystals (ice), snowman, icicles |
| volcano (Cinder Caverns) | Sunny Land → ember crust / basalt | Mountain-at-Dusk sky (red, moonless) → Rocky Pass rocks (dark) → Rocky Pass arches (crimson) | lava spires, obsidian, braziers, burnt pines, lava falls |
| storm (Stormspire Peak) | Sunny Land → sage grass / slate | Magic Cliffs sky → Dusk mountains → Magic Cliffs clouds (drifting) → Magic Cliffs hills → Dusk tree-line | dead trees, wind pines, runestones, broken pillars, storm flags, 16-bit lightning |
| sanctum (Arcane Sanctum) | Sunny Land → marble / gold | Fort sky (violet) → Fort mountains (violet) → Grotto ruins (violet) + stars + moon | Church pillars, arcane banners, floating crystals, arcane circle, arcane braziers |

## The Academy additions (derived, no new downloads)

`town/t_hall_holy.png`, `town/t_hall_shadow.png`, `town/t_sign_holy.png`, `town/t_sign_shadow.png`,
`town/t_banner_holy.png`, `town/t_banner_shadow.png` are palette swaps of the existing pieces above
(Sunny Land hall, Gothicvania Town hanging sign, Fort of Illusion banner — all CC0, Luis Zuno) with small
hand-pixelled additions in the same palettes (Holy bell-cote + cross and sun emblem; Shadow gothic spires and
skull emblem). The Shadow hall is flanked by the existing Gothicvania Church skull pillar (`d_pillar`).

## Branch zones (derived + hand-pixelled, no new downloads)

The three branch-zone looks reuse the packs above; nothing new was downloaded.
- **Moonlit Marsh** (`terrain/marsh.png`, `bg/marsh_sky|far|mid.png`): night palette swaps of the forest kit and
  the Country-side / Sunny Land Woods strips (CC0, Luis Zuno). `bg/marsh_mist.png` (dithered fog band),
  `decor/d_reeds.png` and `decor/d_bog_pool.png` are hand-pixelled in the same palette.
- **Glacier Grotto** (`terrain/grotto.png`, `bg/grotto_far.png`): ice palette swaps of the snow kit and the Warped
  Caves cave layer (CC0, Luis Zuno). `bg/grotto_sky|ceiling|mid.png` (gradient, ice roof and ice spires) and
  `decor/d_ice_spire.png` are hand-pixelled.
- **The Restricted Stacks** (`terrain/library.png`): the sanctum kit layout with a hand-pixelled carpet/masonry
  floor and bookshelf ledges, plus the Sunny Land ladder darkened. `bg/library_sky|far|mid.png` (shelf walls,
  arched windows, pillars) and `decor/d_bookshelf|d_candles|d_book_float|d_book_pile.png` are hand-pixelled.
