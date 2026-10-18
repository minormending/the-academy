// Shadow VFX: local CC0 sheet recolours + hard-edged 1× fallback art, rendered at 2× nearest.
import Phaser from 'phaser';
import { registerVfx } from '../core/vfx';
import { generateShadowTextures as generate } from './shadow/textures';
import {
  arc, aura, beam, bolt, buffCast, cast, heal, hex, hit, plague, summon,
  tideCast, tideImpact, tideProjectile,
} from './shadow/fx';

export function generateShadowTextures(scene: Phaser.Scene): void { generate(scene); }

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
}
