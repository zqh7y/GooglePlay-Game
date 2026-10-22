import Phaser from "phaser";
import { BootScene } from "./scenes/Boot";
import { HubScene } from "./scenes/Hub";
import { DiceScene } from "./scenes/Dice";
import { InventoryScene } from "./scenes/Inventory";
import { GameScene } from "./scenes/Game";

export const WIDTH = 720;
export const HEIGHT = 1280;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#0f1020",
  width: WIDTH,
  height: HEIGHT,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: "arcade", arcade: { debug: false } },
  input: { activePointers: 2 },
  scene: [BootScene, HubScene, DiceScene, InventoryScene, GameScene],
});
