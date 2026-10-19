// OWNER: A7 (world). The maps of The Academy: seven chained world maps, the Trial Hall and three branch zones
// (Moonlit Marsh, Glacier Grotto, The Restricted Stacks). Map ids are save data — never rename them.
//
// Conventions (see ARCHITECTURE.md "Coordinates & conventions"):
//  - platform `y` is the walking surface; the ground floor is a oneWay=false platform spanning the map
//    (non-oneWay platforms are solid columns from y to the map bottom).
//  - walls are solid blocks; their top is walkable (used as raised ground / cliff steps).
//  - jumpable tiers are ≤ 90px apart vertically; taller gaps get a rope or ladder.
//  - rope `top` = surface of the platform it leads onto; `bottom` = just above the lower surface.
//  - spawns sit on platform tops (`y` = platform y, x-range inset from the edges).
//  - this module has no runtime imports so it can be sanity-checked by plain node.
import type { MapDef, PlatformDef, PortalDef, RopeDef, SpawnDef, WallDef } from '../core/types';

const RESPAWN = 7000;
/** Field boss respawn after death (A6 jitters it ±20% → ~8–12 min). */
const FIELD_BOSS_RESPAWN = 600000;

const ground = (x1: number, x2: number, y: number): PlatformDef => ({ x1, x2, y, oneWay: false });
const plat = (x1: number, x2: number, y: number): PlatformDef => ({ x1, x2, y, oneWay: true });
const wall = (x: number, y: number, w: number, h: number): WallDef => ({ x, y, w, h });
/** Rope hanging from the platform at `top` down to just above the surface at `lowerY`. */
const rope = (x: number, top: number, lowerY: number): RopeDef => ({ x, top, bottom: lowerY - 8, kind: 'rope' });
const ladder = (x: number, top: number, lowerY: number): RopeDef => ({ x, top, bottom: lowerY - 2, kind: 'ladder' });
const portal = (id: string, x: number, y: number, targetMap: string, targetPortal: string): PortalDef => ({ id, x, y, targetMap, targetPortal });
/** Spawn across a platform's span (inset 40px from both edges). */
const on = (monsterId: string, p: PlatformDef, count: number, respawnMs = RESPAWN): SpawnDef =>
  ({ monsterId, x1: p.x1 + 40, x2: p.x2 - 40, y: p.y, count, respawnMs });
const span = (monsterId: string, x1: number, x2: number, y: number, count: number, respawnMs = RESPAWN): SpawnDef =>
  ({ monsterId, x1, x2, y, count, respawnMs });

// ───────────────────────────── The Academy campus (town; id kept as `mistvale`) ─────────────────────────────
//
// West → east: armory (Tilda) · quartermaster (Bram) · dormitory + fountain square · Headmistress tower ·
// the five School halls (Fire, Ice, Lightning, Holy, Shadow), each professor in front of their hall · east gate.

const mistvale: MapDef = (() => {
  const W = 3800, H = 1100, G = 980;
  const awning = plat(690, 950, 895);
  const tower1 = plat(1360, 1660, 800);
  const towerTop = plat(1420, 1600, 640);
  const hallWalk = plat(2050, 2300, 895);
  const hallTop = plat(2290, 2440, 810);
  const cloister = plat(2960, 3180, 895);   // walkway between the Holy and Shadow halls
  const belfry = plat(3170, 3320, 810);
  return {
    id: 'mistvale', name: 'Academy Grounds', region: 'The Academy', theme: 'town', music: 'town',
    width: W, height: H, levelRange: [1, 50], safe: true,
    platforms: [ground(0, W, G), awning, tower1, towerTop, hallWalk, hallTop, cloister, belfry],
    walls: [],
    ropes: [ladder(1392, tower1.y, G), rope(1560, towerTop.y, tower1.y)],
    portals: [
      portal('east', 3720, G, 'whisperwood', 'west'),
      // Trial Hall door on the Headmistress tower's balcony (ladder at x 1392 from the ground).
      portal('trial', 1480, tower1.y, 'trial_hall', 'entry'),
      // Branch zone: the Restricted Stacks, reached from the top of the Headmistress tower (rope at x 1560 from the balcony).
      portal('stacks', 1440, towerTop.y, 'restricted_stacks', 'entry'),
    ],
    spawns: [],
    npcs: [
      { npcId: 'smith_tilda', x: 400, y: G, facing: 1 },
      { npcId: 'merchant_bram', x: 820, y: G, facing: 1 },
      { npcId: 'elder_maelis', x: 1590, y: G, facing: -1 },
      { npcId: 'pyra', x: 1990, y: G, facing: -1 },
      { npcId: 'glacius', x: 2290, y: G, facing: -1 },
      { npcId: 'voltis', x: 2590, y: G, facing: -1 },
      { npcId: 'seraphine', x: 2900, y: G, facing: -1 },
      { npcId: 'morvane', x: 3240, y: G, facing: -1 },
    ],
  };
})();

// ───────────────────────────── Whisperwood (1–8) ─────────────────────────────

const whisperwood: MapDef = (() => {
  const W = 3200, H = 1300, G = 1180;
  const A = plat(300, 760, 1095), B = plat(1000, 1400, 1095), C = plat(1900, 2400, 1095), D = plat(2650, 2980, 1095);
  const E = plat(520, 980, 1010), F = plat(1250, 1750, 1010), Gp = plat(2200, 2720, 1010);
  const O = plat(1500, 1620, 925);
  const Hh = plat(380, 900, 840), I = plat(1450, 2050, 840), J = plat(2350, 2900, 840);
  const K = plat(760, 1160, 755), L = plat(1880, 2240, 755);
  const M = plat(950, 1500, 590), N = plat(2000, 2620, 590), R = plat(2700, 2820, 590);
  const Q = plat(2960, 3090, 925);
  const hill = wall(1480, 1135, 220, 45);
  return {
    id: 'whisperwood', name: 'Whisperwood', region: 'Practicum Grounds', theme: 'forest', music: 'forest',
    width: W, height: H, levelRange: [1, 8],
    platforms: [ground(0, W, G), A, B, C, D, E, F, Gp, O, Hh, I, J, K, L, M, N, R, Q],
    walls: [hill],
    ropes: [rope(720, Hh.y, E.y), rope(1620, I.y, F.y), rope(2520, J.y, Gp.y), rope(1060, M.y, K.y), rope(2160, N.y, L.y)],
    portals: [portal('west', 70, G, 'mistvale', 'east'), portal('east', 3130, G, 'shroom_hollow', 'west')],
    spawns: [
      span('moss_snail', 420, 1440, G, 3), span('moss_snail', 1760, 3000, G, 2), on('moss_snail', A, 1), on('moss_snail', D, 1),
      on('puff_slime', B, 1), on('puff_slime', C, 2), on('puff_slime', E, 1), on('puff_slime', F, 1),
      on('cap_shroom', I, 1), on('cap_shroom', J, 1), on('cap_shroom', M, 1), on('cap_shroom', N, 1),
      // Field boss (A6): widest wall-free ground span, clear of both portals. Timed spawn, see MonsterManager.
      span('mossback_matriarch', 1740, 2950, G, 1, FIELD_BOSS_RESPAWN),
    ],
    npcs: [{ npcId: 'scout_finn', x: 240, y: G, facing: 1 }],
  };
})();

// ───────────────────────────── Shroom Hollow (8–15) ─────────────────────────────

const shroom_hollow: MapDef = (() => {
  const W = 3600, H = 1400, G = 1280;
  const A = plat(260, 640, 1195), B = plat(820, 1080, 1195), C = plat(1500, 1900, 1195), D = plat(2150, 2450, 1195), E = plat(2950, 3330, 1195);
  const F = plat(480, 900, 1110), Gp = plat(1300, 1560, 1110), Hh = plat(1800, 2250, 1110), I = plat(2700, 3050, 1110);
  const J = plat(300, 760, 930), K = plat(1150, 1650, 930), L = plat(1950, 2500, 930), M = plat(2800, 3300, 930);
  const N = plat(700, 1200, 845), O = plat(1600, 2000, 845), P = plat(2450, 2850, 845);
  const Q = plat(850, 1450, 660), R = plat(2250, 2900, 660);
  const S = plat(1500, 1800, 575), T = plat(2050, 2300, 575);
  const U = plat(140, 260, 1025), V = plat(3380, 3500, 1025);
  return {
    id: 'shroom_hollow', name: 'Shroom Hollow', region: 'Herbology Field Site', theme: 'mushroom', music: 'cave',
    width: W, height: H, levelRange: [8, 15],
    platforms: [ground(0, W, G), A, B, C, D, E, F, Gp, Hh, I, J, K, L, M, N, O, P, Q, R, S, T, U, V],
    walls: [wall(1100, 1210, 160, 70), wall(2500, 1200, 200, 80)],
    ropes: [ladder(560, J.y, F.y), rope(1400, K.y, Gp.y), rope(2100, L.y, Hh.y), ladder(2900, M.y, I.y), rope(1000, Q.y, N.y), rope(2600, R.y, P.y)],
    portals: [
      portal('west', 70, G, 'whisperwood', 'east'), portal('east', 3530, G, 'frostfang_cliffs', 'west'),
      // Branch zone: Moonlit Marsh, on the high ledge T (jump up from R; rope at x 2600 from P to R).
      portal('marsh', 2175, T.y, 'moonlit_marsh', 'entry'),
    ],
    spawns: [
      span('cap_shroom', 300, 1060, G, 3), on('cap_shroom', A, 1), on('cap_shroom', B, 1), on('cap_shroom', F, 1),
      span('thorn_shroom', 1300, 2460, G, 3), on('thorn_shroom', Hh, 1), on('thorn_shroom', K, 1), on('thorn_shroom', L, 1),
      span('stump_golem', 2740, 3400, G, 2), on('stump_golem', M, 1), on('stump_golem', P, 1), on('stump_golem', Q, 1), on('stump_golem', R, 1),
      on('thorn_shroom', C, 1),
      span('shroom_monarch', 1300, 2460, G, 1, FIELD_BOSS_RESPAWN),
    ],
    npcs: [],
  };
})();

// ───────────────────────────── Frostfang Cliffs (15–25) ─────────────────────────────

const frostfang_cliffs: MapDef = (() => {
  const W = 3800, H = 1500, G = 1380;
  const step1 = wall(900, 1300, 380, 80), step2 = wall(1280, 1220, 260, 160), step3 = wall(2600, 1310, 300, 70);
  const A = plat(250, 700, 1295), B = plat(1700, 2150, 1295), C = plat(3050, 3500, 1295), T = plat(3600, 3720, 1295);
  const D = plat(550, 880, 1210), E = plat(1950, 2450, 1210), F = plat(2750, 3150, 1210);
  const Gp = plat(380, 900, 1040), Hh = plat(1300, 1800, 1040), I = plat(2100, 2650, 1040), J = plat(2900, 3450, 1040);
  const K = plat(850, 1350, 955), L = plat(1750, 2150, 955), M = plat(2600, 2950, 955);
  const N = plat(600, 1150, 780), O = plat(1900, 2500, 780), P = plat(3100, 3600, 780);
  const Q = plat(1200, 1500, 695), R = plat(2550, 2900, 695);
  const S = plat(1350, 1950, 520);
  return {
    id: 'frostfang_cliffs', name: 'Frostfang Cliffs', region: 'Frostfang Range · Field Study', theme: 'snow', music: 'snow',
    width: W, height: H, levelRange: [15, 25],
    platforms: [ground(0, W, G), A, B, C, T, D, E, F, Gp, Hh, I, J, K, L, M, N, O, P, Q, R, S],
    walls: [step1, step2, step3],
    ropes: [
      rope(600, Gp.y, D.y), ladder(1400, Hh.y, step2.y), rope(2300, I.y, E.y), rope(3000, J.y, F.y),
      rope(1000, N.y, K.y), rope(2000, O.y, L.y), rope(3300, P.y, J.y), rope(1420, S.y, Q.y),
    ],
    portals: [
      portal('west', 70, G, 'shroom_hollow', 'east'), portal('east', 3730, G, 'cinder_caverns', 'west'),
      // Branch zone: Glacier Grotto, a cave mouth on the ice step step3 (hop up from the ground, west of ledge F).
      portal('grotto', 2680, step3.y, 'glacier_grotto', 'entry'),
    ],
    spawns: [
      span('snow_yeti', 950, 1230, 1300, 2), span('snow_yeti', 1600, 2560, G, 3), span('snow_yeti', 2950, 3600, G, 2),
      on('frost_bat', A, 1), on('frost_bat', D, 1), on('frost_bat', Gp, 2), on('frost_bat', K, 1), on('frost_bat', B, 1),
      on('ice_wisp', I, 1), on('ice_wisp', J, 1), on('ice_wisp', L, 1), on('ice_wisp', N, 1), on('ice_wisp', O, 1), on('ice_wisp', P, 1), on('ice_wisp', S, 1),
      span('frostfang_alpha', 1580, 2560, G, 1, FIELD_BOSS_RESPAWN),
    ],
    npcs: [],
  };
})();

// ───────────────────────────── Cinder Caverns (25–35) ─────────────────────────────

const cinder_caverns: MapDef = (() => {
  const W = 4000, H = 1500, G = 1380;
  const A = plat(200, 650, 1295), B = plat(900, 1250, 1295), C = plat(1750, 2250, 1295), D = plat(3150, 3600, 1295);
  const E = plat(450, 950, 1210), F = plat(1450, 1850, 1210), Gp = plat(2350, 2700, 1210), Hh = plat(3000, 3300, 1210);
  const I = plat(250, 800, 1035), J = plat(1200, 1700, 1035), K = plat(2150, 2650, 1035), L = plat(3050, 3650, 1035);
  const M = plat(700, 1250, 950), N = plat(1650, 2200, 950), O = plat(2600, 3100, 950);
  const P = plat(400, 900, 775), Q = plat(1400, 1950, 775), R = plat(2700, 3300, 775);
  const S = plat(900, 1300, 690), T = plat(1900, 2400, 690), U = plat(3300, 3700, 690);
  const V = plat(2000, 2700, 515);
  return {
    id: 'cinder_caverns', name: 'Cinder Caverns', region: 'Emberdeep · Field Study', theme: 'volcano', music: 'volcano',
    width: W, height: H, levelRange: [25, 35],
    platforms: [ground(0, W, G), A, B, C, D, E, F, Gp, Hh, I, J, K, L, M, N, O, P, Q, R, S, T, U, V],
    walls: [wall(1300, 1310, 240, 70), wall(2700, 1300, 300, 80)],
    ropes: [
      rope(700, I.y, E.y), rope(1550, J.y, F.y), rope(2450, K.y, Gp.y), ladder(3150, L.y, Hh.y),
      rope(800, P.y, M.y), rope(1800, Q.y, N.y), rope(2900, R.y, O.y), rope(2200, V.y, T.y),
    ],
    portals: [portal('west', 70, G, 'frostfang_cliffs', 'east'), portal('east', 3930, G, 'stormspire_peak', 'west')],
    spawns: [
      span('ember_imp', 200, 1250, G, 3), on('ember_imp', A, 1), on('ember_imp', B, 1), on('ember_imp', E, 1),
      span('lava_salamander', 1600, 2650, G, 3), on('lava_salamander', C, 1), on('lava_salamander', F, 1), on('lava_salamander', I, 1), on('lava_salamander', J, 1), on('lava_salamander', K, 1),
      span('magma_golem', 3050, 3800, G, 2), on('magma_golem', L, 1), on('magma_golem', O, 1), on('magma_golem', R, 1), on('magma_golem', Q, 1), on('magma_golem', V, 1),
      span('magmaw', 1580, 2660, G, 1, FIELD_BOSS_RESPAWN),
    ],
    npcs: [],
  };
})();

// ───────────────────────────── Stormspire Peak (35–45) ─────────────────────────────

const stormspire_peak: MapDef = (() => {
  const W = 3600, H = 1600, G = 1480;
  const plateau = wall(1600, 1400, 400, 80);
  const A = plat(250, 700, 1395), B = plat(1050, 1500, 1395), C = plat(2200, 2600, 1395), D = plat(3000, 3400, 1395);
  const E = plat(550, 1100, 1310), F = plat(1450, 1750, 1310), Gp = plat(1950, 2350, 1310), Hh = plat(2650, 3100, 1310);
  const I = plat(300, 850, 1135), J = plat(1300, 1700, 1135), K = plat(2050, 2550, 1135), L = plat(2850, 3350, 1135);
  const M = plat(800, 1350, 1050), N = plat(1650, 2100, 1050), O = plat(2500, 2900, 1050);
  const X = plat(80, 230, 1050), Y = plat(3330, 3480, 875);
  const P = plat(450, 1000, 875), Q = plat(1500, 2200, 875), R = plat(2700, 3250, 875);
  const S = plat(950, 1450, 790), T = plat(2150, 2750, 790);
  const U = plat(1100, 1700, 615), V = plat(2000, 2600, 615);
  const Wp = plat(1650, 2050, 530);
  return {
    id: 'stormspire_peak', name: 'Stormspire Peak', region: 'Thunderreach Observatory', theme: 'storm', music: 'storm',
    width: W, height: H, levelRange: [35, 45],
    platforms: [ground(0, W, G), A, B, C, D, E, F, Gp, Hh, I, J, K, L, M, N, O, X, Y, P, Q, R, S, T, U, V, Wp],
    walls: [plateau],
    ropes: [
      rope(700, I.y, E.y), rope(1500, J.y, F.y), rope(2200, K.y, Gp.y), rope(2950, L.y, Hh.y),
      rope(900, P.y, M.y), rope(1800, Q.y, N.y), rope(2800, R.y, O.y), rope(1200, U.y, S.y), rope(2500, V.y, T.y),
    ],
    portals: [portal('west', 70, G, 'cinder_caverns', 'east'), portal('east', 3530, G, 'arcane_sanctum', 'west')],
    spawns: [
      span('crag_golem', 250, 1550, G, 3), span('crag_golem', 2050, 3400, G, 3), on('crag_golem', B, 1), span('crag_golem', 1640, 1960, plateau.y, 1), on('crag_golem', D, 1),
      on('storm_harpy', A, 1), on('storm_harpy', E, 1), on('storm_harpy', F, 1), on('storm_harpy', Gp, 1), on('storm_harpy', I, 1), on('storm_harpy', M, 1),
      on('thunder_drake', K, 1), on('thunder_drake', L, 1), on('thunder_drake', Q, 1), on('thunder_drake', R, 1), on('thunder_drake', T, 1), on('thunder_drake', U, 1), on('thunder_drake', Wp, 1),
      span('tempest_wyrm', 2040, 3350, G, 1, FIELD_BOSS_RESPAWN),
    ],
    npcs: [],
  };
})();

// ───────────────────────────── Arcane Sanctum (45–50, boss) ─────────────────────────────

const arcane_sanctum: MapDef = (() => {
  const W = 2600, H = 1100, G = 980;
  const A = plat(200, 520, 895), B = plat(420, 760, 810), D = plat(250, 650, 640);
  const A2 = plat(2080, 2400, 895), B2 = plat(1840, 2180, 810), D2 = plat(1950, 2350, 640);
  const C = plat(1050, 1550, 700);
  return {
    id: 'arcane_sanctum', name: 'Arcane Sanctum', region: 'The Forbidden Wing', theme: 'sanctum', music: 'boss',
    width: W, height: H, levelRange: [45, 50],
    platforms: [ground(0, W, G), A, B, D, A2, B2, D2, C],
    walls: [],
    ropes: [rope(500, D.y, B.y), rope(2100, D2.y, B2.y), rope(1100, C.y, G), rope(1500, C.y, G)],
    portals: [portal('west', 70, G, 'stormspire_peak', 'east'), portal('town', 2530, G, 'mistvale', 'east')],
    spawns: [
      span('lich_archon', 1000, 1600, G, 1, 180000),
      on('void_wisp', A, 2, 7000), on('void_wisp', A2, 2, 7000), on('void_wisp', D, 2, 7000), on('void_wisp', D2, 2, 7000), on('void_wisp', C, 2, 7000),
    ],
    npcs: [],
  };
})();

// ───────────────────────────── Trial Hall (wave-survival arena; ArenaSystem drives it) ─────────────────────────────
//
// One screen-ish hall under the Headmistress tower: flat duelling floor, two jump-up side galleries and a
// high central dais on a rope. No natural spawns — ArenaSystem spawns every wave.

const trial_hall: MapDef = (() => {
  const W = 1800, H = 900, G = 780;
  const galleryW = plat(300, 600, 695), galleryE = plat(1200, 1500, 695);
  const dais = plat(720, 1080, 565);
  return {
    id: 'trial_hall', name: 'Trial Hall', region: 'The Academy · Proving Grounds', theme: 'sanctum', music: 'boss',
    width: W, height: H, levelRange: [1, 50], safe: false,
    platforms: [ground(0, W, G), galleryW, galleryE, dais],
    walls: [],
    ropes: [rope(900, dais.y, G)],
    portals: [portal('entry', 110, G, 'mistvale', 'trial')],
    spawns: [],
    npcs: [],
  };
})();

// ───────────────────────────── Branch zones ─────────────────────────────
//
// Optional side maps off the main chain, each entered by an extra portal on its parent map and left by the same
// `entry` portal. Presentation is a "look" over the base theme (MAP_EXTRAS[id].look → themes.ts LOOK_RUNTIME).

// Moonlit Marsh (12–18): Shroom Hollow's night-time bog. Low hummocks and reed beds on the ground, willow-ledge tiers
// above, two rope climbs per side and a moonlit crown ledge. Toads hop the low ground, wisps drift on the high ledges.
const moonlit_marsh: MapDef = (() => {
  const W = 3200, H = 1400, G = 1280;
  const hummockA = wall(1180, 1235, 220, 45), hummockB = wall(2560, 1230, 180, 50);
  const A = plat(220, 580, 1195), B = plat(760, 1100, 1195), C = plat(1480, 1880, 1195), D = plat(2200, 2520, 1195), E = plat(2860, 3120, 1195);
  const F = plat(420, 820, 1110), Gp = plat(1150, 1500, 1110), Hh = plat(1900, 2300, 1110), I = plat(2550, 2950, 1110);
  const J = plat(260, 700, 930), K = plat(1000, 1500, 930), L = plat(1700, 2200, 930), M = plat(2450, 3000, 930);
  const N = plat(620, 1100, 845), O = plat(1450, 1850, 845), P = plat(2200, 2600, 845);
  const Q = plat(850, 1400, 660), R = plat(1900, 2500, 660);
  const S = plat(1350, 1700, 575), T = plat(2560, 2820, 575);
  return {
    id: 'moonlit_marsh', name: 'Moonlit Marsh', region: 'Herbology Field Site · Night Study', theme: 'forest', music: 'marsh',
    width: W, height: H, levelRange: [12, 18],
    platforms: [ground(0, W, G), A, B, C, D, E, F, Gp, Hh, I, J, K, L, M, N, O, P, Q, R, S, T],
    walls: [hummockA, hummockB],
    ropes: [
      rope(600, J.y, F.y), ladder(1300, K.y, Gp.y), rope(2050, L.y, Hh.y), rope(2700, M.y, I.y),
      rope(1000, Q.y, N.y), rope(2400, R.y, P.y),
    ],
    portals: [portal('entry', 90, G, 'shroom_hollow', 'marsh')],
    spawns: [
      span('bog_toad', 300, 1140, G, 3), span('bog_toad', 1440, 2520, G, 2), on('bog_toad', A, 1), on('bog_toad', B, 1), on('bog_toad', F, 1), on('bog_toad', C, 1),
      span('thorn_shroom', 2780, 3120, G, 2), on('thorn_shroom', D, 1), on('thorn_shroom', Hh, 1),
      on('will_o_wisp', J, 1), on('will_o_wisp', K, 1), on('will_o_wisp', L, 1), on('will_o_wisp', M, 1), on('will_o_wisp', O, 1),
      on('will_o_wisp', Q, 1), on('will_o_wisp', R, 1),
    ],
    npcs: [],
  };
})();

// Glacier Grotto (22–30): a cave of blue ice under Frostfang. Ice steps break up the floor, ledges climb in two
// rope-linked bands to a crystal gallery under the roof. Crabs scuttle the floor and steps, shades haunt the upper bands.
const glacier_grotto: MapDef = (() => {
  const W = 3400, H = 1500, G = 1380;
  const stepA = wall(700, 1300, 300, 80), stepB = wall(2300, 1290, 260, 90);
  const A = plat(150, 500, 1295), B = plat(1150, 1550, 1295), C = plat(1800, 2200, 1295), D = plat(2750, 3150, 1295);
  const E = plat(450, 900, 1210), F = plat(1400, 1800, 1210), Gp = plat(2100, 2500, 1210), Hh = plat(2850, 3250, 1210);
  const I = plat(250, 750, 1040), J = plat(1100, 1600, 1040), K = plat(1900, 2400, 1040), L = plat(2700, 3200, 1040);
  const M = plat(700, 1150, 955), N = plat(1550, 2000, 955), O = plat(2400, 2800, 955);
  const P = plat(400, 950, 780), Q = plat(1300, 1900, 780), R = plat(2300, 2900, 780);
  const S = plat(950, 1250, 695), T = plat(1950, 2300, 695);
  const U = plat(1350, 1850, 520);
  return {
    id: 'glacier_grotto', name: 'Glacier Grotto', region: 'Frostfang Range · Deep Ice', theme: 'snow', music: 'grotto',
    width: W, height: H, levelRange: [22, 30],
    platforms: [ground(0, W, G), A, B, C, D, E, F, Gp, Hh, I, J, K, L, M, N, O, P, Q, R, S, T, U],
    walls: [stepA, stepB],
    ropes: [
      rope(600, I.y, E.y), rope(1500, J.y, F.y), rope(2200, K.y, Gp.y), ladder(3000, L.y, Hh.y),
      rope(800, P.y, M.y), rope(1700, Q.y, N.y), rope(2500, R.y, O.y), rope(1600, U.y, Q.y),
    ],
    portals: [portal('entry', 90, G, 'frostfang_cliffs', 'grotto')],
    spawns: [
      span('crystal_crab', 1060, 2240, G, 3), span('crystal_crab', 2620, 3320, G, 2), span('crystal_crab', 740, 960, stepA.y, 1),
      on('crystal_crab', B, 1), on('crystal_crab', C, 1),
      on('ice_wisp', E, 1), on('ice_wisp', Gp, 1), on('ice_wisp', M, 1), on('ice_wisp', O, 1),
      on('frost_shade', J, 1), on('frost_shade', K, 1), on('frost_shade', L, 1), on('frost_shade', P, 1), on('frost_shade', Q, 1),
      on('frost_shade', R, 1), on('frost_shade', U, 1),
    ],
    npcs: [],
  };
})();

// The Restricted Stacks (32–42): the Academy's forbidden library. Floor aisles around a central reading dais,
// bookshelf galleries stacked above it joined by library ladders, and the top gallery under the vaults.
const restricted_stacks: MapDef = (() => {
  const W = 3000, H = 1500, G = 1380;
  const dais = wall(1300, 1290, 400, 90);
  const A = plat(200, 600, 1295), B = plat(850, 1200, 1295), C = plat(1800, 2150, 1295), D = plat(2450, 2850, 1295);
  const E = plat(450, 900, 1205), F = plat(1350, 1650, 1205), Gp = plat(2100, 2550, 1205);
  const Hh = plat(200, 750, 1030), I = plat(950, 1450, 1030), J = plat(1550, 2050, 1030), K = plat(2300, 2850, 1030);
  const L = plat(600, 1050, 945), M = plat(1900, 2350, 945);
  const N = plat(300, 850, 770), O = plat(1150, 1850, 770), P = plat(2200, 2750, 770);
  const Q = plat(850, 1150, 685), R = plat(1850, 2200, 685);
  const S = plat(1100, 1900, 510);
  return {
    id: 'restricted_stacks', name: 'The Restricted Stacks', region: 'The Academy · Forbidden Library', theme: 'sanctum', music: 'library',
    width: W, height: H, levelRange: [32, 42],
    platforms: [ground(0, W, G), A, B, C, D, E, F, Gp, Hh, I, J, K, L, M, N, O, P, Q, R, S],
    walls: [dais],
    ropes: [
      ladder(500, Hh.y, E.y), ladder(1400, I.y, F.y), ladder(2450, K.y, Gp.y),
      ladder(700, N.y, L.y), ladder(1300, O.y, I.y), ladder(2300, P.y, M.y), ladder(1700, S.y, O.y),
    ],
    portals: [portal('entry', 90, G, 'mistvale', 'stacks')],
    spawns: [
      span('ink_golem', 300, 1260, G, 2), span('ink_golem', 1760, 2920, G, 2), span('ink_golem', 1340, 1660, dais.y, 1),
      on('ink_golem', C, 1), on('ink_golem', O, 1),
      on('animated_tome', E, 1), on('animated_tome', Gp, 1), on('animated_tome', I, 1), on('animated_tome', J, 1),
      on('animated_tome', L, 1), on('animated_tome', M, 1), on('animated_tome', N, 1), on('animated_tome', P, 1),
      on('void_wisp', Q, 1), on('void_wisp', R, 1), on('void_wisp', S, 1),
    ],
    npcs: [],
  };
})();

export const MAPS: MapDef[] = [mistvale, whisperwood, shroom_hollow, frostfang_cliffs, cinder_caverns, stormspire_peak, arcane_sanctum, trial_hall, moonlit_marsh, glacier_grotto, restricted_stacks];
