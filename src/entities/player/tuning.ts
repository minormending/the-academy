// OWNER: A1 (player). Movement / feel tuning constants.

export const PT = {
  /** Fallbacks when progression stats are unavailable. */
  defaultSpeed: 200,
  defaultJump: 560,

  /** Feet are drawn this many px above the bottom edge of the frame (80px frame -> feet at y=78). */
  feetInsetFromBottom: 2,

  maxVx: 650,
  maxVy: 900,

  coyoteMs: 80,
  jumpBufferMs: 100,
  /** Holding jump re-jumps on landing (Maple style) after this gap since the last jump. */
  autoJumpGapMs: 140,

  /** Air steering: acceleration toward the held direction and the minimum cap (fraction of walk speed). */
  airAccel: 520,
  airSteerFrac: 0.4,

  dropThroughMs: 250,
  dropThroughVy: 60,
  /** One-way landing slack (px) on top of the platform surface for the "was above last frame" test. */
  oneWaySlack: 6,

  climbSpeed: 140,
  ropeTolX: 16,
  /** Down grabs a rope when its top is within this many px of the feet. */
  ropeTopGrabTol: 12,
  ropeRegrabMs: 250,
  ropeHopVxFrac: 0.7,
  ropeHopVyFrac: 0.6,

  hitKnockVx: 220,
  hitKnockVy: -250,
  hitLockMs: 350,
  iFramesMs: 1500,
  hitGroundDecel: 900,
  hitTintMs: 140,
  reviveIFramesMs: 2000,

  blinkMargin: 20,
  blinkStep: 6,
  blinkFlashMs: 160,

  /** Fall distance (px from the apex of the airtime) that counts as a hard landing. */
  hardLandFall: 170,
  hardLandVy: 760,

  /** Respawn if feet go this far below the map. */
  fallOutMargin: 100,
} as const;
