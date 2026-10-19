# Monster & drop art credits

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
