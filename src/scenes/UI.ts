import Phaser from "phaser";
import { DICE, DiceDef, PITY_ROLLS } from "../data/dice";
import { FUSE_COST, ItemKey, VARIANT_INFO, makeKey, nextVariant, parseKey } from "../data/items";
import { RARITY_INFO, rainbowColor, rarityRank } from "../data/rarity";
import { UPGRADES, luckMult } from "../data/upgrades";
import { RollResult, oddsOf, rollDie } from "../systems/roll";
import { MAX_EQUIPPED, fuse, lastSeenAtLoad, persist, resetSave, save, toggleEquip } from "../systems/save";
import { BATTLE_H } from "./Battle";
import { fmt } from "../ui/format";
import { Button, button, itemCard, text, updateRainbow } from "../ui/widgets";

type Tab = "roll" | "pets" | "upgrades";

const TAB_Y = 1230;
const CONTENT_TOP = BATTLE_H;
const CONTENT_BOTTOM = 1170;
const REVEAL_Y = 868;
const GRID_TOP = 700;
const VARIANT_RANK = { normal: 0, golden: 1, rainbow: 2 };

/** Where each die lands for a multi-roll, and how big the card is. */
function layout(n: number): { x: number; y: number; scale: number }[] {
  if (n === 1) return [{ x: 360, y: REVEAL_Y, scale: 0.95 }];
  if (n === 3) return [0, 1, 2].map((i) => ({ x: 150 + i * 210, y: REVEAL_Y, scale: 0.85 }));
  return [...Array(n)].map((_, i) => ({
    x: 120 + (i % 4) * 160,
    y: REVEAL_Y - 55 + Math.floor(i / 4) * 112,
    scale: 0.52,
  }));
}

/**
 * The bottom half of the screen: Roll / Pets / Upgrades tabs.
 * The battle keeps running above while the player uses these.
 */
export class UIScene extends Phaser.Scene {
  private tab: Tab = "roll";
  private panels!: Record<Tab, Phaser.GameObjects.Container>;
  private tabButtons!: Record<Tab, Button>;

  // roll tab
  private dieIndex = 0;
  private rolling = false;
  private auto = false;
  private fast = false;
  private lastCount = 1;
  private shown: Phaser.GameObjects.GameObject[] = [];
  private rollCards: Phaser.GameObjects.Container[] = [];
  private dieTabs: Button[] = [];
  private rollButtons: Button[] = [];
  private autoBtn!: Button;
  private fastBtn!: Button;
  private hintText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;

  // pets tab
  private petList!: Phaser.GameObjects.Container;
  private petCards: { key: ItemKey; card: Phaser.GameObjects.Container }[] = [];
  private maxScroll = 0;
  private popup: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("UI");
  }

  private get die(): DiceDef {
    return DICE[this.dieIndex];
  }

  create(): void {
    const W = this.scale.width;
    this.add.tileSprite(0, CONTENT_TOP, W, this.scale.height - CONTENT_TOP, "grid").setOrigin(0);
    this.add.rectangle(0, CONTENT_TOP, W, 6, 0x000000, 0.5).setOrigin(0);

    this.panels = {
      roll: this.add.container(0, 0),
      pets: this.add.container(0, 0),
      upgrades: this.add.container(0, 0),
    };
    this.buildRollPanel();
    this.buildPetsPanel();
    this.buildUpgradesPanel();

    // Tab bar
    this.add.rectangle(0, TAB_Y - 60, W, 120, 0x0b0c18).setOrigin(0);
    const tabs: [Tab, string][] = [["roll", "🎲 Roll"], ["pets", "🐾 Pets"], ["upgrades", "⬆ Upgrade"]];
    this.tabButtons = {} as Record<Tab, Button>;
    tabs.forEach(([id, label], i) => {
      this.tabButtons[id] = button(this, 125 + i * 235, TAB_Y, 220, 84, label, 0x334155, () => this.showTab(id), 30);
    });
    this.showTab("roll");
    this.setupPetScrolling();
    this.offlineEarnings();
  }

  update(time: number): void {
    updateRainbow(this.rollCards, time);
    if (this.tab === "pets") updateRainbow(this.petCards.map((c) => c.card), time);
  }

  private showTab(tab: Tab): void {
    if (this.rolling && tab !== "roll") {
      this.auto = false;
    }
    this.tab = tab;
    (Object.keys(this.panels) as Tab[]).forEach((t) => {
      this.panels[t].setVisible(t === tab);
      this.tabButtons[t].bg.setFillStyle(t === tab ? 0x7c3aed : 0x334155);
    });
    if (tab === "pets") this.buildPetsPanel();
    if (tab === "upgrades") this.buildUpgradesPanel();
    if (tab === "roll") this.refreshRoll();
  }

  // ───────────────────────── Roll tab ─────────────────────────

  private buildRollPanel(): void {
    const p = this.panels.roll;
    const W = this.scale.width;
    this.dieTabs = DICE.map((d, i) =>
      button(this, 185 + i * 350, 652, 330, 74, `${d.name}  🪙${fmt(d.cost)}`, 0x1e293b, () => {
        if (this.rolling) return;
        this.dieIndex = i;
        this.refreshRoll();
        this.showIdleDie();
      }, 24),
    );
    this.hintText = text(this, W / 2, 712, "", 24, "#e2e8f0");
    this.infoText = text(this, W / 2, 746, "", 19, "#fbbf24");
    this.rollButtons = [1, 3, 8].map((n, i) =>
      button(this, 128 + i * 232, 1018, 214, 82, `Roll x${n}`, 0xa855f7, () => this.roll(n), 32),
    );
    this.autoBtn = button(this, 128, 1112, 214, 62, "", 0x475569, () => {
      this.auto = !this.auto;
      this.refreshRoll();
      if (this.auto && !this.rolling) this.roll(this.lastCount);
    }, 24);
    this.fastBtn = button(this, 360, 1112, 214, 62, "", 0x475569, () => {
      this.fast = !this.fast;
      this.refreshRoll();
    }, 24);
    const odds = button(this, 592, 1112, 214, 62, "📊 Odds", 0x0f766e, () => this.showOdds(), 24);
    this.burst = this.add.particles(0, 0, "particle", {
      speed: { min: 150, max: 480 }, lifespan: 850, scale: { start: 1.5, end: 0 }, gravityY: 400, emitting: false,
    }).setDepth(20);
    p.add([...this.dieTabs, this.hintText, this.infoText, ...this.rollButtons, this.autoBtn, this.fastBtn, odds, this.burst]);
    this.showIdleDie();
  }

  private refreshRoll(): void {
    this.dieTabs.forEach((t, i) => {
      const on = i === this.dieIndex;
      t.bg.setFillStyle(on ? DICE[i].color : 0x1e293b);
      t.label.setColor(on ? "#111111" : "#ffffff").setStroke(on ? "#ffffff" : "#000000", 3);
    });
    [1, 3, 8].forEach((n, i) => this.rollButtons[i].setEnabled(save.coins >= this.die.cost * n));
    this.autoBtn.label.setText(`AUTO: ${this.auto ? "ON" : "OFF"}`);
    this.autoBtn.bg.setFillStyle(this.auto ? 0x16a34a : 0x475569);
    this.fastBtn.label.setText(`FAST: ${this.fast ? "ON" : "OFF"}`);
    this.fastBtn.bg.setFillStyle(this.fast ? 0x16a34a : 0x475569);
    const left = PITY_ROLLS - save.pity;
    this.infoText.setText(`🍀 Luck x${luckMult().toFixed(1)}   •   Legendary+ guaranteed in ${left} roll${left === 1 ? "" : "s"}`);
  }

  private clearShown(): void {
    this.shown.forEach((o) => o.destroy());
    this.shown = [];
    this.rollCards = [];
  }

  private showIdleDie(): void {
    this.clearShown();
    const d = this.add.image(360, REVEAL_Y, "face6").setTint(this.die.color);
    this.tweens.add({ targets: d, y: REVEAL_Y - 20, angle: 6, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.panels.roll.add(d);
    this.shown.push(d);
    this.hintText.setText(`Roll the ${this.die.name} for new pets!`);
  }

  private roll(n: number): void {
    if (this.rolling) return;
    const cost = this.die.cost * n;
    if (save.coins < cost) {
      this.auto = false;
      this.refreshRoll();
      this.hintText.setText("Not enough coins — your cat is earning more!");
      return;
    }
    this.lastCount = n;
    this.rolling = true;
    save.coins -= cost;
    persist();

    const luck = luckMult();
    const results = [...Array(n)].map(() => rollDie(this.die, luck));
    this.refreshRoll();
    this.clearShown();
    this.hintText.setText("Rolling...");

    const best = Math.max(...results.map((r) => rarityRank(r.item.rarity)));
    const flight = this.fast ? 320 : 800;
    const suspense = this.fast ? 0 : best >= rarityRank("epic") ? 700 : best >= rarityRank("rare") ? 300 : 0;
    const spots = layout(n);
    let revealed = 0;

    results.forEach((res, i) => {
      const spot = spots[i];
      const die = this.add
        .image(spot.x + Phaser.Math.Between(-80, 80), 1100, `face${Phaser.Math.Between(1, 6)}`)
        .setTint(this.die.color)
        .setScale(spot.scale * 0.4)
        .setDepth(10);
      this.panels.roll.add(die);
      this.shown.push(die);
      const flicker = this.time.addEvent({
        delay: 70, loop: true,
        callback: () => die.setTexture(`face${Phaser.Math.Between(1, 6)}`),
      });
      this.tweens.add({
        targets: die, x: spot.x, y: spot.y, scale: spot.scale * 0.8, angle: Phaser.Math.Between(540, 900),
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
    if (ms === 0 || rarityRank(res.item.rarity) < rarityRank("rare")) return done();
    const glow = this.add.image(die.x, die.y, "glow").setTint(RARITY_INFO[res.item.rarity].color).setScale(0.2).setAlpha(0.8).setDepth(9);
    this.panels.roll.add(glow);
    this.shown.push(glow);
    this.tweens.add({ targets: glow, scale: die.scale * 1.5, duration: ms });
    this.tweens.add({
      targets: die, angle: { from: -8, to: 8 }, duration: 60, yoyo: true, repeat: Math.floor(ms / 120),
      onComplete: () => {
        die.setAngle(0);
        done();
      },
    });
  }

  private reveal(die: Phaser.GameObjects.Image, res: RollResult, spot: { x: number; y: number; scale: number }): void {
    const info = RARITY_INFO[res.item.rarity];
    const rank = rarityRank(res.item.rarity);
    die.setVisible(false);
    const card = itemCard(this, spot.x, spot.y, makeKey(res.item.id, "normal"), null).setScale(0).setDepth(11);
    if (spot.scale > 0.6) card.add(text(this, 0, 82, `1 in ${fmt(res.oneIn)}`, 16, "#fde68a"));
    this.tweens.add({ targets: card, scale: spot.scale, duration: 260, ease: "Back.out" });
    this.panels.roll.add(card);
    this.shown.push(card);
    this.rollCards.push(card);
    if (res.isNew) {
      const tag = text(this, spot.x + 55 * spot.scale, spot.y - 100 * spot.scale, "NEW!", 22, "#22d3ee").setDepth(12).setAngle(15);
      this.panels.roll.add(tag);
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
      // big celebration over the whole screen, battle included
      this.cameras.main.flash(300, 255, 255, 255);
      this.cameras.main.shake(400, 0.01);
      const banner = text(this, 360, 330, `${info.label.toUpperCase()}!\n${best.item.name}\n1 in ${fmt(best.oneIn)}`, 52, info.css)
        .setDepth(3000).setScale(0);
      this.tweens.add({ targets: banner, scale: 1, duration: 400, ease: "Back.out" });
      this.tweens.add({ targets: banner, alpha: 0, delay: 2200, duration: 500, onComplete: () => banner.destroy() });
      if (best.item.rarity === "secret") {
        this.tweens.addCounter({
          from: 0, to: 1, duration: 2700,
          onUpdate: (t) => banner.setColor("#" + rainbowColor(0, (t.getValue() ?? 0) * 3).toString(16).padStart(6, "0")),
        });
      }
    }

    const pityUsed = results.some((r) => r.pity);
    this.hintText.setText(
      pityUsed ? "PITY! Guaranteed Legendary+ 🎉"
        : results.length === 1 ? `${best.item.name}  (${info.label})`
          : `Best: ${best.item.name}  (${info.label})`,
    );
    this.refreshRoll();
    this.autoEquip(results);

    const wait = rank >= rarityRank("legendary") ? 1800 : this.fast ? 250 : 650;
    this.time.delayedCall(wait, () => {
      this.rolling = false;
      if (this.auto && this.tab === "roll") this.roll(this.lastCount);
    });
  }

  /** Fill empty slots with new pets so players see them fight right away. */
  private autoEquip(results: RollResult[]): void {
    let changed = false;
    for (const r of results) {
      const key = makeKey(r.item.id, "normal");
      if (save.equipped.length < MAX_EQUIPPED && !save.equipped.includes(key)) {
        save.equipped.push(key);
        changed = true;
      }
    }
    if (changed) {
      persist();
      this.game.events.emit("pets-changed");
    }
  }

  private showOdds(): void {
    if (this.rolling || this.popup.length) return;
    const W = this.scale.width;
    const odds = oddsOf(this.die, luckMult());
    const panelH = 150 + odds.length * 60;
    const top = 640 - panelH / 2;
    const objs: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(0, 0, W, this.scale.height, 0x000000, 0.7).setOrigin(0).setInteractive(),
      this.add.rectangle(W / 2, 640, 600, panelH, 0x1e2140).setStrokeStyle(5, this.die.color),
      text(this, W / 2, top + 45, `${this.die.name} odds`, 34),
      text(this, W / 2, top + 85, `with your luck x${luckMult().toFixed(1)}`, 20, "#fbbf24"),
    ];
    odds.forEach((o, i) => {
      const y = top + 135 + i * 60;
      objs.push(this.add.image(105, y, o.item.sprite).setTint(o.item.color).setScale(0.6));
      objs.push(text(this, 145, y, o.item.name, 24, RARITY_INFO[o.item.rarity].css).setOrigin(0, 0.5));
      objs.push(text(this, 610, y, o.percent, 24).setOrigin(1, 0.5));
    });
    objs.push(button(this, W / 2, top + panelH + 55, 240, 76, "Close", 0x475569, () => this.closePopup(), 30));
    this.openPopup(objs);
  }

  // ───────────────────────── Pets tab ─────────────────────────

  private buildPetsPanel(): void {
    const p = this.panels.pets;
    p.removeAll(true);
    const W = this.scale.width;
    p.add(text(this, 30, 650, `Equipped ${save.equipped.length}/${MAX_EQUIPPED}  •  tap a pet`, 26).setOrigin(0, 0.5));
    p.add(button(this, 590, 650, 230, 60, `✨ Fuse All`, 0xd97706, () => {
      let fused = 0;
      for (let again = true; again;) {
        again = false;
        for (const key of Object.keys(save.inventory)) {
          if (fuse(key)) {
            fused++;
            again = true;
          }
        }
      }
      if (fused) {
        this.cameras.main.flash(200, 255, 215, 0);
        this.game.events.emit("pets-changed");
      }
      this.buildPetsPanel();
    }, 24));

    const keys = Object.keys(save.inventory).sort((a, b) => {
      const A = parseKey(a);
      const B = parseKey(b);
      return (
        Number(save.equipped.includes(b)) - Number(save.equipped.includes(a)) ||
        rarityRank(B.def.rarity) - rarityRank(A.def.rarity) ||
        VARIANT_RANK[B.variant] - VARIANT_RANK[A.variant] ||
        A.def.name.localeCompare(B.def.name)
      );
    });
    this.petList = this.add.container(0, 0);
    const maskShape = this.make.graphics({}, false).fillRect(0, GRID_TOP, W, CONTENT_BOTTOM - GRID_TOP);
    this.petList.setMask(maskShape.createGeometryMask());
    this.petCards = keys.map((key, i) => {
      const x = 75 + (i % 5) * 142;
      const y = GRID_TOP + 85 + Math.floor(i / 5) * 165;
      const card = itemCard(this, x, y, key, save.inventory[key]).setScale(0.82);
      if (save.equipped.includes(key)) {
        card.add(this.add.rectangle(-52, -12, 32, 30, 0x16a34a).setStrokeStyle(2, 0x000000));
        card.add(text(this, -52, -12, "E", 20));
      }
      if (save.inventory[key] >= FUSE_COST && nextVariant(parseKey(key).variant)) {
        card.add(text(this, 52, -12, "⬆", 26, "#fbbf24"));
      }
      this.petList.add(card);
      return { key, card };
    });
    p.add(this.petList);
    const rows = Math.ceil(keys.length / 5);
    this.maxScroll = Math.max(0, GRID_TOP + rows * 165 + 10 - CONTENT_BOTTOM);
  }

  /** Drag to scroll the pet grid; a short tap opens the pet. */
  private setupPetScrolling(): void {
    let startY = 0;
    let startList = 0;
    let dragging = false;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.tab !== "pets" || this.popup.length || p.y < GRID_TOP || p.y > CONTENT_BOTTOM) return;
      startY = p.y;
      startList = this.petList.y;
      dragging = true;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!dragging || !p.isDown) return;
      this.petList.y = Phaser.Math.Clamp(startList + (p.y - startY), -this.maxScroll, 0);
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(p.y - startY) > 12) return;
      const hit = this.petCards.find(({ card }) =>
        Math.abs(p.x - card.x) < 62 && Math.abs(p.y - (card.y + this.petList.y)) < 78);
      if (hit) this.openPet(hit.key);
    });
  }

  private openPet(key: ItemKey): void {
    const W = this.scale.width;
    const { def, variant } = parseKey(key);
    const count = save.inventory[key] ?? 0;
    const mult = VARIANT_INFO[variant].mult;
    const equipped = save.equipped.includes(key);
    const next = nextVariant(variant);
    const kindLabel = { shot: "Shooter", pierce: "Beam", splash: "Splash", zap: "Lightning", buff: "Support" }[def.kind];
    const statLine = def.kind === "buff"
      ? `Boosts all damage +${Math.round(def.damage * mult)}%`
      : `Damage: ${fmt(def.damage * mult)}${variant !== "normal" ? `  (x${mult})` : ""}\nAttacks every ${(def.cooldown / 1000).toFixed(1)}s` +
        (def.count > 1 ? `  •  ${def.count} targets` : "");
    const changed = () => {
      this.game.events.emit("pets-changed");
      this.closePopup();
      this.buildPetsPanel();
    };

    const canEquip = equipped || save.equipped.length < MAX_EQUIPPED;
    const objs: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(0, 0, W, this.scale.height, 0x000000, 0.75).setOrigin(0).setInteractive(),
      this.add.rectangle(W / 2, 640, 620, 860, 0x1e2140).setStrokeStyle(5, RARITY_INFO[def.rarity].color),
      itemCard(this, W / 2, 420, key, count).setScale(1.45),
      text(this, W / 2, 700, `${def.description}\n\nType: ${kindLabel}\n${statLine}`, 26, "#e2e8f0").setWordWrapWidth(540),
      button(this, W / 2 - 150, 880, 270, 90, equipped ? "Unequip" : canEquip ? "Equip" : "Slots full",
        equipped ? 0xdc2626 : 0x16a34a, () => {
          toggleEquip(key);
          changed();
        }, 30).setEnabled(canEquip),
    ];
    if (next) {
      objs.push(
        button(this, W / 2 + 150, 880, 270, 90, `Fuse ${Math.min(count, FUSE_COST)}/${FUSE_COST}\n→ ${VARIANT_INFO[next].label.trim()}`, 0xd97706, () => {
          if (fuse(key)) this.cameras.main.flash(200, 255, 215, 0);
          changed();
        }, 24).setEnabled(count >= FUSE_COST),
      );
    }
    objs.push(button(this, W / 2, 1000, 240, 70, "Close", 0x475569, () => this.closePopup(), 28));
    this.openPopup(objs);
  }

  // ───────────────────────── Upgrades tab ─────────────────────────

  private buildUpgradesPanel(): void {
    const p = this.panels.upgrades;
    p.removeAll(true);
    const W = this.scale.width;
    p.add(text(this, W / 2, 648, `Upgrade your cat  •  best stage ${save.bestStage}`, 26));
    UPGRADES.forEach((u, i) => {
      const y = 740 + i * 100;
      const lvl = save.upgrades[u.id];
      const maxed = lvl >= u.maxLevel;
      const cost = u.cost(lvl);
      p.add(this.add.rectangle(W / 2, y, 680, 88, 0x1e2140).setStrokeStyle(4, u.color));
      p.add(text(this, 40, y - 16, `${u.name}  Lv ${lvl}`, 26, "#" + u.color.toString(16).padStart(6, "0")).setOrigin(0, 0.5));
      p.add(text(this, 40, y + 18, maxed ? u.value(lvl) : `${u.value(lvl)}  →  ${u.value(lvl + 1)}`, 19, "#cbd5e1").setOrigin(0, 0.5));
      p.add(
        button(this, 590, y, 200, 70, maxed ? "MAX" : `🪙 ${fmt(cost)}`, 0x16a34a, () => {
          if (maxed || save.coins < cost) return;
          save.coins -= cost;
          save.upgrades[u.id]++;
          persist();
          this.game.events.emit("upgrades-changed");
          this.buildUpgradesPanel();
        }, 26).setEnabled(!maxed && save.coins >= cost),
      );
    });

    // Testing helpers — remove before release
    p.add(button(this, 190, 1135, 300, 52, "TEST: +1000 coins", 0x475569, () => {
      save.coins += 1000;
      persist();
      this.buildUpgradesPanel();
    }, 20));
    p.add(button(this, 530, 1135, 300, 52, "TEST: reset save", 0x7f1d1d, () => {
      resetSave();
      window.location.reload();
    }, 20));
  }

  // ───────────────────────── popups & offline ─────────────────────────

  private openPopup(objs: Phaser.GameObjects.GameObject[]): void {
    this.closePopup();
    objs.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(2000));
    this.popup = objs;
  }

  private closePopup(): void {
    this.popup.forEach((o) => o.destroy());
    this.popup = [];
  }

  /** "While you were away" reward — the idle part of the game. */
  private offlineEarnings(): void {
    const away = (Date.now() - lastSeenAtLoad) / 1000;
    if (away < 60 || save.coinsPerSec <= 0) return;
    const seconds = Math.min(away, 8 * 3600);
    const coins = Math.floor(save.coinsPerSec * seconds * 0.5);
    if (coins <= 0) return;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const W = this.scale.width;
    const collect = (mult: number) => {
      save.coins += coins * mult;
      persist();
      this.closePopup();
      this.refreshRoll();
    };
    this.openPopup([
      this.add.rectangle(0, 0, W, this.scale.height, 0x000000, 0.75).setOrigin(0).setInteractive(),
      this.add.rectangle(W / 2, 640, 600, 520, 0x1e2140).setStrokeStyle(5, 0xfde047),
      this.add.image(W / 2, 470, "hero").setScale(1.3),
      text(this, W / 2, 580, "While you were away...", 34),
      text(this, W / 2, 630, `${hours ? `${hours}h ` : ""}${mins}m of fighting`, 24, "#94a3b8"),
      text(this, W / 2, 700, `+ 🪙 ${fmt(coins)}`, 54, "#fde047"),
      button(this, W / 2 - 140, 820, 250, 84, "Collect", 0x16a34a, () => collect(1), 30),
      // In the real game this button would show a rewarded ad first
      button(this, W / 2 + 140, 820, 250, 84, "x2 (ad)", 0xa855f7, () => collect(2), 30),
    ]);
  }
}
