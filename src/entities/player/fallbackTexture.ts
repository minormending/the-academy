// OWNER: A1 (player). Simple placeholder sheet used until A10's character art exists.
import Phaser from 'phaser';
import { PLAYER_FRAME } from '../../core/constants';
import type { JobId } from '../../core/types';
import { Registry } from '../../core/registry';

export function fallbackTextureKey(job: JobId): string { return `player_fallback_${job}`; }

/** Generates (once) a 64x80 placeholder mage with feet at y=78, facing right. Returns its key. */
export function ensureFallbackTexture(scene: Phaser.Scene, job: JobId): string {
  const key = fallbackTextureKey(job);
  if (scene.textures.exists(key)) return key;
  let robe = 0x6a4fc9, trim = 0xd9c25a, hat = 0x4b3696, skin = 0xf2d0b0, hair = 0x5a3a22, gem = 0x9fe8ff;
  try {
    const look = Registry.job(job)?.look;
    if (look) { robe = look.robe; trim = look.robeTrim; hat = look.hat; skin = look.skin; hair = look.hair; gem = look.staffGem; }
  } catch { /* registry not ready: keep defaults */ }

  const { w, h } = PLAYER_FRAME;
  const cx = w / 2;
  const feet = h - 2;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // staff (behind, in front hand side)
  g.fillStyle(0x7a5232, 1); g.fillRect(cx + 11, feet - 52, 3, 50);
  g.fillStyle(gem, 1); g.fillCircle(cx + 12.5, feet - 54, 4);
  // shoes
  g.fillStyle(0x3a2a1e, 1); g.fillRect(cx - 9, feet - 4, 8, 4); g.fillRect(cx + 1, feet - 4, 8, 4);
  // robe
  g.fillStyle(robe, 1);
  g.fillTriangle(cx - 13, feet - 3, cx + 13, feet - 3, cx, feet - 38);
  g.fillRect(cx - 9, feet - 36, 18, 20);
  g.fillStyle(trim, 1); g.fillRect(cx - 13, feet - 6, 26, 3); g.fillRect(cx - 1, feet - 34, 2, 30);
  // arm toward staff
  g.fillStyle(robe, 1); g.fillRect(cx + 4, feet - 32, 9, 5);
  g.fillStyle(skin, 1); g.fillCircle(cx + 12.5, feet - 29.5, 2.5);
  // head
  g.fillStyle(hair, 1); g.fillCircle(cx - 1, feet - 46, 10);
  g.fillStyle(skin, 1); g.fillCircle(cx + 1, feet - 45, 8.5);
  g.fillStyle(0x222233, 1); g.fillRect(cx + 4, feet - 47, 2, 3);
  // pointed hat
  g.fillStyle(hat, 1); g.fillTriangle(cx - 12, feet - 51, cx + 12, feet - 51, cx - 3, feet - 74);
  g.fillStyle(trim, 1); g.fillRect(cx - 12, feet - 53, 24, 3);
  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}
