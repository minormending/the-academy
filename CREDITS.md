# Credits

The Academy's pixel art comes from the generous artists below. Every asset is used under its stated
license (CC0, CC-BY 3.0/4.0 or OGA-BY); attribution is given here as those licenses require. Each pack's
original license text sits next to its files in `public/assets/<domain>/`.

Code, game design, procedural fallback art and synthesized audio are original to this project.

## Characters

| Asset | Author | Source | License | Used for |
|---|---|---|---|---|
| Pointy Hat Mage (1.0) — `pointy_hat_mage/` (idle, walk, jump, attack, climb, hurt, death sheets) | Commissioned from michael_araya (fiverr.com/michael_araya), distributed by Foozle (foozle.io) | https://foozlecc.itch.io/pointy-hat-mage | CC0 1.0 (http://creativecommons.org/publicdomain/zero/1.0/) — "free to use and modify for all projects, including commercial projects. Attribution not required." | Player sprite for all ten jobs (palette-swapped per job look, plus hat band / circlet gem / crown / aura by tier); NPCs Pyra, Glacius, Voltis, Tilda and Finn; dialog portraits |
| Purple Mage (1.0) — `purple_mage/idle.png` | Commissioned from reimonkey (fiverr.com/reimonkey), distributed by Foozle (foozle.io) | https://foozlecc.itch.io/purple-mage | CC0 1.0 — same wording as above | NPCs Elder Maelis and Bram (palette-swapped, 1 px outline added); their dialog portraits |

The original readme of each pack, which contains the license text, is kept as `LICENSE.txt` in that pack's folder.
Credit is not required by CC0. It is listed here as a courtesy.

## Monsters

All sheets are used as sliced / palette-swapped / integer-scaled sources by `src/art/monsterArt.ts`
(manifest: `src/art/manifests/monsters.ts`). Every row below was checked on its source page on 2026-10-18.

| Asset (folder) | Author | Source URL | License | Used for |
|---|---|---|---|---|
| Sunny mushroom (walk, breath, breath-no-gas), Grotto Escape 2 lizard (idle/walk/hurt), Grotto Escape 2 boss dragon (idle), flying creature (skin) — `ansimuz_sideview_fantasy/` | Luis Zuno (@ansimuz) | https://opengameart.org/content/sideview-fantasy-patreon-collection | CC0 (as posted on OGA by the author; the pack also ships a stale `patreon-license.txt` in the boss-dragon folder, superseded by the author's public CC0 release) | `cap_shroom`, `thorn_shroom` (purple cap swap, spore-breath idle), `lava_salamander` (lava ramp), `thunder_drake` (storm ramp), `storm_harpy` (storm ramp); field bosses `shroom_monarch` (crimson cap swap ×4, spore-breath attack) and `tempest_wyrm` (boss dragon, storm-violet/yellow swap ×3) |
| Gothicvania Church — skeleton wizard sheet — `ansimuz_gothicvania_church/` | Luis Zuno (@ansimuz) | https://opengameart.org/content/gothicvania-church-pack | CC0 ("Public domain and free to use on whatever you want, personal or commercial", `public-license.txt`) | `lich_archon` boss (idle + 10-frame cast attack, arcane-violet fire swap, ×4) |
| Sunny Land — enemy-death poof — `ansimuz_sunny_land/` | Luis Zuno (@ansimuz) | https://opengameart.org/content/sunny-land-2d-pixel-art-pack | CC0 (`public-license.txt`) | Derived death animation (fade + poof) for monsters without source death frames |
| Dark Fantasy Platformer Bestiary — wartaur, golem (pal2), sparky — `emceeflesher_bestiary/` | Compiled/edited by Emcee Flesher; sparky from surt's Monster Boy mockup (CC0) edited by Emcee Flesher; wartaur by Redshrike (Stephen Challener); golem by Redshrike & William.Thompsonj (LPC golem) | https://opengameart.org/content/dark-fantasy-platformer-bestiary (originals: https://opengameart.org/content/monsterboy-in-wonder-world-mockup-assets , https://opengameart.org/content/lpc-golem , https://opengameart.org/content/tower-defense-prototyping-assets-4-monsters-some-tiles-a-background-image) | CC-BY 4.0 (bestiary page); components CC0 / CC-BY 3.0 | `snow_yeti` (snow-fur swap), `magma_golem` (magma ramp) + `crag_golem` (stone ramp), `ice_wisp` (ice ramp) + `void_wisp` (void ramp); field bosses `frostfang_alpha` (wartaur, deep-ice swap ×3, axe-swing attack) and `magmaw` (golem, molten ramp ×3, smash attack) |
| Slime Snail — `reemax_snail/` | Reemax | https://opengameart.org/content/slime-snail | CC-BY 3.0 | `moss_snail` (right-facing crawl row; mossy shell hue shift); field boss `mossback_matriarch` (stone-moss swap ×4; its shell-spin cycles the sheet's four views) |
| Slime monster 24x24 — `bonsaiheldin_slime/` | Bonsaiheldin (http://bonsaiheld.org) | https://opengameart.org/content/slime-monster-24x24 | CC-BY 4.0 (`Readme.txt`) | `puff_slime` |
| 3/4-view stump creature walk cycle — `antiotter_stump/` | AntiOtter | https://opengameart.org/content/34-view-stump-creature-walk-cycle | CC-BY 4.0 ("Feel free to use, just credit me") | `stump_golem` |
| Animated Imp — `calciumtrice_imp/` | Calciumtrice (recolor by Merry Dream Games) | https://opengameart.org/content/imp-1 | CC-BY 3.0 ("Credit should be given to Calciumtrice") | `ember_imp` (idle / walk / death; fire hue shift) |
| Enemy Galore I — bat (fly / hit / death) — `admurin_enemy_galore/` | Admurin | https://opengameart.org/content/enemy-galore-i | CC-BY 4.0 | `frost_bat` (ice ramp) |
| Coin animation bronze/silver/gold — `zaphgames_coins/` | zaphgames | https://opengameart.org/content/coin-animation-bronze-silver-gold | CC-BY 3.0 | `drop_coin_bronze/silver/gold` (8-frame spin, ×2) |

Original work (no third-party source): the meso bag (`drop_bag`) and the pixel status overlays
(`monster_fx_*`: ice shell, shards, stun star, spark, ember, snow, puff, orb, aura, glow) are hand-placed
pixel maps in `monsterArt.ts`, drawn at 1× and scaled ×2 (aura ×4). Likewise original: the field boss
overlays (Matriarch flower crown, Monarch gold crown, Alpha ice crest, Magmaw flame crest, Wyrm horns — stamped
at 1× onto the sheet frames before scaling) and the boss attack textures (`boss_fx_*`: icicle, slime glob,
puddle, spore cloud, shockwave, rock chip).

Suggested attribution line: "Monster art by Luis Zuno (ansimuz, CC0), Emcee Flesher, surt, Redshrike, Reemax,
William.Thompsonj, Bonsaiheldin, AntiOtter, Calciumtrice, Merry Dream Games, Admurin and zaphgames (CC-BY 3.0/4.0),
via OpenGameArt.org."

## World

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

## Vfx

All sheets were downloaded from the source pages below, checked for license, and only the needed PNGs (plus
the pack's license/readme text) were copied here. Most were re-packed offline into trimmed horizontal strips
(frames sub-sampled, cropped to content); at boot `src/art/particles.ts` slices them, builds per-element
palette swaps (fire / ice / storm / arcane / gold ramps) and plays them integer-scaled (×2, ×4) with
nearest-neighbour filtering.

| Asset | Author | Source | License | Used for |
|---|---|---|---|---|
| Free Pixel Effects Pack (flamelash, firespin, protection circle, brightfire, weapon hit, fire, nebula, vortex, sunburn, midnight, freezing) | CodeManu | https://opengameart.org/content/free-pixel-effects-pack | CC0 | fire hits/burst/pillar/kindle/ascension, meteor body, pixel shockwave rings, ward bubbles (mana shield, frost armor, tempest surge), ice nova/shatter/orb pulse, frozen orb + winter swirl, combust/overload vortex, blink wisp, nova, job-advance finale |
| Gothicvania Magic Pack 9 (Lightning, Dark-Bolt, Fire-bomb, spark) | Luis Zuno (ansimuz) | https://opengameart.org/content/gothicvania-magic-pack-9 | CC0 | storm/spear/step/surge/totem lightning strikes, spear impact, electric orb casts & hits, thunderstorm bolt heads, totem crystal, ice spike dome (ice palette) |
| Animated Explosions (explosion-1/2/3/4/6) | Luis Zuno (ansimuz) | https://opengameart.org/content/animated-explosions | CC0 | fire hits, orb/combust explosions, pillar base, meteor impact mushroom, lance beam blasts |
| Spell Effects (Fireball, Icespear, Thundersphere) | StarsteelGaming | https://opengameart.org/content/spell-effects-by-starsteelgaming | CC0 | Blazing Orb projectile, Ice Lance / Glacial Lance / blizzard icicles, Ball Lightning body + burst, lance/ball cast flashes |
| Phoenix (reborn) — fly row | Chasersgaming | https://opengameart.org/content/phoenix-reborn | CC0 | Summon Phoenix body; Thunderbird body (storm palette swap) |
| Komodo | teasloth | https://opengameart.org/content/komodo | CC0 | Summon Salamander body (fire palette swap) |
| Walking Ice Golem | tautomer | https://opengameart.org/content/walking-ice-golem | CC0 | Frost Elemental summon body |
| Ice Elemental (idle crystal frames) | Ouren | https://opengameart.org/content/ice-elemental | CC-BY 3.0 — attribution: "Ice Elemental" by Ouren; modified (re-packed, palette-swapped) | Frozen Orb core, Glacial Lance head |
| Spark effect | kurohina | https://opengameart.org/content/spark-effect | CC0 | hit_generic, lightning zap hits, chain-jump sparks, claw/nova hits (tinted) |
| 16x16 Simple Fantasy RPG FX | Emcee Flesher | https://opengameart.org/content/16x16-simple-fantasy-rpg-fx | CC0 | Flame Arrow / Salamander spit / Arcane Bolt projectiles, phoenix bolt, small flames, fire cast stars, ice bolt orb, snow burst, ice shatter, ice tornado, ice shards, arcane claw slashes, ring bursts, level-up/heal burst, pickup/respawn twinkles |

## Holy School VFX

New sheets for the holy tree. Everything else the holy VFX use is a gold/white palette swap of the shared CC0 sheets in
`public/assets/vfx/` (see that folder's CREDITS.md): CodeManu Free Pixel Effects Pack, ansimuz Gothicvania Magic Pack 9 +
Animated Explosions, StarsteelGaming Spell Effects, Chasersgaming Phoenix, kurohina Spark, Emcee Flesher 16x16 Simple
Fantasy RPG FX. Recolouring happens at boot in `src/skills/holy/sheets.ts`.

| Asset | Author | Source | License | Used for |
|---|---|---|---|---|
| Angels (angel-f-001, east-facing row) | Svetlana Kushnariova (Cabbit) <lana-chan@yandex.ru>, liftarn, johnny_automatic, freedo & Jordan Irwin (AntumDeluge) | https://opengameart.org/content/angels | CC-BY 3.0+ / OGA-BY 3.0+ — attribution: "Angels" by Svetlana Kushnariova (Cabbit) <lana-chan@yandex.ru> & Jordan Irwin (AntumDeluge); modified (cropped row, re-packed) | Seraph summon body |
| Angel Wings Effect (white set) | Cethiel | https://opengameart.org/content/angel-wings-effect | CC0 | Seraph wing aura; unfolding wings on Bless / Holy Symbol / Divine Aegis / Angel Ray / Genesis / Judgment / Salvation / Holy Step / Prayer of Mana casts (gold & pale-light palette swaps); downsampled 2x with stepped alpha |
| white wing 32x32 | twiswist | https://opengameart.org/content/white-wing-32x32 | CC0 | Guardian Spirit's little wings, Divine Aegis aura wings, Angel Ray spear-head wings, Seraph fallback |

## Ui

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
