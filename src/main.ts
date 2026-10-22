import Phaser from "phaser";
import { loadFonts } from "./fonts";
import { BASE_H, GAME_W } from "./layout";
import { BootScene } from "./scenes/Boot";
import { BattleScene } from "./scenes/Battle";
import { UIScene } from "./scenes/UI";
import { persist } from "./systems/save";

loadFonts().then(() => {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#171a45",
    // EXPAND keeps the 1080x1920 layout and grows the height to fill taller phones
    scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH, width: GAME_W, height: BASE_H },
    input: { activePointers: 2 },
    scene: [BootScene, BattleScene, UIScene],
  });

  // Rebuild the layout when the screen height changes noticeably (e.g. rotating a tablet).
  let lastH = 0;
  let timer = 0;
  game.scale.on("resize", (size: Phaser.Structs.Size) => {
    if (!lastH) lastH = size.height;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (Math.abs(game.scale.height - lastH) < 40) return;
      lastH = game.scale.height;
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
