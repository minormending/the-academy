// Shadow VFX: local CC0 sheet recolours + hard-edged 1× fallback art, rendered at 2× nearest.
import Phaser from 'phaser';
import { defineSchool, lazyRegister, scheduleIdle } from '../art/lazy';
import { generateShadowTextures as generate } from './shadow/textures';
import * as academy from './shadow/academyFx';
import {
  arc, aura, beam, bolt, buffCast, cast, heal, hex, hit, plague, summon,
  tideCast, tideImpact, tideProjectile,
} from './shadow/fx';

/** Boot hook: textures are built on first shadow VFX (or in the background while on the Title screen). */
export function generateShadowTextures(scene: Phaser.Scene): void { scheduleIdle(scene, 'shadow', generate); }

defineSchool('shadow', generate);
const registerVfx = lazyRegister('shadow', generate);

/** One-shots deliberately discard their sprites; only engine-owned visuals return an object. */
export function registerShadowVfx(): void {
  registerVfx('shd_cast', (scene, o) => { cast(scene, o); });
  registerVfx('shd_hit', (scene, o) => { hit(scene, o); });
  registerVfx('shd_curse_hit', (scene, o) => { hit(scene, o, true); });
  registerVfx('shd_bolt_proj', (scene, o) => bolt(scene, o));
  registerVfx('shd_hex_area', (scene, o) => { hex(scene, o); });
  registerVfx('shd_pact_cast', (scene, o) => { buffCast(scene, o); });
  registerVfx('shd_pact_aura', (scene, o) => aura(scene, o));

  registerVfx('shd_drain_beam', (scene, o) => { beam(scene, o, true); });
  registerVfx('shd_drain_hit', (scene, o) => { hit(scene, o, true); });
  registerVfx('shd_drain_heal', (scene, o) => { heal(scene, o); });
  registerVfx('shd_plague_area', (scene, o) => { plague(scene, o); });
  registerVfx('shd_skeleton', (scene, o) => summon(scene, o));
  registerVfx('shd_bone_arc', (scene, o) => { arc(scene, o); });
  registerVfx('shd_wither_beam', (scene, o) => { beam(scene, o); });

  registerVfx('shd_scythe_arc', (scene, o) => { arc(scene, o, true); });
  registerVfx('shd_tide_cast', (scene, o) => { tideCast(scene, o); });
  registerVfx('shd_tide_proj', tideProjectile);
  registerVfx('shd_tide_impact', (scene, o) => { tideImpact(scene, o); });
  registerVfx('shd_lich', (scene, o) => summon(scene, o, true));
  registerVfx('shd_lich_bolt', (scene, o) => bolt(scene, o, true));
  registerVfx('shd_veil_cast', (scene, o) => { buffCast(scene, o, true); });
  registerVfx('shd_veil_aura', (scene, o) => aura(scene, o, true));

  registerVfx('shd_grave_link', (scene, o) => { academy.graveLink(scene, o); });
  registerVfx('shd_dread_pulse', academy.dreadPulse);
  registerVfx('shd_step_out', (scene, o) => { academy.step(scene, o); });
  registerVfx('shd_step_in', (scene, o) => { academy.step(scene, o, true); });
  registerVfx('shd_grave_skin', academy.graveSkin);
  registerVfx('shd_grave_chains', (scene, o) => { academy.graveLink(scene, o, true); });
  registerVfx('shd_shackle_hit', academy.shackleHit);
  registerVfx('shd_ward_cast', academy.wardCast);
  registerVfx('shd_ward_aura', academy.wardAura);
  registerVfx('shd_wraith', academy.wraith);
  registerVfx('shd_wraith_wisp', academy.wraithWisp);
  registerVfx('shd_wraith_hit', academy.wraithHit);
  registerVfx('shd_lance_cast', academy.lanceCast);
  registerVfx('shd_lance_proj', academy.lance);
  registerVfx('shd_lance_hit', academy.lanceHit);
  registerVfx('shd_dragon', academy.dragon);
  registerVfx('shd_dragon_charge', academy.dragonCharge);
  registerVfx('shd_dragon_breath', academy.dragonBreath);
  registerVfx('shd_dragon_hit', academy.dragonHit);
  registerVfx('shd_reservoir', academy.reservoir);
}
