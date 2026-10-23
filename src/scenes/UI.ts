import Phaser from "phaser";
import { petTexture } from "../art/pets";
import { CARD_H, CARD_W, btnTexture, dieTexture, nodeTexture, panelTexture, pillTexture, slotTexture } from "../art/ui";
import { INK_N } from "../art/draw";
import { FUSE_COST, ItemKey, PET_LIST, VARIANT_INFO, makeKey, nextVariant, parseKey } from "../data/items";
import { RARITY_INFO, RARITY_ORDER, rarityRank } from "../data/rarity";
import { TREE, TREE_BY_ID, TreeNode, effectText, nodeCost } from "../data/tree";
import { GAME_W, Layout, layoutFor } from "../layout";
import { RollResult, luckFloor, rollMany, tierChances } from "../systems/roll";
import { fuse, lastSeenAtLoad, persist, resetSave, save, toggleEquip } from "../systems/save";
import {
  POTION_GEMS, autoUnlocked, buyNode, canBuy, cashMult, dicePerRoll, dieSkin, luck, nodeLevel, nodeUnlocked, offlineRate,
  petSlots, potionActive, potionMinutes, potionMult, rollTime,
} from "../systems/stats";
import { WAVES_PER_STAGE, battle } from "./Battle";
import { fmt, luckText, oneIn } from "../ui/format";
import { Button, Modal, Pill, button, drawBar, fitText, iconButton, label, lockedCard, modal, petCard, text } from "../ui/widgets";

const VARIANT_RANK = { normal: 0, golden: 1, rainbow: 2 };
const KIND_LABEL = { shot: "Shooter", pierce: "Beam", splash: "Explosion", zap: "Lightning", buff: "Support" };
const MAX_SLOTS = 6;
const BOSS_TIME = 30000;

/** Quick-buy cards at the bottom: each shows the next node of one tree branch. */
const BRANCHES: { title: string; icon: string; nodes: string[]; value: () => string }[] = [
  { title: "Luck", icon: "icon_clover", nodes: ["paw", "clover", "iron", "horseshoe", "golddie", "star", "crystaldie", "rainbow", "cosmicdie", "infinite"], value: () => luckText(luck()) },
  { title: "Speed", icon: "icon_clock", nodes: ["auto", "quick", "double", "speedy", "triple", "lightning", "quad", "penta"], value: () => `${(rollTime() / 1000).toFixed(2)}s` },
  { title: "Money", icon: "icon_cash", nodes: ["piggy", "magnet", "vault", "offline", "goose", "infcash"], value: () => `x${fmt(cashMult())}` },
];

/** Rough strength of a pet, used by "Equip Best". */
function petScore(key: ItemKey): number {
  const { def, variant } = parseKey(key);
  const m = VARIANT_INFO[variant].mult;
  if (def.kind === "buff") return def.damage * m * 0.05 * (1 + def.index);
  return ((def.damage * m * def.count) / (def.cooldown / 1000)) * (def.kind === "splash" || def.kind === "pierce" ? 1.4 : 1);
}

interface Scroller {
  list: Phaser.GameObjects.Container;
  top: number;
  bottom: number;
  max: number;
  items: { obj: Phaser.GameObjects.Container; onTap: () => void }[];
}

interface TreeView {
  root: Phaser.GameObjects.Container;
  map: Phaser.GameObjects.Container;
  top: number;
  bottom: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  info: Phaser.GameObjects.Container;
  selected: string;
}

/**
 * Everything drawn over the battle: HUD, side buttons, roll button, upgrade cards,
 * pet screens, the upgrade tree and popups.
 */
export class UIScene extends Phaser.Scene {
  private W = GAME_W;
  private H = 0;
  private L!: Layout;

  // HUD
  private hudBars!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;
  private pathG!: Phaser.GameObjects.Graphics;
  private pathMarker!: Phaser.GameObjects.Image;
  private bossIcon!: Phaser.GameObjects.Image;
  private stageText!: Phaser.GameObjects.Text;
  private cashPill!: Pill;
  private gemPill!: Pill;
  private luckPill!: Pill;
  private potionPill!: Pill;
  private lastWave = "";

  // bottom
  private slotRow!: Phaser.GameObjects.Container;
  private rollBtn!: Button;
  private autoBtn!: Button;
  private fastBtn!: Button;
  private rollBar!: Phaser.GameObjects.Graphics;
  private cards: { bg: Phaser.GameObjects.Image; lvl: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text; cost: Phaser.GameObjects.Text; node: Phaser.GameObjects.Text }[] = [];

  // rolling
  private rollReadyAt = 0;
  private revealing = false;
  private celebrating = false;
  private fast = false;

  // screens
  private openModal: Modal | null = null;
  private sheet: Modal | null = null;
  private sheetKind: "pets" | "index" = "pets";
  private treeTimer: Phaser.Time.TimerEvent | null = null;
  private scroller: Scroller | null = null;
  private tree: TreeView | null = null;
  private drag = { active: false, startX: 0, startY: 0, ox: 0, oy: 0, moved: false };

  constructor() {
    super("UI");
  }

  create(): void {
    this.H = this.scale.height;
    this.L = layoutFor(this.H);
    Object.assign(this, { openModal: null, sheet: null, scroller: null, tree: null, revealing: false, celebrating: false, lastWave: "", cards: [] });
    this.buildHud();
    this.buildSideButtons();
    this.buildBottom();
    this.setupDragging();
    this.game.events.on("toast", this.toast, this);
    this.game.events.on("cash-arrived", this.onCash, this);
    this.events.once("shutdown", () => {
      this.game.events.off("toast", this.toast, this);
      this.game.events.off("cash-arrived", this.onCash, this);
    });
    this.offlineEarnings();
  }

  private onCash(): void {
    this.cashPill.bump();
  }

  update(time: number): void {
    this.updateHud(time);
    this.updateBottom(time);
    if (save.autoRoll && autoUnlocked() && !this.tree) this.tryRoll();
  }

  // ───────────────────────── HUD ─────────────────────────

  private buildHud(): void {
    const W = this.W;
    const band = this.add.graphics();
    band.fillStyle(0x5b3a24, 1).fillRect(0, 0, W, 58);
    band.fillStyle(INK_N, 1).fillRect(0, 56, W, 4);
    this.hudBars = this.add.graphics();
    this.progressText = text(this, W / 2, 88, "", 26);
    iconButton(this, 62, 160, "icon_gear", 86, () => this.showSettings());
    this.pathG = this.add.graphics();
    this.bossIcon = this.add.image(0, 160, "icon_boss").setScale(0.5);
    this.pathMarker = this.add.image(0, 114, "hero").setScale(0.3);
    this.tweens.add({ targets: this.pathMarker, y: 106, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.stageText = text(this, 400, 222, "", 38);
    this.cashPill = new Pill(this, W - 190, 160, 330, 84, "icon_cash", 44);
    this.gemPill = new Pill(this, W - 160, 252, 270, 72, "icon_gem", 36);
    this.luckPill = new Pill(this, 400, 292, 380, 78, "icon_clover", 38, "glass");
    this.luckPill.setSize(380, 78).setInteractive({ useHandCursor: true }).on("pointerup", () => this.showOdds());
    this.potionPill = new Pill(this, W - 160, 336, 270, 64, "icon_potion", 30, "glass");
  }

  private drawPath(): void {
    const g = this.pathG;
    g.clear();
    const xs = [...Array(WAVES_PER_STAGE)].map((_, i) => 190 + i * 105);
    g.lineStyle(14, INK_N, 1).lineBetween(xs[0], 160, xs[xs.length - 1], 160);
    g.lineStyle(6, 0xfff3dc, 1).lineBetween(xs[0], 160, xs[xs.length - 1], 160);
    xs.forEach((x, i) => {
      const w = i + 1;
      const boss = w === WAVES_PER_STAGE;
      const r = boss ? 26 : 17;
      g.fillStyle(INK_N, 1).fillCircle(x, 160, r + 5);
      g.fillStyle(w < save.wave ? 0xfff3dc : w === save.wave ? 0xff9a4a : 0x9a7a5a, 1).fillCircle(x, 160, r);
    });
    this.bossIcon.setPosition(xs[xs.length - 1], 160);
    this.pathMarker.setX(xs[save.wave - 1]);
    this.stageText.setText(`Stage ${save.stage}-${save.wave}`);
  }

  private updateHud(time: number): void {
    const key = `${save.stage}-${save.wave}`;
    if (key !== this.lastWave) {
      this.lastWave = key;
      this.drawPath();
    }
    this.hudBars.clear();
    if (battle.bossLeft > 0) {
      drawBar(this.hudBars, 24, 74, this.W - 48, 30, battle.bossLeft / BOSS_TIME, 0xf26464);
      this.progressText.setText(`BOSS  ${Math.ceil(battle.bossLeft / 1000)}s`);
    } else {
      drawBar(this.hudBars, 24, 74, this.W - 48, 30, battle.progress, 0xffe0a3);
      this.progressText.setText(`${Math.floor(battle.progress * 100)}%`);
    }
    this.cashPill.setValue(fmt(save.cash));
    this.gemPill.setValue(fmt(save.gems));
    this.luckPill.setValue(`Luck ${luckText(luck())}`);
    const active = potionActive();
    this.potionPill.setVisible(active);
    if (active) {
      const s = Math.ceil((save.potionUntil - Date.now()) / 1000);
      this.potionPill.setValue(`x${potionMult()} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
      this.luckPill.value.setColor(time % 1000 < 500 ? "#b6f59a" : "#ffffff");
    } else {
      this.luckPill.value.setColor("#ffffff");
    }
  }

  private toast(str: string, color = "#ffffff"): void {
    const t = text(this, this.W / 2, this.L.hudBottom + 60, str, 40, color).setDepth(7000);
    this.tweens.add({ targets: t, y: t.y - 60, alpha: 0, delay: 1100, duration: 500, onComplete: () => t.destroy() });
  }

  // ───────────────────────── side buttons ─────────────────────────

  private buildSideButtons(): void {
    const { sideTop } = this.L;
    const side = (left: boolean, i: number, icon: string, str: string, onClick: () => void) =>
      button(this, left ? 70 : this.W - 70, sideTop + i * 145, 180, 134, "peach", str, onClick, { icon, iconSize: 68, stack: true, size: 30 });
    side(true, 0, "icon_paw", "Pets", () => this.openSheet("pets"));
    side(true, 1, "icon_book", "Index", () => this.openSheet("index"));
    side(true, 2, "icon_potion", "Potion", () => this.showPotion());
    side(false, 0, "icon_tree", "Tree", () => this.openTree());
    side(false, 1, "icon_odds", "Odds", () => this.showOdds());
  }

  // ───────────────────────── bottom: slots, roll, cards ─────────────────────────

  private buildBottom(): void {
    const { W } = this;
    const { rollY, cardsY } = this.L;
    this.slotRow = this.add.container(0, 0);
    this.buildSlots();

    this.autoBtn = button(this, 175, rollY, 220, 122, "mint", "AUTO", () => {
      if (!autoUnlocked()) {
        this.toast("Unlock Auto Roll in the Tree!", "#ffe680");
        return;
      }
      save.autoRoll = !save.autoRoll;
      persist();
    }, { icon: "icon_auto", iconSize: 52, stack: true, size: 30 });
    this.rollBtn = button(this, W / 2, rollY, 400, 152, "orange", "ROLL", () => this.tryRoll(), {
      icon: dieTexture(this, dieSkin(), 5), iconSize: 86, size: 60,
    });
    this.fastBtn = button(this, W - 175, rollY, 220, 122, "grey", "FAST", () => {
      this.fast = !this.fast;
    }, { icon: "icon_bolt", iconSize: 50, stack: true, size: 30 });
    this.rollBar = this.add.graphics();

    BRANCHES.forEach((b, i) => {
      const x = W / 2 + (i - 1) * 352;
      const c = this.add.container(x, cardsY);
      const bg = this.add.image(0, 0, btnTexture(this, "mint", 320, 196));
      const title = text(this, 0, -122, b.title, 36);
      const icon = this.add.image(-128, -76, b.icon).setScale(0.62);
      const lvl = text(this, 136, -76, "", 24, "#fff3dc").setOrigin(1, 0.5);
      const value = text(this, 0, -26, "", 48);
      const node = label(this, 0, 18, "", 22, "#2f6f5c");
      const costBg = this.add.image(0, 60, pillTexture(this, "dark", 240, 58));
      const cash = this.add.image(-88, 60, "icon_cash").setScale(0.5);
      const cost = text(this, 14, 58, "", 32, "#ffffff");
      c.add([bg, title, icon, lvl, value, node, costBg, cash, cost]);
      c.setSize(320, 196).setInteractive({ useHandCursor: true });
      let holdTimer: Phaser.Time.TimerEvent | null = null;
      const stop = () => {
        holdTimer?.remove();
        holdTimer = null;
        this.tweens.add({ targets: c, scale: 1, duration: 100 });
      };
      c.on("pointerdown", () => {
        this.tweens.add({ targets: c, scale: 0.94, duration: 60 });
        this.buyBranch(i);
        holdTimer = this.time.addEvent({ delay: 140, startAt: -260, loop: true, callback: () => this.buyBranch(i, true) });
      });
      c.on("pointerup", stop);
      c.on("pointerout", stop);
      this.cards.push({ bg, lvl, value, cost, node });
    });
  }

  private branchNode(i: number): TreeNode | null {
    return BRANCHES[i].nodes.map((id) => TREE_BY_ID[id]).find((n) => nodeLevel(n.id) < n.max) ?? null;
  }

  private buyBranch(i: number, quiet = false): void {
    const node = this.branchNode(i);
    if (!node) return;
    if (!nodeUnlocked(node)) {
      if (!quiet) this.toast("Unlock it in the Tree first!", "#ffe680");
      return;
    }
    if (buyNode(node.id)) this.afterPurchase();
    else if (!quiet) this.toast("Not enough money!", "#ff9a9a");
  }

  private afterPurchase(): void {
    this.buildSlots();
    this.rollBtn.icon?.setTexture(dieTexture(this, dieSkin(), 5));
    this.game.events.emit("pets-changed");
  }

  private buildSlots(): void {
    this.slotRow.removeAll(true);
    const n = petSlots();
    for (let i = 0; i < MAX_SLOTS; i++) {
      const x = this.W / 2 + (i - (MAX_SLOTS - 1) / 2) * 126;
      const y = this.L.slotsY;
      const locked = i >= n;
      const slot = this.add.image(x, y, slotTexture(this, 112, locked));
      this.slotRow.add(slot);
      const key = save.equipped[i];
      if (locked) {
        this.slotRow.add(this.add.image(x, y, "icon_lock").setScale(0.45));
      } else if (key) {
        const { def, variant } = parseKey(key);
        this.slotRow.add(this.add.image(x, y + 4, petTexture(this, def.id, variant)).setScale(0.5));
      } else {
        this.slotRow.add(text(this, x, y, "+", 54, "#d9bb8c", { stroke: false }));
      }
      slot.setInteractive({ useHandCursor: true }).on("pointerup", () => this.openSheet("pets"));
    }
  }

  private updateBottom(time: number): void {
    const left = this.rollReadyAt - time;
    const busy = this.revealing || this.celebrating;
    this.rollBtn.setLabel(left > 0 ? `${(left / 1000).toFixed(1)}s` : "ROLL");
    this.rollBtn.setColor(left > 0 || busy ? "peach" : "orange");
    this.rollBar.clear();
    if (left > 0) drawBar(this.rollBar, this.W / 2 - 150, this.L.rollY + 52, 300, 14, 1 - left / rollTime(), 0xffe066);
    const unlocked = autoUnlocked();
    this.autoBtn.setColor(unlocked && save.autoRoll ? "green" : unlocked ? "mint" : "grey");
    this.autoBtn.setLabel(unlocked ? (save.autoRoll ? "AUTO ON" : "AUTO") : "LOCKED");
    this.fastBtn.setColor(this.fast ? "green" : "mint");

    BRANCHES.forEach((b, i) => {
      const card = this.cards[i];
      const node = this.branchNode(i);
      card.value.setText(b.value());
      fitText(card.value, 280);
      if (!node) {
        card.lvl.setText("MAX");
        card.node.setText("All bought!");
        card.cost.setText("MAX");
        return;
      }
      const lv = nodeLevel(node.id);
      card.lvl.setText(node.max > 1 ? `Lv.${lv}` : "");
      card.node.setText(`${node.name}: ${effectText(node)}`);
      fitText(card.node, 290);
      if (!nodeUnlocked(node)) {
        card.cost.setText("LOCKED").setColor("#c9bfb2");
      } else {
        const cost = nodeCost(node, lv);
        card.cost.setText(fmt(cost)).setColor(save.cash >= cost ? "#ffffff" : "#ff9a9a");
      }
      fitText(card.cost, 160);
    });
  }

  // ───────────────────────── rolling ─────────────────────────

  private tryRoll(): void {
    if (this.revealing || this.celebrating || this.time.now < this.rollReadyAt) return;
    const results = rollMany(dicePerRoll(), luck());
    this.rollReadyAt = this.time.now + rollTime();
    this.autoEquip(results);
    this.reveal(results);
  }

  /** Fill empty team slots with new pets so players see them fight right away. */
  private autoEquip(results: RollResult[]): void {
    let changed = false;
    for (const r of results) {
      const key = makeKey(r.item.id, "normal");
      if (save.equipped.length < petSlots() && !save.equipped.includes(key)) {
        save.equipped.push(key);
        changed = true;
      }
    }
    if (changed) {
      persist();
      this.buildSlots();
      this.game.events.emit("pets-changed");
    }
  }

  /** Dice fly up, flip into pet cards, then the cards fly into the Pets button. */
  private reveal(results: RollResult[]): void {
    this.revealing = true;
    const n = results.length;
    const cy = this.L.catY - 360;
    const spacing = Math.min(210, 940 / n);
    const scale = n <= 2 ? 0.8 : n <= 3 ? 0.7 : 0.6;
    const spin = this.fast ? 0 : Math.min(520, rollTime() * 0.35);
    const hold = this.fast ? 320 : Math.min(800, Math.max(380, rollTime() * 0.45));
    const skin = dieSkin();
    let done = 0;

    results.forEach((r, i) => {
      const x = this.W / 2 + (i - (n - 1) / 2) * spacing;
      const showCard = () => {
        const card = petCard(this, x, cy, makeKey(r.item.id, "normal"), { isNew: r.isNew }).setScale(0, scale).setDepth(4200);
        const glow = this.add.image(x, cy, "glow").setTint(RARITY_INFO[r.item.rarity].color).setScale(0).setAlpha(0.8).setDepth(4190);
        this.tweens.add({ targets: card, scaleX: scale, duration: 140, ease: "Back.out" });
        this.tweens.add({ targets: glow, scale: scale * 1.6, duration: 200 });
        this.time.delayedCall(hold, () => {
          this.tweens.add({ targets: glow, alpha: 0, duration: 200, onComplete: () => glow.destroy() });
          this.tweens.add({
            targets: card, x: 70, y: this.L.sideTop, scale: 0.08, duration: 320, ease: "Cubic.in",
            onComplete: () => {
              card.destroy();
              if (++done === n) this.finishReveal(results);
            },
          });
        });
      };
      if (spin === 0) {
        showCard();
        return;
      }
      const die = this.add.image(this.W / 2, this.L.rollY, dieTexture(this, skin, Phaser.Math.Between(1, 6))).setScale(0.3).setDepth(4200);
      const flicker = this.time.addEvent({ delay: 60, loop: true, callback: () => die.setTexture(dieTexture(this, skin, Phaser.Math.Between(1, 6))) });
      this.tweens.add({ targets: die, x, duration: spin, ease: "Sine.out" });
      this.tweens.add({ targets: die, scale: 0.75, angle: Phaser.Math.Between(540, 900), duration: spin });
      this.tweens.add({
        targets: die, y: cy, duration: spin, ease: "Back.out",
        onComplete: () => {
          flicker.remove();
          this.tweens.add({
            targets: die, scaleX: 0, duration: 80,
            onComplete: () => {
              die.destroy();
              showCard();
            },
          });
        },
      });
    });
  }

  private finishReveal(results: RollResult[]): void {
    this.revealing = false;
    const best = results.reduce((a, b) => (b.item.oneIn > a.item.oneIn ? b : a));
    const rank = rarityRank(best.item.rarity);
    if ((best.isNew && rank >= 3) || (rank >= 3 && best.item.oneIn >= luck() * 500)) this.celebrate(best);
  }

  /** Full-screen moment for great pulls. */
  private celebrate(res: RollResult): void {
    this.celebrating = true;
    const { W, H } = this;
    const info = RARITY_INFO[res.item.rarity];
    const cy = H * 0.42;
    const dim = this.add.rectangle(0, 0, W, H, 0x2a1a10, 0.82).setOrigin(0).setInteractive();
    const rays = this.add.image(W / 2, cy, "rays").setScale(2.3).setTint(info.color).setAlpha(0.5);
    const glow = this.add.image(W / 2, cy, "glow").setScale(3.2).setTint(info.color).setAlpha(0.85);
    const title = text(this, W / 2, cy - 470, `${info.label.toUpperCase()}!`, 116, info.css);
    if (res.item.rarity === "secret") title.setTint(0xff6b81, 0xffe066, 0x5ac8ff, 0xb98aff);
    const card = petCard(this, W / 2, cy, makeKey(res.item.id, "normal"), { isNew: res.isNew }).setScale(0);
    const odds = text(this, W / 2, cy + 345, oneIn(res.item.oneIn), 66, "#ffe680");
    const tap = text(this, W / 2, cy + 470, "TAP TO CONTINUE", 40);
    const confetti = this.add.particles(0, -30, "puff", {
      x: { min: 0, max: W }, speedY: { min: 250, max: 560 }, speedX: { min: -120, max: 120 }, lifespan: 4200,
      scaleX: { min: 0.25, max: 0.5 }, scaleY: { min: 0.5, max: 0.9 }, rotate: { min: 0, max: 360 },
      tint: [0xff6b81, 0xffe066, 0x6ff08a, 0x5ac8ff, 0xb98aff, 0xffffff], frequency: 25, quantity: 2,
    });
    const root = this.add.container(0, 0, [dim, rays, glow, confetti, card, title, odds, tap]).setDepth(6000);
    this.cameras.main.flash(300, 255, 250, 230);
    this.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
    this.tweens.add({ targets: card, scale: 1.75, duration: 500, ease: "Back.out" });
    title.setScale(0);
    this.tweens.add({ targets: title, scale: 1, duration: 450, delay: 150, ease: "Back.out" });
    this.tweens.add({ targets: tap, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      confetti.stop();
      this.tweens.add({
        targets: root, alpha: 0, duration: 220,
        onComplete: () => {
          root.destroy();
          this.celebrating = false;
        },
      });
    };
    this.time.delayedCall(700, () => dim.once("pointerup", finish));
    if (save.autoRoll) this.time.delayedCall(3000, finish);
  }

  // ───────────────────────── dragging (grids and tree) ─────────────────────────

  private setupDragging(): void {
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const area = this.tree ?? this.scroller;
      if (!area || p.y < area.top || p.y > area.bottom || (this.openModal && !this.tree)) return;
      if (this.tree && this.openModal) return;
      this.drag = { active: true, startX: p.x, startY: p.y, ox: this.tree ? this.tree.map.x : 0, oy: this.tree ? this.tree.map.y : this.scroller!.list.y, moved: false };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.drag.active || !p.isDown) return;
      const dx = p.x - this.drag.startX;
      const dy = p.y - this.drag.startY;
      if (Math.abs(dx) + Math.abs(dy) > 14) this.drag.moved = true;
      if (this.tree) {
        const b = this.tree.bounds;
        this.tree.map.setPosition(Phaser.Math.Clamp(this.drag.ox + dx, b.minX, b.maxX), Phaser.Math.Clamp(this.drag.oy + dy, b.minY, b.maxY));
      } else if (this.scroller) {
        this.scroller.list.y = Phaser.Math.Clamp(this.drag.oy + dy, -this.scroller.max, 0);
      }
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!this.drag.active) return;
      this.drag.active = false;
      if (this.drag.moved) return;
      if (this.tree) {
        const m = this.tree.map;
        const hit = TREE.find((node) => {
          const pos = this.nodePos(node);
          return Phaser.Math.Distance.Between(p.x, p.y, pos.x + m.x + m.parentContainer!.x, pos.y + m.y + m.parentContainer!.y) < 70;
        });
        if (hit) this.selectNode(hit.id);
      } else if (this.scroller) {
        const s = this.scroller;
        const hit = s.items.find(({ obj }) => {
          const m = obj.getWorldTransformMatrix();
          return Math.abs(p.x - m.tx) < (CARD_W * m.scaleX) / 2 && Math.abs(p.y - m.ty) < (CARD_H * m.scaleY) / 2;
        });
        hit?.onTap();
      }
    });
  }

  // ───────────────────────── pets & index sheets ─────────────────────────

  private openSheet(kind: "pets" | "index"): void {
    this.sheet?.close();
    const top = 350;
    const h = this.H - top - 30;
    const cy = top + h / 2;
    const title = kind === "pets" ? "MY PETS" : `INDEX ${save.discovered.length}/${PET_LIST.length}`;
    const m = modal(this, 1030, h, title, kind === "pets" ? "orange" : "blue", () => {
      if (this.sheet === m) {
        this.sheet = null;
        this.scroller = null;
      }
    }, cy);
    this.sheet = m;
    this.sheetKind = kind;
    const body = m.body;
    let gridTop = -h / 2 + 90;

    if (kind === "pets") {
      const slots = petSlots();
      body.add(label(this, -470, -h / 2 + 100, `TEAM ${save.equipped.length}/${slots}`, 34).setOrigin(0, 0.5));
      for (let i = 0; i < slots; i++) {
        const x = -440 + i * 112;
        const y = -h / 2 + 222;
        const key = save.equipped[i];
        if (key) {
          const c = petCard(this, x, y, key, { noOdds: true }).setScale(0.44);
          c.setInteractive({ useHandCursor: true }).on("pointerup", () => this.openPet(key));
          body.add(c);
        } else {
          body.add(this.add.image(x, y, slotTexture(this, 100, false)));
        }
      }
      body.add(button(this, 330, -h / 2 + 150, 300, 96, "blue", "EQUIP BEST", () => this.equipBest(), { icon: "icon_star", iconSize: 46, size: 30 }));
      body.add(button(this, 330, -h / 2 + 260, 300, 96, "orange", "FUSE ALL", () => this.fuseAll(), { icon: "icon_fuse", iconSize: 46, size: 30 }));
      gridTop = -h / 2 + 330;
    }

    const gridBottom = h / 2 - 30;
    body.add(this.add.image(0, (gridTop + gridBottom) / 2, panelTexture(this, "inset", 970, gridBottom - gridTop)));
    const list = this.add.container(0, 0);
    const mask = this.make.graphics({}, false).fillRect(0, cy + gridTop + 6, this.W, gridBottom - gridTop - 12);
    list.setMask(mask.createGeometryMask());
    body.add(list);

    const scale = kind === "pets" ? 0.8 : 0.72;
    const cols = 4;
    const colW = 238;
    const rowH = CARD_H * scale + 20;
    const items: Scroller["items"] = [];
    const place = (i: number) => ({ x: (i % cols - (cols - 1) / 2) * colW, y: gridTop + 18 + (CARD_H * scale) / 2 + Math.floor(i / cols) * rowH });

    if (kind === "pets") {
      const keys = Object.keys(save.inventory).sort((a, b) => {
        const A = parseKey(a);
        const B = parseKey(b);
        return B.def.index - A.def.index || VARIANT_RANK[B.variant] - VARIANT_RANK[A.variant];
      });
      keys.forEach((key, i) => {
        const { x, y } = place(i);
        const card = petCard(this, x, y, key, {
          count: save.inventory[key],
          equipped: save.equipped.includes(key),
          fuseReady: save.inventory[key] >= FUSE_COST && !!nextVariant(parseKey(key).variant),
        }).setScale(scale);
        list.add(card);
        items.push({ obj: card, onTap: () => this.openPet(key) });
      });
      this.scroller = { list, top: cy + gridTop, bottom: cy + gridBottom, max: Math.max(0, Math.ceil(keys.length / cols) * rowH + 36 - (gridBottom - gridTop)), items };
    } else {
      PET_LIST.forEach((def, i) => {
        const { x, y } = place(i);
        const owned = save.discovered.includes(def.id);
        const card = owned ? petCard(this, x, y, makeKey(def.id, "normal")).setScale(scale) : lockedCard(this, x, y, def.id).setScale(scale);
        list.add(card);
        if (owned) {
          const key = makeKey(def.id, "normal");
          items.push({ obj: card, onTap: () => (save.inventory[key] ? this.openPet(key) : this.toast("You fused all of these!")) });
        }
      });
      this.scroller = { list, top: cy + gridTop, bottom: cy + gridBottom, max: Math.max(0, Math.ceil(PET_LIST.length / cols) * rowH + 36 - (gridBottom - gridTop)), items };
    }
  }

  private refreshAfterPetChange(): void {
    this.buildSlots();
    this.game.events.emit("pets-changed");
    if (this.sheet) {
      const kind = this.sheetKind;
      const y = this.scroller?.list.y ?? 0;
      this.sheet.root.destroy();
      this.sheet = null;
      this.openSheet(kind);
      if (this.scroller) this.scroller.list.y = Phaser.Math.Clamp(y, -this.scroller.max, 0);
    }
  }

  private equipBest(): void {
    save.equipped = Object.keys(save.inventory).sort((a, b) => petScore(b) - petScore(a)).slice(0, petSlots());
    persist();
    this.refreshAfterPetChange();
  }

  private fuseAll(): void {
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
    this.toast(fused ? `Fused ${fused} pet${fused > 1 ? "s" : ""}!` : `Need ${FUSE_COST} of the same pet to fuse`, fused ? "#ffe066" : "#ff9a9a");
    if (fused) this.refreshAfterPetChange();
  }

  private openPet(key: ItemKey): void {
    const { def, variant } = parseKey(key);
    const count = save.inventory[key] ?? 0;
    const mult = VARIANT_INFO[variant].mult;
    const equipped = save.equipped.includes(key);
    const next = nextVariant(variant);
    const h = 1150;
    const m = modal(this, 920, h, `${VARIANT_INFO[variant].label}${def.name}`, "purple", () => {
      if (this.openModal === m) this.openModal = null;
    });
    this.openModal = m;
    const done = () => {
      m.close();
      this.refreshAfterPetChange();
    };
    m.body.add(petCard(this, 0, -280, key, { count }).setScale(1.2));
    m.body.add(label(this, 0, -66, def.description, 32, "#7a5236", 760));
    m.body.add(this.add.image(0, 105, panelTexture(this, "inset", 780, 260)));
    const rows: [string, string, string][] = def.kind === "buff"
      ? [["icon_star", "Type", KIND_LABEL[def.kind]], ["icon_sword", "Team damage", `+${fmt(def.damage * mult)}%`]]
      : [
        ["icon_sword", "Damage", fmt(def.damage * mult)],
        ["icon_clock", "Attacks every", `${(def.cooldown / 1000).toFixed(1)}s`],
        ["icon_target", `${KIND_LABEL[def.kind]} targets`, String(def.count)],
      ];
    rows.forEach(([icon, name, value], i) => {
      const y = 25 + i * 80 + (rows.length === 2 ? 40 : 0);
      m.body.add([
        this.add.image(-320, y, icon).setScale(0.5),
        label(this, -275, y, name, 34).setOrigin(0, 0.5),
        text(this, 340, y, value, 40, "#ffe066").setOrigin(1, 0.5),
      ]);
    });
    if (variant !== "normal") m.body.add(label(this, 0, 268, `${VARIANT_INFO[variant].label.trim()} bonus: x${mult} power`, 30, "#c47a10"));

    const full = !equipped && save.equipped.length >= petSlots();
    m.body.add(button(this, next ? -205 : 0, 410, 380, 134, equipped ? "red" : "green", equipped ? "UNEQUIP" : full ? "SWAP IN" : "EQUIP", () => {
      if (full) {
        const weakest = [...save.equipped].sort((a, b) => petScore(a) - petScore(b))[0];
        save.equipped = save.equipped.filter((k) => k !== weakest);
      }
      toggleEquip(key, petSlots());
      done();
    }, { size: 42 }));
    if (next) {
      m.body.add(button(this, 205, 410, 380, 134, "orange", `FUSE ${Math.min(count, FUSE_COST)}/${FUSE_COST}`, () => {
        if (fuse(key)) this.cameras.main.flash(250, 255, 230, 120);
        done();
      }, { size: 40, sub: `into ${VARIANT_INFO[next].label.trim()}` }).setEnabled(count >= FUSE_COST));
    }
  }

  // ───────────────────────── upgrade tree ─────────────────────────

  private nodePos(node: TreeNode): { x: number; y: number } {
    return { x: this.W / 2 + (node.x - 0.5) * 230, y: node.y * 215 };
  }

  private openTree(): void {
    this.sheet?.close();
    const { W, H } = this;
    const top = 40;
    const panelH = H - 80;
    const root = this.add.container(0, 0).setDepth(4500);
    const dim = this.add.rectangle(0, 0, W, H, 0x2a1a10, 0.7).setOrigin(0).setInteractive();
    const panel = this.add.image(W / 2, top + panelH / 2, panelTexture(this, "cream", 1050, panelH));
    root.add([dim, panel]);
    const mapTop = top + 150;
    const mapBottom = H - 420;
    root.add(this.add.image(W / 2, (mapTop + mapBottom) / 2, panelTexture(this, "inset", 1000, mapBottom - mapTop)));
    root.add(text(this, 330, top + 70, "UPGRADE TREE", 54));
    const cash = new Pill(this, W - 260, top + 70, 280, 76, "icon_cash", 38);
    root.add(cash);
    root.add(iconButton(this, W - 58, top + 30, "icon_close", 86, () => this.closeTree()));

    const holder = this.add.container(0, 0);
    const map = this.add.container(0, 0);
    holder.add(map);
    const mask = this.make.graphics({}, false).fillRect(30, mapTop + 6, W - 60, mapBottom - mapTop - 12);
    holder.setMask(mask.createGeometryMask());
    root.add(holder);

    const info = this.add.container(W / 2, H - 230);
    root.add(info);

    const xs = TREE.map((n) => this.nodePos(n).x);
    const ys = TREE.map((n) => this.nodePos(n).y);
    const viewH = mapBottom - mapTop;
    const bounds = {
      minX: Math.min(0, W - 110 - Math.max(...xs)),
      maxX: Math.max(0, 110 - Math.min(...xs)),
      minY: mapBottom - 110 - Math.max(...ys),
      maxY: Math.max(mapBottom - 110 - Math.max(...ys), mapTop + 110 - Math.min(...ys)),
    };
    this.tree = { root, map, top: mapTop, bottom: mapBottom, bounds, info, selected: "" };
    this.drawTree();
    // start near the most advanced node you can buy
    const focus = TREE.filter((n) => nodeUnlocked(n) && nodeLevel(n.id) < n.max).sort((a, b) => a.y - b.y)[0] ?? TREE[0];
    const fp = this.nodePos(focus);
    map.setPosition(
      Phaser.Math.Clamp(W / 2 - fp.x, bounds.minX, bounds.maxX),
      Phaser.Math.Clamp(mapTop + viewH * 0.6 - fp.y, bounds.minY, bounds.maxY),
    );
    this.selectNode(focus.id);
    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: 160 });
    this.treeTimer = this.time.addEvent({ delay: 250, loop: true, callback: () => cash.setValue(fmt(save.cash)) });
    cash.setValue(fmt(save.cash));
  }

  private closeTree(): void {
    if (!this.tree) return;
    const root = this.tree.root;
    this.tree = null;
    this.treeTimer?.remove();
    this.treeTimer = null;
    this.tweens.add({ targets: root, alpha: 0, duration: 140, onComplete: () => root.destroy() });
  }

  private drawTree(): void {
    if (!this.tree) return;
    const map = this.tree.map;
    map.removeAll(true);
    const g = this.add.graphics();
    map.add(g);
    for (const node of TREE) {
      const a = this.nodePos(node);
      for (const r of node.req) {
        const b = this.nodePos(TREE_BY_ID[r]);
        const owned = nodeLevel(r) > 0;
        g.lineStyle(22, INK_N, 1).lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(12, owned ? 0x7ad651 : 0xc9bfb2, 1).lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    for (const node of TREE) {
      const { x, y } = this.nodePos(node);
      const lv = nodeLevel(node.id);
      const unlocked = nodeUnlocked(node);
      const state = lv >= node.max ? "max" : !unlocked ? "locked" : canBuy(node) ? "ready" : "open";
      const img = this.add.image(x, y, nodeTexture(this, state));
      if (node.id === this.tree.selected) img.setTint(0xfff2c0);
      map.add(img);
      const icon = this.add.image(x, y - 4, `icon_${node.icon}`).setScale(0.6);
      map.add(icon);
      if (!unlocked) {
        icon.setTint(0x9a8e80).setAlpha(0.75);
        map.add(this.add.image(x + 40, y - 40, "icon_lock").setScale(0.36));
      }
      map.add(text(this, x, y + 50, node.max > 1 ? `${lv}/${node.max >= 999 ? "∞" : node.max}` : lv ? "OWNED" : "", 24));
      if (state === "ready") {
        const pulse = this.add.image(x, y, nodeTexture(this, "ready")).setAlpha(0.5);
        map.addAt(pulse, 1);
        this.tweens.add({ targets: pulse, scale: 1.15, alpha: 0, duration: 900, repeat: -1 });
      }
    }
  }

  private selectNode(id: string): void {
    if (!this.tree) return;
    this.tree.selected = id;
    this.drawTree();
    const node = TREE_BY_ID[id];
    const info = this.tree.info;
    info.removeAll(true);
    const lv = nodeLevel(id);
    const maxed = lv >= node.max;
    const unlocked = nodeUnlocked(node);
    const cost = nodeCost(node, lv);
    info.add(this.add.image(0, 0, panelTexture(this, "row", 1000, 300)));
    info.add(this.add.image(-400, -40, nodeTexture(this, maxed ? "max" : unlocked ? "open" : "locked")).setScale(0.9));
    info.add(this.add.image(-400, -44, `icon_${node.icon}`).setScale(0.6));
    info.add(label(this, -310, -90, node.name, 46, "#4a2f1d").setOrigin(0, 0.5));
    info.add(label(this, -310, -40, effectText(node) + (node.max > 1 ? " per level" : ""), 32).setOrigin(0, 0.5));
    info.add(label(this, -310, 6, node.max > 1 ? `Level ${lv} / ${node.max >= 999 ? "∞" : node.max}` : lv ? "Owned" : "Not owned", 30, "#9a7a5a").setOrigin(0, 0.5));
    if (!unlocked) {
      info.add(label(this, 0, 90, `Needs: ${node.req.map((r) => TREE_BY_ID[r].name).join(", ")}`, 32, "#c0564a"));
      return;
    }
    if (maxed) {
      info.add(text(this, 0, 90, "MAXED!", 52, "#ffe066"));
      return;
    }
    info.add(button(this, 0, 88, 460, 120, save.cash >= cost ? "green" : "grey", "BUY", () => {
      if (buyNode(id)) {
        this.afterPurchase();
        this.cameras.main.flash(120, 200, 255, 180);
        this.selectNode(id);
      } else {
        this.toast("Not enough money!", "#ff9a9a");
      }
    }, { sub: fmt(cost), subIcon: "icon_cash", size: 44 }));
  }

  // ───────────────────────── popups ─────────────────────────

  private showModal(m: Modal): Modal {
    this.openModal?.close();
    this.openModal = m;
    return m;
  }

  private showOdds(): void {
    const L = luck();
    const chances = tierChances(L);
    const h = 360 + RARITY_ORDER.length * 82;
    const m = this.showModal(modal(this, 940, h, "YOUR ODDS", "green", () => (this.openModal = null)));
    m.body.add(text(this, 0, -h / 2 + 110, `Luck ${luckText(L)}`, 46, "#b6f59a"));
    m.body.add(label(this, 0, -h / 2 + 162, `Worst possible roll: ${luckFloor(L).name}`, 28));
    RARITY_ORDER.forEach((r, i) => {
      const y = -h / 2 + 235 + i * 82;
      const p = chances[i];
      const info = RARITY_INFO[r];
      m.body.add([
        this.add.image(0, y, panelTexture(this, "row", 840, 72)),
        this.add.image(-380, y, btnTexture(this, "grey", 40, 40)).setTint(info.color),
        text(this, -340, y, info.label, 34, info.css).setOrigin(0, 0.5),
        label(this, 390, y, p <= 0 ? "-" : p > 0.5 ? `${Math.round(p * 100)}%` : oneIn(1 / p), 32, "#4a2f1d").setOrigin(1, 0.5),
      ]);
    });
    m.body.add(label(this, 0, h / 2 - 70, `Rarest roll: ${oneIn(save.bestRoll)}   •   Rolls: ${fmt(save.totalRolls)}`, 28, "#9a7a5a"));
  }

  private showPotion(): void {
    const h = 760;
    const m = this.showModal(modal(this, 860, h, "LUCK POTION", "purple", () => (this.openModal = null)));
    const content = this.add.container(0, 0);
    m.body.add(content);
    const draw = () => {
      content.removeAll(true);
      content.add(this.add.image(0, -150, "glow").setTint(0x9cf06a).setScale(1.3).setAlpha(0.7));
      content.add(this.add.image(0, -150, "icon_potion").setScale(2));
      content.add(text(this, 0, 10, `x${potionMult()} LUCK for ${potionMinutes()} min`, 48, "#b6f59a"));
      const left = save.potionUntil - Date.now();
      content.add(label(this, 0, 80, left > 0 ? `Active: ${Math.ceil(left / 60000)} min left (drinking adds more time)` : "Bosses drop gems. Spend them on potions!", 30, "#7a5236", 760));
      content.add(this.add.image(-60, 150, "icon_gem").setScale(0.6));
      content.add(text(this, 20, 150, `${fmt(save.gems)}`, 44).setOrigin(0, 0.5));
      content.add(button(this, 0, 270, 460, 130, "purple", "DRINK", () => {
        if (save.gems < POTION_GEMS) {
          this.toast("Not enough gems! Beat bosses to get more.", "#ff9a9a");
          return;
        }
        save.gems -= POTION_GEMS;
        save.potionUntil = Math.max(Date.now(), save.potionUntil) + potionMinutes() * 60000;
        persist();
        this.cameras.main.flash(200, 180, 255, 160);
        draw();
      }, { sub: `${POTION_GEMS} gems`, subIcon: "icon_gem", size: 46 }).setEnabled(save.gems >= POTION_GEMS));
    };
    draw();
  }

  private showSettings(): void {
    const h = 880;
    const m = this.showModal(modal(this, 860, h, "SETTINGS", "peach", () => (this.openModal = null)));
    m.body.add(label(this, 0, -h / 2 + 140,
      `Best stage: ${save.bestStage}\nRolls: ${fmt(save.totalRolls)}\nRarest roll: ${oneIn(save.bestRoll)}\nPets found: ${save.discovered.length}/${PET_LIST.length}`, 36, "#7a5236"));
    m.body.add(label(this, 0, -30, "Testing tools (removed before release)", 26, "#9a7a5a"));
    const dev = (y: number, x: number, str: string, fn: () => void) =>
      m.body.add(button(this, x, y, 360, 96, "grey", str, () => {
        fn();
        persist();
      }, { size: 30 }));
    dev(60, -190, "+10K money", () => (save.cash += 1e4));
    dev(60, 190, "+1B money", () => (save.cash += 1e9));
    dev(180, -190, "+100 gems", () => (save.gems += 100));
    dev(180, 190, "+1Qa money", () => (save.cash += 1e15));
    m.body.add(button(this, 0, 320, 460, 110, "red", "RESET SAVE", () => {
      resetSave();
      window.location.reload();
    }, { size: 36 }));
  }

  /** "Welcome back" reward — the idle part of the game. */
  private offlineEarnings(): void {
    const away = (Date.now() - lastSeenAtLoad) / 1000;
    if (away < 60 || save.cashPerSec <= 0) return;
    const seconds = Math.min(away, 8 * 3600);
    const cash = Math.floor(save.cashPerSec * seconds * offlineRate());
    if (cash <= 0) return;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const m = this.showModal(modal(this, 880, 820, "WELCOME BACK!", "gold", () => (this.openModal = null)));
    const collect = (mult: number) => {
      save.cash += cash * mult;
      persist();
      m.close();
    };
    m.body.add([
      this.add.image(0, -150, "glow").setScale(1.6).setTint(0xffe066).setAlpha(0.6),
      this.add.image(0, -120, "hero").setScale(1.2),
      label(this, 0, 20, `Your team fought for ${hours ? `${hours}h ` : ""}${mins}m while you were away`, 32, "#7a5236", 700),
      this.add.image(-150, 135, "icon_cash").setScale(0.95),
      fitText(text(this, -80, 132, `+${fmt(cash)}`, 84, "#8af06a").setOrigin(0, 0.5), 360),
      button(this, -195, 300, 360, 130, "green", "COLLECT", () => collect(1), { size: 44 }),
      // In the real game this would show a rewarded ad first
      button(this, 195, 300, 360, 130, "purple", "x2", () => collect(2), { icon: "icon_ad", iconSize: 70, size: 52 }),
    ]);
  }
}
