import Phaser from "phaser";
import { makePetalTexture } from "../art/world";
import { makeCharacterTextures } from "../art/characters";
import { makeCardTextures, makeIconTextures } from "../art/ui";

/**
 * Draws the shared game art with code (canvas), so the game needs no image files.
 * Pets, dice and the map are drawn later, the first time they are needed.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    makeIconTextures(this);
    makeCharacterTextures(this);
    makeCardTextures(this);
    makePetalTexture(this);
    this.scene.start("Battle");
    this.scene.launch("UI");
  }
}
