import Phaser from "phaser";
import { makeCloudTextures } from "../art/background";
import { makeCharacterTextures } from "../art/characters";
import { makeCardTextures, makeDiceTextures, makeIconTextures } from "../art/ui";

/**
 * Draws all the game art with code (canvas), so the game needs no image files.
 * To use real artwork later, load images under the same texture keys instead.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    makeIconTextures(this);
    makeCharacterTextures(this);
    makeCardTextures(this);
    makeDiceTextures(this);
    makeCloudTextures(this);
    this.scene.start("Battle");
    this.scene.launch("UI");
  }
}
