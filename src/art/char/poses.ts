// OWNER: A10 (art-audio). Pose tables for every player animation + the sheet frame layout.
import { pose, type Pose } from './rig';

export type PlayerAnimName = 'idle' | 'walk' | 'jump' | 'fall' | 'climb' | 'prone' | 'cast' | 'hit' | 'dead';

/** What a frame paints: a normal (side/back) pose, the prone figure, or the ghost. */
export interface FrameDef { kind: 'body' | 'prone' | 'ghost'; pose: Pose; }

export interface AnimDef {
  anim: PlayerAnimName;
  frames: FrameDef[];
  frameRate?: number;
  duration?: number;   // total ms (overrides frameRate)
  repeat: number;      // -1 = loop
}

const body = (p: Partial<Pose>): FrameDef => ({ kind: 'body', pose: pose(p) });

export const PLAYER_ANIMS: AnimDef[] = [
  {
    anim: 'idle', frameRate: 3.5, repeat: -1,
    frames: [0, 1, 2, 1].map((k, i) => body({
      bob: [0, 0.5, 1, 0.5][i], hairSway: k * 0.8, gem: 0.6 + k * 0.2,
      backHand: [-9, -16 + (i === 2 ? 0.4 : 0)],
    })),
  },
  {
    anim: 'walk', frameRate: 8, repeat: -1,
    frames: [
      body({ footF: [4, 0], footB: [-4, 0], hand: [14, -17], staffAngle: 0.2, backHand: [-10, -15], hairSway: -1, lean: 1 }),
      body({ footF: [0, 1.6], footB: [0, 0], bob: -1, hand: [13, -17], staffAngle: 0.12, backHand: [-8.5, -16], hairSway: -2, lean: 1, hemFlare: 0.5 }),
      body({ footF: [-4, 0], footB: [4, 0], hand: [12, -16], staffAngle: 0.06, backHand: [-7, -17], hairSway: -1, lean: 1 }),
      body({ footF: [0, 0], footB: [0, 1.6], bob: -1, hand: [13, -17], staffAngle: 0.12, backHand: [-8.5, -16], hairSway: -2, lean: 1, hemFlare: 0.5 }),
    ],
  },
  {
    anim: 'jump', frameRate: 1, repeat: 0,
    frames: [body({ footF: [3, 4], footB: [-2, 2.5], hemFlare: 2, hemLift: 1, bob: -1, hairUp: -0.4, mouth: 'open', hand: [14, -20], staffAngle: 0.3, backHand: [-11, -20], gem: 0.9 })],
  },
  {
    anim: 'fall', frameRate: 1, repeat: 0,
    frames: [body({ footF: [2, 2], footB: [-3, 3], hemFlare: 4, hemLift: 2.5, hairUp: 1, mouth: 'o', backHand: [-12, -24], hand: [13, -21], staffAngle: 0.35, headDy: -0.5, gem: 0.9 })],
  },
  {
    anim: 'climb', frameRate: 5, repeat: -1,
    frames: [
      body({ view: 'back', backHand: [-3, -60], hand: [3, -50], footB: [0, 3], footF: [0, 0] }),
      body({ view: 'back', backHand: [-3, -50], hand: [3, -60], footB: [0, 0], footF: [0, 3], bob: -1 }),
    ],
  },
  {
    anim: 'prone', frameRate: 1, repeat: 0,
    frames: [{ kind: 'prone', pose: pose({ gem: 0.6, hairSway: -1 }) }],
  },
  {
    anim: 'cast', duration: 350, repeat: 0,
    frames: [
      body({ bob: 1, lean: -1, hand: [8, -15], staffAngle: 0.5, backHand: [-8, -18], eyes: 'focus', mouth: 'flat', gem: 1.0, hairSway: 1, headTilt: -0.05 }),
      body({ bob: -1, hand: [14, -27], staffAngle: 0.12, backHand: [-11, -22], eyes: 'focus', mouth: 'open', gem: 2.4, hairSway: -1, hemFlare: 1, headTilt: 0.04 }),
      body({ lean: 2, hand: [13, -22], staffAngle: 0.4, backHand: [-10, -17], mouth: 'grin', gem: 1.5, hairSway: -2, footF: [2, 0], footB: [-2, 0] }),
    ],
  },
  {
    anim: 'hit', frameRate: 1, repeat: 0,
    frames: [body({ lean: -2, headDx: -1.5, headTilt: -0.18, eyes: 'hurt', mouth: 'ouch', hand: [10, -14], staffAngle: 0.4, backHand: [-11, -20], footF: [1, 0], footB: [-3, 0], hairSway: 2, gem: 0.4 })],
  },
  {
    anim: 'dead', frameRate: 1, repeat: 0,
    frames: [{ kind: 'ghost', pose: pose({ hairSway: 0 }) }],
  },
];

/** Sheet index of every frame of every anim (in PLAYER_ANIMS order). */
export const FRAME_LAYOUT: Record<PlayerAnimName, number[]> = (() => {
  const out = {} as Record<PlayerAnimName, number[]>;
  let i = 0;
  for (const a of PLAYER_ANIMS) out[a.anim] = a.frames.map(() => i++);
  return out;
})();

export const PLAYER_FRAME_COUNT = PLAYER_ANIMS.reduce((n, a) => n + a.frames.length, 0);

/** NPC idle: gentle breathing, 4 frames. */
export const NPC_IDLE: FrameDef[] = [0, 1, 2, 1].map((k, i) => body({
  bob: [0, 0.5, 1, 0.5][i], hairSway: k * 0.6, gem: 0.5 + k * 0.2,
  hand: [13, -17], staffAngle: 0.1,
}));
