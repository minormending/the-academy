# Arcana Story — Architecture & Team Contract

A MapleStory-style 2D side-scroller where every character is a mage. Start as an **Apprentice**,
then specialise at level 10 into one of three trees, with 3rd and 4th advancements at 25 and 40:

| Tier | Level | Fire | Ice | Lightning |
|---|---|---|---|---|
| 1 | 1 | Apprentice | Apprentice | Apprentice |
| 2 | 10 | Pyromancer | Cryomancer | Stormcaller |
| 3 | 25 | Flamebinder | Frostbinder | Stormbinder |
| 4 | 40 | Inferno Sage | Glacial Sage | Tempest Sage |

Stack: **TypeScript + Phaser 3.90 (Arcade physics) + Vite**. No external assets — all art is
procedural (Canvas 2D / Phaser Graphics → textures) and all audio is synthesized (WebAudio).
Game UI windows/HUD are **DOM** (in `#ui-root`, overlaid on the canvas). Damage numbers and
world-space name tags are Phaser objects.

Run: `npm run dev` (http://localhost:5199, add `?debug=1` for physics debug). Typecheck: `npx tsc --noEmit`.
Debug console: `arcana.levelTo(30)`, `arcana.job('pyromancer')`, `arcana.give('red_potion', 10)`,
`arcana.warp('cinder_caverns')`, `arcana.maps()`, `arcana.s` (all services).

---

## Ground rules for builder agents

1. **Edit only the files you own** (table below). You may create new files only inside your own
   namespace (listed per owner). Never edit `src/core/*`, `src/main.ts`, `src/scenes/BootScene.ts`,
   `src/scenes/GameScene.ts`, `src/skills/index.ts` — those belong to the lead.
2. Your files currently contain **stubs** with the exact exported names/signatures the rest of the
   game imports. Keep every existing export (name + signature compatible). Add more exports freely.
3. Code only against `src/core/types.ts` interfaces + `Registry` + `bus` + `playVfx` — never import
   another agent's concrete class (the exceptions are the explicitly shared helpers listed under
   "Shared helpers").
4. **Constructors must not call other services** (the services object is filled in after construction).
   Subscribing to `bus` in a constructor is fine. Do work lazily in methods / `bindMap` / `update`.
5. Typecheck with `npx tsc --noEmit`. **Your files must have zero errors.** Errors in other agents'
   files are not yours — other agents are editing in parallel; ignore them.
6. Do not add npm dependencies. Do not run `git`. Do not start a dev server (the lead does playtesting).
7. Use the **Phaser 3.60+ API** (Phaser 3.90): particles are `scene.add.particles(x, y, key, config)`
   returning a `ParticleEmitter` (`emitter.explode(n, x, y)`, `emitter.stop()`), not the old
   `ParticleEmitterManager`. When unsure, grep `node_modules/phaser/types/phaser.d.ts`.
8. Everything must be robust: missing textures/data must degrade gracefully, never throw in `update`.
9. Finish with a short report: files written, public API, assumptions you made about other modules,
   and any contract problems you had to work around.

## Ownership

| Agent | Area | Files (namespace) |
|---|---|---|
| lead | contracts, boot, game scene orchestration | `src/core/*`, `src/main.ts`, `src/scenes/BootScene.ts`, `src/scenes/GameScene.ts`, `src/skills/index.ts`, `ARCHITECTURE.md` |
| A1 player | movement, physics, ropes, one-way platforms, blink, hit reaction, name tag | `src/entities/Player.ts`, `src/entities/player/*` |
| A2 skill-engine | skill casting, all attack patterns, buffs, summons, combat math, status application, damage numbers, Apprentice skills | `src/systems/SkillSystem.ts`, `src/systems/CombatSystem.ts`, `src/systems/skill/*`, `src/skills/apprentice.ts` |
| A3 fire-tree | fire skills + fire VFX | `src/skills/fire.ts`, `src/skills/fireVfx.ts`, `src/skills/fire/*` |
| A4 ice-tree | ice skills + ice VFX | `src/skills/ice.ts`, `src/skills/iceVfx.ts`, `src/skills/ice/*` |
| A5 lightning-tree | lightning skills + lightning VFX | `src/skills/lightning.ts`, `src/skills/lightningVfx.ts`, `src/skills/lightning/*` |
| A6 monsters | monster defs, art, AI, status visuals, contact damage, spawning/respawn, boss, drops & pickup | `src/data/monsters.ts`, `src/art/monsterArt.ts`, `src/entities/Monster.ts`, `src/entities/monsters/*`, `src/systems/MonsterManager.ts`, `src/systems/DropManager.ts` |
| A7 world | 7 maps, map loader, terrain/parallax/decor art, ropes, portals visuals, ambient weather | `src/data/maps.ts`, `src/world/*`, `src/art/tileArt.ts`, `src/art/world/*` |
| A8 ui | title screen, HUD, hotbar, all windows, dialog/shop, minimap, log, banners, death prompt, settings | `src/ui/*`, `src/scenes/TitleScene.ts` |
| A9 progression | player state, derived stats, leveling, AP/SP, jobs, items, inventory/equipment, shops, NPCs, quests, job advancement, save/load | `src/systems/Progression.ts`, `src/systems/SaveSystem.ts`, `src/systems/NpcManager.ts`, `src/systems/progression/*`, `src/data/items.ts`, `src/data/jobs.ts`, `src/data/npcs.ts`, `src/data/quests.ts`, `src/data/npcScripts.ts` |
| A10 art-audio | player/NPC character art + anims, portraits, icon painter, shared particle textures, common VFX, synthesized SFX & music | `src/art/characters.ts`, `src/art/icons.ts`, `src/art/particles.ts`, `src/art/char/*`, `src/systems/AudioSystem.ts`, `src/systems/audio/*` |

### Shared helpers (the only cross-agent concrete imports allowed)

- `src/art/icons.ts` → `iconDataUrl(spec, size)`, `iconTexture(scene, spec, size)` (A10). Used by A8 UI and A6 drops.
- `src/art/characters.ts` → `playerTextureKey`, `playerAnimKey`, `npcTextureKey`, `portraitDataUrl` (A10). Used by A1, A9, A8.
- `src/systems/SaveSystem.ts` → `newPlayerState`, `loadSave`, `hasSave`, `writeSave`, `deleteSave` (A9). Used by A8 title.
- `src/systems/AudioSystem.ts` → `getAudio()` (A10). Used by A8 title.

---

## Frame flow (GameScene, lead)

`create`: builds services in this order → progression, combat, skills, monsters, drops, npcs, player, ui.
`update` order: progression → player → monsters → skills → combat → drops → npcs → map → input → ui.

**Input owned by GameScene**: hotbar keys (`HOTBAR_KEYS`: Q W E R T A S D F G 1 2) — skills fire
repeatedly while held via `skills.tryCast`, `item:<id>` entries call `progression.useItem` once per press;
**Up** → portal (`map.getPortalNear`) → else NPC (`npcs.nearestInteractable` → `npcs.interact`);
**Z** (held) → `drops.tryPickup()` every 110ms.
**Input owned by Player (A1)**: arrows (move/climb/prone), Space/Alt (jump; Down+Jump drops through one-way).
**Input owned by UI (A8)**: K skills, I inventory, P stats, J quests, M minimap, Esc menu/close, H help.
When UI needs to block gameplay keys (dialog/shop open, text input focused) it calls
`services.game.setInputBlocked(true/false)`.

**Map change** (`services.game.changeMap(mapId, portalId?)`): fade → `skills.clearWorld`, `monsters.clear`,
`drops.clear`, `npcs.clear`, old `map.destroy` → `loadMap` → `player.bindMap` → place at portal →
`monsters.bindMap`, `drops.bindMap`, `npcs.bindMap` → music → `map:changed` + `ui:banner` → save.

**Death**: `progression.loseHp` hits 0 → Progression emits `player:died` → GameScene calls `player.onDeath()`
and emits `ui:death` → UI shows prompt → button calls `progression.respawn()` → Progression restores HP/MP,
applies penalty, emits `player:revived` → GameScene `player.revive()` + `changeMap(TOWN_MAP)`.

**Level up / job advance**: Progression emits `player:levelup` / `player:job`. GameScene plays VFX + SFX and
calls `player.setJob`. **UI (A8) shows the banners** for these.

**Monster death**: `Monster.takeDamage` → hp ≤ 0 → emits `monster:killed` exactly once. Subscribers:
Progression (EXP + quest kill counts), DropManager (`dropFromMonster`), MonsterManager (respawn timer).

**Monster contact / attacks** (A6): MonsterManager checks overlap of living, non-frozen/stunned monsters vs.
`player.getBounds()` each frame and calls `combat.hitPlayer(def.touchDamage, monster.x)` (Combat respects
`player.isInvulnerable()`).

---

## Coordinates & conventions

- World Y grows downward. **Entity `y` = feet.** Player frame 64×80, feet at bottom-center, hitbox 26×58 (see constants).
- `GRAVITY` 1500. Base walk speed 200 px/s, base jump velocity 560 px/s → jump apex ≈ 105 px, horizontal jump ≈ 150 px.
  **Map design rule**: stacked one-way platforms reachable by jump must be ≤ 90 px apart vertically; otherwise
  connect with a rope/ladder. Horizontal gaps ≤ 120 px.
- One-way platforms are static bodies with `checkCollision.down/left/right = false` (only the top collides).
- Depths: use `DEPTH` from constants.
- Colors as `0xRRGGBB` numbers in data; CSS strings only in the DOM UI.
- Ids are `snake_case`. Skill ids prefixed `app_`, `fire_`, `ice_`, `ltn_`. VFX keys use the same prefixes.

## Balance

All content is tuned against `src/core/balance.ts` (EXP curve, reference matk, monster HP/EXP/damage, skill %
guidance). A9 must make derived `matk` ≈ `refMatk(level)` (±15%) for an INT-focused build with on-level gear.
A6 sets monster HP/EXP/touch from the ref curves (×0.8–1.3 variety; bosses: HP ×250, EXP ×40).

Damage (A2): `hit = matk × pct/100 × rand(mastery..1) × (1 + dmgAll + dmgElem) × elemMult × critMult × target.incomingDamageMult() − target.def.def`, min 1.
`elemMult` = 1.5 if element ∈ weak, 0.5 if ∈ resist. Bosses: freeze/stun durations halved.

## Skill engine semantics (A2 implements; A3–A5 author against this)

- **Cast point**: `x = player.x + 18·facing`, `y = player.y − 34` (staff height). Projectiles spawn here.
- `castTimeMs` (default 450, reduced by `castSpeed`) → `player.playCast(lock)`. Ground casting stops horizontal movement.
- `mpCost` checked/spent via `progression.spendMp`. Cooldowns reduced by `cdr`.
- VFX call conventions (`playVfx(scene, key, opts)`):
  - `cast`: at cast point, `facing`.
  - `projectile`: persistent visual drawn pointing **right (+x)** at rotation 0; engine sets `x/y` and
    `rotation` (heading) each frame and destroys it on impact/expiry; then plays `hit`/`area` at impact.
  - `hit`: at target center (`target.x`, `target.y − h/2`), once per target per cast (not per line).
  - `area`: aoe_self/aoe_target/melee_arc/projectile explosion → at area center with `w`,`h`.
    **beam** → `x,y` = start, `targetX,targetY` = end, `h`. **chain** → once per jump segment with
    `x,y` = from and `targetX,targetY` = to. **rain** → once per impact at the ground point under the impact
    (the falling body uses `projectile` with `angle` pointing down).
  - buff `vfx` at player feet; `auraVfx` persistent, engine keeps it at player feet and destroys on expiry.
  - summon `vfx` persistent body; engine positions it and flips via `scaleX = |scaleX|·facing`.
  - movement `vfxOut` at old feet, `vfxIn` at new feet.
- Multi-hit: each hit line rolls separately, shown as **stacked damage numbers** (Maple style),
  `hitIntervalMs` apart (default 90).
- Status: `combat.tryApplyStatus` rolls `chance`, checks `def.immune`, converts burn potency (% of base hit per tick)
  to a concrete number, then `monster.applyStatus`. Monster (A6) handles ticking, slow, freeze/stun AI lock and tints.
- `bonusVs`: multiply damage vs. targets with that status; `consume` removes it (e.g. shatter).
- Passives: `progression.derived()` includes learned passive modifiers and `skills.getBuffModifiers()`;
  SkillSystem calls `progression.invalidate()` whenever buffs start/end.

## Seed IDs (fixed — everyone may reference these)

**Maps (A7)** — chained by portals `east` ↔ `west` (portal ids are literally `west`/`east`, plus extras as needed):
`mistvale` (town, safe, lv —) → `whisperwood` (1–8) → `shroom_hollow` (8–15) → `frostfang_cliffs` (15–25) →
`cinder_caverns` (25–35) → `stormspire_peak` (35–45) → `arcane_sanctum` (45–50, boss).

**Monsters (A6)** — id (level, map, notes):
- whisperwood: `moss_snail` (1), `puff_slime` (3, hopper), `cap_shroom` (6)
- shroom_hollow: `cap_shroom` (6), `thorn_shroom` (9), `stump_golem` (13)
- frostfang_cliffs: `frost_bat` (16, flyer, weak fire), `snow_yeti` (20, weak fire), `ice_wisp` (23, flyer, weak fire, resist ice, immune freeze)
- cinder_caverns: `ember_imp` (26, hopper, weak ice, resist fire), `lava_salamander` (30, weak ice, resist fire, immune burn), `magma_golem` (34, weak ice, resist fire)
- stormspire_peak: `storm_harpy` (37, flyer, weak lightning), `crag_golem` (40, weak lightning), `thunder_drake` (43, flyer, resist lightning, weak ice)
- arcane_sanctum: `void_wisp` (46, flyer), `lich_archon` (48, **boss**)

**Items (A9 defines, A6 drop tables use)**:
- consumables: `red_potion` (+50 HP), `orange_potion` (+150 HP), `white_potion` (+300 HP), `blue_potion` (+100 MP), `mana_elixir` (+300 MP), `elixir` (50% HP & MP), `return_scroll` (warp to town)
- etc: `snail_shell`, `slime_jelly`, `shroom_cap`, `thorn_spore`, `stump_bark`, `bat_wing`, `yeti_fur`, `wisp_essence`, `imp_horn`, `salamander_scale`, `magma_core`, `harpy_feather`, `golem_shard`, `drake_scale`, `void_crystal`, `archon_sigil`
- equips: `oak_wand` (1), `apprentice_hat` (1), `apprentice_robe` (1), `soft_sandals` (1), `willow_staff` (8), `ember_staff` / `frost_staff` / `storm_staff` (15, branch-locked), `sage_hat` (20), `sage_robe` (20), `wind_boots` (25), `mana_ring` (30), `arcane_amulet` (35), `inferno_staff` / `glacier_staff` / `tempest_staff` (35, branch-locked), `archon_staff` (45)

**NPCs (A9 defines; A7 places)**: in `mistvale`: `elder_maelis` (Archmage, guides advancement), `pyra` (Fire Instructor),
`glacius` (Ice Instructor), `voltis` (Lightning Instructor), `merchant_bram` (potions & scrolls), `smith_tilda` (equipment).
In `whisperwood` near the west portal: `scout_finn` (early quests).

**Common VFX keys (A10, in `art/particles.ts`)**: `levelup`, `job_advance`, `respawn`, `hit_generic`, `pickup_sparkle`.
**Shared particle textures (A10)** — all white so they tint: `px_dot` (8px), `px_soft` (32px soft radial),
`px_spark` (16×4 streak), `px_star` (16px 4-point), `px_ring` (32px), `px_smoke` (32px puff), `px_shard` (12×20 diamond), `px_flare` (64px soft glow).
Tree modules may generate additional textures with their own prefix in `generateXTextures(scene)`.

## New character (A9 `newPlayerState`)

Level 1 Apprentice in `mistvale`; INT 10 / LUK 6 / STR 4 / DEX 4; `app_arcane_bolt` lv 1 learned and on hotbar
slot 0 (Q); 3 SP; 10 `red_potion` on slot 10 (key 1) and 10 `blue_potion` on slot 11 (key 2); `oak_wand` and
`apprentice_robe` equipped; 0 mesos → 50 mesos.

---

## Art pivot: 16-bit pixel art (current phase)

The procedural art is being replaced with **SNES-era pixel art from freely licensed packs**. Rules:

1. **Gameplay code does not change.** External art is loaded in `BootScene.preload()` from your domain's
   manifest (`src/art/manifests/<domain>.ts`, see `src/art/assets.ts`), then your generator slices /
   palette-swaps / integer-scales it **into the existing texture keys, frame layouts and anim keys**
   (e.g. `player_<job>` 64×80 frames with feet at y=78; `monster_<id>` + its anims; world `w_/d_/t_` keys).
   Keep the procedural code path as a fallback when a source image is missing.
2. **One pixel size.** `PIXEL_SCALE = 2` (constants.ts): every foreground source pixel → 2×2 screen pixels
   (nearest-neighbor; `pixelArt: true` is on globally). Far parallax layers may use a larger integer scale
   to fill the screen. Never non-integer scale pixel art.
3. **Licensing (strict).** Only CC0 / public domain, CC-BY 3.0/4.0, OGA-BY, or an explicit
   "free for personal & commercial use" license from the author (record the exact URL + wording).
   No NonCommercial, no ripped/commercial game sprites (no MapleStory/Nexon assets), no AI-scraped
   "free sprite" dumps of unclear origin. Prefer opengameart.org, kenney.nl, and itch.io pages whose
   license is stated on the page.
4. **Downloads are untrusted data.** Download each pack into its own new directory in your scratchpad,
   unzip there, never execute anything from it, then copy only the needed `.png` (and the license/readme
   text) into `public/assets/<domain>/<pack>/`. Keep the total added size reasonable (< ~6 MB per domain).
5. **Credits.** Write `public/assets/<domain>/CREDITS.md` with one row per pack:
   asset · author · source URL · license · what it's used for. The lead merges these into `/CREDITS.md`.
6. **Look & cohesion.** Aim for one coherent 16-bit fantasy look across domains: readable silhouettes,
   1px dark outlines where the source has them, saturated but not neon palettes. Element identity:
   fire = reds/oranges/golds, ice = cyans/whites/pale blues, lightning = violets/yellows, apprentice = indigo/blue.

---

## Phase 3: two more trees — Holy and Shadow

| Tier | Level | Holy | Shadow |
|---|---|---|---|
| 2 | 10 | Cleric (`cleric`) | Occultist (`occultist`) |
| 3 | 25 | Priest (`priest`) | Necromancer (`necromancer`) |
| 4 | 40 | Hierophant (`hierophant`) | Umbral Sage (`umbral_sage`) |

Contract additions (already in `src/core/types.ts`): `Element`/`Branch` += `holy`, `shadow`; `DerivedStats` +=
`dmgHoly`, `dmgShadow`; `StatusKind` += `poison` (DoT like burn, potency = % of base hit per 500ms tick) and
`curse` (potency 0..0.6: target takes ×(1+p) damage and deals ×(1−p) contact damage); `IconGlyph` += `halo`,
`holy_cross`, `sunburst`, `wings`, `skull`, `scythe`, `ghost`, `poison`, `paw`; `SfxKey` += `cast_holy`,
`cast_shadow`, `curse`. Job defs/looks are in `src/data/jobs.ts`.

**Holy identity — sustain, smite, control.** Lower raw damage than fire; heals the caster, stuns (`stun` status),
holy damage is the answer to undead/void (`lich_archon`, `void_wisp`, ice/void wisps get `weak: ['holy']`).
Skill ids `holy_`. Heals use `onCast` (see below). Signature: an ultimate **Genesis**-style rain of light.

**Shadow identity — attrition, curses, minions.** Poison DoTs, curses that amplify all damage and weaken foes,
skeletal/wraith summons, life drain. Skill ids `shd_`. Signature: an ultimate **Night Tide**-style rain of
shadow scythes and a big summon (e.g. Bone Dragon / Lich Shade).

**Heals and drains via `onCast`** (no engine change): `onCast(ctx, lv)` replaces default behaviour after MP,
cooldown, cast lock, sfx and `skill:cast` are handled. Use `ctx.runAttack(spec, origin)` for the damage part
(origin = `{ x: player.x + 18·facing, y: player.y − 34, facing }`, read from `ctx.services.player`) and
`ctx.services.progression.heal(hp, mp)` / `.derived().maxHp` for healing; play VFX with `playVfx(ctx.scene, key, opts)`.
Show heal numbers with `ctx.services.combat.showNumber(x, y, amount, 'heal')`.

**Pixel VFX** must match the art pivot: reuse PX4's sheet kit in `src/art/particles.ts` (`pxFx`, palette ramps,
`pixelizeCanvas`) and the CC0 sheets already in `public/assets/vfx/`; new freely licensed sheets go in
`public/assets/vfx/<tree>/` listed in `src/art/manifests/<tree>.ts` with a `CREDITS.md`.
