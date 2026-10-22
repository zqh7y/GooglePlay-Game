import Phaser from "phaser";
import { CARD_H, bottomPanelTexture, dieKey, panelTexture } from "../art/ui";
import { INK_N } from "../art/draw";
import { DICE, DiceDef, PITY_ROLLS } from "../data/dice";
import { FUSE_COST, ITEMS, ItemKey, VARIANT_INFO, makeKey, nextVariant, parseKey } from "../data/items";
import { RARITY_INFO, rarityRank } from "../data/rarity";
import { UPGRADES, luckMult } from "../data/upgrades";
import { GAME_W, NAV_H, battleHeight } from "../layout";
import { RollResult, oddsOf, rollDie } from "../systems/roll";
import { MAX_EQUIPPED, fuse, lastSeenAtLoad, persist, resetSave, save, toggleEquip } from "../systems/save";
import { fmt } from "../ui/format";
import { Button, Modal, Pill, button, drawBar, fitText, lockedCard, modal, petCard, text } from "../ui/widgets";

type Tab = "roll" | "pets" | "upgrades";

const VARIANT_RANK = { normal: 0, golden: 1, rainbow: 2 };
const KIND_LABEL = { shot: "Shooter", pierce: "Beam", splash: "Splash", zap: "Lightning", buff: "Support" };

/** Rough strength of a pet, used by "Equip Best". */
function petScore(key: ItemKey): number {
  const { def, variant } = parseKey(key);
  const m = VARIANT_INFO[variant].mult;
  if (def.kind === "buff") return def.damage * m * 0.6 + 1;
  const area = def.kind === "splash" || def.kind === "pierce" ? 1.5 : 1;
  return ((def.damage * m * Math.max(1, def.count)) / (def.cooldown / 1000)) * area;
}

/**
 * The bottom part of the screen: Roll / Pets / Upgrade tabs, popups and the
 * legendary celebration. The battle keeps running above while these are used.
 */
export class UIScene extends Phaser.Scene {
  private W = GAME_W;
  private H = 0;
  /** top of the bottom panel */
  private P = 0;
  private navTop = 0;
  /** the roll tab's result area grows on tall phones */
  private stageTop = 0;
  private stageBottom = 0;
  private get stageY(): number {
    return (this.stageTop + this.stageBottom) / 2;
  }
  private tab: Tab = "roll";
  private panels!: Record<Tab, Phaser.GameObjects.Container>;
  private tabButtons!: Record<Tab, Button>;
  private openModal: Modal | null = null;

  // roll tab
  private dieIndex = 0;
  private rolling = false;
  private celebrating = false;
  private auto = false;
  private fast = false;
  private lastCount = 1;
  private shown: Phaser.GameObjects.GameObject[] = [];
  private dieButtons: Button[] = [];
  private rollButtons: Button[] = [];
  private autoBtn!: Button;
  private fastBtn!: Button;
  private luckPill!: Pill;
  private pityText!: Phaser.GameObjects.Text;
  private pityBar!: Phaser.GameObjects.Graphics;
  private stageGlow!: Phaser.GameObjects.Image;
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;

  // pets tab
  private petList!: Phaser.GameObjects.Container;
  private gridCards: { key: ItemKey; card: Phaser.GameObjects.Container }[] = [];
  private gridTop = 0;
  private gridBottom = 0;
  private maxScroll = 0;

  constructor() {
    super("UI");
  }

  private get die(): DiceDef {
    return DICE[this.dieIndex];
  }

  create(): void {
    this.H = this.scale.height;
    this.P = battleHeight(this.H);
    this.navTop = this.H - NAV_H;
    this.stageTop = this.P + 258;
    this.stageBottom = this.navTop - 290;
    this.rolling = false;
    this.celebrating = false;
    this.auto = false;
    this.shown = [];
    this.openModal = null;

    this.add.image(0, this.P, bottomPanelTexture(this, this.W, this.H - this.P)).setOrigin(0);
    this.panels = {
      roll: this.add.container(0, 0),
      pets: this.add.container(0, 0),
      upgrades: this.add.container(0, 0),
    };
    this.buildRollPanel();
    this.buildPetsPanel();
    this.buildUpgradesPanel();
    this.buildNav();
    this.showTab("roll", false);
    this.setupGridScrolling();
    this.offlineEarnings();
  }

  // ───────────────────────── navigation ─────────────────────────

  private buildNav(): void {
    const g = this.add.graphics();
    g.fillStyle(INK_N, 1).fillRect(0, this.navTop - 8, this.W, NAV_H + 8);
    g.fillStyle(0x12143a, 1).fillRect(0, this.navTop - 2, this.W, NAV_H + 2);
    const tabs: [Tab, string, string][] = [["roll", "ROLL", "icon_dice"], ["pets", "PETS", "icon_paw"], ["upgrades", "UPGRADE", "icon_up"]];
    this.tabButtons = {} as Record<Tab, Button>;
    tabs.forEach(([id, label, icon], i) => {
      this.tabButtons[id] = button(this, 185 + i * 355, this.navTop + 80, 330, 140, "dark", label, () => this.showTab(id), {
        icon, iconSize: 72, stack: true, size: 34,
      });
    });
  }

  private showTab(tab: Tab, animate = true): void {
    this.tab = tab;
    (Object.keys(this.panels) as Tab[]).forEach((t) => {
      const on = t === tab;
      this.panels[t].setVisible(on);
      this.tabButtons[t].setColor(on ? "orange" : "dark");
      this.tabButtons[t].icon?.setScale((on ? 84 : 66) / 96);
    });
    if (tab === "pets") this.buildPetsPanel();
    if (tab === "upgrades") this.buildUpgradesPanel();
    if (tab === "roll") this.refreshRoll();
    if (animate) {
      const p = this.panels[tab];
      p.setAlpha(0).setY(24);
      this.tweens.add({ targets: p, alpha: 1, y: 0, duration: 160, ease: "Quad.out" });
    }
  }

  private toast(str: string, color = "#ff8a8a"): void {
    const t = text(this, this.W / 2, this.stageBottom - 20, str, 40, color).setDepth(4000);
    this.tweens.add({ targets: t, y: t.y - 70, alpha: 0, delay: 700, duration: 500, onComplete: () => t.destroy() });
  }

  private showModal(m: Modal): Modal {
    this.openModal?.close();
    this.openModal = m;
    return m;
  }

  // ───────────────────────── Roll tab ─────────────────────────

  private buildRollPanel(): void {
    const p = this.panels.roll;
    const P = this.P;

    this.dieButtons = DICE.map((d, i) =>
      button(this, 280 + i * 520, P + 100, 490, 135, "dark", d.name, () => {
        if (this.rolling) return;
        this.dieIndex = i;
        this.refreshRoll();
        this.showIdleDie();
      }, { icon: dieKey(d.id, 5), iconSize: 96, sub: fmt(d.cost), subIcon: "icon_coin", size: 40 }),
    );

    this.luckPill = new Pill(this, 180, P + 220, 300, 78, "icon_clover", 36, "#9cf05a");
    this.pityText = text(this, 720, P + 196, "", 26, "#ffd84a");
    this.pityBar = this.add.graphics();

    const sy = this.stageY;
    const sh = this.stageBottom - this.stageTop;
    const stage = this.add.image(this.W / 2, sy, panelTexture(this, "inset", 1036, sh));
    const rays = this.add.image(this.W / 2, sy, "rays").setScale(Math.max(0.75, sh / 450)).setAlpha(0.08);
    this.tweens.add({ targets: rays, angle: 360, duration: 30000, repeat: -1 });
    this.stageGlow = this.add.image(this.W / 2, sy, "glow").setScale(1.5).setAlpha(0.45);
    const pedestal = this.add.ellipse(this.W / 2, sy + 117, 320, 54, 0x000000, 0.28);

    const costLabel = (n: number) => fmt(this.die.cost * n);
    this.rollButtons = [
      button(this, 172, this.navTop - 192, 280, 140, "purple", "ROLL x3", () => this.roll(3), { sub: costLabel(3), subIcon: "icon_coin", size: 40 }),
      button(this, this.W / 2, this.navTop - 196, 400, 158, "green", "ROLL", () => this.roll(1), { sub: costLabel(1), subIcon: "icon_coin", size: 66 }),
      button(this, this.W - 172, this.navTop - 192, 280, 140, "purple", "ROLL x8", () => this.roll(8), { sub: costLabel(8), subIcon: "icon_coin", size: 40 }),
    ];
    this.autoBtn = button(this, 195, this.navTop - 60, 330, 88, "dark", "AUTO", () => {
      this.auto = !this.auto;
      this.refreshRoll();
      if (this.auto && !this.rolling) this.roll(this.lastCount);
    }, { icon: "icon_auto", iconSize: 52, size: 36 });
    this.fastBtn = button(this, this.W / 2, this.navTop - 60, 330, 88, "dark", "FAST", () => {
      this.fast = !this.fast;
      this.refreshRoll();
    }, { icon: "icon_fast", iconSize: 48, size: 36 });
    const odds = button(this, this.W - 195, this.navTop - 60, 330, 88, "teal", "ODDS", () => this.showOdds(), { icon: "icon_odds", iconSize: 50, size: 36 });

    this.burst = this.add.particles(0, 0, "spark", {
      speed: { min: 200, max: 620 }, lifespan: 900, scale: { start: 1, end: 0 }, rotate: { min: 0, max: 180 }, gravityY: 500, emitting: false,
    }).setDepth(20);

    p.add([
      ...this.dieButtons, this.luckPill, this.pityText, this.pityBar, stage, rays, this.stageGlow, pedestal,
      ...this.rollButtons, this.autoBtn, this.fastBtn, odds, this.burst,
    ]);
    this.showIdleDie();
  }

  private refreshRoll(): void {
    this.dieButtons.forEach((b, i) => b.setColor(i === this.dieIndex ? "gold" : "dark"));
    [3, 1, 8].forEach((n, i) => {
      this.rollButtons[i].setSub(fmt(this.die.cost * n));
      this.rollButtons[i].setEnabled(save.coins >= this.die.cost * n);
    });
    this.autoBtn.setColor(this.auto ? "green" : "dark");
    this.fastBtn.setColor(this.fast ? "green" : "dark");
    this.luckPill.setValue(`x${luckMult().toFixed(1)}`);
    const left = PITY_ROLLS - save.pity;
    this.pityText.setText(`LEGENDARY+ GUARANTEED IN ${left}`);
    this.pityBar.clear();
    drawBar(this.pityBar, 380, this.P + 222, 660, 28, save.pity / PITY_ROLLS, 0xffb21e);
    this.stageGlow.setTint(this.die.color);
  }

  private clearShown(): void {
    this.shown.forEach((o) => o.destroy());
    this.shown = [];
  }

  private showIdleDie(): void {
    this.clearShown();
    const y = this.stageY;
    const d = this.add.image(this.W / 2, y, dieKey(this.die.id, 6)).setScale(Phaser.Math.Clamp((this.stageBottom - this.stageTop) / 300, 1.1, 1.6));
    this.tweens.add({ targets: d, y: y - 26, angle: 7, duration: 950, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const hint = text(this, this.W / 2, this.stageBottom - 30, "Roll for new pets!", 30, "#c9d2ff", { font: "body" });
    this.panels.roll.add([d, hint]);
    this.shown.push(d, hint);
    this.stageGlow.setTint(this.die.color);
  }

  /** Where the results land on the stage, and how big each card is. */
  private spots(n: number): { x: number; y: number; s: number }[] {
    const cy = this.stageY;
    const sh = this.stageBottom - this.stageTop;
    if (n === 1) return [{ x: this.W / 2, y: cy, s: Math.min(1.3, (sh - 30) / CARD_H) }];
    if (n === 3) return [0, 1, 2].map((i) => ({ x: 230 + i * 310, y: cy, s: Math.min(1.1, (sh - 50) / CARD_H) }));
    const s = Math.min(0.8, (sh - 40) / 2 / CARD_H);
    const rowGap = CARD_H * s + 8;
    return [...Array(n)].map((_, i) => ({ x: this.W / 2 + ((i % 4) - 1.5) * 235, y: cy - rowGap / 2 + Math.floor(i / 4) * rowGap, s }));
  }

  private roll(n: number): void {
    if (this.rolling || this.celebrating) return;
    const cost = this.die.cost * n;
    if (save.coins < cost) {
      this.auto = false;
      this.refreshRoll();
      this.toast("Not enough coins!");
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

    const best = Math.max(...results.map((r) => rarityRank(r.item.rarity)));
    const flight = this.fast ? 300 : 650;
    const suspense = this.fast ? 0 : best >= rarityRank("epic") ? 750 : best >= rarityRank("rare") ? 350 : 0;
    const spots = this.spots(n);
    let revealed = 0;

    results.forEach((res, i) => {
      const spot = spots[i];
      const die = this.add.image(this.W / 2, this.navTop - 196, dieKey(this.die.id, Phaser.Math.Between(1, 6))).setScale(0.3).setDepth(10);
      this.panels.roll.add(die);
      this.shown.push(die);
      const flicker = this.time.addEvent({
        delay: 65, loop: true, callback: () => die.setTexture(dieKey(this.die.id, Phaser.Math.Between(1, 6))),
      });
      const dieScale = Math.min(1, spot.s * 0.9);
      this.tweens.add({ targets: die, x: spot.x, duration: flight, delay: i * (this.fast ? 25 : 60), ease: "Sine.out" });
      this.tweens.add({ targets: die, scale: dieScale, angle: Phaser.Math.Between(540, 900), duration: flight, delay: i * (this.fast ? 25 : 60) });
      this.tweens.add({
        targets: die, y: spot.y, duration: flight, delay: i * (this.fast ? 25 : 60), ease: "Back.out",
        onComplete: () => {
          flicker.remove();
          die.setAngle(0);
          this.tweens.add({ targets: die, scaleY: dieScale * 0.82, scaleX: dieScale * 1.1, duration: 80, yoyo: true });
          this.suspense(die, res, suspense, () => {
            this.reveal(die, res, spot);
            if (++revealed === n) this.time.delayedCall(260, () => this.finishRoll(results));
          });
        },
      });
    });
  }

  /** The die shakes harder for better rarities — the "is it legendary??" moment. */
  private suspense(die: Phaser.GameObjects.Image, res: RollResult, ms: number, done: () => void): void {
    if (ms === 0 || rarityRank(res.item.rarity) < rarityRank("rare")) return done();
    const glow = this.add.image(die.x, die.y, "glow").setTint(RARITY_INFO[res.item.rarity].color).setScale(0.2).setAlpha(0.9).setDepth(9);
    this.panels.roll.add(glow);
    this.shown.push(glow);
    this.tweens.add({ targets: glow, scale: die.scale * 1.7, duration: ms });
    this.tweens.add({
      targets: die, angle: { from: -9, to: 9 }, duration: 55, yoyo: true, repeat: Math.floor(ms / 110),
      onComplete: () => {
        die.setAngle(0);
        done();
      },
    });
  }

  /** Flip the die over into the pet card. */
  private reveal(die: Phaser.GameObjects.Image, res: RollResult, spot: { x: number; y: number; s: number }): void {
    const rank = rarityRank(res.item.rarity);
    const color = RARITY_INFO[res.item.rarity].color;
    this.tweens.add({
      targets: die, scaleX: 0, duration: 90, ease: "Quad.in",
      onComplete: () => {
        die.setVisible(false);
        const card = petCard(this, spot.x, spot.y, makeKey(res.item.id, "normal"), {
          oneIn: spot.s > 0.8 ? `1 in ${fmt(res.oneIn)}` : undefined,
          isNew: res.isNew,
        }).setScale(0, spot.s).setDepth(11);
        this.panels.roll.add(card);
        this.shown.push(card);
        this.tweens.add({ targets: card, scaleX: spot.s, duration: 140, ease: "Back.out" });
        if (rank >= rarityRank("rare")) {
          this.burst.setParticleTint(color);
          this.burst.explode(8 + rank * 6, spot.x, spot.y);
        }
      },
    });
  }

  private finishRoll(results: RollResult[]): void {
    const best = results.reduce((a, b) => (rarityRank(b.item.rarity) > rarityRank(a.item.rarity) ? b : a));
    this.refreshRoll();
    this.autoEquip(results);
    if (results.some((r) => r.pity)) this.toast("PITY! Guaranteed Legendary+", "#ffd84a");

    const next = () => {
      this.rolling = false;
      if (this.auto && this.tab === "roll") this.roll(this.lastCount);
    };
    if (rarityRank(best.item.rarity) >= rarityRank("legendary")) {
      this.celebrate(best, () => this.time.delayedCall(200, next));
    } else {
      this.time.delayedCall(this.fast ? 250 : 650, next);
    }
  }

  /** Full-screen moment for Legendary and better pulls. */
  private celebrate(res: RollResult, done: () => void): void {
    this.celebrating = true;
    const { W, H } = this;
    const info = RARITY_INFO[res.item.rarity];
    const cy = H * 0.44;
    const dim = this.add.rectangle(0, 0, W, H, 0x07041a, 0.88).setOrigin(0).setInteractive();
    const rays = this.add.image(W / 2, cy, "rays").setScale(2.3).setTint(info.color).setAlpha(0.5);
    const glow = this.add.image(W / 2, cy, "glow").setScale(3.2).setTint(info.color).setAlpha(0.85);
    const title = text(this, W / 2, cy - 470, `${info.label.toUpperCase()}!`, 120, info.css);
    if (res.item.rarity === "secret") title.setTint(0xff5f6d, 0xffd84a, 0x4fc3ff, 0xb67bff);
    const card = petCard(this, W / 2, cy, makeKey(res.item.id, "normal")).setScale(0);
    const odds = text(this, W / 2, cy + 330, `1 in ${fmt(res.oneIn)}`, 64, "#ffe680");
    const tap = text(this, W / 2, cy + 470, "TAP TO CONTINUE", 40, "#ffffff");
    const confetti = this.add.particles(0, -30, "puff", {
      x: { min: 0, max: W }, speedY: { min: 250, max: 560 }, speedX: { min: -120, max: 120 }, lifespan: 4200,
      scaleX: { min: 0.25, max: 0.5 }, scaleY: { min: 0.5, max: 0.9 }, rotate: { min: 0, max: 360 },
      tint: [0xff5f6d, 0xffd84a, 0x5ef08a, 0x4fc3ff, 0xb67bff, 0xffffff], frequency: 25, quantity: 2,
    });
    const root = this.add.container(0, 0, [dim, rays, glow, confetti, card, title, odds, tap]).setDepth(6000);

    this.cameras.main.flash(350, 255, 255, 255);
    this.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
    this.tweens.add({ targets: card, scale: 1.7, duration: 500, ease: "Back.out" });
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
          done();
        },
      });
    };
    this.time.delayedCall(700, () => dim.once("pointerup", finish));
    if (this.auto) this.time.delayedCall(3500, finish);
  }

  /** Fill empty team slots with new pets so players see them fight right away. */
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
    if (this.rolling) return;
    const odds = oddsOf(this.die, luckMult());
    const h = 215 + odds.length * 92;
    const m = this.showModal(modal(this, 920, h, `${this.die.name} Odds`, "teal", () => (this.openModal = null)));
    m.body.add(text(this, 0, -h / 2 + 105, `Luck x${luckMult().toFixed(1)} applied to Rare and better`, 28, "#c9d2ff", { font: "body" }));
    odds.forEach((o, i) => {
      const y = -h / 2 + 185 + i * 92;
      const info = RARITY_INFO[o.item.rarity];
      m.body.add([
        this.add.image(0, y, panelTexture(this, "row", 820, 80)),
        this.add.image(-350, y - 2, `pet_${o.item.id}_normal`).setScale(0.42),
        text(this, -290, y, o.item.name, 34, info.css).setOrigin(0, 0.5),
        text(this, 380, y, o.percent, 34).setOrigin(1, 0.5),
      ]);
    });
  }

  // ───────────────────────── Pets tab ─────────────────────────

  private buildPetsPanel(): void {
    const p = this.panels.pets;
    p.removeAll(true);
    const P = this.P;

    p.add(text(this, 40, P + 52, `YOUR TEAM  ${save.equipped.length}/${MAX_EQUIPPED}`, 40).setOrigin(0, 0.5));
    for (let i = 0; i < MAX_EQUIPPED; i++) {
      const x = 105 + i * 152;
      const y = P + 178;
      const key = save.equipped[i];
      if (!key) {
        p.add(this.add.image(x, y, "card_empty").setScale(0.62));
        continue;
      }
      const card = petCard(this, x, y, key).setScale(0.62);
      card.setInteractive({ useHandCursor: true }).on("pointerup", () => this.openPet(key));
      p.add(card);
    }
    p.add(button(this, 870, P + 120, 360, 104, "blue", "EQUIP BEST", () => this.equipBest(), { icon: "icon_star", iconSize: 52, size: 34 }));
    p.add(button(this, 870, P + 238, 360, 104, "orange", "FUSE ALL", () => this.fuseAll(), { icon: "icon_fuse", iconSize: 52, size: 34 }));

    const ids = Object.keys(ITEMS);
    p.add(text(this, 40, P + 322, `COLLECTION  ${save.discovered.length}/${ids.length}`, 34, "#ffd84a").setOrigin(0, 0.5));
    p.add(text(this, this.W - 40, P + 324, "Tap a pet for details", 26, "#9aa3d6", { font: "body" }).setOrigin(1, 0.5));

    this.gridTop = P + 352;
    this.gridBottom = this.navTop - 12;
    const gh = this.gridBottom - this.gridTop;
    p.add(this.add.image(this.W / 2, this.gridTop + gh / 2, panelTexture(this, "inset", 1044, gh)));

    const keys = Object.keys(save.inventory).sort((a, b) => {
      const A = parseKey(a);
      const B = parseKey(b);
      return (
        rarityRank(B.def.rarity) - rarityRank(A.def.rarity) ||
        VARIANT_RANK[B.variant] - VARIANT_RANK[A.variant] ||
        A.def.name.localeCompare(B.def.name)
      );
    });
    const locked = ids.filter((id) => !save.discovered.includes(id));

    this.petList = this.add.container(0, 0);
    const mask = this.make.graphics({}, false).fillRect(0, this.gridTop + 6, this.W, gh - 12);
    this.petList.setMask(mask.createGeometryMask());
    const scale = 0.72;
    const rowH = CARD_H * scale + 20;
    const pos = (i: number) => ({ x: this.W / 2 + ((i % 5) - 2) * 204, y: this.gridTop + 20 + (CARD_H * scale) / 2 + Math.floor(i / 5) * rowH });
    this.gridCards = keys.map((key, i) => {
      const { x, y } = pos(i);
      const card = petCard(this, x, y, key, {
        count: save.inventory[key],
        equipped: save.equipped.includes(key),
        fuseReady: save.inventory[key] >= FUSE_COST && !!nextVariant(parseKey(key).variant),
      }).setScale(scale);
      this.petList.add(card);
      return { key, card };
    });
    locked.forEach((id, j) => {
      const { x, y } = pos(keys.length + j);
      this.petList.add(lockedCard(this, x, y, id).setScale(scale));
    });
    p.add(this.petList);
    const rows = Math.ceil((keys.length + locked.length) / 5);
    this.maxScroll = Math.max(0, rows * rowH + 30 - gh);
  }

  /** Drag to scroll the collection; a short tap opens the pet. */
  private setupGridScrolling(): void {
    let startY = 0;
    let startList = 0;
    let dragging = false;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.tab !== "pets" || this.openModal || p.y < this.gridTop || p.y > this.gridBottom) return;
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
      if (Math.abs(p.y - startY) > 14) return;
      const hit = this.gridCards.find(({ card }) =>
        Math.abs(p.x - card.x) < 80 && Math.abs(p.y - (card.y + this.petList.y)) < 101);
      if (hit) this.openPet(hit.key);
    });
  }

  private equipBest(): void {
    const best = Object.keys(save.inventory).sort((a, b) => petScore(b) - petScore(a)).slice(0, MAX_EQUIPPED);
    save.equipped = best;
    persist();
    this.game.events.emit("pets-changed");
    this.buildPetsPanel();
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
    if (fused) {
      this.cameras.main.flash(250, 255, 215, 80);
      this.toast(`Fused ${fused} pet${fused > 1 ? "s" : ""}!`, "#ffd84a");
      this.game.events.emit("pets-changed");
    } else {
      this.toast(`Need ${FUSE_COST} of the same pet to fuse`);
    }
    this.buildPetsPanel();
  }

  private openPet(key: ItemKey): void {
    const { def, variant } = parseKey(key);
    const count = save.inventory[key] ?? 0;
    const mult = VARIANT_INFO[variant].mult;
    const equipped = save.equipped.includes(key);
    const next = nextVariant(variant);
    const h = 1130;
    const m = this.showModal(modal(this, 920, h, `${VARIANT_INFO[variant].label}${def.name}`, "purple", () => (this.openModal = null)));
    const refresh = () => {
      this.game.events.emit("pets-changed");
      m.close();
      this.buildPetsPanel();
    };

    m.body.add(petCard(this, 0, -270, key, { count }).setScale(1.3));
    m.body.add(text(this, 0, -52, def.description, 34, "#dfe3ff", { font: "body" }));
    m.body.add(this.add.image(0, 125, panelTexture(this, "inset", 800, 280)));
    const rows: [string, string, string][] = def.kind === "buff"
      ? [["icon_star", "Type", KIND_LABEL[def.kind]], ["icon_sword", "Team damage", `+${Math.round(def.damage * mult)}%`]]
      : [
        ["icon_sword", "Damage", fmt(def.damage * mult)],
        ["icon_clock", "Attacks every", `${(def.cooldown / 1000).toFixed(1)}s`],
        ["icon_target", `${KIND_LABEL[def.kind]} targets`, String(Math.max(1, def.count))],
      ];
    rows.forEach(([icon, label, value], i) => {
      const y = 37 + i * 88 + (rows.length === 2 ? 44 : 0);
      m.body.add([
        this.add.image(-330, y, icon).setScale(0.55),
        text(this, -280, y, label, 36, "#ffffff").setOrigin(0, 0.5),
        text(this, 350, y, value, 40, "#ffe680").setOrigin(1, 0.5),
      ]);
    });
    if (variant !== "normal") m.body.add(text(this, 0, 302, `${VARIANT_INFO[variant].label.trim()} bonus: x${mult} power`, 30, "#ffd84a", { font: "body" }));

    // With a full team, equipping swaps out the weakest pet.
    const full = !equipped && save.equipped.length >= MAX_EQUIPPED;
    m.body.add(button(this, next ? -210 : 0, 420, 390, 140, equipped ? "red" : "green", equipped ? "UNEQUIP" : full ? "SWAP IN" : "EQUIP", () => {
      if (full) {
        const weakest = [...save.equipped].sort((a, b) => petScore(a) - petScore(b))[0];
        save.equipped = save.equipped.filter((k) => k !== weakest);
      }
      toggleEquip(key);
      refresh();
    }, { size: 44 }));
    if (next) {
      m.body.add(button(this, 210, 420, 390, 140, "orange", `FUSE ${Math.min(count, FUSE_COST)}/${FUSE_COST}`, () => {
        if (fuse(key)) this.cameras.main.flash(250, 255, 215, 80);
        refresh();
      }, { size: 42, sub: `into ${VARIANT_INFO[next].label.trim()}` }).setEnabled(count >= FUSE_COST));
    }
  }

  // ───────────────────────── Upgrades tab ─────────────────────────

  private buildUpgradesPanel(): void {
    const p = this.panels.upgrades;
    p.removeAll(true);
    const P = this.P;
    p.add(text(this, this.W / 2, P + 60, "UPGRADE YOUR CAT", 52));
    p.add(text(this, this.W / 2, P + 112, `Best stage reached: ${save.bestStage}`, 28, "#9aa3d6", { font: "body" }));

    const gap = Math.min(200, (this.navTop - 120 - (P + 220)) / UPGRADES.length);
    UPGRADES.forEach((u, i) => {
      const y = P + 220 + i * gap;
      const lvl = save.upgrades[u.id];
      const maxed = lvl >= u.maxLevel;
      const cost = u.cost(lvl);
      p.add([
        this.add.image(this.W / 2, y, panelTexture(this, "row", 1036, 146)),
        this.add.image(100, y, "badge_round"),
        this.add.image(100, y, u.icon).setScale(0.72),
        text(this, 180, y - 30, u.name, 44).setOrigin(0, 0.5),
        text(this, 180, y + 30, maxed ? `${u.value(lvl)} ${u.desc}` : `${u.value(lvl)}  ›  ${u.value(lvl + 1)} ${u.desc}`, 30, "#c9d2ff", { font: "body" }).setOrigin(0, 0.5),
      ]);
      const name = p.list[p.list.length - 2] as Phaser.GameObjects.Text;
      p.add(text(this, 180 + name.width + 14, y - 28, `LV ${lvl}`, 28, "#ffd84a").setOrigin(0, 0.5));
      p.add(
        button(this, 880, y - 4, 270, 118, "green", maxed ? "MAX" : fmt(cost), () => {
          if (maxed || save.coins < cost) return;
          save.coins -= cost;
          save.upgrades[u.id]++;
          persist();
          this.game.events.emit("upgrades-changed");
          this.buildUpgradesPanel();
        }, maxed ? { size: 44 } : { icon: "icon_coin", iconSize: 56, size: 44 }).setEnabled(!maxed && save.coins >= cost),
      );
    });

    // Testing helpers — remove before release
    p.add(button(this, 290, this.navTop - 50, 380, 72, "dark", "DEV: +1000 COINS", () => {
      save.coins += 1000;
      persist();
      this.buildUpgradesPanel();
    }, { size: 26 }));
    p.add(button(this, 790, this.navTop - 50, 380, 72, "dark", "DEV: RESET SAVE", () => {
      resetSave();
      window.location.reload();
    }, { size: 26 }));
  }

  // ───────────────────────── offline earnings ─────────────────────────

  /** "Welcome back" reward — the idle part of the game. */
  private offlineEarnings(): void {
    const away = (Date.now() - lastSeenAtLoad) / 1000;
    if (away < 60 || save.coinsPerSec <= 0) return;
    const seconds = Math.min(away, 8 * 3600);
    const coins = Math.floor(save.coinsPerSec * seconds * 0.5);
    if (coins <= 0) return;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const m = this.showModal(modal(this, 880, 860, "WELCOME BACK!", "gold", () => (this.openModal = null)));
    const collect = (mult: number) => {
      save.coins += coins * mult;
      persist();
      m.close();
      this.refreshRoll();
    };
    m.body.add([
      this.add.image(0, -150, "glow").setScale(1.6).setTint(0xffd84a).setAlpha(0.6),
      this.add.image(0, -100, "hero").setScale(1.25),
      text(this, 0, 20, `Your cat fought for ${hours ? `${hours}h ` : ""}${mins}m while you were away`, 32, "#dfe3ff", { font: "body", wrap: 700 }),
      this.add.image(-150, 140, "icon_coin").setScale(0.9),
      text(this, -80, 136, `+${fmt(coins)}`, 84, "#ffe680").setOrigin(0, 0.5),
      button(this, -195, 320, 360, 140, "green", "COLLECT", () => collect(1), { size: 46 }),
      // In the real game this would show a rewarded ad first
      button(this, 195, 320, 360, 140, "purple", "x2", () => collect(2), { icon: "icon_ad", iconSize: 70, size: 54 }),
    ]);
    fitText(m.body.list[m.body.list.length - 3] as Phaser.GameObjects.Text, 360);
  }
}
