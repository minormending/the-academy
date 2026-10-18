// Academy additions: hard-edged art drawn in source pixels and displayed at exactly x2.
// Sheet accents use the existing CC0 storm palette; every silhouette also works without sheets.
import Phaser from 'phaser';
import { pxFx } from '../../art/particles';
import { DEPTH } from '../../core/constants';
import type { VfxFn } from '../../core/types';
import { C, loopWhileAlive } from './fx';

type G = Phaser.GameObjects.Graphics;
type Point = readonly [number, number];

/** Integer Bresenham strokes, with no antialiased paths or fractional source pixels. */
function stroke(g: G, from: Point, to: Point, color: number, width = 1): void {
  let x = Math.round(from[0]), y = Math.round(from[1]);
  const tx = Math.round(to[0]), ty = Math.round(to[1]);
  const dx = Math.abs(tx - x), dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1, sy = y < ty ? 1 : -1;
  let err = dx + dy;
  g.fillStyle(color, 1);
  for (;;) {
    g.fillRect(x - Math.floor(width / 2), y - Math.floor(width / 2), width, width);
    if (x === tx && y === ty) break;
    const e = 2 * err;
    if (e >= dy) { err += dy; x += sx; }
    if (e <= dx) { err += dx; y += sy; }
  }
}

function path(g: G, points: readonly Point[], color = C.yellow, width = 1): void {
  for (let i = 1; i < points.length; i++) stroke(g, points[i - 1], points[i], color, width);
}

function arc(g: G, rx: number, ry: number, color: number, cy = 0): void {
  const points: Point[] = Array.from({ length: 33 }, (_, i) => {
    const a = i * Math.PI / 16;
    return [Math.round(Math.cos(a) * rx), cy + Math.round(Math.sin(a) * ry)];
  });
  path(g, points, C.deepViolet, 3);
  path(g, points, color);
}

function layer(scene: Phaser.Scene, x: number, y: number, paint: (g: G) => void): G {
  const g = scene.add.graphics().setPosition(Math.round(x), Math.round(y)).setScale(2).setDepth(DEPTH.VFX);
  paint(g);
  return g;
}

/** All one-shots own their fade and destroy; early destruction also cancels the tween. */
function fade(scene: Phaser.Scene, g: G, ms = 280, delay = 0): void {
  if (delay) g.setVisible(false);
  const tween = scene.tweens.add({
    targets: g, alpha: 0, duration: ms, delay,
    onStart: () => { if (g.active) g.setVisible(true); },
    onComplete: () => g.destroy(),
  });
  g.once('destroy', () => tween.remove());
}

function accent(scene: Phaser.Scene, x: number, y: number, id = 'g9_spark'): void {
  // Optional sheet only: the accompanying source-pixel geometry is the fallback.
  pxFx(scene, id, Math.round(x), Math.round(y), { v: 'ltn', scale: 2, dur: 280, alpha: 0.65 });
}

export const needleCast: VfxFn = (scene, o) => {
  const g = layer(scene, o.x, o.y, (g) => {
    path(g, [[-9, 0], [0, -8], [9, 0], [0, 8], [-9, 0]], C.violet);
    path(g, [[-6, 0], [14, 0]], C.yellow, 3);
    path(g, [[0, -4], [0, 4]], C.white);
  });
  g.scaleX = 2 * o.facing;
  fade(scene, g, 180);
  accent(scene, o.x, o.y);
};

/** Persistent projectile: tip at +x, tail at -x; no root scale/position animation. */
export const needleProj: VfxFn = (scene) => {
  const tail = layer(scene, 0, 0, (g) => {
    path(g, [[-26, 0], [-18, -3], [-11, 1], [-5, -2], [7, 0]], C.deepViolet, 3);
    path(g, [[-22, 0], [-15, -2], [-9, 1], [7, 0]], C.violet);
    path(g, [[-9, 0], [8, 0], [2, -3], [8, 0], [2, 3]], C.yellow);
    path(g, [[-4, 0], [8, 0]], C.white);
  });
  const owner = scene.add.container(0, 0, [tail]).setDepth(DEPTH.VFX);
  loopWhileAlive(scene, owner, { targets: tail, alpha: 0.6, duration: 90, yoyo: true, repeat: -1 });
  return owner;
};

export const repulsionArea: VfxFn = (scene, o) => {
  const rx = Math.round((o.w ?? 300) / 4), ry = Math.round((o.h ?? 180) / 4);
  for (let i = 0; i < 3; i++) {
    const g = layer(scene, o.x, o.y, (g) => {
      arc(g, rx - (2 - i) * 12, ry - (2 - i) * 7, i === 1 ? C.white : C.yellow);
      for (const side of [-1, 1]) {
        path(g, [[side * (rx - 24), -4], [side * (rx - 16), 0], [side * (rx - 24), 4]], C.violet, 2);
      }
    });
    fade(scene, g, 230, i * 65);
  }
};

function shield(g: G): void {
  const frame: Point[] = [[0, -39], [17, -29], [15, -11], [0, -1], [-15, -11], [-17, -29], [0, -39]];
  path(g, frame, C.gloom, 3);
  path(g, frame, C.violet);
  path(g, [[-12, -31], [-15, -27], [-13, -20]], C.yellow);
  path(g, [[12, -31], [15, -27], [13, -20]], C.yellow);
  path(g, [[-7, -10], [0, -5], [7, -10]], C.yellow);
}

export const wardCast: VfxFn = (scene, o) => {
  const g = layer(scene, o.x, o.y, (g) => {
    shield(g);
    path(g, [[2, -31], [-3, -23], [3, -23], [-2, -14]], C.white, 2);
  });
  fade(scene, g, 420);
  accent(scene, o.x, o.y - 40, 'cm_shield');
};

/** Persistent feet-anchored shield; all looping animation belongs to the returned root. */
export const wardAura: VfxFn = (scene) => {
  const shell = layer(scene, 0, 0, shield);
  const owner = scene.add.container(0, 0, [shell]).setDepth(DEPTH.VFX);
  loopWhileAlive(scene, owner, { targets: shell, alpha: 0.4, duration: 650, yoyo: true, repeat: -1 });
  return owner;
};

export const liveWireSigil: VfxFn = (scene, o) => {
  const g = layer(scene, o.x - 24 * o.facing, o.y + 12, (g) => {
    for (let i = 0; i < 3; i++) {
      path(g, [[-12 + i * 7, -4], [-8 + i * 7, 0], [-12 + i * 7, 4]], i === 2 ? C.yellow : C.violet);
    }
  });
  g.scaleX = 2 * o.facing;
  fade(scene, g, 240);
};

export const capacitorArc: VfxFn = (scene, o) => {
  for (let i = 0; i < 3; i++) {
    const g = layer(scene, o.x, o.y, (g) => {
      const y = (i - 1) * 12;
      const curve: Point[] = [[-42, y], [-20, y - 7], [0, y - 9], [20, y - 5], [42, y + 6]];
      path(g, curve, C.deepViolet, 4);
      path(g, curve, C.yellow, 2);
      path(g, curve, C.white);
      path(g, [[34, y - 1], [42, y + 6], [29, y + 7]], C.violet);
    });
    g.scaleX = 2 * o.facing;
    fade(scene, g, 220, i * 55);
  }
};

export const reversalCast: VfxFn = (scene, o) => {
  const g = layer(scene, o.x, o.y, (g) => {
    arc(g, 24, 10, C.violet, -5);
    path(g, [[-8, -28], [-8, -12], [8, -12], [8, -28], [-8, -28]], C.deepViolet, 3);
    path(g, [[-8, -28], [-8, -12], [8, -12], [8, -28], [-8, -28]], C.yellow);
    path(g, [[-4, -17], [4, -17], [-4, -21], [4, -21], [-4, -25], [4, -25]], C.white);
    for (const side of [-1, 1]) {
      path(g, [[side * 18, -9], [side * 18, -27], [side * 14, -21], [side * 18, -27], [side * 22, -21]], C.yellow);
    }
  });
  fade(scene, g, 650);
  accent(scene, o.x, o.y - 40);
};

function relayFx(arriving: boolean): VfxFn {
  return (scene, o) => {
    const g = layer(scene, o.x, o.y, (g) => {
      for (const side of [-1, 1]) {
        path(g, [[side * 7, -40], [side * 18, -32], [side * 11, -19], [side * 18, -9], [side * 7, 0]], C.deepViolet, 3);
        path(g, [[side * 7, -40], [side * 18, -32], [side * 11, -19], [side * 18, -9], [side * 7, 0]], arriving ? C.yellow : C.violet);
      }
      path(g, [[0, -35], [-4, -21], [4, -21], [0, -7]], C.white);
      for (let i = 0; i < 3; i++) {
        const x = (arriving ? 1 : -1) * (22 + i * 7);
        path(g, [[x, -31], [x + 4, -26], [x, -21]], C.violet);
      }
    });
    g.scaleX = 2 * o.facing;
    fade(scene, g, arriving ? 320 : 220);
    accent(scene, o.x, o.y - 36);
  };
}

export const relayOut = relayFx(false);
export const relayIn = relayFx(true);

export const relayArrival: VfxFn = (scene, o) => {
  const g = layer(scene, o.x, o.y, (g) => {
    arc(g, 48, 35, C.violet);
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      const x = Math.round(Math.cos(a) * 46), y = Math.round(Math.sin(a) * 33);
      path(g, [[0, 0], [Math.round(x / 2) - 4, Math.round(y / 2)], [Math.round(x / 2) + 4, Math.round(y / 2) - 3], [x, y]], C.yellow);
    }
  });
  fade(scene, g, 350);
};

export const judgmentCage: VfxFn = (scene, o) => {
  const cage = layer(scene, o.x, o.y, (g) => {
    for (const side of [-1, 1]) {
      path(g, [[side * 7, -36], [side * 17, -36], [side * 17, 36], [side * 7, 36]], C.deepViolet, 3);
      path(g, [[side * 7, -36], [side * 17, -36], [side * 17, 36], [side * 7, 36]], C.violet);
    }
  });
  fade(scene, cage, 500);
  // Eight discrete scratches match the eight independently rolled damage lines.
  for (let i = 0; i < 8; i++) {
    const g = layer(scene, o.x, o.y, (g) => {
      const side = i % 2 ? -1 : 1, y = (i % 4 - 2) * 4;
      const cut: Point[] = [[-18 * side, -24 + y], [-4 * side, -3 + y], [5 * side, -9 + y], [18 * side, 25 + y]];
      path(g, cut, C.deepViolet, 3);
      path(g, cut, i % 2 ? C.white : C.yellow);
    });
    fade(scene, g, 130, i * 45);
  }
  accent(scene, o.x, o.y);
};

export const railCharge: VfxFn = (scene, o) => {
  const g = layer(scene, o.x, o.y, (g) => {
    arc(g, 17, 17, C.yellow);
    arc(g, 24, 24, C.violet);
    for (const side of [-1, 1]) {
      path(g, [[-42, side * 22], [-22, side * 12], [-7, 0]], C.white);
    }
  });
  g.scaleX = 2 * o.facing;
  fade(scene, g, 300);
  accent(scene, o.x, o.y);
};

export const railBeam: VfxFn = (scene, o) => {
  const length = Math.max(1, Math.round(Math.abs((o.targetX ?? o.x + o.facing * 820) - o.x) / 2));
  const g = layer(scene, o.x, o.y, (g) => {
    // Twin rails and square induction coils give this a different silhouette from Spark Lance.
    for (const y of [-9, 9]) {
      path(g, [[0, y], [length, y]], C.deepViolet, 5);
      path(g, [[0, y], [length, y]], C.violet, 3);
      path(g, [[0, y], [length, y]], C.yellow);
    }
    path(g, [[0, 0], [length, 0]], C.yellow, 5);
    path(g, [[0, 0], [length, 0]], C.white, 2);
    for (let x = 12; x < length; x += 24) {
      path(g, [[x - 3, -15], [x + 3, -15], [x + 3, 15], [x - 3, 15]], C.yellow);
    }
    path(g, [[length - 14, -17], [length, 0], [length - 14, 17]], C.white, 2);
  });
  g.scaleX = 2 * o.facing;
  // Damage begins after the 300ms charge; the rail persists through all twelve lines.
  fade(scene, g, 700, 300);
};

export const conductorSigil: VfxFn = (scene, o) => {
  const g = layer(scene, o.x, o.y - 26, (g) => {
    path(g, [[0, -9], [9, 0], [0, 9], [-9, 0], [0, -9]], C.deepViolet, 3);
    path(g, [[0, -9], [9, 0], [0, 9], [-9, 0], [0, -9]], C.yellow);
    path(g, [[0, -5], [0, 5]], C.white);
    path(g, [[-5, 0], [5, 0]], C.white);
  });
  fade(scene, g, 360);
};
