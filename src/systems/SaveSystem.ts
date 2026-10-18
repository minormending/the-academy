// OWNER: A9 (progression). STUB — replace with real implementation.
import type { PlayerState } from '../core/types';
import { HOTBAR_SIZE } from '../core/types';
import { START_MAP } from '../core/constants';
export function newPlayerState(name: string): PlayerState {
  return { version: 1, name, level: 1, exp: 0, job: 'apprentice', base: { str: 4, dex: 4, int: 10, luk: 6 }, ap: 0, sp: 0, hp: 80, mp: 64,
    skills: {}, hotbar: new Array(HOTBAR_SIZE).fill(null), inventory: [], equipment: {}, mesos: 0, mapId: START_MAP, quests: {}, playTimeMs: 0 };
}
export function hasSave(): boolean { return false; }
export function loadSave(): PlayerState | null { return null; }
export function writeSave(state: PlayerState): void {}
export function deleteSave(): void {}
