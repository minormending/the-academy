/** Entry point. Owned by the lead. */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, GRAVITY } from './core/constants';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';

// All 2D canvases in this game are offscreen art-generation surfaces that we read back with getImageData
// (palette swaps, outlines, pixelization). Default them to CPU-backed storage: faster reads and no
// "willReadFrequently" console warnings. Explicit options passed by callers still win.
{
  const orig = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, id: string, opts?: unknown) => RenderingContext | null;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, opts?: unknown) {
    if (id === '2d') return orig.call(this, id, { willReadFrequently: true, ...(opts as object | undefined) });
    return orig.call(this, id, opts);
  } as typeof HTMLCanvasElement.prototype.getContext;
}

const debug = new URLSearchParams(location.search).has('debug');

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0b0d16',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: GRAVITY }, debug, fixedStep: false } },
  pixelArt: true,
  render: { antialias: false, roundPixels: true },
  disableContextMenu: true,
  scene: [BootScene, TitleScene, GameScene],
});
(window as unknown as { game: Phaser.Game }).game = game;
