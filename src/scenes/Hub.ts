import Phaser from "phaser";
import { MAX_EQUIPPED, persist, resetSave, save } from "../systems/save";
import { button, coinLabel, itemCard, text, updateRainbow } from "../ui/widgets";
import { formatTime } from "./Game";

export class HubScene extends Phaser.Scene {
  private cards: Phaser.GameObjects.Container[] = [];

  constructor() {
    super("Hub");
  }

  create(): void {
    const W = this.scale.width;
    this.add.tileSprite(0, 0, W, this.scale.height, "grid").setOrigin(0).setAlpha(0.6);

    coinLabel(this, W - 30, 50).setText(`🪙 ${save.coins.toLocaleString()}`);

    const die = this.add.image(W / 2, 220, "face5").setTint(0xc08552).setScale(0.9);
    this.tweens.add({ targets: die, angle: 360, duration: 6000, repeat: -1 });
    this.tweens.add({ targets: die, y: 200, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    text(this, W / 2, 360, "DICE SURVIVOR", 68, "#fde047");

    // Equipped weapons
    text(this, W / 2, 450, `Equipped (${save.equipped.length}/${MAX_EQUIPPED})`, 28, "#cbd5e1");
    this.cards = [];
    for (let i = 0; i < MAX_EQUIPPED; i++) {
      const x = W / 2 + (i - 1.5) * 160;
      const key = save.equipped[i];
      if (key) {
        this.cards.push(itemCard(this, x, 580, key, null, 145, 180));
      } else {
        this.add.rectangle(x, 580, 145, 180, 0x000000, 0.25).setStrokeStyle(3, 0x475569);
        text(this, x, 580, "empty", 20, "#64748b");
      }
    }

    button(this, W / 2, 780, 460, 110, "▶  PLAY", 0x22c55e, () => this.scene.start("Game"), 46)
      .setEnabled(save.equipped.length > 0);
    button(this, W / 2, 920, 460, 100, "🎲  ROLL DICE", 0xa855f7, () => this.scene.start("Dice"), 40);
    button(this, W / 2, 1050, 460, 100, "🎒  INVENTORY", 0x3b82f6, () => this.scene.start("Inventory"), 40);

    text(this, W / 2, 1140, `Best survival: ${formatTime(save.bestTime)}   •   Total rolls: ${save.totalRolls}`, 22, "#94a3b8");

    // Testing helpers — remove before release
    button(this, 190, 1220, 300, 56, "TEST: +1000 coins", 0x475569, () => {
      save.coins += 1000;
      persist();
      this.scene.restart();
    }, 22);
    button(this, 530, 1220, 300, 56, "TEST: reset save", 0x7f1d1d, () => {
      resetSave();
      this.scene.restart();
    }, 22);
  }

  update(time: number): void {
    updateRainbow(this.cards, time);
  }
}
