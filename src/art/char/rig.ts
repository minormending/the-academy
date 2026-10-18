// OWNER: A10 (art-audio). The chibi mage painter: draws one character frame on a Canvas 2D context.
//
// Coordinate system: the caller translates the context so (0,0) is the FEET (bottom-center of the
// character). y is negative upward. The character faces RIGHT (+x). All units are frame pixels.
//
// Proportions (MapleStory-ish): head ≈ 27px tall on a ≈ 56px body (+ hat), robe 24px, tiny feet.

import type { CharacterLook } from '../../core/types';
import { css, mix, outline, shade } from './color';

type Ctx = CanvasRenderingContext2D;

export type EyeState = 'open' | 'focus' | 'hurt' | 'happy' | 'closed';
export type MouthState = 'smile' | 'open' | 'o' | 'flat' | 'ouch' | 'grin';
export type HairStyle = 'tuft' | 'bob' | 'long' | 'ponytail' | 'spiky' | 'bald';

/** Per-character variations (NPCs get seeded ones, the player uses DEFAULT_EXTRAS). */
export interface Extras {
  hairStyle: HairStyle;
  beard?: number | null;   // beard color, null/undefined = no beard
  beardLong?: boolean;
  glasses?: boolean;
}
export const DEFAULT_EXTRAS: Extras = { hairStyle: 'tuft' };

export interface Pose {
  view: 'side' | 'back';
  bob: number;              // upper body vertical offset (+ = down)
  headDx: number; headDy: number;
  headTilt: number;         // radians
  lean: number;             // robe top shifts forward by this many px
  footB: [number, number];  // back foot [dx, lift]
  footF: [number, number];  // front foot [dx, lift]
  hemFlare: number;         // extra hem half-width
  hemLift: number;          // hem raise
  hairSway: number;         // px offset of hair tips / hat tip
  hairUp: number;           // 0..1 hair blown upward (falling)
  hand: [number, number];   // front (staff) hand, relative to feet, before bob
  staffAngle: number;       // radians from vertical (+ = top leans forward)
  backHand: [number, number];
  gem: number;              // gem glow intensity 0..2.5
  eyes: EyeState;
  mouth: MouthState;
  showStaff: boolean;
}

export function pose(p: Partial<Pose> = {}): Pose {
  return {
    view: 'side', bob: 0, headDx: 0, headDy: 0, headTilt: 0, lean: 0,
    footB: [0, 0], footF: [0, 0], hemFlare: 0, hemLift: 0, hairSway: 0, hairUp: 0,
    hand: [13, -17], staffAngle: 0.14, backHand: [-9, -16], gem: 0.7,
    eyes: 'open', mouth: 'smile', showStaff: true,
    ...p,
  };
}

const SHOE = 0x4a3020;
const WOOD = 0x8a5a34;
const BODY_TOP = -28;     // robe neckline y (before bob)
const HEM_Y = -4;
export const HEAD_X = 1;
export const HEAD_Y = -41;
const HEAD_RX = 14.5;
const HEAD_RY = 13.5;

// ───────────────────────────── primitives ─────────────────────────────

function fillStroke(ctx: Ctx, fill: string | CanvasGradient, stroke: string, lw = 1.1) {
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke();
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

function vgrad(ctx: Ctx, y0: number, y1: number, c0: number, c1: number, a = 1): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, css(c0, a)); g.addColorStop(1, css(c1, a));
  return g;
}

function star4(ctx: Ctx, x: number, y: number, r: number, inner = 0.28) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * inner;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Thick limb drawn as an outlined round-capped stroke. */
function limb(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, fill: number) {
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.strokeStyle = css(outline(fill)); ctx.lineWidth = w + 2; ctx.stroke();
  ctx.strokeStyle = css(fill); ctx.lineWidth = w; ctx.stroke();
  ctx.lineCap = 'butt';
}

export function glow(ctx: Ctx, x: number, y: number, r: number, color: number, a: number) {
  if (a <= 0 || r <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, css(shade(color, 0.5), Math.min(1, a)));
  g.addColorStop(0.35, css(color, Math.min(1, a * 0.55)));
  g.addColorStop(1, css(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ───────────────────────────── body parts ─────────────────────────────

function drawFeet(ctx: Ctx, L: CharacterLook, p: Pose, back = false) {
  const shoe = mix(shade(L.robe, -0.45), SHOE, 0.55);
  const feet: [number, number, number][] = back
    ? [[-4 + p.footB[0], -2 - p.footB[1], 0], [4 + p.footF[0], -2 - p.footF[1], 0]]
    : [[-4 + p.footB[0], -2.2 - p.footB[1], -0.1], [5 + p.footF[0], -2.4 - p.footF[1], 0.1]];
  feet.forEach(([x, y, r], i) => {
    ellipse(ctx, x, y, 4.4, 2.7, r);
    fillStroke(ctx, css(i === 0 && !back ? shade(shoe, -0.15) : shoe), css(outline(shoe)), 1);
    ellipse(ctx, x + 1, y - 1, 1.6, 0.8);
    ctx.fillStyle = css(0xffffff, 0.25); ctx.fill();
  });
}

function robePath(ctx: Ctx, p: Pose, sym: boolean) {
  const top = BODY_TOP + p.bob, hem = HEM_Y - p.hemLift;
  const tx = sym ? 0 : p.lean;
  const tw = 8, hw = 13 + p.hemFlare;
  const mid = (top + hem) / 2;
  ctx.beginPath();
  ctx.moveTo(tx - tw, top);
  ctx.quadraticCurveTo(tx - tw - 4, mid, -hw, hem);
  // scalloped hem (left → right)
  const n = 4;
  for (let i = 0; i < n; i++) {
    const x0 = -hw + (2 * hw * i) / n, x1 = -hw + (2 * hw * (i + 1)) / n;
    ctx.quadraticCurveTo((x0 + x1) / 2, hem + (i % 2 === 0 ? 2.2 : 1.2), x1, hem);
  }
  ctx.quadraticCurveTo(tx + tw + 4, mid, tx + tw, top);
  ctx.quadraticCurveTo(tx, top - 2, tx - tw, top);
  ctx.closePath();
  return { top, hem, tx, hw };
}

function drawRobe(ctx: Ctx, L: CharacterLook, p: Pose, back = false) {
  const { top, hem, tx, hw } = robePath(ctx, p, back);
  fillStroke(ctx, vgrad(ctx, top, hem, shade(L.robe, 0.18), shade(L.robe, -0.18)), css(outline(L.robe)), 1.2);

  ctx.save();
  robePath(ctx, p, back);
  ctx.clip();
  // side shading (back side darker, front lit)
  const hg = ctx.createLinearGradient(-hw, 0, hw, 0);
  hg.addColorStop(0, 'rgba(20,10,40,0.28)');
  hg.addColorStop(0.45, 'rgba(20,10,40,0)');
  hg.addColorStop(0.8, 'rgba(255,255,255,0.08)');
  hg.addColorStop(1, 'rgba(20,10,40,0.12)');
  ctx.fillStyle = hg; ctx.fillRect(-hw - 2, top - 2, hw * 2 + 4, hem - top + 6);
  // folds
  ctx.strokeStyle = css(shade(L.robe, -0.45), 0.45); ctx.lineWidth = 0.9;
  ctx.beginPath();
  if (back) {
    ctx.moveTo(-3, top + 10); ctx.quadraticCurveTo(-5, hem - 6, -7, hem);
    ctx.moveTo(3, top + 10); ctx.quadraticCurveTo(5, hem - 6, 7, hem);
  } else {
    ctx.moveTo(tx - 3, top + 12); ctx.quadraticCurveTo(-5, hem - 7, -7 - p.hemFlare * 0.5, hem);
    ctx.moveTo(tx + 7, top + 13); ctx.quadraticCurveTo(9, hem - 6, 10 + p.hemFlare * 0.5, hem);
  }
  ctx.stroke();
  // front opening trim
  if (!back) {
    ctx.strokeStyle = css(outline(L.robeTrim)); ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(tx + 3.5, top + 2); ctx.quadraticCurveTo(tx + 3.5, hem - 8, 4 + p.hemFlare * 0.3, hem + 3); ctx.stroke();
    ctx.strokeStyle = css(L.robeTrim); ctx.lineWidth = 1.8; ctx.stroke();
  }
  // hem trim band
  ctx.fillStyle = css(L.robeTrim);
  ctx.fillRect(-hw - 2, hem - 3.2, hw * 2 + 4, 7);
  ctx.strokeStyle = css(outline(L.robeTrim)); ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-hw - 2, hem - 3.2); ctx.lineTo(hw + 2, hem - 3.2); ctx.stroke();
  ctx.fillStyle = css(0xffffff, 0.3); ctx.fillRect(-hw - 2, hem - 2.6, hw * 2 + 4, 0.8);
  // sash
  const sy = top + 11;
  ctx.fillStyle = css(shade(L.robeTrim, -0.12));
  ctx.fillRect(-hw - 2, sy, hw * 2 + 4, 3);
  ctx.strokeStyle = css(outline(L.robeTrim), 0.8); ctx.lineWidth = 0.8;
  ctx.strokeRect(-hw - 2, sy, hw * 2 + 4, 3);
  ctx.restore();

  if (!back) {
    // sash gem buckle
    ellipse(ctx, tx + 4, sy + 1.5, 2, 2);
    fillStroke(ctx, css(L.staffGem), css(outline(L.staffGem)), 0.8);
    ellipse(ctx, tx + 3.4, sy + 0.9, 0.7, 0.7); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
  }
  // collar
  ellipse(ctx, tx + (back ? 0 : 1), top + 0.5, 7.5, 2.4);
  fillStroke(ctx, css(L.robeTrim), css(outline(L.robeTrim)), 0.9);
}

function drawSleeve(ctx: Ctx, L: CharacterLook, sx: number, sy: number, hx: number, hy: number, robeCol: number) {
  limb(ctx, sx, sy, hx, hy, 6, robeCol);
  // cuff (short segment just before the hand)
  const dx = hx - sx, dy = hy - sy, len = Math.hypot(dx, dy) || 1;
  const cx = hx - (dx / len) * 1.8, cy = hy - (dy / len) * 1.8;
  limb(ctx, cx - (dx / len) * 0.6, cy - (dy / len) * 0.6, cx, cy, 6.4, L.robeTrim);
  ellipse(ctx, hx + (dx / len) * 1.2, hy + (dy / len) * 1.2, 2.7, 2.7);
  fillStroke(ctx, css(L.skin), css(outline(L.skin)), 0.9);
}

export interface StaffOpts { top?: number; bottom?: number; }

/** Staff held at (hx,hy), angle from vertical. Draws shaft, ornament, gem and glow. */
export function drawStaff(ctx: Ctx, L: CharacterLook, hx: number, hy: number, angle: number, gemGlow: number, o: StaffOpts = {}) {
  const topLen = o.top ?? 30, botLen = o.bottom ?? 11;
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(angle);
  // shaft
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, botLen); ctx.lineTo(0, -topLen);
  ctx.strokeStyle = css(outline(WOOD)); ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = css(WOOD); ctx.lineWidth = 2.3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.5, botLen - 1); ctx.lineTo(0.5, -topLen + 1);
  ctx.strokeStyle = css(shade(WOOD, 0.35)); ctx.lineWidth = 0.7; ctx.stroke();
  // wrap bands
  ctx.strokeStyle = css(L.robeTrim); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-1.6, -topLen + 4); ctx.lineTo(1.6, -topLen + 4); ctx.stroke();
  // ornament prongs
  const metal = L.robeTrim;
  ctx.beginPath();
  ctx.moveTo(0, -topLen + 2); ctx.quadraticCurveTo(-6, -topLen - 1, -3.6, -topLen - 8);
  ctx.moveTo(0, -topLen + 2); ctx.quadraticCurveTo(6, -topLen - 1, 3.6, -topLen - 8);
  ctx.strokeStyle = css(outline(metal)); ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = css(metal); ctx.lineWidth = 1.6; ctx.stroke();
  ctx.lineCap = 'butt';
  // gem
  const gy = -topLen - 4.2;
  const gg = ctx.createRadialGradient(-1, gy - 1.2, 0.3, 0, gy, 3.6);
  gg.addColorStop(0, '#ffffff'); gg.addColorStop(0.35, css(shade(L.staffGem, 0.35))); gg.addColorStop(1, css(shade(L.staffGem, -0.25)));
  ctx.beginPath(); ctx.arc(0, gy, 3.4, 0, Math.PI * 2);
  fillStroke(ctx, gg, css(outline(L.staffGem)), 0.9);
  ctx.restore();
  // glow (unrotated, in parent space)
  const gx = hx + Math.sin(angle) * (topLen + 4.2), gyy = hy - Math.cos(angle) * (topLen + 4.2);
  glow(ctx, gx, gyy, 5 + gemGlow * 4, L.staffGem, 0.35 + gemGlow * 0.3);
  if (gemGlow > 1.2) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    star4(ctx, gx, gyy, 5 + gemGlow * 3.2, 0.18);
    ctx.fillStyle = css(shade(L.staffGem, 0.7), 0.9); ctx.fill();
    ctx.restore();
  }
}

// ───────────────────────────── head ─────────────────────────────

function hairFill(ctx: Ctx, L: CharacterLook, y0 = -16, y1 = 14): CanvasGradient {
  return vgrad(ctx, y0, y1, shade(L.hair, 0.18), shade(L.hair, -0.18));
}

/** Back hair (behind face and body). Head-local coords. */
function drawHairBack(ctx: Ctx, L: CharacterLook, ex: Extras, p: Pose, back: boolean) {
  if (ex.hairStyle === 'bald') return;
  const s = p.hairSway, up = p.hairUp;
  const fill = hairFill(ctx, L, -16, 26), line = css(outline(L.hair));
  ctx.beginPath();
  switch (ex.hairStyle) {
    case 'long': {
      const tipY = 26 - up * 14;
      ctx.moveTo(-15, -4);
      ctx.quadraticCurveTo(-18 + s * 0.5, 12, -14 + s, tipY);
      ctx.lineTo(-9 + s, tipY - 3); ctx.lineTo(-5 + s, tipY + 1);
      ctx.quadraticCurveTo(-2, 14, 4, 10);
      ctx.lineTo(10, 0);
      break;
    }
    case 'bob':
      ctx.moveTo(-15.5, -4);
      ctx.quadraticCurveTo(-18 + s * 0.4, 9, -12 + s * 0.4, 12 - up * 3);
      ctx.quadraticCurveTo(-4, 14, 3, 11);
      ctx.lineTo(10, 0);
      break;
    case 'spiky':
      ctx.moveTo(-14, -8);
      ctx.lineTo(-21 + s, -4 - up * 4); ctx.lineTo(-15, 0);
      ctx.lineTo(-20 + s, 5 - up * 4); ctx.lineTo(-13, 6);
      ctx.lineTo(-15 + s, 11 - up * 4); ctx.lineTo(-7, 9);
      ctx.lineTo(4, 6);
      break;
    case 'ponytail':
    case 'tuft':
    default:
      ctx.moveTo(-15, -4);
      ctx.quadraticCurveTo(-17.5 + s * 0.4, 5, -14 + s * 0.6, 9 - up * 3);
      ctx.lineTo(-10, 7); ctx.lineTo(-8 + s * 0.3, 11 - up * 3);
      ctx.lineTo(-3, 7);
      ctx.lineTo(8, 2);
      break;
  }
  ctx.lineTo(10, -8);
  ctx.ellipse(-1.2, -1, 15.6, 14.8, 0, -0.2, Math.PI + 0.25, true);
  ctx.closePath();
  fillStroke(ctx, fill, line, 1.1);

  if (ex.hairStyle === 'ponytail') drawPonytail(ctx, L, p, back);
}

function drawPonytail(ctx: Ctx, L: CharacterLook, p: Pose, back: boolean) {
  const s = p.hairSway, up = p.hairUp, line = css(outline(L.hair));
  {
    // tie + tail
    const bx = back ? 0 : -12, by = back ? 4 : -5;
    ctx.beginPath();
    ctx.moveTo(bx - 2, by);
    ctx.quadraticCurveTo(bx - 9 + s, by + 6 - up * 8, bx - 6 + s * 1.5, by + 20 - up * 14);
    ctx.quadraticCurveTo(bx - 1 + s, by + 12 - up * 8, bx + 3, by + 2);
    ctx.closePath();
    fillStroke(ctx, hairFill(ctx, L, by, by + 20), line, 1.1);
    ellipse(ctx, bx, by + 1, 2.4, 2.4);
    fillStroke(ctx, css(L.robeTrim), css(outline(L.robeTrim)), 0.8);
  }
}

/** Front hair / bangs (over the forehead). Head-local coords. */
function drawBangs(ctx: Ctx, L: CharacterLook, ex: Extras, p: Pose, showAhoge: boolean) {
  if (ex.hairStyle === 'bald') {
    // a little shine on the scalp
    ellipse(ctx, 2, -10, 5, 2, -0.2); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    return;
  }
  const s = p.hairSway * 0.3;
  ctx.beginPath();
  ctx.moveTo(-15.6, 5);
  ctx.ellipse(0, -0.5, 15.4, 14.6, 0, Math.PI * 0.95, Math.PI * 2.02, false);
  // bangs edge right → left across the forehead
  ctx.quadraticCurveTo(13.5, -2, 12.5 + s, 2.5);
  ctx.quadraticCurveTo(11, -2, 9.5, -4.5);
  ctx.quadraticCurveTo(8.5, -1.5, 6.5 + s, 0.5);
  ctx.quadraticCurveTo(5.5, -3.5, 3, -5.5);
  ctx.quadraticCurveTo(1.5, -2.5, -0.5 + s, -1);
  ctx.quadraticCurveTo(-1.5, -4.5, -4, -6);
  ctx.quadraticCurveTo(-5.5, -1, -7, 2);
  ctx.quadraticCurveTo(-8.5, 6, -9 + s, 9);
  ctx.quadraticCurveTo(-12, 5, -15.6, 5);
  ctx.closePath();
  fillStroke(ctx, hairFill(ctx, L), css(outline(L.hair)), 1.1);
  // shine
  ctx.strokeStyle = css(0xffffff, 0.42); ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(0, -1, 11, 10, 0, Math.PI * 1.22, Math.PI * 1.38); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -1, 11, 10, 0, Math.PI * 1.46, Math.PI * 1.64); ctx.stroke();
  ctx.lineCap = 'butt';
  if (ex.hairStyle === 'spiky') {
    ctx.beginPath();
    ctx.moveTo(-6, -13); ctx.lineTo(-4 + s, -19); ctx.lineTo(0, -14); ctx.lineTo(3 + s, -19.5); ctx.lineTo(6, -13);
    ctx.closePath();
    fillStroke(ctx, hairFill(ctx, L, -20, -12), css(outline(L.hair)), 1);
  }
  if (showAhoge) {
    ctx.beginPath();
    ctx.moveTo(1, -14);
    ctx.quadraticCurveTo(-1 + s, -22, 5 + p.hairSway * 0.8, -21 - p.hairUp * 2);
    ctx.quadraticCurveTo(1.5, -19, 3.5, -14);
    ctx.closePath();
    fillStroke(ctx, css(shade(L.hair, 0.1)), css(outline(L.hair)), 1);
  }
}

function drawEye(ctx: Ctx, L: CharacterLook, x: number, y: number, w: number, state: EyeState, outward: 1 | -1) {
  const dark = '#2a1f3d';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (state === 'hurt') {
    ctx.strokeStyle = dark; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 2 * outward, y - 2.6); ctx.lineTo(x + 1.6 * outward, y); ctx.lineTo(x - 2 * outward, y + 2.6);
    ctx.stroke();
  } else if (state === 'happy' || state === 'closed') {
    ctx.strokeStyle = dark; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (state === 'happy') ctx.arc(x, y + 1.6, w * 0.55, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(x, y - 0.6, w * 0.55, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    // lash flick
    ctx.beginPath(); ctx.moveTo(x + outward * w * 0.5, y + (state === 'happy' ? 0.2 : 0.4)); ctx.lineTo(x + outward * (w * 0.5 + 1.2), y - 0.6); ctx.stroke();
  } else {
    const h = state === 'focus' ? 5.4 : 7.4;
    const cy = state === 'focus' ? y + 0.8 : y;
    const iris = mix(L.staffGem, 0x3050a0, 0.45);
    ctx.save();
    ellipse(ctx, x, cy, w / 2, h / 2);
    const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    g.addColorStop(0, dark); g.addColorStop(0.45, css(mix(iris, 0x2a1f3d, 0.5))); g.addColorStop(1, css(shade(iris, 0.25)));
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    // upper lid / lash
    ctx.strokeStyle = dark; ctx.lineWidth = 1.6;
    ctx.beginPath();
    if (state === 'focus') { ctx.moveTo(x - w / 2 - 0.4, cy - h / 2 + (outward > 0 ? 0.2 : -0.6)); ctx.lineTo(x + w / 2 + 0.4, cy - h / 2 + (outward > 0 ? -0.6 : 0.2)); }
    else ctx.ellipse(x, cy, w / 2 + 0.2, h / 2 + 0.2, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x + outward * (w / 2), cy - h / 2 + 1.2); ctx.lineTo(x + outward * (w / 2 + 1.3), cy - h / 2 + 0.2); ctx.stroke();
    // highlights
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x - w * 0.18, cy - h * 0.2, Math.max(0.9, w * 0.26), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w * 0.18, cy + h * 0.22, 0.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
}

function drawMouth(ctx: Ctx, x: number, y: number, m: MouthState) {
  const dark = '#7a2a35';
  ctx.lineCap = 'round';
  ctx.strokeStyle = dark; ctx.lineWidth = 1;
  switch (m) {
    case 'smile':
      ctx.beginPath(); ctx.arc(x, y - 1.2, 1.7, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke(); break;
    case 'flat':
      ctx.beginPath(); ctx.moveTo(x - 1.4, y); ctx.lineTo(x + 1.4, y - 0.2); ctx.stroke(); break;
    case 'o':
      ellipse(ctx, x, y, 1.2, 1.5); ctx.fillStyle = dark; ctx.fill(); break;
    case 'open':
    case 'grin': {
      const w = m === 'grin' ? 2.6 : 2;
      ctx.beginPath(); ctx.moveTo(x - w, y - 0.8); ctx.quadraticCurveTo(x, y - 0.2, x + w, y - 0.8);
      ctx.quadraticCurveTo(x + w * 0.6, y + 2.8, x, y + 2.8); ctx.quadraticCurveTo(x - w * 0.6, y + 2.8, x - w, y - 0.8);
      ctx.fillStyle = dark; ctx.fill();
      ellipse(ctx, x + 0.2, y + 1.9, w * 0.45, 0.7); ctx.fillStyle = '#ff8a9a'; ctx.fill();
      break;
    }
    case 'ouch':
      ctx.beginPath(); ctx.moveTo(x - 2, y + 0.8); ctx.lineTo(x - 0.7, y - 0.4); ctx.lineTo(x + 0.6, y + 0.8); ctx.lineTo(x + 2, y - 0.4); ctx.stroke(); break;
  }
  ctx.lineCap = 'butt';
}

/** Face (skin, eyes, blush, mouth, glasses, beard). Head-local coords, facing right. */
function drawFace(ctx: Ctx, L: CharacterLook, ex: Extras, p: Pose) {
  ellipse(ctx, 0, 0, HEAD_RX, HEAD_RY);
  const g = ctx.createRadialGradient(4, 1, 2, 2, 0, 16);
  g.addColorStop(0, css(shade(L.skin, 0.12))); g.addColorStop(1, css(shade(L.skin, -0.08)));
  fillStroke(ctx, g, css(outline(L.skin)), 1.1);
  // ear (back side)
  ellipse(ctx, -7.5, 3, 2.2, 3); fillStroke(ctx, css(shade(L.skin, -0.05)), css(outline(L.skin)), 0.9);
  // blush
  ctx.fillStyle = 'rgba(255,110,130,0.38)';
  ellipse(ctx, 1.5, 6.2, 2.6, 1.4); ctx.fill();
  ellipse(ctx, 11.6, 5.6, 1.9, 1.3); ctx.fill();
  drawEye(ctx, L, 2.8, 1.2, 5.4, p.eyes, -1);
  drawEye(ctx, L, 10.6, 0.8, 4.5, p.eyes, 1);
  if (ex.glasses) {
    ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(3, 1.2, 3.9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(10.6, 0.8, 3.3, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6.9, 0.6); ctx.lineTo(7.4, 0.4); ctx.moveTo(-0.9, 0.8); ctx.lineTo(-6, -0.5); ctx.stroke();
    ctx.fillStyle = 'rgba(200,230,255,0.18)';
    ctx.beginPath(); ctx.arc(3, 1.2, 3.6, 0, Math.PI * 2); ctx.fill();
  }
  if (ex.beard != null) {
    const bc = ex.beard;
    const len = ex.beardLong ? 18 : 11;
    ctx.beginPath();
    ctx.moveTo(-4, 4);
    ctx.quadraticCurveTo(-1, 9, 4, 7.5);
    ctx.quadraticCurveTo(8, 6, 13.4, 4);
    ctx.quadraticCurveTo(13, 9, 9, len - 3);
    ctx.quadraticCurveTo(6 + p.hairSway * 0.3, len + 1, 4 + p.hairSway * 0.4, len + 2);
    ctx.quadraticCurveTo(1, len - 2, -2, len - 6);
    ctx.quadraticCurveTo(-4, 9, -4, 4);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 4, len + 2, shade(bc, 0.15), shade(bc, -0.15)), css(outline(bc)), 1);
    // mustache
    ctx.beginPath();
    ctx.moveTo(3, 6.8); ctx.quadraticCurveTo(6, 4.8, 8, 6.4); ctx.quadraticCurveTo(10.5, 4.8, 13, 6.5);
    ctx.quadraticCurveTo(10, 8.4, 8, 7.4); ctx.quadraticCurveTo(5.5, 8.6, 3, 6.8);
    fillStroke(ctx, css(shade(bc, 0.08)), css(outline(bc)), 0.8);
  } else {
    drawMouth(ctx, 7.6, 7.6, p.mouth);
  }
  if (p.eyes === 'focus') {
    ctx.strokeStyle = css(shade(L.hair, -0.3)); ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0.6, -4.2); ctx.lineTo(5, -3.2); ctx.moveTo(8.6, -3.4); ctx.lineTo(12.4, -4.4); ctx.stroke();
    ctx.lineCap = 'butt';
  }
}

// ───────────────────────────── hats ─────────────────────────────

function hatGrad(ctx: Ctx, L: CharacterLook, x0: number, x1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, css(shade(L.hat, -0.25))); g.addColorStop(0.6, css(L.hat)); g.addColorStop(1, css(shade(L.hat, 0.22)));
  return g;
}

/** Layer behind the face (hood back). */
function drawHatBack(ctx: Ctx, L: CharacterLook, p: Pose, back: boolean) {
  if (L.hatStyle !== 'hood') return;
  ctx.beginPath();
  ctx.moveTo(-14, 10);
  ctx.quadraticCurveTo(-19, 16, -13, 19);
  ctx.quadraticCurveTo(0, 20, 12, 16);
  ctx.quadraticCurveTo(15, 10, 14, 6);
  ctx.ellipse(-1, -0.8, 17.4, 16.4, 0, 0.3, Math.PI + 0.65, true);
  ctx.closePath();
  fillStroke(ctx, hatGrad(ctx, L, -18, 16), css(outline(L.hat)), 1.1);
  if (!back) {
    // hood point flopping back
    ctx.beginPath();
    ctx.moveTo(-10, -12); ctx.quadraticCurveTo(-19 + p.hairSway, -13 - p.hairUp * 3, -21 + p.hairSway, -4); ctx.quadraticCurveTo(-17, -6, -15, 0);
    ctx.closePath();
    fillStroke(ctx, css(shade(L.hat, -0.18)), css(outline(L.hat)), 1);
  }
}

/** Hat layer in front of the hair. Head-local coords. */
function drawHatFront(ctx: Ctx, L: CharacterLook, p: Pose, back: boolean) {
  const sway = p.hairSway, up = p.hairUp;
  const trim = L.hatTrim;
  switch (L.hatStyle) {
    case 'pointed': {
      // brim
      ellipse(ctx, 0.5, -12, 18.5, 4.3, back ? 0 : -0.07);
      const bg = vgrad(ctx, -16, -8, shade(L.hat, 0.12), shade(L.hat, -0.25));
      fillStroke(ctx, bg, css(outline(L.hat)), 1.2);
      ellipse(ctx, 0.5, -11.7, 17.1, 3.3, back ? 0 : -0.07);
      ctx.strokeStyle = css(trim, 0.9); ctx.lineWidth = 0.9; ctx.stroke();
      // cone
      const tipX = (back ? -2 : -11) + sway, tipY = -34.5 - up * 2;
      ctx.beginPath();
      ctx.moveTo(-10, -13.5);
      ctx.quadraticCurveTo(-6, -24.5, -4, -29.5);
      ctx.quadraticCurveTo(-6, -33.5, tipX, tipY);
      ctx.quadraticCurveTo(-3, -35.5, 2, -29.5);
      ctx.quadraticCurveTo(8, -22.5, 11, -13.5);
      ctx.quadraticCurveTo(0.5, -10.5, -10, -13.5);
      ctx.closePath();
      fillStroke(ctx, hatGrad(ctx, L, -10, 11), css(outline(L.hat)), 1.2);
      // band
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-10, -13.5); ctx.quadraticCurveTo(-6, -24.5, -4, -29.5); ctx.lineTo(2, -29.5); ctx.quadraticCurveTo(8, -22.5, 11, -13.5); ctx.quadraticCurveTo(0.5, -10.5, -10, -13.5);
      ctx.clip();
      ctx.fillStyle = css(trim); ctx.fillRect(-14, -18, 28, 4.2);
      ctx.strokeStyle = css(outline(trim)); ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-14, -18); ctx.lineTo(14, -18); ctx.stroke();
      // cone highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(6, -16.5); ctx.quadraticCurveTo(4, -23.5, 0.5, -28.5); ctx.stroke();
      ctx.restore();
      if (!back) {
        // buckle star
        star4(ctx, 3, -15.9, 2.8, 0.4);
        fillStroke(ctx, css(shade(trim, 0.35)), css(outline(trim)), 0.7);
      }
      // tip star
      star4(ctx, tipX, tipY, 3, 0.38);
      fillStroke(ctx, css(trim), css(outline(trim)), 0.7);
      break;
    }
    case 'hood': {
      // front cap covering the top of the head with a trimmed rim
      ctx.beginPath();
      ctx.moveTo(-16, 8);
      ctx.ellipse(-0.5, -0.5, 16.8, 15.8, 0, Math.PI * 0.86, back ? Math.PI * 2.14 : Math.PI * 1.96, false);
      if (back) {
        ctx.quadraticCurveTo(14, 12, 0, 14); ctx.quadraticCurveTo(-14, 13, -16, 8);
      } else {
        ctx.quadraticCurveTo(12, -11, 4, -11);
        ctx.quadraticCurveTo(-5, -11, -7, -3);
        ctx.quadraticCurveTo(-9, 4, -10, 9);
        ctx.quadraticCurveTo(-13, 9, -16, 8);
      }
      ctx.closePath();
      fillStroke(ctx, hatGrad(ctx, L, -16, 16), css(outline(L.hat)), 1.1);
      if (back) {
        ctx.strokeStyle = css(shade(L.hat, -0.35), 0.6); ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(1, -2, 0, 13); ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(16, -2.6); ctx.quadraticCurveTo(12, -11, 4, -11); ctx.quadraticCurveTo(-5, -11, -7, -3); ctx.quadraticCurveTo(-9, 4, -10, 9);
        ctx.strokeStyle = css(outline(trim)); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
        ctx.strokeStyle = css(trim); ctx.lineWidth = 1.7; ctx.stroke(); ctx.lineCap = 'butt';
        ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.ellipse(-0.5, -0.5, 13.5, 12.5, 0, Math.PI * 1.15, Math.PI * 1.4); ctx.stroke();
      }
      break;
    }
    case 'circlet': {
      // A9 convention: hat = metal band color, hatTrim = gem/accent
      const band = L.hat, gemC = trim;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (back) ctx.ellipse(0, -6.5, 15.4, 2.6, 0, 0, Math.PI);
      else ctx.ellipse(0.5, -6.5, 15.2, 2.6, -0.05, 0.02 * Math.PI, 0.98 * Math.PI);
      ctx.strokeStyle = css(outline(band)); ctx.lineWidth = 3.4; ctx.stroke();
      ctx.strokeStyle = css(band); ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.lineCap = 'butt';
      if (!back) {
        // gem + little wings
        const gx = 5.2, gy = -4.1;
        ctx.beginPath();
        ctx.moveTo(gx - 6, gy - 1); ctx.quadraticCurveTo(gx - 4, gy - 5, gx - 1, gy - 2.5); ctx.closePath();
        ctx.moveTo(gx + 6, gy - 1.6); ctx.quadraticCurveTo(gx + 4, gy - 5.4, gx + 1, gy - 2.6); ctx.closePath();
        fillStroke(ctx, css(shade(band, 0.2)), css(outline(band)), 0.7);
        ctx.beginPath(); ctx.moveTo(gx, gy - 3.4); ctx.lineTo(gx + 2.4, gy); ctx.lineTo(gx, gy + 3); ctx.lineTo(gx - 2.4, gy); ctx.closePath();
        fillStroke(ctx, css(gemC), css(outline(gemC)), 0.8);
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(gx - 1, gy - 1.6, 0.9, 1.2);
        glow(ctx, gx, gy, 6, gemC, 0.35);
      }
      break;
    }
    case 'crown': {
      const metal = L.hat, jewel = trim;
      ctx.save();
      ctx.translate(-1, -11.5); ctx.rotate(back ? 0 : -0.12);
      ctx.beginPath();
      ctx.moveTo(-8.5, 1.5);
      ctx.lineTo(-9.5, -8); ctx.lineTo(-5, -4); ctx.lineTo(-2.5, -10.5); ctx.lineTo(0.5, -5);
      ctx.lineTo(3.5, -10.5); ctx.lineTo(6, -4); ctx.lineTo(10, -8); ctx.lineTo(9, 1.5);
      ctx.quadraticCurveTo(0, 3.5, -8.5, 1.5);
      ctx.closePath();
      fillStroke(ctx, vgrad(ctx, -10, 2, shade(metal, 0.35), shade(metal, -0.2)), css(outline(metal)), 1);
      ctx.fillStyle = css(shade(metal, -0.15)); ctx.fillRect(-8.6, -2, 17.4, 2.6);
      [-9.5, -2.5, 3.5, 10].forEach((x, i) => {
        const y = i === 0 || i === 3 ? -8 : -10.5;
        ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fillStyle = css(shade(metal, 0.5)); ctx.fill();
      });
      [-5, 0.5, 6].forEach((x, i) => {
        ctx.beginPath(); ctx.arc(x, -0.7, i === 1 ? 1.6 : 1.1, 0, Math.PI * 2);
        fillStroke(ctx, css(jewel), css(outline(jewel)), 0.6);
      });
      ctx.restore();
      break;
    }
    default: break;
  }
}

/** Whole head at the current transform origin (head-local), facing right. */
function drawHead(ctx: Ctx, L: CharacterLook, ex: Extras, p: Pose) {
  drawHatBack(ctx, L, p, false);
  drawFace(ctx, L, ex, p);
  const ahoge = L.hatStyle === 'none' || L.hatStyle === 'circlet' || L.hatStyle === 'crown';
  if (L.hatStyle !== 'hood') drawBangs(ctx, L, ex, p, ahoge && ex.hairStyle === 'tuft' && L.hatStyle !== 'crown');
  else {
    // a few bangs locks peeking under the hood rim
    ctx.save();
    ctx.beginPath(); ctx.rect(-12, -11, 28, 10); ctx.clip();
    drawBangs(ctx, L, ex, p, false);
    ctx.restore();
  }
  drawHatFront(ctx, L, p, false);
}

function drawHeadBack(ctx: Ctx, L: CharacterLook, ex: Extras, p: Pose) {
  if (L.hatStyle === 'hood') {
    drawHatBack(ctx, L, p, true);
    drawHatFront(ctx, L, p, true);
    return;
  }
  // back of the head: all hair
  const hairCol = ex.hairStyle === 'bald' ? L.skin : L.hair;
  ellipse(ctx, 0, -0.5, 15.2, 14.4);
  fillStroke(ctx, vgrad(ctx, -15, 14, shade(hairCol, 0.15), shade(hairCol, -0.2)), css(outline(hairCol)), 1.1);
  // ears
  ellipse(ctx, -14.6, 3, 2, 2.8); fillStroke(ctx, css(L.skin), css(outline(L.skin)), 0.9);
  ellipse(ctx, 14.6, 3, 2, 2.8); fillStroke(ctx, css(L.skin), css(outline(L.skin)), 0.9);
  if (ex.hairStyle !== 'bald') {
    // nape locks
    ctx.beginPath();
    ctx.moveTo(-13, 6); ctx.lineTo(-10, 13 + (ex.hairStyle === 'long' ? 12 : 0)); ctx.lineTo(-5, 10);
    ctx.lineTo(0, 14 + (ex.hairStyle === 'long' ? 13 : 0)); ctx.lineTo(5, 10); ctx.lineTo(10, 13 + (ex.hairStyle === 'long' ? 12 : 0)); ctx.lineTo(13, 6);
    ctx.closePath();
    fillStroke(ctx, css(shade(L.hair, -0.12)), css(outline(L.hair)), 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(0, -1, 11, 10, 0, Math.PI * 1.2, Math.PI * 1.45); ctx.stroke();
    if (ex.hairStyle === 'ponytail') drawPonytail(ctx, L, p, true);
  }
  drawHatFront(ctx, L, p, true);
}

// ───────────────────────────── full figures ─────────────────────────────

/** Full character (side or back view) at feet origin. */
export function drawCharacter(ctx: Ctx, L: CharacterLook, ex: Extras, p: Pose) {
  if (p.view === 'back') return drawBackView(ctx, L, ex, p);
  const hx = HEAD_X + p.lean * 0.6 + p.headDx, hy = HEAD_Y + p.bob + p.headDy;
  const top = BODY_TOP + p.bob;
  // hair behind everything
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(p.headTilt);
  drawHairBack(ctx, L, ex, p, false);
  ctx.restore();
  // back arm
  drawSleeve(ctx, L, p.lean - 4, top + 3.5, p.backHand[0], p.backHand[1] + p.bob, shade(L.robe, -0.22));
  drawFeet(ctx, L, p);
  drawRobe(ctx, L, p);
  // head
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(p.headTilt);
  drawHead(ctx, L, ex, p);
  ctx.restore();
  // staff + front arm
  const handX = p.hand[0], handY = p.hand[1] + p.bob;
  if (p.showStaff) drawStaff(ctx, L, handX, handY, p.staffAngle, p.gem);
  drawSleeve(ctx, L, p.lean + 3, top + 3.5, handX, handY, L.robe);
}

function drawBackView(ctx: Ctx, L: CharacterLook, ex: Extras, p: Pose) {
  const top = BODY_TOP + p.bob;
  const hy = HEAD_Y + p.bob + p.headDy;
  drawFeet(ctx, L, p, true);
  drawRobe(ctx, L, p, true);
  // staff slung on the back
  if (p.showStaff) {
    const a = 0.85;
    drawStaff(ctx, L, -2, -18 + p.bob, a, 0.3, { top: 16, bottom: 12 });
    // strap
    ctx.strokeStyle = css(shade(L.robeTrim, -0.3)); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-6, top + 2); ctx.lineTo(7, top + 16); ctx.stroke();
  }
  ctx.save(); ctx.translate(p.headDx, hy);
  drawHeadBack(ctx, L, ex, p);
  ctx.restore();
  // arms reaching up over the back of the head, hands gripping the rope
  const [lx, ly] = p.backHand, [rx, ry] = p.hand;
  drawSleeve(ctx, L, -7, top + 2, lx, ly + p.bob, shade(L.robe, -0.05));
  drawSleeve(ctx, L, 7, top + 2, rx, ry + p.bob, shade(L.robe, -0.05));
}

/** Lying on the belly, head toward +x. */
export function drawProne(ctx: Ctx, L: CharacterLook, ex: Extras, p: Pose) {
  ctx.save(); ctx.translate(-3, 0);
  drawProneInner(ctx, L, ex, p);
  ctx.restore();
}

function drawProneInner(ctx: Ctx, L: CharacterLook, ex: Extras, p: Pose) {
  const shoe = mix(shade(L.robe, -0.45), SHOE, 0.55);
  // feet
  ellipse(ctx, -24.5, -4, 2.8, 3.8, 0.3); fillStroke(ctx, css(shoe), css(outline(shoe)), 1);
  ellipse(ctx, -22, -2.8, 2.8, 3.6, 0.2); fillStroke(ctx, css(shade(shoe, -0.15)), css(outline(shoe)), 1);
  // hair tail behind
  ctx.save(); ctx.translate(12, -14); ctx.rotate(0.1);
  drawHairBack(ctx, L, ex, { ...p, hairSway: -2 }, false);
  ctx.restore();
  // robe body
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(4, -14);
    ctx.quadraticCurveTo(-10, -20, -23, -12);
    ctx.quadraticCurveTo(-27, -6, -23, -1);
    ctx.quadraticCurveTo(-10, 1, 4, -1);
    ctx.closePath();
  };
  body();
  fillStroke(ctx, vgrad(ctx, -18, 0, shade(L.robe, 0.18), shade(L.robe, -0.2)), css(outline(L.robe)), 1.2);
  ctx.save(); body(); ctx.clip();
  ctx.fillStyle = css(L.robeTrim); ctx.fillRect(-28, -20, 5.5, 24);
  ctx.fillStyle = css(shade(L.robeTrim, -0.12)); ctx.fillRect(-11, -20, 3, 24);
  ctx.strokeStyle = css(shade(L.robe, -0.45), 0.45); ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-6, -12); ctx.quadraticCurveTo(-14, -9, -20, -9); ctx.stroke();
  ctx.restore();
  // head
  ctx.save(); ctx.translate(12, -14.5); ctx.rotate(0.12);
  drawHead(ctx, L, ex, p);
  ctx.restore();
  // arm + staff stretched forward on the ground
  if (p.showStaff) drawStaff(ctx, L, 13, -3.5, Math.PI / 2 + 0.04, p.gem, { top: 8, bottom: 12 });
  drawSleeve(ctx, L, 2, -8, 13, -3.5, L.robe);
}

/** Dead: an adorable little ghost wearing the hat, with soul wisps. */
export function drawGhost(ctx: Ctx, L: CharacterLook, ex: Extras, p: Pose) {
  const cy = -44, s = p.hairSway;
  const tint = mix(0xffffff, L.robe, 0.18);
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.moveTo(-13.5, cy + 2);
  ctx.ellipse(0, cy, 14, 13.5, 0, Math.PI * 0.95, Math.PI * 2.05, false);
  ctx.quadraticCurveTo(14, cy + 14, 9 + s, cy + 21);
  ctx.quadraticCurveTo(6 + s, cy + 24, 4 + s, cy + 20);
  ctx.quadraticCurveTo(1 + s, cy + 25, -2 + s, cy + 20);
  ctx.quadraticCurveTo(-6 + s * 1.5, cy + 27, -8 + s * 2, cy + 24);
  ctx.quadraticCurveTo(-14, cy + 18, -13.5, cy + 2);
  ctx.closePath();
  const g = ctx.createRadialGradient(3, cy - 3, 2, 0, cy + 4, 22);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, css(tint));
  fillStroke(ctx, g, css(mix(L.robe, 0x8899cc, 0.6), 0.9), 1.2);
  // little arms
  ellipse(ctx, -12, cy + 9, 3, 2, -0.6); fillStroke(ctx, css(tint), css(mix(L.robe, 0x8899cc, 0.6), 0.9), 1);
  ellipse(ctx, 13, cy + 8, 3, 2, 0.6); fillStroke(ctx, css(tint), css(mix(L.robe, 0x8899cc, 0.6), 0.9), 1);
  // face
  ctx.save(); ctx.translate(0, cy);
  ctx.fillStyle = 'rgba(255,120,150,0.35)';
  ellipse(ctx, 1, 5.5, 2.4, 1.3); ctx.fill(); ellipse(ctx, 11, 5, 1.8, 1.2); ctx.fill();
  drawEye(ctx, L, 3, 1.5, 4.6, 'closed', -1);
  drawEye(ctx, L, 10, 1.1, 4, 'closed', 1);
  drawMouth(ctx, 7, 7, 'o');
  if (ex.glasses) {
    ctx.strokeStyle = 'rgba(60,40,30,0.7)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(3, 1.6, 3.8, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(10.4, 1.2, 3.2, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.rotate(-0.15);
  drawHatFront(ctx, L, { ...p, hairSway: 2, hairUp: 0 }, false);
  ctx.restore();
  ctx.restore();
  // soul wisps
  for (const [x, y, r] of [[-20, cy + 16, 3], [19, cy - 6, 2.4], [-17, cy - 14, 1.8]] as const) {
    glow(ctx, x, y, r * 3.4, L.staffGem, 0.7);
    ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
  }
}
