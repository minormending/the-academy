// OWNER: A2 (skill-engine). Combat math, monster damage, status application, player hits, damage numbers.
import Phaser from 'phaser';
import { bus } from '../core/events';
import type { DamageNumberKind, DerivedStats, Element, GameServices, ICombatSystem, IMonster, StatusInstance, StatusSpec } from '../core/types';
import { DamageNumbers } from './skill/DamageNumbers';
import { clamp, num } from './skill/util';

const DEF_K = 120;            // player def mitigation constant: raw × (1 − def/(def+K))
const HIT_SFX_GAP = 55;       // ms between monster_hit sfx
const CRIT_SFX_GAP = 80;

export class CombatSystem implements ICombatSystem {
  private numbers: DamageNumbers;
  private lastHitSfx = 0;
  private lastCritSfx = 0;

  constructor(private scene: Phaser.Scene, private services: GameServices) {
    this.numbers = new DamageNumbers(scene);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.numbers.destroy());
  }

  private derived(): DerivedStats | null {
    try { return this.services.progression.derived(); } catch { return null; }
  }

  rollSkillDamage(element: Element, damagePct: number, target: IMonster): { amount: number; crit: boolean } {
    const d = this.derived();
    const matk = num(d?.matk, 10);
    const mastery = clamp(num(d?.mastery, 0.5), 0, 1);
    const roll = mastery + Math.random() * (1 - mastery);
    const elemBonus = element === 'fire' ? num(d?.dmgFire, 0) : element === 'ice' ? num(d?.dmgIce, 0)
      : element === 'lightning' ? num(d?.dmgLightning, 0) : element === 'holy' ? num(d?.dmgHoly, 0)
      : element === 'shadow' ? num(d?.dmgShadow, 0) : 0;
    const def = target.def;
    let elemMult = 1;
    if (element !== 'neutral') {
      if (def.weak?.includes(element)) elemMult = 1.5;
      else if (def.resist?.includes(element)) elemMult = 0.5;
    }
    const crit = Math.random() < clamp(num(d?.critRate, 0), 0, 1);
    const critMult = crit ? 1 + Math.max(0, num(d?.critDmg, 0.5)) : 1;
    let incoming = 1;
    try { incoming = num(target.incomingDamageMult(), 1); } catch { /* ignore */ }
    const raw = matk * (num(damagePct, 100) / 100) * roll * Math.max(0, 1 + num(d?.dmgAll, 0) + elemBonus)
      * elemMult * critMult * incoming - num(def.def, 0);
    return { amount: Math.max(1, Math.round(raw)), crit };
  }

  damageMonster(target: IMonster, amount: number, opts: { crit?: boolean; element?: Element; fromX?: number; knockback?: number; kind?: DamageNumberKind; stackIndex?: number } = {}): void {
    if (!target || !target.alive) return;
    const dmg = Math.max(0, Math.round(num(amount, 0)));
    const b = safeBounds(target);
    if (dmg <= 0) { this.showNumber(target.x, b.top - 4, 0, 'miss', opts.stackIndex ?? 0); return; }
    const crit = !!opts.crit;
    const kind: DamageNumberKind = opts.kind ?? (crit ? 'crit' : 'monster');
    let knockbackX: number | undefined;
    if (opts.knockback && opts.knockback > 0) {
      const dir = opts.fromX === undefined ? 1 : (target.x >= opts.fromX ? 1 : -1);
      knockbackX = opts.knockback * dir;
    }
    try {
      target.takeDamage(dmg, { crit, knockbackX, fromX: opts.fromX });
    } catch (e) { console.error('[combat] takeDamage', e); }
    this.showNumber(target.x, b.top - 4, dmg, kind, opts.stackIndex ?? 0);
    bus.emit('monster:damaged', { monster: target, amount: dmg, crit, element: opts.element ?? 'neutral' });
    if (kind !== 'dot') {
      const now = this.scene.time.now;
      if (crit) {
        if (now - this.lastCritSfx >= CRIT_SFX_GAP) { this.lastCritSfx = now; this.lastHitSfx = now; this.services.audio?.play('monster_crit'); }
      } else if (now - this.lastHitSfx >= HIT_SFX_GAP) {
        this.lastHitSfx = now;
        this.services.audio?.play('monster_hit', { detune: (Math.random() - 0.5) * 200 });
      }
    }
  }

  tryApplyStatus(target: IMonster, spec: StatusSpec, lv: number, element: Element, baseHit: number): void {
    if (!target || !target.alive || !spec) return;
    const chance = clamp(num(spec.chance(lv), 0), 0, 1);
    if (Math.random() >= chance) return;
    if (target.def.immune?.includes(spec.kind)) return;
    let duration = Math.max(0, num(spec.durationMs(lv), 0));
    if (duration <= 0) return;
    const isBoss = !!target.def.boss || target.def.behavior === 'boss';
    if (isBoss && (spec.kind === 'freeze' || spec.kind === 'stun')) duration *= 0.5;
    const rawPot = num(spec.potency(lv), 0);
    let potency: number;
    switch (spec.kind) {
      case 'burn':
      case 'poison': potency = Math.max(1, Math.round((num(baseHit, 1) * rawPot) / 100)); break;
      case 'curse': potency = clamp(rawPot, 0, 0.6); break;
      case 'chill': potency = clamp(rawPot, 0, 0.9); break;
      case 'shock': potency = Math.max(0, rawPot); break;
      default: potency = rawPot;
    }
    const inst: StatusInstance = { kind: spec.kind, durationMs: Math.round(duration), potency, element };
    try { target.applyStatus(inst); } catch (e) { console.error('[combat] applyStatus', e); }
  }

  hitPlayer(raw: number, fromX: number): void {
    const s = this.services;
    const p = s.player;
    if (!p || !s.progression) return;
    if (s.progression.isDead() || p.state === 'dead' || p.isInvulnerable()) return;
    const d = this.derived();
    const def = Math.max(0, num(d?.def, 0));
    const variance = 0.9 + Math.random() * 0.2;
    const total = Math.max(1, Math.round(Math.max(1, num(raw, 1) * (1 - def / (def + DEF_K))) * variance));
    const shield = clamp(num(d?.mpShield, 0), 0, 0.95);
    let mpPaid = 0;
    if (shield > 0) mpPaid = Math.min(Math.round(total * shield), Math.max(0, Math.floor(s.progression.state.mp)));
    const hpLoss = Math.max(0, total - mpPaid);

    try { p.onHit(fromX); } catch (e) { console.error('[combat] onHit', e); }
    if (mpPaid > 0) s.progression.loseMp(mpPaid);
    const headY = p.y - 66;
    if (hpLoss > 0) this.showNumber(p.x, headY, hpLoss, 'player', 0);
    if (mpPaid > 0) this.showNumber(p.x, headY, mpPaid, 'mp', hpLoss > 0 ? 1 : 0);
    s.audio?.play('player_hurt');
    bus.emit('player:damaged', { amount: hpLoss });
    if (hpLoss > 0) s.progression.loseHp(hpLoss);
  }

  showNumber(x: number, y: number, amount: number, kind: DamageNumberKind, stackIndex = 0): void {
    try { this.numbers.show(x, y, amount, kind, stackIndex); } catch (e) { console.error('[combat] number', e); }
  }

  update(time: number, delta: number): void {
    try { this.numbers.update(Math.min(100, delta)); } catch (e) { console.error('[combat] update', e); }
  }
}

function safeBounds(m: IMonster): { top: number } {
  try { return m.getBounds(); } catch { return { top: m.y - 40 }; }
}
