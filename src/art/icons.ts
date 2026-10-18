// OWNER: A10 (art-audio). STUB — replace with real implementation.
import Phaser from 'phaser';
import type { IconSpec } from '../core/types';
/** Pure-canvas icon painter (no Phaser needed) — cached data URL for DOM UI. */
export function iconDataUrl(spec: IconSpec, size = 32): string { return ''; }
/** Same icon registered as a Phaser texture (cached); returns texture key. */
export function iconTexture(scene: Phaser.Scene, spec: IconSpec, size = 32): string { return '__DEFAULT'; }
