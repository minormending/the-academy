/**
 * ARCANA STORY — SHARED CONTRACTS.
 * Owned by the lead (orchestrator). Builder agents MUST NOT edit this file.
 * If you need a contract change, note it in your final report instead and
 * work around it locally.
 */
import type Phaser from 'phaser';

// ───────────────────────────── Elements, jobs ─────────────────────────────

export type Element = 'neutral' | 'fire' | 'ice' | 'lightning' | 'holy' | 'shadow';
export type Branch = 'none' | 'fire' | 'ice' | 'lightning' | 'holy' | 'shadow';
export type JobTier = 1 | 2 | 3 | 4;

export type JobId =
  | 'apprentice'                                   // tier 1 (start, lv 1)
  | 'pyromancer' | 'flamebinder' | 'inferno_sage'  // fire  tiers 2,3,4
  | 'cryomancer' | 'frostbinder' | 'glacial_sage'  // ice   tiers 2,3,4
  | 'stormcaller' | 'stormbinder' | 'tempest_sage' // lightning tiers 2,3,4
  | 'cleric' | 'priest' | 'hierophant'            // holy  tiers 2,3,4
  | 'occultist' | 'necromancer' | 'umbral_sage';  // shadow tiers 2,3,4

export interface JobDef {
  id: JobId;
  name: string;
  branch: Branch;
  tier: JobTier;
  requiredLevel: number;          // see JOB_LEVELS in constants.ts
  parent: JobId | null;
  description: string;
  /** Character look for this job (robe/hat colors). Used by art/characters.ts. */
  look: CharacterLook;
}

export interface CharacterLook {
  robe: number;      // 0xRRGGBB
  robeTrim: number;
  hat: number;
  hatTrim: number;
  hair: number;
  skin: number;
  staffGem: number;  // glowing gem on the staff
  hatStyle: 'none' | 'hood' | 'pointed' | 'circlet' | 'crown';
}

// ───────────────────────────── Stats ─────────────────────────────

export interface BaseStats { str: number; dex: number; int: number; luk: number; }
export type BaseStatKey = keyof BaseStats;

export interface DerivedStats {
  maxHp: number;
  maxMp: number;
  matk: number;        // magic attack (main damage scalar)
  def: number;         // damage reduction vs. monster touch/attacks
  critRate: number;    // 0..1
  critDmg: number;     // extra multiplier on crit, e.g. 0.5 => x1.5
  mastery: number;     // 0..1  min-roll as a fraction of max damage
  speed: number;       // walk speed px/s (base 200)
  jump: number;        // jump velocity px/s (base 560)
  hpRegen: number;     // HP restored every 5s
  mpRegen: number;     // MP restored every 5s
  mpShield: number;    // 0..1 portion of incoming damage taken from MP instead
  dmgAll: number;      // additive % bonus as fraction (0.1 = +10%)
  dmgFire: number;
  dmgIce: number;
  dmgLightning: number;
  dmgHoly: number;
  dmgShadow: number;
  castSpeed: number;   // fraction that reduces cast lock times (0.2 = 20% faster)
  cdr: number;         // fraction cooldown reduction
}
export type DerivedStatKey = keyof DerivedStats;

/** final = (base + Σadd) * (1 + Σmul) */
export interface StatModifier { stat: DerivedStatKey; add?: number; mul?: number; }

// ───────────────────────────── Icons (procedural) ─────────────────────────────

export type IconGlyph =
  | 'flame' | 'fireball' | 'meteor' | 'phoenix' | 'ember' | 'explosion'
  | 'snowflake' | 'icicle' | 'ice_shard' | 'frost_nova' | 'blizzard' | 'glacier'
  | 'bolt' | 'chain' | 'storm' | 'thunder_cloud' | 'spark' | 'orb'
  | 'arcane_star' | 'missile' | 'claw' | 'shield' | 'teleport' | 'book' | 'eye' | 'wind' | 'heart' | 'mana'
  | 'potion' | 'wand' | 'staff' | 'hat' | 'robe' | 'shoes' | 'gloves' | 'ring' | 'amulet'
  | 'coin' | 'gem' | 'scroll' | 'shell' | 'jelly' | 'mushroom' | 'feather' | 'fur' | 'bone' | 'crystal' | 'scale'
  | 'halo' | 'holy_cross' | 'sunburst' | 'wings' | 'skull' | 'scythe' | 'ghost' | 'poison' | 'paw';

export interface IconSpec {
  glyph: IconGlyph;
  color: number;      // primary glyph color
  color2?: number;    // secondary/accent color
  bg?: number;        // tile background (skill icons); items usually omit
}

// ───────────────────────────── Status effects ─────────────────────────────

export type StatusKind =
  | 'burn'    // DoT: potency = damage per tick (ticks every 500ms)
  | 'chill'   // slow: potency = fraction of move speed removed (0..0.9)
  | 'freeze'  // cannot move or attack; potency unused
  | 'shock'   // takes extra damage: potency = fraction bonus damage taken
  | 'stun'    // cannot move or attack; potency unused
  | 'poison'  // DoT like burn (shadow): potency = damage per tick (ticks every 500ms)
  | 'curse';  // weakened: takes extra damage AND deals less: potency = fraction (0..0.6)

export interface StatusSpec {
  kind: StatusKind;
  chance: (lv: number) => number;      // 0..1
  durationMs: (lv: number) => number;
  /** For 'burn': % of the skill's per-hit damage dealt per tick (e.g. 15 = 15%). Otherwise raw potency. */
  potency: (lv: number) => number;
}

export interface StatusInstance {
  kind: StatusKind;
  durationMs: number;   // remaining
  potency: number;      // concrete value (burn: damage per tick, chill: slow fraction, shock: bonus fraction)
  element: Element;
}

// ───────────────────────────── Skills ─────────────────────────────

export type SkillKind = 'attack' | 'buff' | 'passive' | 'movement' | 'summon';

export type AttackPattern =
  | 'projectile'  // flies forward from caster; hits first N targets (or pierces)
  | 'melee_arc'   // instant area in front of caster (area w/h, offsetX)
  | 'aoe_self'    // area centered on caster
  | 'aoe_target'  // area centered on the nearest monster in front within `range` (or at range if none)
  | 'chain'       // hits nearest target in front, then jumps to next-nearest within chain.jumpRange
  | 'beam'        // instant line in front: rect from caster of length `range`, height area.h
  | 'rain';       // N impacts spread over an area in front, dropping from above

export interface AttackSpec {
  pattern: AttackPattern;
  damagePct: (lv: number) => number;   // % of matk per hit (see balance.ts for reference ranges)
  hits: (lv: number) => number;        // damage lines per target (Maple-style multi-hit)
  maxTargets: (lv: number) => number;
  range: number;                       // px forward reach (projectile max travel, aoe_target search, beam length)
  area?: { w: number; h: number; offsetX?: number; offsetY?: number }; // for melee_arc/aoe_self/aoe_target/beam/rain/projectile-explosion
  projectile?: {
    speed: number;          // px/s
    radius: number;         // collision radius
    pierce?: boolean;       // keep going through targets (up to maxTargets)
    gravity?: number;       // px/s^2 (arcing projectiles); default 0
    explodeArea?: { w: number; h: number }; // on first impact deal damage to all in area (up to maxTargets)
    count?: (lv: number) => number;  // number of projectiles fired (fanned / staggered)
    spreadDeg?: number;     // fan spread between projectiles
  };
  chain?: { jumpRange: number; jumpDelayMs?: number };
  rain?: { count: (lv: number) => number; spreadX: number; intervalMs: number; fallHeight?: number };
  status?: StatusSpec;
  /** Bonus damage vs. targets that have a status, e.g. shatter frozen. */
  bonusVs?: { status: StatusKind; mult: number; consume?: boolean };
  knockback?: number;       // px pushed away from caster
  delayMs?: number;         // delay from cast start to first damage (sync with vfx)
  hitIntervalMs?: number;   // delay between multi-hit lines (default 90)
  vfx: {
    cast?: string;          // played at caster on cast
    projectile?: string;    // visual that travels with a projectile (engine owns lifetime)
    hit?: string;           // played on each damaged target
    area?: string;          // played at the area / impact point
  };
}

export interface BuffSpec {
  durationMs: (lv: number) => number;
  modifiers: (lv: number) => StatModifier[];
  vfx?: string;             // one-shot on cast
  auraVfx?: string;         // persistent visual following the player while active (engine owns lifetime)
}

export interface MovementSpec {
  kind: 'blink';            // instant teleport in input direction (left/right/up/down), default facing
  distance: (lv: number) => number;
  vfxOut?: string;          // at origin
  vfxIn?: string;           // at destination
}

export interface SummonSpec {
  durationMs: (lv: number) => number;
  attackIntervalMs: number;
  attack: AttackSpec;       // executed from the summon's position, facing nearest monster
  vfx: string;              // persistent body visual (engine owns lifetime); positioned at summon x/y
  offset: { x: number; y: number }; // spawn offset relative to caster (x mirrored by facing)
  follow?: boolean;         // hovers near the player if true, else stationary
}

export interface SkillDef {
  id: string;               // prefix: app_ / fire_ / ice_ / ltn_
  name: string;
  description: string;      // one line; may mention {dmg} etc. — UI shows plain text
  element: Element;
  job: JobId;               // job that teaches it (tier implied by job)
  kind: SkillKind;
  maxLevel: number;
  icon: IconSpec;
  requires?: { skillId: string; level: number }[];
  mpCost: (lv: number) => number;
  cooldownMs?: (lv: number) => number;
  castTimeMs?: number;      // player animation lock (default 450)
  attack?: AttackSpec;      // kind 'attack'
  buff?: BuffSpec;          // kind 'buff'
  passive?: (lv: number) => StatModifier[]; // kind 'passive' (always on while learned)
  movement?: MovementSpec;  // kind 'movement'
  summon?: SummonSpec;      // kind 'summon'
  sfx?: SfxKey;
  /** Escape hatch: replaces the default behaviour entirely. Use sparingly. */
  onCast?: (ctx: SkillContext, lv: number) => void;
}

export type CastResult = 'ok' | 'no_mp' | 'cooldown' | 'busy' | 'not_learned' | 'unknown' | 'passive' | 'dead';

export interface ActiveBuff {
  skillId: string;
  remainingMs: number;
  totalMs: number;
  modifiers: StatModifier[];
}

/** Passed to SkillDef.onCast and used by the engine internally. */
export interface SkillContext {
  scene: Phaser.Scene;
  services: GameServices;
  skill: SkillDef;
  level: number;
  /** Convenience: run any AttackSpec from an origin (used by onCast customs). */
  runAttack: (spec: AttackSpec, origin: { x: number; y: number; facing: 1 | -1 }) => void;
}

// ───────────────────────────── VFX ─────────────────────────────

export interface VfxOptions {
  x: number;
  y: number;
  facing: 1 | -1;
  targetX?: number;
  targetY?: number;
  w?: number;              // area width hint
  h?: number;              // area height hint
  durationMs?: number;     // for persistent visuals (aura/summon), informational
  lv?: number;
  scale?: number;
  angle?: number;          // radians, projectile heading
  /** Walkable surface y under the effect (feet line) when the engine knows it — anchor ground effects here. */
  groundY?: number;
}

/**
 * A VFX function draws an effect. One-shot effects must clean themselves up (tweens/timers)
 * and return void. Persistent visuals (projectile/aura/summon) return a GameObject whose
 * position the engine updates each frame and which the engine destroys when done.
 */
export type VfxFn = (scene: Phaser.Scene, o: VfxOptions) => Phaser.GameObjects.GameObject | void;

// ───────────────────────────── Audio ─────────────────────────────

export type SfxKey =
  | 'jump' | 'land' | 'portal' | 'pickup' | 'mesos' | 'levelup' | 'job_advance' | 'death'
  | 'player_hurt' | 'monster_hit' | 'monster_crit' | 'monster_die' | 'boss_roar'
  | 'cast_arcane' | 'cast_fire' | 'cast_ice' | 'cast_lightning' | 'cast_holy' | 'cast_shadow' | 'buff' | 'curse'
  | 'explosion' | 'freeze' | 'shatter' | 'thunder' | 'zap' | 'whoosh' | 'blink' | 'heal'
  | 'ui_click' | 'ui_open' | 'ui_close' | 'ui_error' | 'quest_complete' | 'potion';

export type MusicKey = 'title' | 'town' | 'forest' | 'cave' | 'snow' | 'volcano' | 'storm' | 'boss';

// ───────────────────────────── Items ─────────────────────────────

export type ItemType = 'consumable' | 'equip' | 'etc';
export type EquipSlot = 'weapon' | 'hat' | 'robe' | 'shoes' | 'gloves' | 'ring' | 'amulet';

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  description: string;
  icon: IconSpec;
  price: number;           // shop buy price (0 = not sold)
  sellPrice: number;
  maxStack: number;        // 1 for equips
  consumable?: {
    hp?: number; mp?: number; hpPct?: number; mpPct?: number;
    cooldownMs?: number;
    returnToTown?: boolean;
  };
  equip?: {
    slot: EquipSlot;
    reqLevel: number;
    reqBranch?: Branch;     // undefined = any mage
    modifiers: StatModifier[];
  };
}

export interface ItemStack { uid: string; itemId: string; qty: number; }

export interface DropEntry { itemId: string; chance: number; min?: number; max?: number; }

// ───────────────────────────── Monsters ─────────────────────────────

export type MonsterBehavior = 'walker' | 'hopper' | 'flyer' | 'stationary' | 'boss';

export interface MonsterDef {
  id: string;
  name: string;
  level: number;
  hp: number;
  exp: number;
  mesos: [number, number];
  touchDamage: number;
  def: number;             // flat damage reduction applied to player hits (keep small)
  speed: number;           // px/s
  size: { w: number; h: number }; // hitbox
  behavior: MonsterBehavior;
  aggressive?: boolean;    // chases player after being hit (always true for boss)
  weak?: Element[];        // x1.5
  resist?: Element[];      // x0.5
  immune?: StatusKind[];
  drops: DropEntry[];
  boss?: boolean;
}

export interface IMonster {
  readonly uid: number;
  readonly def: MonsterDef;
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly x: number;
  readonly y: number;      // feet position
  hp: number;
  readonly maxHp: number;
  readonly alive: boolean;
  getBounds(): Phaser.Geom.Rectangle;
  /** Apply final damage (already computed by CombatSystem). Handles hit anim, aggro, death. */
  takeDamage(amount: number, opts: { crit?: boolean; knockbackX?: number; fromX?: number }): void;
  applyStatus(s: StatusInstance): void;
  hasStatus(kind: StatusKind): boolean;
  removeStatus(kind: StatusKind): void;
  /** Multiplier for incoming damage from statuses (e.g. shock). */
  incomingDamageMult(): number;
  update(time: number, delta: number): void;
  destroy(): void;
}

// ───────────────────────────── Maps ─────────────────────────────

export type MapTheme = 'town' | 'forest' | 'mushroom' | 'snow' | 'volcano' | 'storm' | 'sanctum';

export interface PlatformDef { x1: number; x2: number; y: number; oneWay: boolean; } // y = top surface
export interface WallDef { x: number; y: number; w: number; h: number; }
export interface RopeDef { x: number; top: number; bottom: number; kind: 'rope' | 'ladder'; }
export interface PortalDef { id: string; x: number; y: number; targetMap: string; targetPortal: string; hidden?: boolean; }
export interface SpawnDef { monsterId: string; x1: number; x2: number; y: number; count: number; respawnMs?: number; }
export interface NpcPlacement { npcId: string; x: number; y: number; facing?: 1 | -1; }

export interface MapDef {
  id: string;
  name: string;
  region: string;
  theme: MapTheme;
  music: MusicKey;
  width: number;            // px
  height: number;           // px
  platforms: PlatformDef[]; // ground floor is a platform with oneWay=false spanning width
  walls?: WallDef[];        // solid blocks
  ropes: RopeDef[];
  portals: PortalDef[];
  spawns: SpawnDef[];
  npcs: NpcPlacement[];
  levelRange: [number, number];
  safe?: boolean;           // town: no monsters, faster regen
}

export interface IMapInstance {
  readonly def: MapDef;
  readonly widthPx: number;
  readonly heightPx: number;
  /** Fully solid bodies (ground, walls). */
  readonly solids: Phaser.Physics.Arcade.StaticGroup;
  /** One-way (jump-through) platforms: bodies only collide on their top face. */
  readonly platforms: Phaser.Physics.Arcade.StaticGroup;
  getRopeAt(x: number, y: number, tolerance?: number): RopeDef | null;
  getPortalNear(x: number, y: number): PortalDef | null;
  getPortalById(id: string): PortalDef | null;
  /** Default spawn when no portal given (first portal or map center ground). */
  getDefaultSpawn(): { x: number; y: number };
  /** The walkable span (platform) whose top is at/just below (x,y). Used by monster AI edge checks. */
  platformAt(x: number, y: number, tolerance?: number): PlatformDef | null;
  update(time: number, delta: number): void;   // parallax etc.
  destroy(): void;
}

// ───────────────────────────── NPCs, dialog, quests ─────────────────────────────

export interface NpcDef {
  id: string;
  name: string;
  title?: string;          // e.g. "Fire Instructor"
  look: CharacterLook;
}

export interface DialogOption { label: string; action?: () => void; closes?: boolean; }
export interface DialogSpec {
  npcId: string;
  npcName: string;
  portraitKey?: string;    // Phaser texture key (UI may render via canvas snapshot) — optional
  text: string;            // supports \n
  options: DialogOption[]; // empty => single "OK" that closes
}
export interface ShopSpec { npcId: string; npcName: string; items: { itemId: string; price: number }[]; }

export interface QuestDef {
  id: string;
  name: string;
  giver: string;           // npc id
  description: string;
  minLevel: number;
  requiredJobBranch?: Branch;
  objectives: ({ kind: 'kill'; monsterId: string; count: number } | { kind: 'collect'; itemId: string; count: number } | { kind: 'level'; level: number })[];
  rewards: { exp?: number; mesos?: number; items?: { itemId: string; qty: number }[] };
}
export interface QuestProgress { status: 'active' | 'complete' | 'turned_in'; counts: number[]; }

// ───────────────────────────── Player state (persisted) ─────────────────────────────

/** Two pages of 12 slots; keys (HOTBAR_KEYS) act on the current page; Tab flips pages. */
export const HOTBAR_SIZE = 24;
export const HOTBAR_PAGE_SIZE = 12;

export interface PlayerState {
  version: 1;
  name: string;
  level: number;
  exp: number;
  job: JobId;
  base: BaseStats;
  ap: number;
  sp: number;
  hp: number;
  mp: number;
  skills: Record<string, number>;          // skillId -> learned level
  hotbar: (string | null)[];               // length HOTBAR_SIZE; skill id, or "item:<itemId>"
  inventory: ItemStack[];
  equipment: Partial<Record<EquipSlot, ItemStack>>;
  mesos: number;
  mapId: string;
  quests: Record<string, QuestProgress>;
  playTimeMs: number;
}

// ───────────────────────────── Service interfaces ─────────────────────────────

export interface IPlayer {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly x: number;
  readonly y: number;          // feet
  facing: 1 | -1;
  readonly state: 'idle' | 'walk' | 'jump' | 'fall' | 'climb' | 'prone' | 'cast' | 'hit' | 'dead';
  isGrounded(): boolean;
  isBusy(): boolean;           // in cast lock / hitstun / dead
  isInvulnerable(): boolean;
  /** Arrow-key direction currently held. */
  getAimDir(): { x: -1 | 0 | 1; y: -1 | 0 | 1 };
  getBounds(): Phaser.Geom.Rectangle;
  bindMap(map: IMapInstance): void;
  placeAt(x: number, y: number): void;       // feet position, resets velocity
  playCast(lockMs: number): void;
  /** Visual + physical reaction to being hit (knockback, i-frames). HP is handled by progression. */
  onHit(fromX: number): void;
  /** Blink by offset; must clamp within map bounds and not end inside solids. */
  blink(dx: number, dy: number): void;
  setJob(job: JobId): void;
  onDeath(): void;
  revive(): void;
  /** Movement lock (e.g. dialogs open). */
  setControlEnabled(enabled: boolean): void;
  update(time: number, delta: number): void;
  destroy(): void;
}

export interface IMonsterManager {
  all(): IMonster[];
  inRect(rect: Phaser.Geom.Rectangle): IMonster[];
  /** Nearest living monster. If facing given, only those in front (|dy| <= maxDy). */
  nearest(x: number, y: number, maxDist: number, facing?: 1 | -1, maxDy?: number): IMonster | null;
  /** Called on map load: spawns from map.def.spawns and sets up colliders/respawn timers. */
  bindMap(map: IMapInstance): void;
  spawn(monsterId: string, x: number, y: number): IMonster | null;
  update(time: number, delta: number): void;
  clear(): void;
}

export interface IDropManager {
  /** Roll a monster's drops + mesos and spawn them at x,y. */
  dropFromMonster(def: MonsterDef, x: number, y: number): void;
  spawnItem(itemId: string, qty: number, x: number, y: number): void;
  spawnMesos(amount: number, x: number, y: number): void;
  bindMap(map: IMapInstance): void;
  /** Pick up the nearest drop in reach of the player (Z key). */
  tryPickup(): boolean;
  /** Pick up the nearest drop within `radius` of (x, y) on the player's behalf (familiar auto-loot). */
  pickupNear(x: number, y: number, radius: number): boolean;
  /** Positions of drops currently on the ground (for the familiar to seek). */
  dropPositions(): { x: number; y: number }[];
  update(time: number, delta: number): void;
  clear(): void;
}

export interface ISkillSystem {
  tryCast(skillId: string): CastResult;
  getCooldownRemaining(skillId: string): number;
  getCooldownTotal(skillId: string): number;
  getActiveBuffs(): ActiveBuff[];
  getBuffModifiers(): StatModifier[];
  cancelBuff(skillId: string): void;
  update(time: number, delta: number): void;
  /** Destroy projectiles/summons on map change (buffs persist). */
  clearWorld(): void;
}

export type DamageNumberKind = 'monster' | 'crit' | 'player' | 'heal' | 'mp' | 'miss' | 'dot';

export interface ICombatSystem {
  /** Roll damage for one hit line of a skill on a target. */
  rollSkillDamage(element: Element, damagePct: number, target: IMonster): { amount: number; crit: boolean };
  /** Apply damage to monster (calls target.takeDamage, shows number, emits events). */
  damageMonster(target: IMonster, amount: number, opts?: { crit?: boolean; element?: Element; fromX?: number; knockback?: number; kind?: DamageNumberKind; stackIndex?: number }): void;
  /** Roll + apply a status from a spec (respects chance & immunity). baseHit is the per-hit damage (for burn). */
  tryApplyStatus(target: IMonster, spec: StatusSpec, lv: number, element: Element, baseHit: number): void;
  /** Monster/hazard hits player: applies def, mpShield, i-frames, knockback, HP loss, death. */
  hitPlayer(raw: number, fromX: number): void;
  showNumber(x: number, y: number, amount: number, kind: DamageNumberKind, stackIndex?: number): void;
  update(time: number, delta: number): void;
}

export interface IProgression {
  readonly state: PlayerState;
  derived(): DerivedStats;            // cached; recomputed after invalidate()
  invalidate(): void;                 // call when buffs/equipment/skills change
  jobDef(): JobDef;
  gainExp(amount: number): void;
  addMesos(amount: number): void;
  /** Reduce HP (already mitigated). Triggers death at 0. */
  loseHp(amount: number): void;
  loseMp(amount: number): void;
  spendMp(amount: number): boolean;   // false if insufficient
  heal(hp: number, mp: number): void;
  isDead(): boolean;
  respawn(): void;                    // restore some HP/MP; GameScene moves player to town
  canLearn(skillId: string): boolean;
  learnSkill(skillId: string): boolean;     // spend 1 SP
  allocateAp(stat: BaseStatKey): boolean;
  autoAllocateAp(): void;
  availableAdvancements(): JobId[];   // jobs the player qualifies for now
  advanceJob(job: JobId): boolean;
  addItem(itemId: string, qty: number): boolean;   // false if inventory full
  removeItem(itemId: string, qty: number): boolean;
  countItem(itemId: string): number;
  useItem(itemId: string): boolean;
  equip(uid: string): boolean;
  unequip(slot: EquipSlot): boolean;
  buy(itemId: string, price: number, qty: number): boolean;
  sell(uid: string, qty: number): boolean;
  setHotbar(slot: number, entry: string | null): void;
  acceptQuest(questId: string): void;
  turnInQuest(questId: string): boolean;
  save(): void;
  update(time: number, delta: number): void;   // regen, playtime, autosave
}

export interface INpcManager {
  bindMap(map: IMapInstance): void;    // create NPC sprites for map.def.npcs
  /** NPC within talk range of the player, if any. */
  nearestInteractable(): string | null;
  interact(npcId: string): void;       // opens dialog via bus 'ui:dialog' / 'ui:shop'
  update(time: number, delta: number): void;
  clear(): void;
}

export interface IAudio {
  play(key: SfxKey, opts?: { volume?: number; detune?: number }): void;
  playMusic(key: MusicKey): void;
  stopMusic(): void;
  setVolumes(sfx: number, music: number): void;
  getVolumes(): { sfx: number; music: number };
}

export interface IGameApi {
  changeMap(mapId: string, portalId?: string): void;
  currentMap(): IMapInstance | null;
  /** True while a UI window that should block gameplay keys is focused (typing etc.). */
  setInputBlocked(blocked: boolean): void;
  isInputBlocked(): boolean;
  /** Current hotbar page (0 or 1); HOTBAR_KEYS map to slots page*HOTBAR_PAGE_SIZE + i. */
  hotbarPage(): number;
  setHotbarPage(page: number): void;
}

export interface IUI {
  update(time: number, delta: number): void;
  destroy(): void;
}

export interface GameServices {
  scene: Phaser.Scene;   // the GameScene
  game: IGameApi;
  player: IPlayer;
  monsters: IMonsterManager;
  drops: IDropManager;
  skills: ISkillSystem;
  combat: ICombatSystem;
  progression: IProgression;
  npcs: INpcManager;
  audio: IAudio;
  ui: IUI;
}
