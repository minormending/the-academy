/** Entry point. Owned by the lead. */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, GRAVITY } from './core/constants';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { startGamepadBridge } from './systems/GamepadBridge';
import { gameLogicalWidth, onMobileLayoutChanged } from './ui/mobile';

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
  // Phones in landscape get a canvas as wide as the device aspect (no letterbox bars); desktop stays 1280×720.
  width: gameLogicalWidth() || GAME_WIDTH,
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

// Re-fit the logical width when the phone rotates or the viewport changes (desktop always resolves to 1280).
{
  let timer = 0;
  const refit = () => {
    const w = gameLogicalWidth() || GAME_WIDTH;
    if (game.isBooted && game.scale && (game.scale.width !== w || game.scale.height !== GAME_HEIGHT)) game.scale.setGameSize(w, GAME_HEIGHT);
  };
  // Mobile browsers report the new size a beat after resize/orientationchange: refit now and once more shortly after.
  const schedule = () => { refit(); clearTimeout(timer); timer = window.setTimeout(refit, 250); };
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  onMobileLayoutChanged(schedule);
  game.events.once(Phaser.Core.Events.READY, schedule);
}

// Controllers drive the game through synthetic key events (see GamepadBridge for the mapping).
startGamepadBridge();
