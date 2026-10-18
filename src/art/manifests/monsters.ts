// Asset manifest for the monsters art domain (owned by that domain's art agent).
// Sources (CC0 / CC-BY, see public/assets/monsters/CREDITS.md). Raw sheets are sliced,
// palette-swapped and integer-scaled into `monster_<id>` / `drop_coin_*` by src/art/monsterArt.ts.
import type { AssetEntry } from '../assets';

const img = (key: string, path: string): AssetEntry => ({ key, path, type: 'image' });

/** Source texture keys (raw sheets). */
export const MSRC = {
  snail: 'src_mon_snail',
  slime: 'src_mon_slime',
  shroomWalk: 'src_mon_shroom_walk',
  shroomBreath: 'src_mon_shroom_breath',
  shroomIdle: 'src_mon_shroom_idle',
  stump: 'src_mon_stump',
  batFly: 'src_mon_bat_fly',
  batHit: 'src_mon_bat_hit',
  batDeath: 'src_mon_bat_death',
  wartaur: 'src_mon_wartaur',
  sparky: 'src_mon_sparky',
  imp: 'src_mon_imp',
  lizardIdle: 'src_mon_lizard_idle',
  lizardWalk: 'src_mon_lizard_walk',
  lizardHurt: 'src_mon_lizard_hurt',
  golem: 'src_mon_golem',
  bird: 'src_mon_bird',
  dragon: 'src_mon_dragon_idle',
  wizard: 'src_mon_wizard',
  poof: 'src_mon_poof',
  coins: 'src_mon_coins',
} as const;

export const MONSTER_ASSETS: AssetEntry[] = [
  img(MSRC.snail, 'monsters/reemax_snail/slime-snail.png'),
  img(MSRC.wartaur, 'monsters/emceeflesher_bestiary/wartaur.png'),
  img(MSRC.golem, 'monsters/emceeflesher_bestiary/golem.png'),
  img(MSRC.sparky, 'monsters/emceeflesher_bestiary/sparky.png'),
  img(MSRC.slime, 'monsters/bonsaiheldin_slime/slime_monster_spritesheet.png'),
  img(MSRC.shroomWalk, 'monsters/ansimuz_sideview_fantasy/sunny-mushroom-walk.png'),
  img(MSRC.shroomBreath, 'monsters/ansimuz_sideview_fantasy/sunny-mushroom-breath.png'),
  img(MSRC.shroomIdle, 'monsters/ansimuz_sideview_fantasy/sunny-mushroom-breath-no-gas.png'),
  img(MSRC.lizardIdle, 'monsters/ansimuz_sideview_fantasy/lizard-idle.png'),
  img(MSRC.lizardWalk, 'monsters/ansimuz_sideview_fantasy/lizard-walk.png'),
  img(MSRC.lizardHurt, 'monsters/ansimuz_sideview_fantasy/lizard-hurt.png'),
  img(MSRC.dragon, 'monsters/ansimuz_sideview_fantasy/dragon-idle.png'),
  img(MSRC.bird, 'monsters/ansimuz_sideview_fantasy/flying-creature-cycle-skin.png'),
  img(MSRC.wizard, 'monsters/ansimuz_gothicvania_church/wizard.png'),
  img(MSRC.poof, 'monsters/ansimuz_sunny_land/enemy-death.png'),
  img(MSRC.stump, 'monsters/antiotter_stump/stump.png'),
  img(MSRC.imp, 'monsters/calciumtrice_imp/imp.png'),
  img(MSRC.batFly, 'monsters/admurin_enemy_galore/bat-fly.png'),
  img(MSRC.batHit, 'monsters/admurin_enemy_galore/bat-hit.png'),
  img(MSRC.batDeath, 'monsters/admurin_enemy_galore/bat-death.png'),
  img(MSRC.coins, 'monsters/zaphgames_coins/coins_animation.png'),
];
