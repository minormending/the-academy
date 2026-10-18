// OWNER: A9 (progression). NPC sprites, name tags, quest markers, talk hints and interaction.
import Phaser from 'phaser';
import type { CharacterLook, GameServices, IMapInstance, INpcManager, NpcDef } from '../core/types';
import { Registry } from '../core/registry';
import { DEPTH } from '../core/constants';
import { npcTextureKey } from '../art/characters';
import { npcNotice, runNpcScript, type NpcNotice } from '../data/npcScripts';

/** Horizontal talk range (px). */
export const NPC_TALK_RANGE = 90;
const TALK_RANGE_Y = 90;
const NOTICE_REFRESH_MS = 400;

interface NpcEntry {
  id: string;
  def: NpcDef;
  x: number;
  y: number;              // feet
  height: number;
  textureKey: string;
  sprite: Phaser.GameObjects.Sprite;
  nameTag: Phaser.GameObjects.Text;
  titleTag: Phaser.GameObjects.Text | null;
  notice: Phaser.GameObjects.Text;
  noticeKind: NpcNotice;
  baseFlip: boolean;
}

export class NpcManager implements INpcManager {
  private npcs: NpcEntry[] = [];
  private hint: Phaser.GameObjects.Text | null = null;
  private nearest: NpcEntry | null = null;
  private noticeAcc = NOTICE_REFRESH_MS;

  constructor(private scene: Phaser.Scene, private services: GameServices) {}

  bindMap(map: IMapInstance) {
    this.clear();
    const placements = map?.def?.npcs ?? [];
    for (const pl of placements) {
      const def = Registry.npc(pl.npcId);
      if (!def) { console.warn(`[npc] unknown npc ${pl.npcId}`); continue; }
      try { this.npcs.push(this.createNpc(def, pl.x, pl.y, pl.facing ?? 1)); }
      catch (e) { console.warn(`[npc] failed to create ${pl.npcId}`, e); }
    }
    this.noticeAcc = NOTICE_REFRESH_MS;
  }

  private createNpc(def: NpcDef, x: number, y: number, facing: 1 | -1): NpcEntry {
    const scene = this.scene;
    let key = '';
    try { key = npcTextureKey(scene, def.id, def.look); } catch (e) { console.warn('[npc] npcTextureKey failed', e); }
    if (!key || !scene.textures.exists(key)) key = this.fallbackTexture(def.id, def.look);

    const sprite = scene.add.sprite(x, y, key).setOrigin(0.5, 1).setDepth(DEPTH.NPC);
    const baseFlip = facing === -1;
    sprite.setFlipX(baseFlip);
    const idle = `${key}_idle`;
    if (scene.anims.exists(idle)) {
      try { sprite.play({ key: idle, startFrame: Math.floor(Math.random() * 2) }); } catch { /* ignore */ }
    }
    const height = Math.max(40, sprite.displayHeight || 80);

    const nameTag = scene.add.text(x, y + 4, def.name, {
      fontFamily: 'Verdana, Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffe95a',
      backgroundColor: 'rgba(10,12,30,0.72)', padding: { x: 5, y: 1 },
    }).setOrigin(0.5, 0).setDepth(DEPTH.NAMETAG);
    const titleTag = def.title ? scene.add.text(x, y + 23, def.title, {
      fontFamily: 'Verdana, Arial, sans-serif', fontSize: '11px', color: '#ffffff',
      backgroundColor: 'rgba(10,12,30,0.6)', padding: { x: 4, y: 1 },
    }).setOrigin(0.5, 0).setDepth(DEPTH.NAMETAG) : null;

    const notice = scene.add.text(x, y - height - 8, '!', {
      fontFamily: 'Verdana, Arial, sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#ffd400',
      stroke: '#5a3a00', strokeThickness: 5,
    }).setOrigin(0.5, 1).setDepth(DEPTH.NAMETAG).setVisible(false);

    return { id: def.id, def, x, y, height, textureKey: key, sprite, nameTag, titleTag, notice, noticeKind: null, baseFlip };
  }

  /** Simple robed silhouette in the NPC's colours, used when A10's texture is missing. */
  private fallbackTexture(id: string, look: CharacterLook): string {
    const key = `npc_fallback_${id}`;
    if (this.scene.textures.exists(key)) return key;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const W = 48, H = 72;
    // robe
    g.fillStyle(look.robe, 1);
    g.fillTriangle(W / 2, 26, 8, H, W - 8, H);
    g.fillRect(14, 28, W - 28, H - 28);
    g.fillStyle(look.robeTrim, 1);
    g.fillRect(8, H - 5, W - 16, 5);
    // head
    g.fillStyle(look.skin, 1);
    g.fillCircle(W / 2, 20, 9);
    g.fillStyle(look.hair, 1);
    g.fillRect(W / 2 - 9, 11, 18, 5);
    // hat
    if (look.hatStyle === 'pointed') {
      g.fillStyle(look.hat, 1); g.fillTriangle(W / 2, 0, W / 2 - 12, 14, W / 2 + 12, 14);
      g.fillStyle(look.hatTrim, 1); g.fillRect(W / 2 - 13, 12, 26, 3);
    } else if (look.hatStyle === 'hood') {
      g.fillStyle(look.hat, 1); g.fillRect(W / 2 - 11, 9, 22, 6); g.fillRect(W / 2 - 11, 9, 4, 18); g.fillRect(W / 2 + 7, 9, 4, 18);
    } else if (look.hatStyle === 'circlet' || look.hatStyle === 'crown') {
      g.fillStyle(look.hatTrim, 1); g.fillRect(W / 2 - 9, 12, 18, 3);
      if (look.hatStyle === 'crown') { g.fillTriangle(W / 2 - 8, 12, W / 2 - 5, 5, W / 2 - 2, 12); g.fillTriangle(W / 2 + 2, 12, W / 2 + 5, 5, W / 2 + 8, 12); }
    }
    g.generateTexture(key, W, H);
    g.destroy();
    return key;
  }

  nearestInteractable(): string | null {
    const pl = this.playerPos();
    if (!pl) return null;
    let best: NpcEntry | null = null;
    let bestD = Infinity;
    for (const n of this.npcs) {
      const dx = Math.abs(n.x - pl.x), dy = Math.abs(n.y - pl.y);
      if (dx > NPC_TALK_RANGE || dy > TALK_RANGE_Y) continue;
      const d = dx + dy * 0.5;
      if (d < bestD) { bestD = d; best = n; }
    }
    return best?.id ?? null;
  }

  interact(npcId: string) {
    const n = this.npcs.find(e => e.id === npcId);
    if (n) {
      const pl = this.playerPos();
      if (pl) n.sprite.setFlipX(pl.x < n.x); // face the player (art faces right by default)
    }
    try { this.services.audio?.play('ui_open'); } catch { /* ignore */ }
    runNpcScript(this.services, npcId, n?.textureKey);
    this.noticeAcc = NOTICE_REFRESH_MS; // re-evaluate markers right away
  }

  update(time: number, _delta: number) {
    if (!this.npcs.length) return;
    try {
      this.noticeAcc += _delta || 0;
      if (this.noticeAcc >= NOTICE_REFRESH_MS) {
        this.noticeAcc = 0;
        for (const n of this.npcs) {
          let kind: NpcNotice = null;
          try { kind = npcNotice(this.services, n.id); } catch { kind = null; }
          if (kind !== n.noticeKind) {
            n.noticeKind = kind;
            n.notice.setVisible(!!kind);
            if (kind === 'turnin') n.notice.setText('!').setColor('#7dff6a').setStroke('#14500a', 5);
            else if (kind === 'new') n.notice.setText('!').setColor('#ffd400').setStroke('#5a3a00', 5);
          }
        }
      }
      const bob = Math.sin(time / 220) * 4;
      for (const n of this.npcs) if (n.noticeKind) n.notice.setY(n.y - n.height - 8 + bob);

      // Talk hint over the nearest NPC in range.
      const id = this.nearestInteractable();
      const near = id ? this.npcs.find(e => e.id === id) ?? null : null;
      if (near !== this.nearest) {
        // NPCs turn back to their default facing once you walk away.
        if (this.nearest && !near) this.nearest.sprite.setFlipX(this.nearest.baseFlip);
        this.nearest = near;
      }
      if (near) {
        if (!this.hint) {
          this.hint = this.scene.add.text(0, 0, '▲ Talk', {
            fontFamily: 'Verdana, Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffffff',
            backgroundColor: 'rgba(40,60,140,0.85)', padding: { x: 6, y: 2 },
          }).setOrigin(0.5, 1).setDepth(DEPTH.NAMETAG);
        }
        const offset = near.noticeKind ? 40 : 10;
        this.hint.setPosition(near.x, near.y - near.height - offset + Math.sin(time / 300) * 2).setVisible(true);
      } else if (this.hint) {
        this.hint.setVisible(false);
      }
    } catch (e) {
      console.warn('[npc] update failed', e);
    }
  }

  clear() {
    for (const n of this.npcs) {
      n.sprite.destroy(); n.nameTag.destroy(); n.titleTag?.destroy(); n.notice.destroy();
    }
    this.npcs = [];
    this.nearest = null;
    this.hint?.destroy();
    this.hint = null;
  }

  private playerPos(): { x: number; y: number } | null {
    try {
      const p = this.services.player;
      if (!p) return null;
      return { x: p.x, y: p.y };
    } catch { return null; }
  }
}
