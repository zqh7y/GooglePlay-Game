import Phaser from "phaser";
import { makePickupTextures } from "../art/pickups";
import { panelTexture } from "../art/ui";
import { DICE_LUCK, TIER_INFO, Tier } from "../data/tiers";
import { dailyDay } from "../systems/goals";
import { persist, save } from "../systems/save";
import { buzz, sfx } from "../systems/sound";
import { POTION_GEMS, potionMinutes, potionMult } from "../systems/stats";
import { fmt } from "./format";
import { Host, Screen } from "./screens";
import { BtnColor } from "../art/ui";
import { Button, button, fitText, label, text } from "./widgets";

const FREE_GIFT_MS = 10 * 60 * 1000;

interface Item {
  icon: string;
  title: string;
  desc: () => string;
  price: () => string;
  priceIcon?: string;
  color: BtnColor;
  /** returns false if it could not be bought */
  buy: () => boolean;
  enabled?: () => boolean;
}

const income = (minutes: number) => Math.max(1000, save.cashPerSec * 60 * minutes);

/** The shop: free gift, daily reward, potions, roll boosts, money and gems. */
export class ShopScreen extends Screen {
  private list: Phaser.GameObjects.Container;
  private top: number;
  private bottom: number;
  private max = 0;
  private drag = { on: false, y: 0, oy: 0 };
  private buttons: { btn: Button; item: Item }[] = [];
  private giftBtn!: Button;
  private giftText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, host: Host) {
    super(scene, host, "shop");
    const s = scene;
    makePickupTextures(s);
    const W = s.scale.width;
    this.top = host.L.headerBottom + 10;
    this.bottom = host.L.navTop - 10;
    this.list = s.add.container(0, 0);
    const mask = s.make.graphics({}, false).fillRect(0, this.top, W, this.bottom - this.top);
    this.list.setMask(mask.createGeometryMask());
    this.root.add(this.list);
    this.build();
    s.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.visible || p.y < this.top || p.y > this.bottom) return;
      this.drag = { on: true, y: p.y, oy: this.list.y };
    });
    s.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.drag.on || !p.isDown) return;
      this.list.y = Phaser.Math.Clamp(this.drag.oy + p.y - this.drag.y, -this.max, 0);
    });
    s.input.on("pointerup", () => (this.drag.on = false));
  }

  private section(y: number, title: string): number {
    const s = this.scene;
    this.list.add(text(s, 50, y, title, 46, "#ffffff").setOrigin(0, 0.5));
    return y + 70;
  }

  private card(y: number, item: Item): number {
    const s = this.scene;
    const W = s.scale.width;
    const h = 170;
    const cy = y + h / 2;
    const btn = button(s, W - 190, cy, 280, 110, item.color, item.price(), () => {
      if (item.enabled && !item.enabled()) return;
      if (item.buy()) {
        sfx.buy();
        buzz(30);
        this.host.coinShower(btn.x, btn.y + this.list.y, 6);
        this.scene.tweens.add({ targets: btn, scale: 1.12, duration: 90, yoyo: true });
      }
      this.refresh();
    }, { size: 32, icon: item.priceIcon, iconSize: 40 });
    this.list.add([
      s.add.image(W / 2, cy, panelTexture(s, "cream", 1000, h)),
      s.add.image(130, cy, "glow").setTint(0xffe066).setScale(0.75).setAlpha(0.6),
      s.add.image(130, cy, item.icon).setScale(1.05),
      fitText(label(s, 220, cy - 30, item.title, 40, "#4a2f1d").setOrigin(0, 0.5), 450),
      fitText(label(s, 220, cy + 26, item.desc(), 26, "#8a6a4a").setOrigin(0, 0.5), 450),
      btn,
    ]);
    this.buttons.push({ btn, item });
    return y + h + 24;
  }

  private build(): void {
    const s = this.scene;
    const W = s.scale.width;
    let y = this.top + 30;
    const host = this.host;

    // free gift every 10 minutes
    const giftY = y + 120;
    this.list.add(s.add.image(W / 2, giftY, panelTexture(s, "cream", 1000, 240)));
    const rays = s.add.image(150, giftY, "rays").setScale(0.35).setTint(0xffe066).setAlpha(0.6);
    s.tweens.add({ targets: rays, angle: 360, duration: 8000, repeat: -1 });
    const gift = s.add.image(150, giftY, "icon_gift").setScale(1.5);
    s.tweens.add({ targets: gift, angle: { from: -6, to: 6 }, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.giftText = label(s, 270, giftY + 30, "", 28, "#8a6a4a").setOrigin(0, 0.5);
    this.giftBtn = button(s, W - 190, giftY, 280, 120, "green", "OPEN", () => this.openGift(), { size: 40 });
    this.list.add([rays, gift, label(s, 270, giftY - 30, "FREE GIFT", 48, "#4a2f1d").setOrigin(0, 0.5), this.giftText, this.giftBtn]);
    y = giftY + 150;

    y = this.card(y, {
      icon: "icon_gift", title: "Daily Reward", desc: () => (dailyDay() >= 0 ? "Your daily reward is ready!" : "Come back tomorrow"),
      price: () => (dailyDay() >= 0 ? "CLAIM" : "OPEN"), color: "gold", buy: () => {
        host.showDaily();
        return false;
      },
    });

    y = this.section(y + 10, "POTIONS");
    y = this.card(y, {
      icon: "icon_potion", title: "Luck Potion", desc: () => `x${potionMult()} luck for ${potionMinutes()} minutes`,
      price: () => `${POTION_GEMS}`, priceIcon: "icon_gem", color: "purple", buy: () => this.spend(POTION_GEMS, () => {
        save.potionUntil = Math.max(Date.now(), save.potionUntil) + potionMinutes() * 60000;
      }),
    });
    y = this.card(y, {
      icon: "icon_clock", title: "Speed Potion", desc: () => "Roll twice as fast for 10 minutes",
      price: () => "12", priceIcon: "icon_gem", color: "blue", buy: () => this.spend(12, () => {
        save.speedUntil = Math.max(Date.now(), save.speedUntil) + 10 * 60000;
      }),
    });

    y = this.section(y + 10, "DICE");
    for (const [tier, amount, gems] of [["A", 10, 5], ["A", 50, 20], ["B", 10, 25], ["C", 5, 60]] as [Tier, number, number][]) {
      y = this.card(y, {
        icon: `die_${tier}`, title: `${amount} ${tier} Dice`, desc: () => `${TIER_INFO[tier].name}: x${DICE_LUCK[tier]} luck per roll (you have ${fmt(save.dice[tier])})`,
        price: () => `${gems}`, priceIcon: "icon_gem", color: "gold", buy: () => this.spend(gems, () => {
          save.dice[tier] += amount;
          host.afterPurchase();
        }),
      });
    }

    y = this.section(y + 10, "LUCKY ROLLS");
    y = this.card(y, {
      icon: "icon_clover", title: "10 Lucky Rolls", desc: () => "Your next 10 rolls are Lucky Rolls",
      price: () => "15", priceIcon: "icon_gem", color: "orange", buy: () => this.spend(15, () => (save.luckyBoost += 10)),
    });
    y = this.card(y, {
      icon: "icon_clover", title: "50 Lucky Rolls", desc: () => "Your next 50 rolls are Lucky Rolls",
      price: () => "60", priceIcon: "icon_gem", color: "orange", buy: () => this.spend(60, () => (save.luckyBoost += 50)),
    });

    y = this.section(y + 10, "MONEY");
    for (const [title, minutes, gems] of [["Bag of Money", 15, 5], ["Chest of Money", 120, 30], ["Vault of Money", 720, 150]] as [string, number, number][]) {
      y = this.card(y, {
        icon: "icon_cash", title, desc: () => `+${fmt(income(minutes))} money (${minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`} of income)`,
        price: () => `${gems}`, priceIcon: "icon_gem", color: "green", buy: () => this.spend(gems, () => (save.cash += income(minutes))),
      });
    }

    y = this.section(y + 10, "GEMS");
    for (const [title, amount, price] of [["Handful of Gems", 80, "$0.99"], ["Bag of Gems", 500, "$4.99"], ["Chest of Gems", 1200, "$9.99"]] as [string, number, string][]) {
      y = this.card(y, {
        icon: "icon_gem", title, desc: () => `${amount} gems (coming soon)`, price: () => price, color: "grey", enabled: () => false, buy: () => false,
      });
    }
    this.max = Math.max(0, y + 40 - this.bottom);
  }

  private spend(gems: number, give: () => void): boolean {
    if (save.gems < gems) {
      sfx.error();
      this.host.toast("Not enough gems! Beat bosses and open chests to get more.", "#ff9a9a");
      return false;
    }
    save.gems -= gems;
    give();
    persist();
    return true;
  }

  private openGift(): void {
    if (Date.now() < save.freeGiftAt) {
      sfx.error();
      return;
    }
    const gems = 2 + Math.floor(Math.random() * 4);
    const cash = income(5);
    save.gems += gems;
    save.cash += cash;
    save.dice.A += 3;
    save.freeGiftAt = Date.now() + FREE_GIFT_MS;
    persist();
    sfx.fanfare();
    buzz(80);
    this.scene.cameras.main.flash(180, 255, 240, 170);
    this.host.coinShower(this.giftBtn.x, this.giftBtn.y + this.list.y, 12);
    this.host.toast(`+${gems} gems  +3 dice  +${fmt(cash)} money`, "#ffe066");
    this.refresh();
  }

  private refresh(): void {
    for (const { btn, item } of this.buttons) {
      btn.setLabel(item.price());
      if (item.enabled) btn.setEnabled(item.enabled());
    }
  }

  protected onShow(): void {
    this.refresh();
  }

  update(): void {
    if (!this.visible) return;
    const left = save.freeGiftAt - Date.now();
    if (left > 0) {
      const m = Math.floor(left / 60000);
      const sec = Math.floor((left % 60000) / 1000);
      this.giftBtn.setLabel(`${m}:${String(sec).padStart(2, "0")}`).setColor("grey");
      this.giftText.setText("Free gems, dice and money every 10 minutes");
    } else {
      this.giftBtn.setLabel("OPEN").setColor("green");
      this.giftText.setText("Ready! Tap to open");
    }
  }
}

export const freeGiftReady = () => Date.now() >= save.freeGiftAt;
