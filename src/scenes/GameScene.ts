/**
 * GameScene: constructs all services, owns map transitions and global input
 * (hotbar, portals/NPC interaction, pickup). Owned by the lead.
 */
import Phaser from 'phaser';
import { DEPTH, MAX_LEVEL, SCENES, START_MAP, TOWN_MAP } from '../core/constants';
import { ACTIONS, SLOT_ACTIONS, getBinding, onBindingsChanged, type ActionId } from '../core/bindings';
import { flashAlpha, getSettings, onSettingsChanged, shakeScale } from '../core/settings';
import { bus } from '../core/events';
import { setServices } from '../core/services';
import { Registry } from '../core/registry';
import { playVfx } from '../core/vfx';
import { expToNext } from '../core/balance';
import { HOTBAR_PAGE_SIZE, HOTBAR_SIZE, type GameServices, type IGameApi, type IMapInstance, type JobId, type PlayerState } from '../core/types';
import { Player } from '../entities/Player';
import { SkillSystem } from '../systems/SkillSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { MonsterManager } from '../systems/MonsterManager';
import { DropManager } from '../systems/DropManager';
import { Progression } from '../systems/Progression';
import { NpcManager } from '../systems/NpcManager';
import { getAudio } from '../systems/AudioSystem';
import { UIRoot } from '../ui/UIRoot';
import { PetSystem } from '../systems/PetSystem';
import { ArenaSystem } from '../systems/ArenaSystem';
import { HonorsSystem } from '../systems/HonorsSystem';
import { loadMap } from '../world/MapLoader';
import { cameraZoom, onMobileLayoutChanged } from '../ui/mobile';

export class GameScene extends Phaser.Scene implements IGameApi {
  private s!: GameServices;
  private pet: PetSystem | null = null;
  private arena: ArenaSystem | null = null;
  private honors: HonorsSystem | null = null;
  private map: IMapInstance | null = null;
  private initialState!: PlayerState;
  private inputBlocked = false;
  private transitioning = false;
  /** Phaser keys for the current bindings (null = action unbound); rebuilt live by bindKeys(). */
  private hotkeys: (Phaser.Input.Keyboard.Key | null)[] = [];
  private keyUp: Phaser.Input.Keyboard.Key | null = null;
  private keyPickup: Phaser.Input.Keyboard.Key | null = null;
  private keyPage: Phaser.Input.Keyboard.Key | null = null;
  private keyLatchers: [Phaser.Input.Keyboard.Key, () => void][] = [];
  private page = 0;
  private nextPickupAt = 0;
  /** Presses latched from key 'down' events so sub-frame taps are never lost (Phaser clears _justDown on keyup). */
  private pendingDest: { mapId: string; portalId?: string } | null = null;
  /** A spell tapped while another cast was still locking the player; fired as soon as the lock ends. */
  private castBuffer: { skillId: string; until: number } | null = null;
  private latched = new Set<Phaser.Input.Keyboard.Key>();

  constructor() { super(SCENES.GAME); }

  init(data: { state: PlayerState }) {
    this.initialState = data.state;
    this.map = null;
    this.inputBlocked = false;
    this.transitioning = false;
    this.pendingDest = null;
    this.latched.clear();
    this.page = 0;
    this.castBuffer = null;
  }

  create() {
    const state = this.initialState;
    const s = {} as GameServices;
    s.scene = this;
    s.game = this;
    s.audio = getAudio();
    s.progression = new Progression(s, state);
    this.honors = new HonorsSystem(this, s);
    s.combat = new CombatSystem(this, s);
    s.skills = new SkillSystem(this, s);
    s.monsters = new MonsterManager(this, s);
    s.drops = new DropManager(this, s);
    this.arena = new ArenaSystem(this, s);
    s.npcs = new NpcManager(this, s);
    s.player = new Player(this, s, 200, 200, state.job);
    this.pet = new PetSystem(this, s);
    this.s = s;
    setServices(s);
    s.ui = new UIRoot(this, s);

    this.wireEvents();
    this.wireKeys();
    this.wireSettings();

    const startMap = Registry.map(state.mapId) ? state.mapId : START_MAP;
    this.loadMapNow(startMap);
    this.cameras.main.fadeIn(400, 0, 0, 0);

    this.exposeDebug();
    // Phones: zoomed-in world (re-applied on rotation / Touch setting changes).
    const offZoom = onMobileLayoutChanged(() => this.applyCameraZoom());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offZoom);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  // ─────────────────────────── IGameApi ───────────────────────────

  changeMap(mapId: string, portalId?: string) {
    if (!Registry.map(mapId)) { console.warn(`[game] unknown map ${mapId}`); return; }
    // A request during an in-flight fade replaces its destination (e.g. respawn mid-portal).
    this.pendingDest = { mapId, portalId };
    if (this.transitioning) return;
    this.transitioning = true;
    this.s.player.setControlEnabled(false);
    this.s.audio.play('portal');
    const cam = this.cameras.main;
    cam.fadeOut(220, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const dest = this.pendingDest ?? { mapId, portalId };
      this.pendingDest = null;
      this.loadMapNow(dest.mapId, dest.portalId);
      cam.fadeIn(320, 0, 0, 0);
      this.transitioning = false;
      this.s.player.setControlEnabled(!this.inputBlocked);
    });
  }

  currentMap() { return this.map; }

  setInputBlocked(blocked: boolean) {
    this.inputBlocked = blocked;
    const kb = this.input.keyboard!;
    if (blocked) { kb.disableGlobalCapture(); kb.resetKeys(); } else { kb.enableGlobalCapture(); }
    this.s.player.setControlEnabled(!blocked && !this.transitioning);
  }

  isInputBlocked() { return this.inputBlocked; }

  hotbarPage() { return this.page; }

  setHotbarPage(page: number) {
    const pages = Math.max(1, Math.floor(HOTBAR_SIZE / HOTBAR_PAGE_SIZE));
    const p = ((Math.floor(page) % pages) + pages) % pages;
    if (p === this.page) return;
    this.page = p;
    bus.emit('hotbar:page', { page: p });
  }

  // ─────────────────────────── Internals ───────────────────────────

  private loadMapNow(mapId: string, portalId?: string) {
    const s = this.s;
    s.skills.clearWorld();
    this.arena?.clear();
    s.monsters.clear();
    s.drops.clear();
    s.npcs.clear();
    this.pet?.clear();
    this.map?.destroy();

    const map = loadMap(this, mapId);
    this.map = map;
    s.progression.state.mapId = mapId;

    this.physics.world.setBounds(0, 0, map.widthPx, map.heightPx);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthPx, map.heightPx);
    this.applyCameraZoom();

    s.player.bindMap(map);
    const portal = portalId ? map.getPortalById(portalId) : null;
    const spawn = portal ? { x: portal.x, y: portal.y } : map.getDefaultSpawn();
    s.player.placeAt(spawn.x, spawn.y);
    cam.startFollow(s.player.sprite, true, 0.12, 0.12, 0, 40);

    s.monsters.bindMap(map);
    s.drops.bindMap(map);
    s.npcs.bindMap(map);
    this.pet?.bindMap(map);
    this.arena?.bindMap(map);

    s.audio.playMusic(map.def.music);
    bus.emit('map:changed', { mapId });
    bus.emit('ui:banner', { text: map.def.name, sub: map.def.region });
    s.progression.save();
  }

  /** Mobile layout: zoom the world camera in (MOBILE_CAMERA_ZOOM); desktop stays at 1. Bounds/follow are zoom-aware. */
  private applyCameraZoom() {
    const cam = this.cameras?.main;
    if (!cam) return;
    const z = cameraZoom();
    if (cam.zoom !== z) cam.setZoom(z);
  }

  private wireEvents() {
    const s = this.s;
    bus.on('player:levelup', ({ level }) => {
      playVfx(this, 'levelup', { x: s.player.x, y: s.player.y, facing: s.player.facing });
      s.audio.play('levelup');
    });
    bus.on('player:job', ({ job }) => {
      s.player.setJob(job);
      playVfx(this, 'job_advance', { x: s.player.x, y: s.player.y, facing: s.player.facing });
      s.audio.play('job_advance');
    });
    bus.on('player:died', () => {
      s.player.onDeath();
      s.audio.play('death');
      bus.emit('ui:death', {});
    });
    bus.on('player:revived', () => {
      s.player.revive();
      playVfx(this, 'respawn', { x: s.player.x, y: s.player.y, facing: s.player.facing });
      this.changeMap(TOWN_MAP);
    });
  }

  private wireKeys() {
    this.bindKeys();
    // Re-bind live when the player changes a key in the Controls window.
    const off = onBindingsChanged(() => { if (this.input?.keyboard) this.bindKeys(); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  /** (Re)create the Phaser keys for the gameplay actions GameScene owns, without leaking 'down' listeners. */
  private bindKeys() {
    const kb = this.input.keyboard!;
    for (const [k, fn] of this.keyLatchers) k.off('down', fn);
    this.keyLatchers = [];
    this.latched.clear();
    const add = (action: ActionId) => {
      const code = getBinding(action);
      if (!code) return null;
      const k = kb.addKey(code);
      const fn = () => this.latched.add(k);
      k.on('down', fn);
      this.keyLatchers.push([k, fn]);
      return k;
    };
    this.hotkeys = SLOT_ACTIONS.map(a => add(a));
    this.keyUp = add('interact');
    this.keyPickup = add('pickup');
    this.keyPage = add('hotbarPage');
    // Drop Phaser keys (and their browser capture) for codes no gameplay action uses any more.
    // Player keys are bound codes too, so this never touches them; UI-only keys are handled by DOM listeners.
    const ui = new Set<ActionId>(['skills', 'inventory', 'stats', 'quests', 'minimap', 'help', 'menu', 'honors']);
    const used = new Set(ACTIONS.filter(a => !ui.has(a.id)).map(a => getBinding(a.id)).filter(Boolean));
    for (const k of [...kb.keys]) {
      if (k && !used.has(k.keyCode)) { try { kb.removeKey(k, true); } catch { /* ignore */ } }
    }
  }

  /** Accessibility settings: camera shake/flash strength (one patch covers every VFX caller) + familiar toggle. */
  private wireSettings() {
    const cam = this.cameras.main as Phaser.Cameras.Scene2D.Camera & { __academyFx?: boolean };
    if (!cam.__academyFx) {
      cam.__academyFx = true;
      const shake = cam.shake.bind(cam);
      const flash = cam.flash.bind(cam);
      cam.shake = (duration?: number, intensity?: number | Phaser.Math.Vector2, force?: boolean, callback?: Phaser.Types.Cameras.Scene2D.CameraShakeCallback, context?: unknown) => {
        const k = shakeScale();
        if (k <= 0 && !callback) return cam;
        const base = intensity ?? 0.05;
        const scaled = typeof base === 'number' ? base * k : new Phaser.Math.Vector2(base.x * k, base.y * k);
        return shake(duration, scaled, force, callback, context);
      };
      cam.flash = (duration?: number, red?: number, green?: number, blue?: number, force?: boolean, callback?: Phaser.Types.Cameras.Scene2D.CameraFlashCallback, context?: unknown) => {
        const a = flashAlpha();
        if (a <= 0 && !callback) return cam;
        if (!force && cam.flashEffect.isRunning) return cam;
        cam.flashEffect.alpha = a;
        return flash(duration, red, green, blue, force, callback, context);
      };
    }
    const applyPet = () => { try { this.pet?.setEnabled(getSettings().familiar); } catch { /* ignore */ } };
    applyPet();
    const off = onSettingsChanged((_s, key) => {
      if (key === 'familiar') applyPet();
      if (key === 'shake' && shakeScale() <= 0) { try { cam.shakeEffect.reset(); cam.flashEffect.reset(); } catch { /* ignore */ } }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  /** True once per physical press, even if the key was released before this frame. */
  private consumePress(k: Phaser.Input.Keyboard.Key | null): boolean {
    if (!k) return false;
    Phaser.Input.Keyboard.JustDown(k);
    if (!this.latched.has(k)) return false;
    this.latched.delete(k);
    return true;
  }

  private handleInput(time: number) {
    const s = this.s;
    if (this.inputBlocked || this.transitioning || s.progression.isDead()) { this.latched.clear(); return; }
    const JustDown = (k: Phaser.Input.Keyboard.Key | null) => this.consumePress(k);

    // Hotbar: skills repeat while held (Maple-style), items fire once per press.
    if (JustDown(this.keyPage)) this.setHotbarPage(this.page + 1);
    const hotbar = s.progression.state.hotbar;
    const offset = this.page * HOTBAR_PAGE_SIZE;
    // Buffered tap from the previous cast lock: fire it the moment the player is free (≤350ms window).
    if (this.castBuffer) {
      if (time > this.castBuffer.until) this.castBuffer = null;
      else if (!s.player.isBusy()) {
        const id = this.castBuffer.skillId;
        this.castBuffer = null;
        s.skills.tryCast(id);
      }
    }
    for (let i = 0; i < this.hotkeys.length; i++) {
      const key = this.hotkeys[i];
      const entry = hotbar[offset + i];
      if (!entry) { JustDown(key); continue; }
      if (entry.startsWith('item:')) {
        if (JustDown(key)) s.progression.useItem(entry.slice(5));
        continue;
      }
      const pressed = JustDown(key);
      if (!key?.isDown && !pressed) continue;
      const r = s.skills.tryCast(entry);
      if (pressed && r === 'busy') this.castBuffer = { skillId: entry, until: time + 350 };
      if (pressed && r !== 'ok' && r !== 'busy') {
        const msg = r === 'no_mp' ? 'Not enough MP.' : r === 'cooldown' ? 'That skill is still cooling down.'
          : r === 'not_learned' ? 'You have not learned that skill.' : r === 'passive' ? 'Passive skills are always active.'
          : r === 'failed' ? 'The spell fizzled. (MP refunded)' : '';
        if (msg) { bus.emit('ui:log', { text: msg, color: '#ff9b9b' }); bus.emit('skill:fail', { skillId: entry, reason: r }); s.audio.play('ui_error'); }
      }
    }

    // Up: portal first, then NPC (rope climbing is handled by the player).
    const climbing = (s.player as { isClimbing?: () => boolean }).isClimbing?.() ?? false;
    if (JustDown(this.keyUp) && this.map && !climbing) {
      const portal = this.map.getPortalNear(s.player.x, s.player.y);
      if (portal) { this.changeMap(portal.targetMap, portal.targetPortal); return; }
      const npc = s.npcs.nearestInteractable();
      if (npc) s.npcs.interact(npc);
    }

    // Pick up (repeats while held).
    if ((this.consumePress(this.keyPickup) || !!this.keyPickup?.isDown) && time >= this.nextPickupAt) {
      s.drops.tryPickup();
      this.nextPickupAt = time + 110;
    }
  }

  update(time: number, delta: number) {
    const s = this.s;
    if (!this.map) return;
    s.progression.update(time, delta);
    s.player.update(time, delta);
    s.monsters.update(time, delta);
    s.skills.update(time, delta);
    s.combat.update(time, delta);
    s.drops.update(time, delta);
    this.pet?.update(time, delta);
    this.arena?.update(time, delta);
    this.honors?.update(time, delta);
    s.npcs.update(time, delta);
    this.map.update(time, delta);
    this.handleInput(time);
    s.ui.update(time, delta);
  }

  private teardown() {
    const s = this.s;
    try { s.progression.save(); } catch { /* ignore */ }
    for (const fn of [() => s.ui.destroy(), () => s.skills.clearWorld(), () => s.monsters.clear(), () => s.drops.clear(),
      () => s.npcs.clear(), () => this.pet?.destroy(), () => this.arena?.destroy(), () => this.honors?.destroy(), () => s.player.destroy(), () => this.map?.destroy()]) {
      try { fn(); } catch (e) { console.warn('[game] teardown step failed', e); }
    }
    this.map = null;
    this.pendingDest = null;
    bus.removeAll();
    setServices(null);
    this.input.keyboard?.removeAllKeys(true);
    this.input.keyboard?.enableGlobalCapture();
  }

  private exposeDebug() {
    const s = this.s;
    const api = {
      s,
      levelTo: (n: number) => {
        // Clamp to MAX_LEVEL and stop if a pass doesn't raise the level (gainExp is a no-op at the cap).
        const target = Math.min(Math.floor(n), MAX_LEVEL);
        while (s.progression.state.level < target) {
          const before = s.progression.state.level;
          s.progression.gainExp(expToNext(before) - s.progression.state.exp);
          if (s.progression.state.level <= before) break;
        }
      },
      give: (itemId: string, qty = 1) => s.progression.addItem(itemId, qty),
      mesos: (n: number) => s.progression.addMesos(n),
      warp: (mapId: string, portalId?: string) => this.changeMap(mapId, portalId),
      job: (job: JobId) => s.progression.advanceJob(job),
      heal: () => s.progression.heal(99999, 99999),
      maps: () => Registry.maps().map(m => m.id),
      pet: (on?: boolean) => { const p = this.pet; if (!p) return false; p.setEnabled(on ?? !p.isEnabled()); return p.isEnabled(); },
      depth: DEPTH,
      honors: this.honors?.debugApi(),
    };
    (window as unknown as { arcana: typeof api }).arcana = api;
  }
}
