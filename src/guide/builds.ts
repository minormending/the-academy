// Suggested builds. Writers pick the spells and levels; the page totals the SP, checks every prerequisite and
// checks each Year fits the SP a student really has by then (3 to start, 3 per level, 3 per School Year).
// Story mode: a Year opens when the Headmistress declares or promotes you, never before its level, and some
// classes pay a little SP when you pass them. The budget leaves class SP out, so every build also fits a student
// who skipped those classes.
// A build that stops fitting after a balance change is flagged on the page and in the console (dev).

import { SP_PER_LEVEL } from '../core/balance';
import { JOB_LEVELS, MAX_LEVEL } from '../core/constants';
import { JOB_ADVANCE_BONUS_SP } from '../systems/Progression';
import { Registry } from '../core/registry';
import type { School } from '../data/jobs';

export type Alloc = Record<string, number>;

export interface Build {
  name: string;
  style: string;
  /** Year 2, Year 3, Year 4 allocations (Year 1 uses CORE_PLAN; the Year 5 Archon page is left to the reader). */
  years: [Alloc, Alloc, Alloc];
  /** Rotation / play notes. */
  notes: string[];
}

/** A shared Year 1 plan every build below starts from. */
export const CORE_PLAN: Alloc = {
  app_arcane_bolt: 10, app_arcane_orb: 5, app_blink: 1, app_mana_font: 5, app_scholars_insight: 3,
};

export const BUILDS: Record<School, Build[]> = {
  fire: [
    {
      name: 'Wildfire', style: 'Burn whole ledges at once: cones, pillars and explosions that leave everything burning.',
      years: [
        { fire_arrow: 10, fire_flame_burst: 15, fire_firebomb: 12, fire_smolder: 10, fire_kindle: 5 },
        { fire_pillar: 15, fire_pyre_mastery: 10, fire_flame_wall: 8, fire_orb: 5, fire_combust: 10 },
        { fire_inferno_lance: 5, fire_meteor_storm: 10, fire_supernova: 10, fire_inferno_heart: 11 },
      ],
      notes: ['Open with Firebomb into a crowd, follow with Flame Burst at close range.', 'Inferno Pillar and Wall of Fire hold a ledge while burns tick.', 'Save Meteor Storm and Supernova for packed rooms and bosses.'],
    },
    {
      name: 'Sunfire Duelist', style: 'One target, then the next: the biggest single hits in the Academy, with a salamander and a phoenix on your side.',
      years: [
        { fire_arrow: 20, fire_smolder: 15, fire_kindle: 10, fire_firebomb: 3, fire_overheat: 4 },
        { fire_orb: 20, fire_pyre_mastery: 15, fire_salamander: 8, fire_ember_ward: 3, fire_ember_volley: 2 },
        { fire_inferno_lance: 10, fire_immolation: 10, fire_phoenix: 5, fire_inferno_heart: 11 },
      ],
      notes: ['Kindle up, then Flame Arrow and later Blazing Orb on repeat.', 'Overheat trades defence for damage: pop it when the boss is busy elsewhere.', 'Immolation costs HP; keep a Red Potion key under your finger.'],
    },
    {
      name: 'Trapper', style: 'Mines on the approach, brands on the survivors, and fire that spreads on its own. Fight from where you are standing.',
      years: [
        { fire_arrow: 10, fire_firebomb: 3, fire_cinder_mine: 13, fire_kindling_brand: 12, fire_flamethrower: 6, fire_overheat: 8 },
        { fire_flashover: 15, fire_vent_heat: 10, fire_orb: 13, fire_pyre_mastery: 10 },
        { fire_last_ember: 12, fire_inferno_lance: 15, fire_inferno_heart: 9 },
      ],
      notes: ['Plant Cinder Mines between you and the pack; they arm after half a second and erupt when a foe steps on them.', 'Kindling Brand up to three foes: a branded foe that dies bursts and lights its neighbours. Flashover on a burning target then ignites everything around it.', 'Overheat, then Vent Heat to cash it in for a blast: the fresher the buff, the bigger the blast. Last Ember hits hardest when your HP is low, so save it for the moment a boss has you cornered.'],
    },
  ],
  ice: [
    {
      name: 'Permafrost Controller', style: 'Freeze the room, shatter it, repeat. Nothing reaches you.',
      years: [
        { ice_frost_bolt: 10, ice_frost_nova: 15, ice_cold_mastery: 10, ice_frost_armor: 8, ice_frost_step: 1, ice_crystal_wall: 8 },
        { ice_lance: 5, ice_glacial_spike: 15, ice_shatter: 15, ice_glacial_mastery: 10, ice_crystal_memory: 3 },
        { ice_blizzard: 10, ice_absolute_zero: 10, ice_glacial_lance: 1, ice_permafrost: 10, ice_winters_embrace: 5 },
      ],
      notes: ['Frost Nova or Glacial Spike to freeze, Shatter while they are frozen.', 'Crystal Wall stops a charge cold.', 'Blizzard then Absolute Zero clears a whole map section.'],
    },
    {
      name: 'Glacier Sniper', style: 'Long, heavy lances from behind a wall of frost armour.',
      years: [
        { ice_frost_bolt: 15, ice_cold_mastery: 10, ice_frost_armor: 10, ice_rime_guard: 10, ice_rime_ray: 7 },
        { ice_lance: 15, ice_crystal_needle: 10, ice_glacial_mastery: 10, ice_frost_elemental: 5, ice_restorative_thaw: 3, ice_crystal_memory: 5 },
        { ice_glacial_lance: 20, ice_permafrost: 10, ice_hoarfrost_relay: 6 },
      ],
      notes: ['Frost Armor and Rime Guard make you the sturdiest student in the Academy.', 'Icicle Lance and Glacial Lance pierce lines of monsters.', 'Restorative Thaw is your heal: use it early, not at the last sliver.'],
    },
    {
      name: 'Rime Tactician', style: 'Set the trap, mark the target, cash it in. Chill, freeze and thaw all pay you something.',
      years: [
        { ice_frost_bolt: 10, ice_cold_snap: 14, ice_rime_snare: 10, ice_rime_brand: 10, ice_frost_nova: 5, ice_frost_armor: 2, ice_frost_step: 1 },
        { ice_hail_loom: 15, ice_cold_exchange: 10, ice_fracture_route: 15, ice_lance: 8 },
        { ice_diamond_reckoning: 15, ice_rime_recall: 10, ice_glacial_lance: 11 },
      ],
      notes: ['Rime Snare freezes the first group to step into it. Rime Brand marks one foe: three ice hits on it freeze it.', 'Cold Snap cashes in chill on a tight cluster for double damage. Cold Exchange thaws up to three frozen foes nearby and pays you MP for the privilege.', 'Hail Loom is a channel that lashes a line six times, harder on chilled foes; move or get hit and it breaks. Fracture Route cuts a chilling trail as you blink backward out of trouble.', 'Diamond Reckoning doubles its burst if Frost Armor or Diamond Barrier is up, and uses that armour up: do not cast it with the only thing keeping you alive. Rime Recall drops an anchor; recast it to snap back and freeze whatever stood there.'],
    },
  ],
  lightning: [
    {
      name: 'Chain Reactor', style: 'Bolts that leap through every monster on the screen, then a storm on top.',
      years: [
        { ltn_thunder_bolt: 20, ltn_static_charge: 10, ltn_spark_lance: 10, ltn_storm_step: 1, ltn_live_wire: 5, ltn_repulsion_ring: 6 },
        { ltn_thunder_spear: 15, ltn_ball_lightning: 10, ltn_overload: 5, ltn_storm_totem: 5, ltn_storm_mastery: 10, ltn_flash_relay: 3 },
        { ltn_arc_storm: 15, ltn_thunderstorm: 10, ltn_perfect_conductor: 5, ltn_eye_of_the_storm: 6 },
      ],
      notes: ['Thunder Bolt and later Arc Storm chain through crowds; shocked targets take extra from everything.', 'Repulsion Ring stuns whatever gets close.', 'Drop a Storm Totem on a busy ledge and keep moving.'],
    },
    {
      name: 'Thunder Duelist', style: 'Rapid single-target strikes and huge crits, built for field bosses.',
      years: [
        { ltn_thunder_bolt: 10, ltn_galvanic_needle: 20, ltn_static_charge: 10, ltn_live_wire: 9, ltn_storm_step: 3 },
        { ltn_thunder_spear: 10, ltn_capacitor_burst: 20, ltn_storm_totem: 5, ltn_storm_mastery: 10, ltn_charge_reversal: 3 },
        { ltn_perfect_conductor: 10, ltn_rail_of_heaven: 10, ltn_arc_storm: 3, ltn_ion_judgment: 10, ltn_eye_of_the_storm: 3 },
      ],
      notes: ['Galvanic Needle and Capacitor Burst hit one target many times.', 'Ion Judgment and Rail of Heaven are the boss finishers.', 'Charge Reversal refills HP and MP in the middle of a long boss fight.'],
    },
    {
      name: 'Short Circuit', style: 'Brand, then discharge. Seals and fields hold the room while you skate and channel.',
      years: [
        { ltn_thunder_bolt: 12, ltn_ion_brand: 10, ltn_short_circuit: 15, ltn_grounding_seal: 15 },
        { ltn_tesla_channel: 15, ltn_arc_skate: 15, ltn_blood_dynamo: 10, ltn_thunder_spear: 8 },
        { ltn_tempest_reprisal: 10, ltn_storm_circuit: 15, ltn_arc_storm: 11 },
      ],
      notes: ['Ion Brand puts a long-lived shock on one foe; Short Circuit chains through three foes and consumes shock for 80% more damage.', 'Grounding Seal wakes for intruders and stuns them repeatedly. Storm Circuit shocks foes only while you stand inside it, so fight at its centre.', 'Arc Skate cuts three shocking lines along your real path. Tesla Channel needs you to stand still for a second.', 'Blood Dynamo trades up to 12% of your max HP for MP when you are dry. Tempest Reprisal answers up to three hits with a retaliation: pop it before a boss swing, not after.'],
    },
  ],
  holy: [
    {
      name: 'Dawnbringer', style: 'Radiant offence: stuns, rays and a rain of light, with just enough healing.',
      years: [
        { holy_arrow: 10, holy_heal: 8, holy_divine_focus: 10, holy_smite: 13, holy_bless: 5, holy_faith: 5, holy_step: 1 },
        { holy_shining_ray: 20, holy_sacred_lance: 10, holy_radiant_mastery: 10, holy_prayer: 5, holy_guardian_spirit: 3 },
        { holy_halo_nova: 11, holy_angel_ray: 5, holy_genesis: 10, holy_benediction: 10 },
      ],
      notes: ['Shining Ray stuns and softens a pack; Smite cleans up up close.', 'Heal also damages everything around you: cast it into a crowd.', 'Genesis is the ultimate answer to the Lich Archon.'],
    },
    {
      name: 'Sanctuary', style: 'Out-heal anything. Slow, steady and nearly impossible to bring down.',
      years: [
        { holy_heal: 20, holy_faith: 10, holy_bless: 10, holy_arrow: 10, holy_step: 2 },
        { holy_symbol: 15, holy_consecration: 10, holy_shining_ray: 10, holy_guardian_spirit: 8, holy_radiant_mastery: 5 },
        { holy_divine_aegis: 10, holy_salvation: 5, holy_seraph: 10, holy_halo_nova: 11 },
      ],
      notes: ['Keep Bless and Holy Symbol up at all times.', 'Guardian Spirit and later Summon Seraph fight while you heal.', 'Salvation is the panic button: save it for the Lich\'s enrage.'],
    },
    {
      name: 'Verdict', style: 'Stun them, then judge them. Wards and a vow of blood hold the line, and a ray finishes it.',
      years: [
        { holy_arrow: 10, holy_heal: 5, holy_faith: 3, holy_smite: 5, holy_glyph: 10, holy_verdict: 14, holy_dawn_rush: 5 },
        { holy_brand: 15, holy_martyr: 10, holy_retribution: 13, holy_shining_ray: 10 },
        { holy_dawn_ray: 15, holy_sanctuary: 10, holy_halo_nova: 11 },
      ],
      notes: ['Warding Glyph stuns whatever steps on it; Brand of Judgment leaps between foes with a near-certain stun. Verdict hits a stunned target far harder.', 'Dawn Rush charges along the ground, hitting everything on the way and healing you more for each foe.', "Martyr's Vow spends a quarter of your current HP (never the last point) and then heals you strongly over five seconds. Retribution calls judgment on the nearest foe whenever you are hit, with a short pause between strikes.", 'Sanctuary absorbs damage, then bursts: the more it held, the harder it hits. Ray of Dawn is a channel; stunned foes burn brighter.'],
    },
  ],
  shadow: [
    {
      name: 'Plaguebearer', style: 'Curse, poison and wither: everything dies slowly, and all at once.',
      years: [
        { shd_shadow_bolt: 10, shd_hex: 10, shd_umbral_focus: 15, shd_grave_link: 10, shd_dread_pulse: 5, shd_shadow_step: 2 },
        { shd_plague_cloud: 15, shd_wither: 10, shd_soul_drain: 3, shd_necrotic_mastery: 10, shd_grave_chains: 10 },
        { shd_death_scythe: 10, shd_night_tide: 10, shd_veil_of_night: 5, shd_grave_pact: 11 },
      ],
      notes: ['Hex first: cursed monsters take more from everything you do next.', 'Plague Cloud and Wither stack poison and curse over a whole pack.', 'Night Tide rains scythes over the screen.'],
    },
    {
      name: 'Gravecaller', style: 'Let the dead do the work: skeletons, a wraith, a lich shade and a bone dragon.',
      years: [
        { shd_shadow_bolt: 15, shd_dark_pact: 10, shd_umbral_focus: 10, shd_shadow_step: 5, shd_grave_skin: 10, shd_hex: 2 },
        { shd_soul_drain: 10, shd_raise_skeleton: 10, shd_haunt_wraith: 10, shd_bone_ward: 5, shd_necrotic_mastery: 13 },
        { shd_lich_shade: 15, shd_bone_dragon: 10, shd_veil_of_night: 5, shd_soul_reservoir: 6 },
      ],
      notes: ['Raise your servants before you pull, then Soul Drain to stay topped up.', 'Grave Skin and Bone Ward keep you alive while the summons tank.', 'Bone Dragon has a very long cooldown: open every boss fight with it.'],
    },
    {
      name: 'Hexweaver', style: 'Poison and curse as setups, then spend them. Traps and wards do the waiting for you.',
      years: [
        { shd_shadow_bolt: 10, shd_hex: 10, shd_grave_mine: 10, shd_bitter_harvest: 15, shd_blood_tithe: 7 },
        { shd_doom_seal: 15, shd_dirge_channel: 10, shd_umbra_passage: 10, shd_soul_drain: 13 },
        { shd_hex_relay: 15, shd_soul_ward: 10, shd_death_scythe: 11 },
      ],
      notes: ['Grave Mine bursts into poison when a foe steps on it; Bitter Harvest then cleaves for double damage against poison and consumes it.', 'Doom Seal curses a zone and collapses it two seconds later, spending every curse in it. Hex Relay does the same to scattered foes, 1.8 times over.', 'Dirge Channel sends a wraith whose beams punish cursed foes. Umbra Passage cuts every foe along the blink.', 'Blood Tithe turns HP into MP when you are dry. Soul Ward pulses against cursed foes and drains a little life, so Hex first.'],
    },
  ],
};

// ─────────────────────────── SP budget ───────────────────────────

/**
 * Total SP a student has received by `level` from levels and Year bonuses, having been promoted into every Year
 * whose level they have reached (Years 2–4). Class rewards are not counted (see the note at the top).
 */
export function spAtLevel(level: number): number {
  const START_SP = 3; // newPlayerState: 3 SP at level 1
  const years = ([2, 3, 4] as const).filter(t => level >= JOB_LEVELS[t]).length;
  return START_SP + SP_PER_LEVEL * (Math.min(level, MAX_LEVEL) - 1) + JOB_ADVANCE_BONUS_SP * years;
}

/** SP an allocation costs (Arcane Bolt's first level is free). */
export function allocCost(a: Alloc): number {
  return Object.entries(a).reduce((n, [id, lv]) => n + lv - (id === 'app_arcane_bolt' ? Math.min(1, lv) : 0), 0);
}

export interface BuildCheck { cost: number[]; budget: number[]; problems: string[] }

/** Cumulative cost per Year vs. SP on the last level before the next Year opens (and at max level). */
export function checkBuild(b: Build): BuildCheck {
  const stages: Alloc[] = [CORE_PLAN, ...b.years];
  const lastLevel = [JOB_LEVELS[2] - 1, JOB_LEVELS[3] - 1, JOB_LEVELS[4] - 1, MAX_LEVEL];
  const problems: string[] = [];
  const have: Alloc = {};
  const cost: number[] = [];
  let total = 0;
  stages.forEach((st, i) => {
    for (const [id, lv] of Object.entries(st)) {
      const s = Registry.skill(id);
      if (!s) { problems.push(`unknown spell ${id}`); continue; }
      if (lv > s.maxLevel) problems.push(`${s.name} only goes to ${s.maxLevel}`);
      have[id] = Math.max(have[id] ?? 0, lv);
    }
    total += allocCost(st);
    cost.push(total);
  });
  for (const [id, lv] of Object.entries(have)) {
    const s = Registry.skill(id);
    for (const r of s?.requires ?? []) {
      if ((have[r.skillId] ?? 0) < r.level) problems.push(`${s?.name} needs ${Registry.skill(r.skillId)?.name ?? r.skillId} ${r.level}`);
    }
    if (lv <= 0) problems.push(`${s?.name ?? id} at level 0`);
  }
  const budget = lastLevel.map(spAtLevel);
  cost.forEach((c, i) => { if (c > budget[i]) problems.push(`Year ${i + 1} needs ${c} SP but a student has ${budget[i]} by level ${lastLevel[i]}`); });
  return { cost, budget, problems };
}
