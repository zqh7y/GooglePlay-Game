import Phaser from "phaser";
import { DICE, DiceDef, PITY_ROLLS } from "../data/dice";
import { makeKey } from "../data/items";
import { RARITY_INFO, rainbowColor, rarityRank } from "../data/rarity";
import { RollResult, oddsOf, rollDie } from "../systems/roll";
import { persist, save } from "../systems/save";
import { Button, button, coinLabel, itemCard, text, updateRainbow } from "../ui/widgets";

const AREA_Y = 610;

/** Where each die lands for a multi-roll, and how big it is. */
function layout(n: number): { x: number; y: number; scale: number }[] {
  if (n === 1) return [{ x: 360, y: AREA_Y, scale: 1.4 }];
  if (n === 3) return [0, 1, 2].map((i) => ({ x: 140 + i * 220, y: AREA_Y, scale: 0.95 }));
  return [...Array(n)].map((_, i) => ({
    x: 105 + (i % 4) * 170,
    y: AREA_Y - 120 + Math.floor(i / 4) * 250,
    scale: 0.72,
  }));
}

export class DiceScene extends Phaser.Scene {
  private dieIndex = 0;
  private rolling = false;
  private auto = false;
  private fast = false;
  private lastCount = 1;
  private shown: Phaser.GameObjects.GameObject[] = [];
  private cards: Phaser.GameObjects.Container[] = [];
  private coinText!: Phaser.GameObjects.Text;
  private pityText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private tabs: Button[] = [];
  private rollButtons: Button[] = [];
  private autoBtn!: Button;
  private fastBtn!: Button;
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super("Dice");
  }

  private get die(): DiceDef {
    return DICE[this.dieIndex];
  }

  create(): void {
    const W = this.scale.width;
    this.rolling = false;
    this.auto = false;
    this.shown = [];
    this.cards = [];
    this.add.tileSprite(0, 0, W, this.scale.height, "grid").setOrigin(0).setAlpha(0.5);

    button(this, 90, 50, 140, 64, "◀ Back", 0x334155, () => this.scene.start("Hub"), 26);
    this.coinText = coinLabel(this, W - 30, 50);

    // Die selector tabs
    this.tabs = DICE.map((d, i) =>
      button(this, 190 + i * 340, 160, 320, 90, `${d.name}\n🪙 ${d.cost}`, 0x1e293b, () => {
        if (this.rolling) return;
        this.dieIndex = i;
        this.refresh();
        this.showIdleDie();
      }, 26),
    );
    button(this, W / 2, 250, 220, 56, "📊 Odds", 0x0f766e, () => this.showOdds(), 24);

    this.hintText = text(this, W / 2, 960, "", 26, "#e2e8f0");
    this.pityText = text(this, W / 2, 1010, "", 22, "#fbbf24");

    this.rollButtons = [1, 3, 8].map((n, i) =>
      button(this, 130 + i * 230, 1100, 210, 100, `Roll x${n}`, 0xa855f7, () => this.roll(n), 32),
    );
    this.autoBtn = button(this, 245, 1215, 250, 70, "AUTO: OFF", 0x475569, () => {
      this.auto = !this.auto;
      this.refresh();
      if (this.auto && !this.rolling) this.roll(this.lastCount);
    }, 26);
    this.fastBtn = button(this, 475, 1215, 190, 70, "FAST: OFF", 0x475569, () => {
      this.fast = !this.fast;
      this.refresh();
    }, 26);

    this.burst = this.add.particles(0, 0, "particle", {
      speed: { min: 150, max: 520 }, lifespan: 900, scale: { start: 1.6, end: 0 },
      gravityY: 400, emitting: false,
    }).setDepth(20);

    this.refresh();
    this.showIdleDie();
  }

  update(time: number): void {
    updateRainbow(this.cards, time);
  }

  private refresh(): void {
    this.coinText.setText(`🪙 ${save.coins.toLocaleString()}`);
    this.tabs.forEach((t, i) => {
      t.bg.setFillStyle(i === this.dieIndex ? DICE[i].color : 0x1e293b);
      t.label.setColor(i === this.dieIndex ? "#000000" : "#ffffff").setStroke(i === this.dieIndex ? "#ffffff" : "#000000", 3);
    });
    [1, 3, 8].forEach((n, i) => this.rollButtons[i].setEnabled(save.coins >= this.die.cost * n));
    this.autoBtn.label.setText(`AUTO: ${this.auto ? "ON" : "OFF"}`);
    this.autoBtn.bg.setFillStyle(this.auto ? 0x16a34a : 0x475569);
    this.fastBtn.label.setText(`FAST: ${this.fast ? "ON" : "OFF"}`);
    this.fastBtn.bg.setFillStyle(this.fast ? 0x16a34a : 0x475569);
    const left = PITY_ROLLS - save.pity;
    this.pityText.setText(`Legendary+ guaranteed in ${left} roll${left === 1 ? "" : "s"}`);
  }

  private clearShown(): void {
    this.shown.forEach((o) => o.destroy());
    this.shown = [];
    this.cards = [];
  }

  private showIdleDie(): void {
    this.clearShown();
    const d = this.add.image(360, AREA_Y, "face6").setTint(this.die.color).setScale(1.4);
    this.tweens.add({ targets: d, y: AREA_Y - 25, angle: 6, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.shown.push(d);
    this.hintText.setText(`Tap Roll to throw the ${this.die.name}!`);
  }

  private roll(n: number): void {
    if (this.rolling) return;
    const cost = this.die.cost * n;
    if (save.coins < cost) {
      this.auto = false;
      this.refresh();
      this.hintText.setText("Not enough coins — play a run to earn more!");
      this.cameras.main.shake(150, 0.004);
      return;
    }
    this.lastCount = n;
    this.rolling = true;
    save.coins -= cost;
    persist();

    const results = [...Array(n)].map(() => rollDie(this.die));
    this.refresh();
    this.clearShown();
    this.hintText.setText("Rolling...");

    const best = Math.max(...results.map((r) => rarityRank(r.item.rarity)));
    const flight = this.fast ? 350 : 850;
    const suspense = this.fast ? 0 : best >= rarityRank("epic") ? 700 : best >= rarityRank("rare") ? 300 : 0;
    const spots = layout(n);
    let revealed = 0;

    results.forEach((res, i) => {
      const spot = spots[i];
      const die = this.add
        .image(spot.x + Phaser.Math.Between(-80, 80), 1350, `face${Phaser.Math.Between(1, 6)}`)
        .setTint(this.die.color)
        .setScale(spot.scale * 0.6);
      this.shown.push(die);

      // Flicker faces while tumbling
      const flicker = this.time.addEvent({
        delay: 70, loop: true,
        callback: () => die.setTexture(`face${Phaser.Math.Between(1, 6)}`),
      });

      this.tweens.add({
        targets: die, x: spot.x, y: spot.y, scale: spot.scale, angle: Phaser.Math.Between(540, 900),
        duration: flight, delay: i * (this.fast ? 30 : 70), ease: "Back.out",
        onComplete: () => {
          flicker.remove();
          die.setAngle(0);
          this.suspense(die, res, suspense, () => {
            this.reveal(die, res, spot);
            if (++revealed === n) this.finishRoll(results);
          });
        },
      });
    });
  }

  /** Shake the die harder for better rarities — the "is it legendary??" moment. */
  private suspense(die: Phaser.GameObjects.Image, res: RollResult, ms: number, done: () => void): void {
    const rank = rarityRank(res.item.rarity);
    if (ms === 0 || rank < rarityRank("rare")) return done();
    const glow = this.add.image(die.x, die.y, "glow").setTint(RARITY_INFO[res.item.rarity].color)
      .setScale(0.2).setAlpha(0.8);
    this.shown.push(glow);
    die.setDepth(2);
    this.tweens.add({ targets: glow, scale: die.scale * 1.6, duration: ms });
    this.tweens.add({
      targets: die, angle: { from: -8, to: 8 }, duration: 60, yoyo: true,
      repeat: Math.floor(ms / 120), onComplete: () => {
        die.setAngle(0);
        done();
      },
    });
  }

  private reveal(die: Phaser.GameObjects.Image, res: RollResult, spot: { x: number; y: number; scale: number }): void {
    const info = RARITY_INFO[res.item.rarity];
    const rank = rarityRank(res.item.rarity);
    die.setVisible(false);

    const card = itemCard(this, spot.x, spot.y, makeKey(res.item.id, "normal"), null);
    const cardScale = spot.scale * (spot.scale > 1 ? 1.15 : 1.05);
    card.setScale(0).setDepth(5);
    this.tweens.add({ targets: card, scale: cardScale, duration: 280, ease: "Back.out" });
    this.shown.push(card);
    this.cards.push(card);

    if (res.isNew) {
      const tag = text(this, spot.x + 50 * cardScale, spot.y - 105 * cardScale, "NEW!", 24, "#22d3ee").setDepth(6).setAngle(15);
      this.shown.push(tag);
    }

    if (rank >= rarityRank("rare")) {
      this.burst.setParticleTint(info.color);
      this.burst.explode(rank * 12, spot.x, spot.y);
    }
  }

  private finishRoll(results: RollResult[]): void {
    const best = results.reduce((a, b) => (rarityRank(b.item.rarity) > rarityRank(a.item.rarity) ? b : a));
    const rank = rarityRank(best.item.rarity);
    const info = RARITY_INFO[best.item.rarity];

    if (rank >= rarityRank("legendary")) {
      this.cameras.main.flash(300, 255, 255, 255);
      this.cameras.main.shake(400, 0.012);
      const banner = text(this, 360, 380, `${info.label.toUpperCase()}!\n${best.item.name}`, 54, info.css).setDepth(30).setScale(0);
      this.shown.push(banner);
      this.tweens.add({ targets: banner, scale: 1, duration: 400, ease: "Back.out" });
      if (best.item.rarity === "secret") {
        this.tweens.addCounter({
          from: 0, to: 1, duration: 3000,
          onUpdate: (t) => banner.setColor("#" + rainbowColor(0, (t.getValue() ?? 0) * 3).toString(16).padStart(6, "0")),
        });
      }
    }

    const pityUsed = results.some((r) => r.pity);
    this.hintText.setText(pityUsed ? "PITY! Guaranteed Legendary+ 🎉" : results.length === 1 ? `You got ${best.item.name}!` : `Best: ${best.item.name} (${info.label})`);
    this.refresh();

    const wait = rank >= rarityRank("legendary") ? 1800 : this.fast ? 250 : 650;
    this.time.delayedCall(wait, () => {
      this.rolling = false;
      if (this.auto) this.roll(this.lastCount);
    });
  }

  private showOdds(): void {
    if (this.rolling) return;
    const W = this.scale.width;
    const odds = oddsOf(this.die);
    const parts: Phaser.GameObjects.GameObject[] = [];
    const dim = this.add.rectangle(0, 0, W, this.scale.height, 0x000000, 0.7).setOrigin(0).setInteractive();
    const panelH = 160 + odds.length * 62;
    const panel = this.add.rectangle(W / 2, 640, 600, panelH, 0x1e2140).setStrokeStyle(5, this.die.color);
    parts.push(dim, panel);
    const top = 640 - panelH / 2;
    parts.push(text(this, W / 2, top + 50, `${this.die.name} odds`, 36));
    odds.forEach((o, i) => {
      const y = top + 120 + i * 62;
      const info = RARITY_INFO[o.item.rarity];
      parts.push(this.add.image(100, y, `icon_${o.item.kind}`).setTint(o.item.color).setScale(0.6));
      parts.push(text(this, 140, y, o.item.name, 24, info.css).setOrigin(0, 0.5));
      parts.push(text(this, 610, y, o.percent, 24).setOrigin(1, 0.5));
    });
    const container = this.add.container(0, 0, parts).setDepth(100);
    const close = button(this, W / 2, top + panelH + 60, 240, 80, "Close", 0x475569, () => {
      container.destroy();
      close.destroy();
    }, 30).setDepth(101);
  }
}
