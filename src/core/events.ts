/** Typed global event bus. Owned by the lead — do not edit. */
import Phaser from 'phaser';
import type { DialogSpec, IMonster, JobId, ShopSpec, Element } from './types';

export interface GameEvents {
  'monster:damaged': { monster: IMonster; amount: number; crit: boolean; element: Element };
  'monster:killed': { monster: IMonster };
  'player:damaged': { amount: number };
  'player:healed': { hp: number; mp: number };
  'player:levelup': { level: number };
  'player:died': {};
  'player:revived': {};
  'player:job': { job: JobId };
  /** Any change to PlayerState the UI should re-render (hp/mp/exp/inventory/skills/stats...). */
  'player:changed': {};
  'skill:cast': { skillId: string };
  'hotbar:page': { page: number };
  'skill:fail': { skillId: string; reason: string };
  'item:gained': { itemId: string; qty: number };
  'mesos:gained': { amount: number };
  'map:changed': { mapId: string };
  'quest:updated': { questId: string };
  /** Talked to an NPC (counts `talk` objectives). */
  'npc:talked': { npcId: string };
  'course:updated': { courseId: string };
  'course:passed': { courseId: string; badgeId: string };
  /** Promoted to a new Year (2..5), or graduated (year 6). */
  'year:promoted': { year: number };
  'ui:dialog': DialogSpec;
  'ui:shop': ShopSpec;
  'ui:closeDialog': {};
  /** Big centered banner: level up, job advance, map name. */
  'ui:banner': { text: string; sub?: string; color?: string };
  /** System message in the chat log. */
  'ui:log': { text: string; color?: string };
  /** Ask UI to show the death prompt. */
  'ui:death': {};
  /** Ask UI to open a window by name. */
  'ui:open': { window: 'skills' | 'inventory' | 'stats' | 'quests' | 'jobs' | 'menu' | 'courses' };
}

type Handler<T> = (payload: T) => void;

class Bus {
  private ee = new Phaser.Events.EventEmitter();
  /** Original handler → the guarded wrapper(s) actually registered, so `off` can find them. */
  private wrapped = new Map<Handler<never>, { ev: string; ctx: unknown; wrapper: Handler<never> }[]>();

  /** One throwing listener must not stop the remaining listeners of the same event: log it and carry on. */
  private guard<K extends keyof GameEvents>(ev: K, fn: Handler<GameEvents[K]>, ctx: unknown, once = false): Handler<GameEvents[K]> {
    const wrapper: Handler<GameEvents[K]> = (payload) => {
      if (once) this.unguard(ev, fn, ctx);
      try { fn.call(ctx, payload); } catch (err) { console.error(`[bus] listener for '${ev}' threw`, err); }
    };
    const list = this.wrapped.get(fn as Handler<never>) ?? [];
    list.push({ ev, ctx, wrapper: wrapper as Handler<never> });
    this.wrapped.set(fn as Handler<never>, list);
    return wrapper;
  }
  private unguard<K extends keyof GameEvents>(ev: K, fn: Handler<GameEvents[K]>, ctx: unknown): Handler<GameEvents[K]> | undefined {
    const list = this.wrapped.get(fn as Handler<never>);
    const i = list?.findIndex(w => w.ev === ev && w.ctx === ctx) ?? -1;
    if (!list || i < 0) return undefined;
    const [w] = list.splice(i, 1);
    if (!list.length) this.wrapped.delete(fn as Handler<never>);
    return w.wrapper as Handler<GameEvents[K]>;
  }

  on<K extends keyof GameEvents>(ev: K, fn: Handler<GameEvents[K]>, ctx?: unknown) {
    const w = this.guard(ev, fn, ctx);
    this.ee.on(ev, w);
    return () => this.off(ev, fn, ctx);
  }
  once<K extends keyof GameEvents>(ev: K, fn: Handler<GameEvents[K]>, ctx?: unknown) {
    this.ee.once(ev, this.guard(ev, fn, ctx, true));
  }
  off<K extends keyof GameEvents>(ev: K, fn: Handler<GameEvents[K]>, ctx?: unknown) {
    const w = this.unguard(ev, fn, ctx);
    if (w) this.ee.off(ev, w);
  }
  emit<K extends keyof GameEvents>(ev: K, payload: GameEvents[K]) { this.ee.emit(ev, payload); }
  removeAll() { this.ee.removeAllListeners(); this.wrapped.clear(); }
}

export const bus = new Bus();
