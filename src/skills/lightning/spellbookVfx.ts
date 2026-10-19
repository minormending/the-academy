// Phase 9 silhouettes: integer source pixels at x2; optional existing CC0 sheets are lazy pxFx accents.
import Phaser from 'phaser';
import { pxFx } from '../../art/particles';
import { DEPTH } from '../../core/constants';
import type { VfxFn } from '../../core/types';
import { C, loopWhileAlive } from './fx';

type G = Phaser.GameObjects.Graphics;
type Point = readonly [number, number];

function path(g: G, points: readonly Point[], color: number = C.yellow, width = 1): void {
  g.fillStyle(color, 1);
  for (let i = 1; i < points.length; i++) {
    let x = Math.round(points[i - 1][0]), y = Math.round(points[i - 1][1]);
    const tx = Math.round(points[i][0]), ty = Math.round(points[i][1]);
    const dx = Math.abs(tx - x), dy = -Math.abs(ty - y), sx = x < tx ? 1 : -1, sy = y < ty ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      g.fillRect(x - Math.floor(width / 2), y - Math.floor(width / 2), width, width);
      if (x === tx && y === ty) break;
      const e = err * 2;
      if (e >= dy) { err += dy; x += sx; }
      if (e <= dx) { err += dx; y += sy; }
    }
  }
}

function wire(g: G, points: readonly Point[], color: number = C.yellow): void {
  path(g, points, C.gloom, 3);
  path(g, points, color);
}

function diamond(g: G, x: number, y: number, r: number, color: number = C.yellow): void {
  wire(g, [[x - r, y], [x, y - r], [x + r, y], [x, y + r], [x - r, y]], color);
}

function art(scene: Phaser.Scene, x: number, y: number, paint: (g: G) => void): G {
  const g = scene.add.graphics().setPosition(Math.round(x), Math.round(y)).setScale(2).setDepth(DEPTH.VFX);
  paint(g);
  return g;
}

/** One-shots animate alpha only, preserving the 2px grid. Destruction cancels their tween. */
function fade(scene: Phaser.Scene, g: G, duration = 260, delay = 0): void {
  if (delay) g.setVisible(false);
  const tw = scene.tweens.add({
    targets: g, alpha: 0, delay, duration,
    onStart: () => { if (g.active) g.setVisible(true); }, onComplete: () => g.destroy(),
  });
  g.once(Phaser.GameObjects.Events.DESTROY, () => tw.remove());
}

/** Persistent art always faces +x; the engine/custom owner handles facing and lifetime. */
function body(scene: Phaser.Scene, x: number, y: number, paint: (g: G) => void): Phaser.GameObjects.Container {
  const ink = art(scene, 0, 0, paint);
  const root = scene.add.container(Math.round(x), Math.round(y), [ink]).setDepth(DEPTH.VFX);
  loopWhileAlive(scene, root, { targets: ink, alpha: 0.55, duration: 320, yoyo: true, repeat: -1 });
  return root;
}

export const brandStamp: VfxFn = (scene, o) => {
  const ink = art(scene, o.x, o.y, g => {
    // Broken target brackets around a + / - ion sigil: low-damage setup rather than an explosion.
    for (const s of [-1, 1]) wire(g, [[s * 6, -22], [s * 12, -22], [s * 12, 22], [s * 6, 22]], C.violet);
    diamond(g, 0, 0, 9);
    path(g, [[-4, -13], [4, -13]], C.white);
    path(g, [[0, 10], [0, 16]], C.white);
    path(g, [[-3, 13], [3, 13]], C.white);
  });
  fade(scene, ink, 600);
  pxFx(scene, 'g9_spark', o.x, o.y, { v: 'ltn', scale: 2, dur: 260, alpha: 0.5 });
};

export const groundingSealBody: VfxFn = (scene, o) => body(scene, o.x, o.y, g => {
  const base = Math.round(((o.groundY ?? o.y + 32) - o.y) / 2);
  // Broad grounding plates and short copper prongs, rooted at the caster's feet line.
  wire(g, [[-44, base - 3], [-35, base + 2], [35, base + 2], [44, base - 3]], C.violet);
  for (const x of [-32, 0, 32]) {
    wire(g, [[x - 6, base], [x - 6, base - 5], [x, base - 5], [x, base - 19], [x + 4, base - 24]]);
    diamond(g, x, base - 24, 3, C.white);
  }
});

export const groundingSealPulse: VfxFn = (scene, o) => {
  const w = Math.round((o.w ?? 180) / 4), h = Math.round((o.h ?? 96) / 4);
  for (let i = 0; i < 2; i++) {
    const ink = art(scene, o.x, o.y, g => {
      wire(g, [[-w, h], [-w, -h], [w, -h], [w, h]], C.violet);
      for (let x = -w + 8; x < w; x += 16) {
        wire(g, [[x, h], [x - 4, 4], [x + 4, -4], [x, -h]], i ? C.white : C.yellow);
      }
    });
    fade(scene, ink, 160, i * 60);
  }
};

export const circuitBreak: VfxFn = (scene, o) => {
  const tx = o.targetX ?? o.x + o.facing * 160, ty = o.targetY ?? o.y;
  const dx = Math.round((tx - o.x) / 2), dy = Math.round((ty - o.y) / 2);
  const ink = art(scene, o.x, o.y, g => {
    for (const s of [-1, 1]) {
      const points: Point[] = [[0, s * 3], [Math.round(dx / 3), Math.round(dy / 3) + s * 6],
        [Math.round(dx * 2 / 3), Math.round(dy * 2 / 3) - s * 5], [dx, dy]];
      wire(g, points, s === 1 ? C.yellow : C.violet);
    }
    // Opening switch at the target signals that shock was cashed in.
    wire(g, [[dx - 9, dy + 7], [dx - 9, dy - 7], [dx - 2, dy - 7], [dx + 9, dy - 16]], C.white);
    wire(g, [[dx + 9, dy - 5], [dx + 9, dy + 7]], C.yellow);
  });
  fade(scene, ink, 300);
};

export const dynamoExchange: VfxFn = (scene, o) => {
  const ink = art(scene, o.x, o.y, g => {
    // Heart into battery, connected by a stepped arrow; magenta HP, yellow stored charge.
    wire(g, [[-24, -31], [-28, -35], [-33, -35], [-36, -31], [-36, -27], [-24, -16],
      [-12, -27], [-12, -31], [-15, -35], [-20, -35], [-24, -31]], C.violet);
    wire(g, [[-8, -25], [8, -25], [3, -30], [8, -25], [3, -20]], C.white);
    wire(g, [[17, -38], [27, -38], [27, -34], [32, -34], [32, -14], [12, -14], [12, -34], [17, -34], [17, -38]]);
    for (const y of [-19, -25, -31]) path(g, [[17, y], [27, y]], C.white, 2);
  });
  fade(scene, ink, 650);
};

function skateEndpoint(arrive: boolean): VfxFn {
  return (scene, o) => {
    const ink = art(scene, o.x, o.y, g => {
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 9;
        wire(g, [[x - 12, -33], [x + 2, -22], [x - 4, -14], [x + 9, -3]], arrive ? C.yellow : C.violet);
      }
      wire(g, [[-15, 1], [15, 1], [21, -3]], C.white);
    });
    ink.scaleX = 2 * o.facing;
    fade(scene, ink, arrive ? 320 : 220);
  };
}
export const skateDepart = skateEndpoint(false);
export const skateArrive = skateEndpoint(true);

export const skateTrail: VfxFn = (scene, o) => {
  const length = Math.round(Math.abs((o.targetX ?? o.x) - o.x) / 2);
  const ink = art(scene, o.x, o.y, g => {
    for (const y of [-12, 0, 12]) {
      for (let x = 0; x < length; x += 18) {
        const end = Math.min(length, x + 16);
        wire(g, [[x, y], [Math.min(end, x + 6), y - 3], [end, y]], y ? C.violet : C.white);
      }
    }
  });
  ink.scaleX = 2 * o.facing;
  fade(scene, ink, 400);
};

export const channelFocus: VfxFn = (scene, o) => body(scene, o.x, o.y, g => {
  for (const x of [-6, 6]) {
    wire(g, [[x - 3, -18], [x + 3, -18], [x + 3, 18], [x - 3, 18], [x - 3, -18]], C.violet);
    for (const y of [-12, -4, 4, 12]) wire(g, [[x - 4, y], [x + 4, y]]);
  }
  wire(g, [[10, -10], [20, 0], [10, 10]], C.white);
});

export const channelArc: VfxFn = (scene, o) => {
  const length = Math.round(Math.abs((o.targetX ?? o.x + o.facing * 460) - o.x) / 2);
  const ink = art(scene, o.x, o.y, g => {
    // A narrow interlaced double helix, distinct from the solid lance and the ultimate's rails.
    for (const s of [-1, 1]) {
      const points: Point[] = [[0, s * 7]];
      for (let x = 12, i = 0; x < length; x += 12, i++) points.push([x, s * (i % 2 ? -7 : 7)]);
      points.push([length, 0]);
      wire(g, points, s > 0 ? C.white : C.yellow);
    }
  });
  ink.scaleX = 2 * o.facing;
  fade(scene, ink, 180);
};

function lattice(g: G, w: number, h: number): void {
  wire(g, [[-w, -h], [w, -h], [w, h], [-w, h], [-w, -h]], C.violet);
  for (const x of [-w, w]) for (const y of [-h, h]) diamond(g, x, y, 5);
}

export const circuitLattice: VfxFn = (scene, o) => body(scene, o.x, o.y, g => {
  const w = Math.round((o.w ?? 360) / 4), h = Math.round((o.h ?? 160) / 4);
  lattice(g, w, h);
  // Corner pylons plus sparse circuit traces keep monsters readable inside the field.
  for (const x of [-w, w]) {
    wire(g, [[x, h], [x, h - 15], [x + (x < 0 ? 6 : -6), h - 20]]);
  }
  for (let x = -w + 12; x < w; x += 24) path(g, [[x, h], [x + 6, h]], C.yellow);
});

export const circuitPulse: VfxFn = (scene, o) => {
  const w = Math.round((o.w ?? 360) / 4), h = Math.round((o.h ?? 160) / 4);
  const ink = art(scene, o.x, o.y, g => {
    lattice(g, w, h);
    for (let x = -w; x <= w; x += 18) {
      wire(g, [[x, -h], [x + 4, -10], [x - 4, 10], [x, h]], C.yellow);
    }
    for (const y of [-20, 20]) wire(g, [[-w, y], [w, y]], C.violet);
  });
  fade(scene, ink, 250);
};

export const reprisalAegis: VfxFn = (scene, o) => body(scene, o.x, o.y, g => {
  // Two hooked storm talons face outward, framing the mage rather than hiding the body.
  for (const s of [-1, 1]) {
    wire(g, [[s * 10, -39], [s * 22, -33], [s * 25, -17], [s * 17, -10], [s * 22, -22], [s * 10, -30]], C.violet);
    wire(g, [[s * 22, -33], [s * 19, -23], [s * 14, -19]], C.yellow);
  }
  diamond(g, 0, -43, 4, C.white);
});

export const reprisalFangs: VfxFn = (scene, o) => {
  const w = Math.round((o.w ?? 340) / 4), h = Math.round((o.h ?? 200) / 4);
  for (let i = 0; i < 5; i++) {
    const ink = art(scene, o.x, o.y, g => {
      for (const s of [-1, 1]) {
        const x = Math.round((w - 8) * s), y = Math.round((i - 2) * h / 3);
        wire(g, [[s * 8, y - 8], [x, y - 12], [x - s * 12, y + 10], [x - s * 8, y - 3]], i % 2 ? C.white : C.yellow);
      }
    });
    fade(scene, ink, 150, i * 45);
  }
};
