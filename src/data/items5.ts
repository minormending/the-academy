// OWNER: Year 5 items agent. Fellowship gear and endgame drops.
import type { Branch, EquipSlot, IconSpec, ItemDef, StatModifier } from '../core/types';

function consumable(id: string, name: string, description: string, icon: IconSpec, price: number,
  effect: NonNullable<ItemDef['consumable']>, maxStack = 100): ItemDef {
  return { id, name, type: 'consumable', description, icon, price, sellPrice: Math.max(1, Math.floor(price * 0.25)), maxStack, consumable: effect };
}

function etc(id: string, name: string, description: string, icon: IconSpec, sellPrice: number, maxStack = 200, price = 0): ItemDef {
  return { id, name, type: 'etc', description, icon, price, sellPrice, maxStack };
}

function equip(id: string, name: string, description: string, icon: IconSpec, slot: EquipSlot, reqLevel: number,
  price: number, modifiers: StatModifier[], reqBranch?: Branch, sellPrice?: number): ItemDef {
  return {
    id, name, type: 'equip', description, icon, price, sellPrice: sellPrice ?? Math.max(1, Math.floor(price * 0.3)), maxStack: 1,
    equip: { slot, reqLevel, reqBranch, modifiers },
  };
}

const add = (stat: StatModifier['stat'], v: number): StatModifier => ({ stat, add: v });

export const ITEMS5: ItemDef[] = [
  // ───────────── Etc ─────────────
  etc('star_dust', 'Star Dust', 'Fine silver grit that falls from the Observatory ceiling after midnight. Sweep it up; the astronomers will never notice.', { glyph: 'spark', color: 0xd8e4ff, color2: 0xffe27a }, 90, 200),
  etc('rift_shard', 'Rift Shard', 'A splinter of the sky where the Rift tore. It shows you the room you are standing in, slightly later.', { glyph: 'crystal', color: 0x7a4ad8, color2: 0xff7ad0 }, 160, 100),
  etc('archon_seal', 'Archon Seal', 'The last seal of the Lich Archon, cracked clean through. The Fellowship asks that you not frame it.', { glyph: 'arcane_star', color: 0xe0b0ff, color2: 0xffd447 }, 8000, 10),

  // ───────────── Accessories ─────────────
  equip('astral_ring', 'Astral Ring', 'A band of star-metal. The constellation on its face is one the Academy has not named yet.', { glyph: 'ring', color: 0xc8d4f0, color2: 0xffe27a },
    'ring', 55, 0, [add('matk', 9), add('maxMp', 110), add('mpRegen', 8), add('critRate', 0.03)], undefined, 40000),
  equip('rift_amulet', 'Rift Amulet', 'A shard of the Rift set in black silver. It pulls at your hems and your cooldowns, in that order.', { glyph: 'amulet', color: 0x5a2ab8, color2: 0xff7ad0 },
    'amulet', 60, 0, [add('matk', 11), add('dmgAll', 0.06), add('cdr', 0.06), add('maxHp', 90), add('maxMp', 100)], undefined, 60000),

  // ───────────── Fellowship rods (lv 55, branch-locked) ─────────────
  equip('fellow_rod_fire', 'Fellowship Rod of Flame', 'Issued to the Fellowship\'s Fire chair. Warm to the touch, and very warm to everyone else.', { glyph: 'staff', color: 0x9a2210, color2: 0xffb02e },
    'weapon', 55, 0, [add('matk', 46), add('dmgFire', 0.22), add('critRate', 0.04)], 'fire', 80000),
  equip('fellow_rod_ice', 'Fellowship Rod of Frost', 'Issued to the Fellowship\'s Ice chair. Its owner keeps a spare pair of gloves in the handle.', { glyph: 'staff', color: 0xdff4ff, color2: 0x3fd0ff },
    'weapon', 55, 0, [add('matk', 46), add('dmgIce', 0.22), add('critRate', 0.04)], 'ice', 80000),
  equip('fellow_rod_lightning', 'Fellowship Rod of Storms', 'Issued to the Fellowship\'s Lightning chair. Please do not hold it during exams.', { glyph: 'staff', color: 0x3a1a78, color2: 0xfff470 },
    'weapon', 55, 0, [add('matk', 46), add('dmgLightning', 0.22), add('critRate', 0.04)], 'lightning', 80000),
  equip('fellow_rod_holy', 'Fellowship Rod of Dawn', 'Issued to the Fellowship\'s Holy chair. Polished daily by something that is not quite a person.', { glyph: 'staff', color: 0xfff6dc, color2: 0xffd447 },
    'weapon', 55, 0, [add('matk', 46), add('dmgHoly', 0.22), add('critRate', 0.04)], 'holy', 80000),
  equip('fellow_rod_shadow', 'Fellowship Rod of Dusk', 'Issued to the Fellowship\'s Shadow chair. The signature line on the loan form is already signed. In your handwriting.', { glyph: 'staff', color: 0x1a1030, color2: 0xa86bff },
    'weapon', 55, 0, [add('matk', 46), add('dmgShadow', 0.22), add('critRate', 0.04)], 'shadow', 80000),

  // ───────────── Endgame ─────────────
  equip('archon_crown', 'Archon Crown', 'The Lich Archon\'s crown, rededicated to the Academy. It still thinks it is in charge.', { glyph: 'hat', color: 0x3a1a5a, color2: 0xffd447 },
    'hat', 65, 0, [add('def', 16), add('matk', 8), add('maxHp', 140), add('maxMp', 180), add('cdr', 0.04), add('critDmg', 0.08)], undefined, 90000),
  equip('unwritten_tome', 'The Unwritten Tome', 'Every page is blank until you need it. The Headmistress says it is the best edition ever printed.', { glyph: 'book', color: 0xf4efe0, color2: 0xc89bff },
    'weapon', 70, 0, [add('matk', 64), add('dmgAll', 0.15), add('critRate', 0.05), add('critDmg', 0.2), add('castSpeed', 0.05)], undefined, 200000),

  // ───────────── Consumables ─────────────
  // The consumable schema has no buff support, so this is a full restore only.
  consumable('fellowship_elixir', 'Fellowship Elixir', 'Brewed to the Fellowship\'s private recipe. Fully restores HP and MP, and tastes of victory and a little of pencil.', { glyph: 'potion', color: 0xe0b0ff, color2: 0xffe27a }, 6000, { hpPct: 1, mpPct: 1, cooldownMs: 1500 }, 50),
];
