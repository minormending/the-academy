// OWNER: A10 (art-audio). STUB — replace with real implementation.
import type { IAudio, MusicKey, SfxKey } from '../core/types';
export class AudioSystem implements IAudio {
  play(key: SfxKey, opts?: { volume?: number; detune?: number }): void {}
  playMusic(key: MusicKey): void {}
  stopMusic(): void {}
  setVolumes(sfx: number, music: number): void {}
  getVolumes() { return { sfx: 0.7, music: 0.4 }; }
}
let inst: AudioSystem | null = null;
/** Singleton shared by Title and Game scenes. */
export function getAudio(): IAudio { return (inst ??= new AudioSystem()); }
