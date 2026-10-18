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
  'skill:fail': { skillId: string; reason: string };
  'item:gained': { itemId: string; qty: number };
  'mesos:gained': { amount: number };
  'map:changed': { mapId: string };
  'quest:updated': { questId: string };
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
  'ui:open': { window: 'skills' | 'inventory' | 'stats' | 'quests' | 'jobs' | 'menu' };
}

type Handler<T> = (payload: T) => void;

class Bus {
  private ee = new Phaser.Events.EventEmitter();
  on<K extends keyof GameEvents>(ev: K, fn: Handler<GameEvents[K]>, ctx?: unknown) { this.ee.on(ev, fn, ctx); return () => this.ee.off(ev, fn, ctx); }
  once<K extends keyof GameEvents>(ev: K, fn: Handler<GameEvents[K]>, ctx?: unknown) { this.ee.once(ev, fn, ctx); }
  off<K extends keyof GameEvents>(ev: K, fn: Handler<GameEvents[K]>, ctx?: unknown) { this.ee.off(ev, fn, ctx); }
  emit<K extends keyof GameEvents>(ev: K, payload: GameEvents[K]) { this.ee.emit(ev, payload); }
  removeAll() { this.ee.removeAllListeners(); }
}

export const bus = new Bus();
