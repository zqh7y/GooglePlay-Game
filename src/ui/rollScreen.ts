import Phaser from "phaser";
import { petKey, petTexture } from "../art/pets";
import { CARD_H, CARD_W, btnTexture, dieTexture, panelTexture, pillTexture } from "../art/ui";
import { ItemDef, PET_LIST } from "../data/items";
import { RARITY_INFO, rarityRank } from "../data/rarity";
import { Branch, TREE, TreeNode, effectText } from "../data/tree";
import { RollResult } from "../systems/roll";
import { persist, save } from "../systems/save";
import { buzz, sfx } from "../systems/sound";
import {
  autoUnlocked, buyNode, cashMult, dieSkin, luck, luckParts, luckyEvery, luckyMult, nodeOwned, nodeUnlocked, potionActive, rollTime, speedActive,
} from "../systems/stats";
import { fmt, luckText, oneIn } from "./format";
import { Host, Screen } from "./screens";
import { Button, button, drawBar, fitText, label, text } from "./widgets";

/** Quick-buy cards: each buys the cheapest open hexagon of one tree branch. */
const BRANCHES: { title: string; icon: string; branch: Branch; value: () => string }[] = [
  { title: "Luck", icon: "icon_clover", branch: "luck", value: () => luckText(luck()) },
  { title: "Rolling", icon: "icon_clock", branch: "roll", value: () => `${(rollTime() / 1000).toFixed(2)}s` },
  { title: "Money", icon: "icon_cash", branch: "money", value: () => `x${fmt(cashMult())}` },
];

/** The rolling screen: luck, a big die, the reels, ROLL / AUTO / FAST, recent pulls and quick upgrades. */
export class RollScreen extends Screen {
  revealing = false;
  private rollBtn: Button;
  private autoBtn: Button;
  private fastBtn: Button;
  private rollBar: Phaser.GameObjects.Graphics;
  private die: Phaser.GameObjects.Image;
  private dieRays: Phaser.GameObjects.Image;
  private luckText: Phaser.GameObjects.Text;
  private chips: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private history: Phaser.GameObjects.Container;
  private recent: ItemDef[] = [];
  private cards: { box: Phaser.GameObjects.Container; value: Phaser.GameObjects.Text; cost: Phaser.GameObjects.Text; node: Phaser.GameObjects.Text }[] = [];
  private burst: Phaser.GameObjects.Particles.ParticleEmitter;
  private readyAt = 0;
  private reelY: number;

  constructor(scene: Phaser.Scene, host: Host) {
    super(scene, host, "roll");
    const s = scene;
    const W = s.scale.width;
    const top = host.L.headerBottom;
    const bottom = host.L.navTop;
    const r = this.root;

    // luck panel
    const panelY = top + 80;
    r.add(s.add.image(W / 2, panelY, panelTexture(s, "glass", 1000, 140)));
    r.add(s.add.image(90, panelY, "icon_clover").setScale(0.9));
    this.luckText = text(s, 150, panelY - 22, "", 54, "#b6f59a").setOrigin(0, 0.5);
    this.chips = text(s, 150, panelY + 34, "", 26, "#fff3dc").setOrigin(0, 0.5);
    r.add([this.luckText, this.chips]);
    r.add(button(s, W - 120, panelY, 170, 100, "green", "ODDS", () => host.showOdds(), { icon: "icon_odds", iconSize: 40, size: 28 }));

    // the big die on a glowing pedestal
    // tall phones: spread things out instead of leaving a gap
    const extra = Math.max(0, bottom - 1724);
    const dieY = top + 330 + extra * 0.3;
    this.dieRays = s.add.image(W / 2, dieY, "rays").setScale(0.9).setAlpha(0.25).setTint(0xffe066);
    s.tweens.add({ targets: this.dieRays, angle: 360, duration: 16000, repeat: -1 });
    const ped = s.add.graphics();
    ped.fillStyle(0x2a1f4a, 0.6).fillEllipse(W / 2, dieY + 110, 300, 70);
    ped.fillStyle(0xffe066, 0.25).fillEllipse(W / 2, dieY + 104, 240, 50);
    this.die = s.add.image(W / 2, dieY, dieTexture(s, dieSkin(), 5)).setScale(2.2);
    s.tweens.add({ targets: this.die, y: dieY - 18, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    r.add([this.dieRays, ped, this.die]);

    // reels area
    this.reelY = (dieY + bottom - 430) / 2 + 40;
    this.hint = text(s, W / 2, this.reelY, "Tap ROLL to find new pets!", 40, "#e8e0ff");
    s.tweens.add({ targets: this.hint, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });
    r.add(this.hint);

    // buttons
    const btnY = bottom - 430;
    this.autoBtn = button(s, 175, btnY, 220, 122, "mint", "AUTO", () => {
      if (!autoUnlocked()) {
        host.toast("Unlock Auto Roll in Upgrades!", "#ffe680");
        return;
      }
      save.autoRoll = !save.autoRoll;
      persist();
    }, { icon: "icon_auto", iconSize: 52, stack: true, size: 30 });
    this.rollBtn = button(s, W / 2, btnY, 400, 152, "orange", "ROLL", () => host.roll(), { icon: dieTexture(s, dieSkin(), 5), iconSize: 80, size: 56, sub: "" });
    s.tweens.add({ targets: this.rollBtn.icon, angle: { from: -8, to: 8 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.fastBtn = button(s, W - 175, btnY, 220, 122, "grey", "FAST", () => host.setFast(!host.isFast()), { icon: "icon_bolt", iconSize: 50, stack: true, size: 30 });
    this.rollBar = s.add.graphics();
    r.add([this.autoBtn, this.rollBtn, this.fastBtn, this.rollBar]);

    // recent pulls
    const histY = bottom - 300;
    r.add(s.add.image(W / 2, histY, panelTexture(s, "glass", 1000, 100)));
    r.add(text(s, 80, histY, "Last", 28, "#e8e0ff"));
    this.history = s.add.container(0, histY);
    r.add(this.history);

    // quick upgrade cards
    const cardsY = bottom - 125;
    BRANCHES.forEach((b, i) => {
      const x = W / 2 + (i - 1) * 352;
      const c = s.add.container(x, cardsY);
      const bg = s.add.image(0, 0, btnTexture(s, "mint", 320, 196));
      const value = text(s, 0, -26, "", 48);
      const node = label(s, 0, 18, "", 22, "#2f6f5c");
      const cost = text(s, 14, 58, "", 32, "#ffffff");
      c.add([bg, text(s, 0, -122, b.title, 36), s.add.image(-128, -76, b.icon).setScale(0.62), value, node,
        s.add.image(0, 60, pillTexture(s, "dark", 240, 58)), s.add.image(-88, 60, "icon_cash").setScale(0.5), cost]);
      c.setSize(320, 196).setInteractive({ useHandCursor: true });
      let hold: Phaser.Time.TimerEvent | null = null;
      const stop = () => {
        hold?.remove();
        hold = null;
        s.tweens.add({ targets: c, scale: 1, duration: 100 });
      };
      c.on("pointerdown", () => {
        s.tweens.add({ targets: c, scale: 0.94, duration: 60 });
        this.buyBranch(i);
        hold = s.time.addEvent({ delay: 160, startAt: -280, loop: true, callback: () => this.buyBranch(i, true) });
      });
      c.on("pointerup", stop);
      c.on("pointerout", stop);
      r.add(c);
      this.cards.push({ box: c, value, cost, node });
    });

    this.burst = s.add.particles(0, 0, "spark", {
      speed: { min: 200, max: 620 }, lifespan: 800, scale: { start: 0.9, end: 0 }, rotate: { min: 0, max: 180 }, gravityY: 500, emitting: false,
    });
    r.add(this.burst);
  }

  setReadyAt(t: number): void {
    this.readyAt = t;
  }

  refreshDie(): void {
    this.die.setTexture(dieTexture(this.scene, dieSkin(), 5));
    this.rollBtn.icon?.setTexture(dieTexture(this.scene, dieSkin(), 5));
  }

  private branchNode(i: number): TreeNode | null {
    return TREE.filter((n) => n.branch === BRANCHES[i].branch && !nodeOwned(n.id) && nodeUnlocked(n)).sort((a, b) => a.cost - b.cost)[0] ?? null;
  }

  private buyBranch(i: number, quiet = false): void {
    const node = this.branchNode(i);
    if (!node) return;
    if (buyNode(node.id)) {
      sfx.buy();
      const card = this.cards[i].box;
      this.burst.setParticleTint(0x8af06a);
      this.burst.explode(14, card.x, card.y - 40);
      this.scene.tweens.add({ targets: this.cards[i].value, scale: 1.3, duration: 100, yoyo: true });
      this.host.toast(`${node.name}: ${effectText(node)}`, "#b6f59a");
      this.host.afterPurchase();
    } else if (!quiet) {
      sfx.error();
      this.host.toast("Not enough money!", "#ff9a9a");
    }
  }

  update(time: number): void {
    if (!this.visible) return;
    const p = luckParts();
    this.luckText.setText(`Luck ${luckText(luck())}`);
    const every = luckyEvery();
    const luckyNext = save.luckyBoost > 0 || save.luckyCount >= every - 1;
    const chips = [`Lucky roll ${luckyNext ? "NOW!" : `in ${Math.max(1, every - save.luckyCount - 1)}`}`];
    if (save.luckyBoost > 0) chips.push(`${save.luckyBoost} lucky dice`);
    if (p.index > 1) chips.push(`Index x${p.index.toFixed(2)}`);
    if (potionActive()) chips.push(`Potion x${p.potion}`);
    if (speedActive()) chips.push("Speed x2");
    fitText(this.chips.setText(chips.join("  •  ")), 680);
    fitText(this.luckText, 680);

    const left = this.readyAt - time;
    this.rollBtn.setLabel(left > 0 ? `${(left / 1000).toFixed(1)}s` : "ROLL");
    this.rollBtn.setSub(luckyNext ? "LUCKY ROLL!" : `Lucky in ${Math.max(1, every - save.luckyCount - 1)}`);
    this.rollBtn.subText?.setColor(luckyNext ? "#fff27a" : "#ffffff");
    this.rollBtn.setColor(left > 0 || this.revealing ? "peach" : luckyNext ? "gold" : "orange");
    this.rollBar.clear();
    if (left > 0) drawBar(this.rollBar, this.scene.scale.width / 2 - 150, this.host.L.navTop - 378, 300, 14, 1 - left / rollTime(), 0xffe066);
    const unlocked = autoUnlocked();
    this.autoBtn.setColor(unlocked && save.autoRoll ? "green" : unlocked ? "mint" : "grey");
    this.autoBtn.setLabel(unlocked ? (save.autoRoll ? "AUTO ON" : "AUTO") : "LOCKED");
    this.fastBtn.setColor(this.host.isFast() ? "green" : "mint");

    BRANCHES.forEach((b, i) => {
      const card = this.cards[i];
      const node = this.branchNode(i);
      card.value.setText(b.value());
      fitText(card.value, 280);
      if (!node) {
        card.node.setText("All bought!");
        card.cost.setText("MAX");
        return;
      }
      fitText(card.node.setText(`${node.name}: ${effectText(node)}`), 290);
      fitText(card.cost.setText(fmt(node.cost)).setColor(save.cash >= node.cost ? "#ffffff" : "#ff9a9a"), 160);
    });
  }

  /** Recent pulls strip. */
  addHistory(results: RollResult[]): void {
    this.recent = [...results.map((r) => r.item).reverse(), ...this.recent].slice(0, 8);
    this.history.removeAll(true);
    this.recent.forEach((def, i) => {
      const x = 180 + i * 108;
      const ring = this.scene.add.circle(x, 0, 40, RARITY_INFO[def.rarity].color).setStrokeStyle(5, 0x2a1a10);
      this.history.add([ring, this.scene.add.image(x, 4, petTexture(this.scene, def.id)).setScale(0.42)]);
    });
  }

  /** A pet to flash on the reel: mostly below the real result, sometimes a teasing rarer one. */
  private fakePet(rank: number): ItemDef {
    const r = Math.random();
    const tier = r < 0.5 ? Math.max(0, rank - 1 - Math.floor(Math.random() * 2)) : r < 0.82 ? rank : Math.min(9, rank + 1 + Math.floor(Math.random() * 2));
    return PET_LIST[Math.min(PET_LIST.length - 1, tier * 10 + Math.floor(Math.random() * 10))];
  }

  /**
   * The die tumbles, reels spin and slow down, and land on the rolled pets.
   * Rare pulls get suspense first (a slower reel, a shaking card and a growing glow).
   */
  reveal(results: RollResult[], lucky: boolean, done: () => void): void {
    const s = this.scene;
    const W = s.scale.width;
    this.revealing = true;
    this.hint.setVisible(false);
    const n = results.length;
    const y = this.reelY;
    const scale = n <= 1 ? 1 : n <= 3 ? 0.86 : 0.66;
    const spacing = Math.min(CARD_W * scale + 14, 980 / n);
    const bestRank = Math.max(...results.map((r) => rarityRank(r.item.rarity)));
    const suspense = !this.host.isFast() && bestRank >= 3;
    const quick = Phaser.Math.Clamp(rollTime() / 2000, 0.12, 1) * (this.host.isFast() ? 0.5 : 1);
    const spin = Math.max(140, 1000 * quick) + (suspense ? 500 + bestRank * 90 : 0);
    const hold = Math.max(120, 700 * quick) + (suspense ? 300 : 0);
    const fly = Math.max(140, 360 * quick);

    // tumble the die
    s.tweens.add({ targets: this.die, angle: this.die.angle + 720, duration: Math.min(spin, 900), ease: "Cubic.out" });
    const faces = s.time.addEvent({ delay: 70, repeat: Math.floor(Math.min(spin, 900) / 70), callback: () => this.die.setTexture(dieTexture(s, dieSkin(), 1 + Math.floor(Math.random() * 6))) });
    s.time.delayedCall(Math.min(spin, 900) + 80, () => {
      faces.remove();
      this.die.setTexture(dieTexture(s, dieSkin(), 6));
    });

    if (lucky) {
      sfx.lucky();
      const t = text(s, W / 2, y - 210, `LUCKY ROLL!  x${luckyMult()} LUCK`, 50, "#ffe066").setScale(0);
      this.root.add(t);
      s.tweens.add({ targets: t, scale: 1, duration: 220, ease: "Back.out" });
      s.tweens.add({ targets: t, alpha: 0, y: t.y - 50, delay: 1000, duration: 400, onComplete: () => t.destroy() });
      s.cameras.main.flash(150, 255, 230, 120);
    }
    let finished = 0;
    results.forEach((res, i) => {
      const x = W / 2 + (i - (n - 1) / 2) * spacing;
      const rank = rarityRank(res.item.rarity);
      const color = RARITY_INFO[res.item.rarity].color;
      const glow = s.add.image(x, y, "glow").setAlpha(0.35).setScale(scale * 1.8);
      const rays = s.add.image(x, y, "rays").setAlpha(0).setScale(scale * 0.6);
      const frame = s.add.image(0, 0, "card_common");
      const rar = text(s, 0, -CARD_H / 2 + 25, "", 24);
      const pet = s.add.image(0, -12, "icon_dice").setScale(1.3);
      const odds = text(s, 0, CARD_H / 2 - 66, "", 22, "#fff3dc");
      const name = text(s, 0, CARD_H / 2 - 27, "", 25);
      const card = s.add.container(x, y + 200, [frame, rar, pet, odds, name]).setScale(0);
      this.root.add([rays, glow, card]);
      const show = (def: ItemDef, real: boolean) => {
        frame.setTexture(`card_${def.rarity}`);
        fitText(rar.setText(RARITY_INFO[def.rarity].label.toUpperCase()), CARD_W - 40);
        fitText(name.setText(def.name), CARD_W - 36);
        odds.setText(oneIn(def.oneIn));
        const key = petKey(def.id);
        if (real) pet.setTexture(petTexture(s, def.id)).setScale(0.9);
        else if (s.textures.exists(key)) pet.setTexture(key).setScale(0.9);
        else pet.setTexture("icon_dice").setScale(1.3).setAngle(Phaser.Math.Between(-20, 20));
        glow.setTint(RARITY_INFO[def.rarity].color);
      };
      s.tweens.add({ targets: card, scale, y, duration: 220, delay: i * 60, ease: "Back.out" });
      let t = 0;
      let k = 0;
      const tick = () => {
        show(this.fakePet(rank), false);
        sfx.tick(k++);
        const p = t / spin;
        s.tweens.add({ targets: card, y: y - 10, duration: 30, yoyo: true });
        if (suspense && p > 0.55) {
          card.setAngle(Phaser.Math.Between(-4, 4));
          glow.setAlpha(0.35 + p * 0.5).setScale(scale * (1.8 + p * 0.8));
        }
        const delay = 40 + (suspense ? 200 : 120) * p * p;
        t += delay;
        s.time.delayedCall(delay, t < spin ? tick : land);
      };
      const land = () => {
        show(res.item, true);
        card.setAngle(0);
        pet.setAngle(0);
        sfx.reveal(rank);
        glow.setAlpha(0.95);
        if (rank >= 3) {
          rays.setTint(color);
          s.tweens.add({ targets: rays, alpha: 0.85, scale: scale * (0.75 + rank * 0.05), duration: 250 });
          s.tweens.add({ targets: rays, angle: 120, duration: hold + rank * 60 + 300 });
          s.cameras.main.flash(180, (color >> 16) & 255, (color >> 8) & 255, color & 255);
        }
        s.tweens.add({ targets: card, scaleX: scale * 1.22, scaleY: scale * 0.84, duration: 80, yoyo: true, ease: "Quad.out" });
        s.tweens.add({ targets: glow, scale: scale * (2.2 + rank * 0.25), alpha: 0.6, duration: 260 });
        if (rank >= 1) {
          this.burst.setParticleTint(color);
          this.burst.explode(8 + rank * 9, x, y);
        }
        if (rank >= 2) {
          const call = text(s, x, y - (CARD_H * scale) / 2 - 34, `${RARITY_INFO[res.item.rarity].label.toUpperCase()}!`, 34 + rank * 3, RARITY_INFO[res.item.rarity].css).setScale(0);
          this.root.add(call);
          s.tweens.add({ targets: call, scale: 1, duration: 200, ease: "Back.out" });
          s.tweens.add({ targets: call, alpha: 0, y: call.y - 30, delay: hold + 150, duration: 300, onComplete: () => call.destroy() });
        }
        if (rank >= 4) {
          s.cameras.main.shake(180 + rank * 30, 0.004 + rank * 0.001);
          buzz(40 + rank * 15);
        }
        if (res.isNew) {
          const tag = text(s, CARD_W / 2 - 16, -CARD_H / 2 - 2, "NEW!", 34, "#ff6a8a").setAngle(14).setScale(2.5);
          card.add(tag);
          s.tweens.add({ targets: tag, scale: 1, duration: 200, ease: "Back.out" });
        } else if (save.pets[res.item.id]) {
          card.add(text(s, 0, CARD_H / 2 + 26, `+1 copy  (Lv.${save.pets[res.item.id].level})`, 26, "#b6f59a"));
        }
        s.time.delayedCall(hold + rank * 60, () => {
          s.tweens.add({ targets: [glow, rays], alpha: 0, duration: 200, onComplete: () => (glow.destroy(), rays.destroy()) });
          const target = this.host.tabPos("pets");
          s.tweens.add({
            targets: card, x: target.x, y: target.y, scale: 0.06, angle: 200, duration: fly, ease: "Cubic.in",
            onComplete: () => {
              card.destroy();
              if (++finished === n) {
                this.revealing = false;
                this.hint.setVisible(true);
                done();
              }
            },
          });
        });
      };
      s.time.delayedCall(i * 60 + 140, tick);
    });
  }
}
