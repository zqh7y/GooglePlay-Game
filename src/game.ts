import Phaser from "phaser";
import { PET_H, PET_SIZE, drawPet } from "./art/pets";
import { ITEMS } from "./data/items";
import { BASE_H, GAME_W } from "./layout";
import { BootScene } from "./scenes/Boot";
import { BattleScene } from "./scenes/Battle";
import { UIScene } from "./scenes/UI";
import { persist, save } from "./systems/save";

export { persist, save };
export { music } from "./systems/sound";

/**
 * The game is always 1080 wide. Taller phones get extra height (up to a limit); anything
 * wider than a phone shows the game as a centred column with borders on the sides.
 */
const heightFor = () => Math.round(Phaser.Math.Clamp((GAME_W * window.innerHeight) / Math.max(1, window.innerWidth), BASE_H, 2400));

/**
 * Starts the game. `progress` hears how far it got (0.6 booted, 0.8 the world is built, 1 the
 * screens are ready); the promise resolves once the screens are ready.
 */
/**
 * Speed: Phaser redraws a text's whole texture on setColor / setFontSize / setStroke even when
 * nothing changed, and the HUD calls them every frame. Skip the redraw when the value is the same.
 */
function cheapTextUpdates(): void {
  const T = Phaser.GameObjects.Text.prototype;
  const setColor = T.setColor;
  T.setColor = function (this: Phaser.GameObjects.Text, color: string | CanvasGradient | CanvasPattern) {
    return typeof color === "string" && this.style.color === color ? this : setColor.call(this, color);
  };
  const setFontSize = T.setFontSize;
  T.setFontSize = function (this: Phaser.GameObjects.Text, size: number | string) {
    const css = typeof size === "number" ? `${size}px` : size;
    return this.style.fontSize === css ? this : setFontSize.call(this, size);
  };
  const setStroke = T.setStroke;
  T.setStroke = function (this: Phaser.GameObjects.Text, color: string | CanvasGradient | CanvasPattern, thickness: number) {
    return typeof color === "string" && this.style.stroke === color && this.style.strokeThickness === thickness ? this : setStroke.call(this, color, thickness);
  };
}

export function startGame(progress: (f: number) => void = () => {}): { game: Phaser.Game; ready: Promise<void> } {
  cheapTextUpdates();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    // ask for the fast GPU and draw more sprites per batch (fewer draw calls)
    render: { powerPreference: "high-performance" },
    parent: "game",
    backgroundColor: "#4a2f1d",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: GAME_W, height: heightFor() },
    input: { activePointers: 2 },
    scene: [BootScene, BattleScene, UIScene],
  });
  // handy for automated tests and debugging in the browser console
  (window as unknown as { game: Phaser.Game }).game = game;
  const ready = new Promise<void>((res) => game.events.once("ui-ready", res));
  game.events.once(Phaser.Core.Events.READY, () => {
    progress(0.6);
    game.scene.getScene("Battle").events.once(Phaser.Scenes.Events.CREATE, () => progress(0.8));
  });
  void ready.then(() => progress(1));

  // Rebuild the layout when the screen shape changes noticeably (e.g. rotating a tablet).
  let timer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const h = heightFor();
      if (Math.abs(h - game.scale.height) < 40) return;
      game.scale.setGameSize(GAME_W, h);
      if (game.scene.isActive("Battle")) {
        game.scene.getScene("Battle").scene.restart();
        game.scene.getScene("UI").scene.restart();
      }
    }, 300);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) persist();
  });
  return { game, ready };
}

/** The three friends the story's dice turn into: a common, a rare and a very rare pet. */
export const STORY_PETS = ["puppy", "baby_dragon", "galaxy_fox"];

/** A pet drawn on its own canvas (twice the usual size, so it stays sharp up close). */
export function petPicture(id: string): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = PET_SIZE * 2;
  cv.height = PET_H * 2;
  const c = cv.getContext("2d")!;
  c.scale(2, 2);
  drawPet(c, ITEMS[id] ?? Object.values(ITEMS)[0], 0);
  return cv;
}
