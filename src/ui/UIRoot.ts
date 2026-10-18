/**
 * UIRoot (A8): DOM HUD + windows overlaid on the Phaser canvas.
 * Built in the constructor (DOM + bus subscriptions only); reads services lazily from update().
 */
import './ui.css';
import Phaser from 'phaser';
import type { GameServices, IUI, SfxKey } from '../core/types';
import { bus, type GameEvents } from '../core/events';
import { Registry } from '../core/registry';
import { expToNext } from '../core/balance';
import { Layout, type UICtx, type WindowName } from './context';
import { fmtNum, isTextInput, safe } from './dom';
import { UIScaler, uiRootEl } from './scaler';
import { Tooltip } from './tooltip';
import { DragManager, type DragPayload } from './drag';
import { BuffTray, Hotbar, StatusBar, Vignette } from './hud';
import { Minimap } from './minimap';
import { ChatLog } from './chatlog';
import { Banners } from './banners';
import { SkillsWindow } from './skillsWindow';
import { InventoryWindow } from './inventoryWindow';
import { StatsWindow } from './statsWindow';
import { QuestsWindow } from './questsWindow';
import { HelpWindow, JobsWindow, MenuWindow, applySavedVolumes } from './miscWindows';
import { DeathModal, DialogWindow, ShopWindow } from './dialogs';
import { BRANCH_COLORS, jobName } from './info';
import { consumeNewCharacter } from './session';
import type { UIWindow } from './window';

export class UIRoot implements IUI {
  private root: HTMLElement;
  private ctx: UICtx;
  private scaler: UIScaler;
  private tooltip: Tooltip;
  private drag: DragManager;
  private layout = new Layout();
  private z = 100;

  private status: StatusBar;
  private hotbar: Hotbar;
  private buffs: BuffTray;
  private vignette: Vignette;
  private minimap: Minimap;
  private chat: ChatLog;
  private banners: Banners;
  private death: DeathModal;
  private dialog: DialogWindow;
  private shop: ShopWindow;
  private windows: Record<WindowName, UIWindow>;
  private allWindows: UIWindow[];

  private started = false;
  private destroyed = false;
  private blocked = false;
  private lastLevel = -1;
  private lastExp = 0;
  private questStatus = new Map<string, string>();
  private unsubs: (() => void)[] = [];
  private errorAt = 0;

  private readonly onKeyDown = (e: KeyboardEvent) => this.keyDown(e);
  private readonly onContextMenu = (e: Event) => e.preventDefault();
  private readonly onDragStart = (e: Event) => e.preventDefault();
  /** Keep buttons from taking keyboard focus (so Space/Enter never re-trigger them during play). */
  private readonly onMouseDown = (e: MouseEvent) => { if ((e.target as Element | null)?.closest?.('button')) e.preventDefault(); };

  constructor(private scene: Phaser.Scene, private services: GameServices) {
    this.root = uiRootEl();
    this.root.classList.add('ax-ui');
    this.scaler = new UIScaler(this.root, scene.game);
    this.tooltip = new Tooltip(this.root, this.scaler);
    this.drag = new DragManager(this.root, this.scaler, (p, t) => this.onDrop(p, t));
    this.ctx = {
      root: this.root,
      s: services,
      scaler: this.scaler,
      tooltip: this.tooltip,
      drag: this.drag,
      layout: this.layout,
      nextZ: () => ++this.z,
      sfx: (k: SfxKey) => { try { this.services.audio?.play(k); } catch { /* ignore */ } },
      log: (text, color) => this.chat.push(text, color),
      openWindow: (n) => this.openWindow(n),
      toggleWindow: (n) => this.toggleWindow(n),
    };

    // HUD (order = stacking order for siblings without z-index)
    this.vignette = new Vignette(this.ctx);
    this.minimap = new Minimap(this.ctx);
    this.buffs = new BuffTray(this.ctx);
    this.chat = new ChatLog(this.ctx);
    this.status = new StatusBar(this.ctx);
    this.hotbar = new Hotbar(this.ctx);
    this.banners = new Banners(this.ctx);

    // Windows
    this.windows = {
      skills: new SkillsWindow(this.ctx),
      inventory: new InventoryWindow(this.ctx),
      stats: new StatsWindow(this.ctx),
      quests: new QuestsWindow(this.ctx),
      jobs: new JobsWindow(this.ctx),
      menu: new MenuWindow(this.ctx),
      help: new HelpWindow(this.ctx),
    };
    this.dialog = new DialogWindow(this.ctx);
    this.shop = new ShopWindow(this.ctx);
    this.allWindows = [...Object.values(this.windows), this.dialog, this.shop];
    this.death = new DeathModal(this.ctx);

    window.addEventListener('keydown', this.onKeyDown);
    this.root.addEventListener('contextmenu', this.onContextMenu);
    this.root.addEventListener('dragstart', this.onDragStart);
    this.root.addEventListener('mousedown', this.onMouseDown);
    this.subscribe();
  }

  // ─────────────────────────── bus ───────────────────────────

  private on<K extends keyof GameEvents>(ev: K, fn: (p: GameEvents[K]) => void) {
    this.unsubs.push(bus.on(ev, (p) => { try { fn(p); } catch (e) { console.warn(`[ui] ${String(ev)} handler failed`, e); } }));
  }

  private subscribe() {
    const dirtyAll = () => this.markAllDirty();
    this.on('player:changed', dirtyAll);
    this.on('player:damaged', () => this.status.onDamaged());
    this.on('player:levelup', ({ level }) => {
      this.banners.levelUp(level);
      this.chat.push(`Congratulations! You reached level ${level}.`, '#ffd76a');
      dirtyAll();
    });
    this.on('player:job', ({ job }) => {
      const def = safe(() => Registry.job(job), undefined);
      this.banners.jobAdvance(def?.name ?? jobName(job), def?.description ?? '', BRANCH_COLORS[def?.branch ?? 'none']);
      this.chat.push(`You are now a ${def?.name ?? jobName(job)}! New skills await (K).`, '#ffd76a');
      if (this.windows.jobs.isOpen) this.windows.jobs.close();
      dirtyAll();
    });
    this.on('player:revived', () => { this.death.hide(); dirtyAll(); });
    this.on('item:gained', ({ itemId, qty }) => {
      const name = Registry.item(itemId)?.name ?? itemId;
      this.chat.gain(`item:${itemId}`, qty, (n) => `Gained ${name}${n > 1 ? ` ×${n}` : ''}`, '#9fdcff');
      this.markAllDirty();
    });
    this.on('mesos:gained', ({ amount }) => {
      if (amount > 0) this.chat.gain('mesos', amount, (n) => `+${fmtNum(n)} mesos`, '#ffe08a');
      this.markAllDirty();
    });
    this.on('map:changed', ({ mapId }) => {
      this.minimap.invalidate();
      const m = Registry.map(mapId);
      if (m) this.chat.push(`Entered ${m.name}.`, '#b8c2ff');
    });
    this.on('quest:updated', ({ questId }) => this.onQuestUpdated(questId));
    this.on('skill:cast', ({ skillId }) => this.hotbar.flash(skillId));
    this.on('skill:fail', ({ skillId }) => this.hotbar.flash(skillId, true));
    this.on('ui:dialog', (spec) => { this.dialog.show(spec); this.tooltip.hide(); });
    this.on('ui:closeDialog', () => this.dialog.close());
    this.on('ui:shop', (spec) => { this.shop.show(spec); this.tooltip.hide(); });
    this.on('ui:banner', ({ text, sub, color }) => this.banners.showArea(text, sub, color));
    this.on('ui:log', ({ text, color }) => this.chat.push(text, color));
    this.on('ui:death', () => { this.dialog.close(); this.shop.close(); this.death.show(); });
    this.on('ui:open', ({ window: w }) => this.openWindow(w));
  }

  private onQuestUpdated(questId: string) {
    const q = Registry.quest(questId);
    const pr = this.services.progression.state.quests?.[questId];
    const prev = this.questStatus.get(questId);
    const now = pr?.status ?? '';
    if (q && now !== prev) {
      const giver = Registry.npc(q.giver)?.name ?? q.giver;
      if (now === 'active' && !prev) this.chat.push(`New quest: ${q.name}`, '#c9b8ff');
      else if (now === 'complete') { this.chat.push(`Quest objectives complete: ${q.name} — return to ${giver}.`, '#9fe8a8'); this.banners.showArea('Quest Complete', q.name, '#9fe8a8'); }
      else if (now === 'turned_in') this.chat.push(`Quest finished: ${q.name}!`, '#ffd76a');
    }
    this.questStatus.set(questId, now);
    this.windows.quests.markDirty();
  }

  private markAllDirty() {
    this.hotbar.markDirty();
    for (const w of this.allWindows) w.markDirty();
  }

  // ─────────────────────────── windows ───────────────────────────

  private openWindow(name: WindowName) {
    const w = this.windows[name];
    if (!w) return;
    w.open();
  }

  private toggleWindow(name: WindowName) {
    const w = this.windows[name];
    if (!w) return;
    w.toggle();
  }

  private topmostOpen(): UIWindow | null {
    let best: UIWindow | null = null;
    for (const w of this.allWindows) if (w.isOpen && (!best || w.z > best.z)) best = w;
    return best;
  }

  private keyDown(e: KeyboardEvent) {
    if (this.destroyed || !this.started) return;
    const active = document.activeElement;
    if (isTextInput(active)) {
      if (e.code === 'Escape') (active as HTMLElement).blur();
      return;
    }
    if (this.death.isOpen) return;
    if (this.dialog.isOpen) {
      if (e.code === 'Escape') { this.dialog.close(); e.preventDefault(); return; }
      if (this.dialog.handleKey(e)) { e.preventDefault(); return; }
      return; // other keys do nothing while talking
    }
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyK': this.toggleWindow('skills'); break;
      case 'KeyI': this.toggleWindow('inventory'); break;
      case 'KeyP': this.toggleWindow('stats'); break;
      case 'KeyJ': this.toggleWindow('quests'); break;
      case 'KeyH': this.toggleWindow('help'); break;
      case 'KeyM': this.minimap.toggle(); break;
      case 'Escape': {
        const top = this.topmostOpen();
        if (top) top.close(); else this.openWindow('menu');
        e.preventDefault();
        break;
      }
      default: return;
    }
  }

  // ─────────────────────────── drag & drop ───────────────────────────

  private onDrop(p: DragPayload, target: Element | null) {
    const slotEl = target?.closest('[data-hotbar-slot]');
    if (!slotEl) return;
    const slot = Number(slotEl.getAttribute('data-hotbar-slot'));
    if (!Number.isInteger(slot)) return;
    const prog = this.services.progression;
    const hb = prog.state.hotbar ?? [];
    if (p.fromSlot !== undefined) {
      if (p.fromSlot === slot) return;
      const other = hb[slot] ?? null;
      prog.setHotbar(slot, p.entry);
      prog.setHotbar(p.fromSlot, other);
    } else {
      // Move rather than duplicate if the entry is already on the bar.
      const existing = hb.findIndex((e, i) => e === p.entry && i !== slot);
      if (existing >= 0) prog.setHotbar(existing, null);
      prog.setHotbar(slot, p.entry);
    }
    this.ctx.sfx('ui_click');
    this.hotbar.markDirty();
    this.markAllDirty();
  }

  // ─────────────────────────── frame ───────────────────────────

  private start() {
    this.started = true;
    const st = this.services.progression.state;
    this.lastLevel = st.level;
    this.lastExp = st.exp;
    for (const [id, q] of Object.entries(st.quests ?? {})) this.questStatus.set(id, q.status);
    applySavedVolumes(this.services.audio);
    const flag = `helpSeen:${st.name}`;
    const brandNew = consumeNewCharacter();
    const looksFresh = st.level === 1 && st.exp === 0 && (st.playTimeMs ?? 0) < 3000 && !this.layout.getFlag(flag, false);
    if (brandNew || looksFresh) {
      this.layout.setFlag(flag, true);
      this.windows.help.open();
      this.chat.push(`Welcome to Arcana Story, ${st.name}!`, '#ffd76a');
      this.chat.push('Press H any time to see the controls.', '#b8c2ff');
    } else {
      this.chat.push(`Welcome back, ${st.name}.`, '#ffd76a');
    }
  }

  private trackExp() {
    const st = this.services.progression.state;
    let gained = 0;
    if (st.level === this.lastLevel) gained = st.exp - this.lastExp;
    else if (st.level > this.lastLevel) {
      gained = expToNext(this.lastLevel) - this.lastExp;
      for (let l = this.lastLevel + 1; l < st.level; l++) gained += expToNext(l);
      gained += st.exp;
    }
    if (gained > 0) this.chat.gain('exp', gained, (n) => `+${fmtNum(n)} EXP`, '#c8f7a0');
    this.lastLevel = st.level;
    this.lastExp = st.exp;
  }

  private syncInputBlock() {
    const want = this.dialog.isOpen || this.shop.isOpen || isTextInput(document.activeElement);
    if (want === this.blocked) return;
    this.blocked = want;
    try { this.services.game.setInputBlocked(want); } catch { /* ignore */ }
  }

  update(time: number, delta: number) {
    if (this.destroyed) return;
    try {
      if (!this.started) this.start();
      this.scaler.check(time);
      this.trackExp();
      this.status.frame(delta);
      this.hotbar.frame();
      this.buffs.frame();
      this.vignette.frame();
      this.minimap.frame(time);
      this.chat.frame(time);
      for (const w of this.allWindows) w.tick(time, delta);
      this.tooltip.check();
      this.syncInputBlock();
      if (!this.death.isOpen && safe(() => this.services.progression.isDead(), false) && this.started) {
        // Safety net: if ui:death was missed, still offer the respawn prompt.
        this.death.show();
      }
    } catch (e) {
      if (time > this.errorAt) { this.errorAt = time + 2000; console.error('[ui] update failed', e); }
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const u of this.unsubs) { try { u(); } catch { /* ignore */ } }
    this.unsubs = [];
    window.removeEventListener('keydown', this.onKeyDown);
    this.root.removeEventListener('contextmenu', this.onContextMenu);
    this.root.removeEventListener('dragstart', this.onDragStart);
    this.root.removeEventListener('mousedown', this.onMouseDown);
    if (this.blocked) { try { this.scene.input.keyboard?.enableGlobalCapture(); } catch { /* ignore */ } }
    for (const w of this.allWindows) w.destroy();
    this.death.destroy();
    this.banners.destroy();
    this.status.destroy();
    this.hotbar.destroy();
    this.buffs.destroy();
    this.vignette.destroy();
    this.minimap.destroy();
    this.chat.destroy();
    this.drag.destroy();
    this.tooltip.destroy();
    this.scaler.destroy();
    this.root.classList.remove('ax-ui');
  }
}
