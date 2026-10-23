import Phaser from "phaser";
import { loadFonts } from "./fonts";
import { BASE_H, GAME_W } from "./layout";
import { BootScene } from "./scenes/Boot";
import { BattleScene } from "./scenes/Battle";
import { UIScene } from "./scenes/UI";
import { persist } from "./systems/save";

/**
 * The game is always 1080 wide. Taller phones get extra height (up to a limit); anything
 * wider than a phone shows the game as a centred column with borders on the sides.
 */
const heightFor = () => Math.round(Phaser.Math.Clamp((GAME_W * window.innerHeight) / Math.max(1, window.innerWidth), BASE_H, 2400));

loadFonts().then(() => {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#4a2f1d",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: GAME_W, height: heightFor() },
    input: { activePointers: 2 },
    scene: [BootScene, BattleScene, UIScene],
  });
  // handy for automated tests and debugging in the browser console
  (window as unknown as { game: Phaser.Game }).game = game;

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
});
