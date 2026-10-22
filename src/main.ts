import Phaser from "phaser";
import { BootScene } from "./scenes/Boot";
import { BattleScene } from "./scenes/Battle";
import { UIScene } from "./scenes/UI";

export const WIDTH = 720;
export const HEIGHT = 1280;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#0f1020",
  width: WIDTH,
  height: HEIGHT,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [BootScene, BattleScene, UIScene],
});
