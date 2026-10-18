// OWNER: A10 (art-audio). STUB — replace with real implementation.
import Phaser from 'phaser';
import type { CharacterLook, JobId } from '../core/types';
export type PlayerAnim = 'idle' | 'walk' | 'jump' | 'fall' | 'climb' | 'prone' | 'cast' | 'hit' | 'dead';
/** Generates a spritesheet + animations for every job's look. Anim key = `${playerTextureKey(job)}_${anim}`. */
export function generateCharacterTextures(scene: Phaser.Scene): void {}
export function playerTextureKey(job: JobId): string { return `player_${job}`; }
export function playerAnimKey(job: JobId, anim: PlayerAnim): string { return `${playerTextureKey(job)}_${anim}`; }
/** Lazily generates an NPC sheet (idle anim `${key}_idle`) for a look; returns the texture key. */
export function npcTextureKey(scene: Phaser.Scene, npcId: string, look: CharacterLook): string { return `npc_${npcId}`; }
/** Data URL portrait (head & shoulders) for dialog windows. */
export function portraitDataUrl(look: CharacterLook, size?: number): string { return ''; }
