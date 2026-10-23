import Phaser from "phaser";
import { INK_N } from "../art/draw";
import { petTexture } from "../art/pets";
import { btnTexture, panelTexture } from "../art/ui";
import { crystalKey } from "../art/world";
import { MAX_STAGE, MINUTES, STAGE_MS } from "../data/balance";
import { PET_LIST } from "../data/items";
import { RARITY_INFO, RARITY_ORDER, rarityRank } from "../data/rarity";
import { regionForStage } from "../data/regions";
import { MAX_SKILL, SKILL_BY_ID, SkillId } from "../data/skills";
import { TREE } from "../data/tree";
import { GAME_W, Layout, layoutFor } from "../layout";
import {
  DAILY, INDEX_STEP, checkIndexMilestones, claimDaily, claimQuest, dailyCash, dailyDay, ensureQuests, indexBonus, questDone, questEvent,
  questGoal, questReward, questText,
} from "../systems/goals";
import { RollResult, luckFloor, rollMany, tierChances } from "../systems/roll";
import { lastSeenAtLoad, persist, resetSave, save } from "../systems/save";
import { buzz, isMuted, music, setMuted, sfx, unlockAudio } from "../systems/sound";
import { autoUnlocked, canBuy, dicePerRoll, luck, luckyEvery, luckyMult, offlineRate, petSlots, potionActive, potionMult, rollTime } from "../systems/stats";
import { fmt, luckText, oneIn } from "../ui/format";
import { MapScreen } from "../ui/mapScreen";
import { PetsScreen, anyLevelReady } from "../ui/petsScreen";
import { RollScreen } from "../ui/rollScreen";
import { Host, Screen, Tab } from "../ui/screens";
import { ShopScreen, freeGiftReady } from "../ui/shopScreen";
import { TreeScreen } from "../ui/treeScreen";
import { Button, Modal, Pill, button, drawBar, fitText, iconButton, label, modal, petCard, text } from "../ui/widgets";
import { StageResult, battle, mmss } from "./Battle";

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "shop", icon: "icon_shop", label: "Shop" },
  { id: "pets", icon: "icon_paw", label: "Pets" },
  { id: "battle", icon: "icon_sword", label: "Battle" },
  { id: "roll", icon: "icon_dice", label: "Roll" },
  { id: "upgrades", icon: "icon_tree", label: "Upgrades" },
];
const TITLES: Record<Tab, string> = { shop: "SHOP", pets: "PETS", battle: "", roll: "ROLL", upgrades: "UPGRADES" };

interface NavTab {
  box: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Container;
}

/**
 * Everything drawn over the world: the bottom tab bar (Shop, Pets, Battle, Roll, Upgrades),
 * the top bar, the battle overlay, rolling, celebrations and popups.
 */
export class UIScene extends Phaser.Scene implements Host {
  private W = GAME_W;
  private H = 0;
  L!: Layout;
  private tab: Tab = "battle";
  private mapOpen = false;

  // shared top bar
  private header!: Phaser.GameObjects.Container;
  private title!: Phaser.GameObjects.Text;
  private cashPill!: Pill;
  private gemPill!: Pill;
  // battle overlay
  private hud!: Phaser.GameObjects.Container;
  private hudBars!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
  private crystalIcon!: Phaser.GameObjects.Image;
  private luckPill!: Pill;
  private dicePill!: Pill;
  private potionPill!: Pill;
  private skillBar!: Phaser.GameObjects.Container;
  private picker: Phaser.GameObjects.Container | null = null;
  private questG!: Phaser.GameObjects.Graphics;
  private questLabel!: Phaser.GameObjects.Text;
  private questCount!: Phaser.GameObjects.Text;
  private questGlow!: Phaser.GameObjects.Image;
  private badges: { obj: Phaser.GameObjects.Container; show: () => boolean }[] = [];
  private badgeTimer = 0;
  private nav: Record<Tab, NavTab> = {} as Record<Tab, NavTab>;

  // screens
  private screens!: Record<Exclude<Tab, "battle" | "upgrades">, Screen>;
  private rollScreen!: RollScreen;
  private tree!: TreeScreen;
  private map!: MapScreen;
  private openModal: Modal | null = null;

  // rolling
  private rollReadyAt = 0;
  private celebrating = false;
  private fast = false;

  constructor() {
    super("UI");
  }

  create(): void {
    this.H = this.scale.height;
    this.L = layoutFor(this.H);
    Object.assign(this, { openModal: null, celebrating: false, picker: null, badges: [], tab: "battle", mapOpen: false, nav: {} });
    ensureQuests();
    this.buildHud();
    this.rollScreen = new RollScreen(this, this);
    this.screens = { roll: this.rollScreen, pets: new PetsScreen(this, this), shop: new ShopScreen(this, this) };
    this.tree = new TreeScreen(this, this.L, () => this.afterPurchase(), (s, c) => this.toast(s, c));
    this.map = new MapScreen(this, this, () => this.setTab("battle"));
    this.buildHeader();
    this.buildNav();
    this.input.on("pointerdown", () => unlockAudio());
    const on: [string, (...a: never[]) => void][] = [
      ["toast", this.toast],
      ["cash-arrived", this.onCash],
      ["stage-clear", this.stageClear],
      ["land-unlocked", this.landUnlocked],
      ["skill-choice", this.showSkillChoice],
      ["skills-changed", this.drawSkillBar],
      ["stage-start", this.drawSkillBar],
      ["stage-failed", this.stageFailed],
      ["dice", this.onDice],
    ];
    for (const [ev, fn] of on) this.game.events.on(ev, fn, this);
    this.events.once("shutdown", () => {
      for (const [ev, fn] of on) this.game.events.off(ev, fn, this);
    });
    let i = 0;
    this.time.addEvent({ delay: 40, repeat: PET_LIST.length - 1, callback: () => petTexture(this, PET_LIST[i++].id) });
    this.setTab("battle", true);
    if (!this.offlineEarnings() && dailyDay() >= 0) this.time.delayedCall(900, () => this.showDaily());
  }

  private onCash(): void {
    this.cashPill.bump();
  }

  private onDice(): void {
    this.dicePill.bump();
    const t = text(this, this.dicePill.x, this.dicePill.y - 60, "+1", 44, "#ffe066").setDepth(7000);
    this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  /** The fight only runs while you look at it and no popup is open. */
  private syncBattle(): void {
    const run = this.tab === "battle" && !this.mapOpen && !this.openModal && !battle.choosing && !this.celebrating && !this.picker;
    const paused = this.scene.isPaused("Battle");
    if (run && paused) this.scene.resume("Battle");
    else if (!run && !paused && this.scene.isActive("Battle")) this.scene.pause("Battle");
    music.play(this.tab === "battle" && !this.mapOpen && !battle.over ? (battle.bossFrac >= 0 ? "boss" : "battle") : "calm");
  }

  update(time: number, delta: number): void {
    this.badgeTimer -= delta;
    if (this.badgeTimer <= 0) {
      this.badgeTimer = 400;
      this.updateGoals();
      // the world only needs drawing while you look at it
      const b = this.scene.get("Battle");
      b.cameras.main.setVisible(this.tab === "battle" && !this.mapOpen);
    }
    this.syncBattle();
    this.cashPill.setValue(fmt(save.cash));
    this.gemPill.setValue(fmt(save.gems));
    if (this.tab === "battle") this.updateHud(time);
    this.rollScreen.setReadyAt(this.rollReadyAt);
    for (const s of Object.values(this.screens)) s.update(time);
    this.tree.update(delta);
    if (save.autoRoll && autoUnlocked()) this.roll(true);
  }

  // ───────────────────────── Host (used by the screens) ─────────────────────────

  isFast(): boolean {
    return this.fast;
  }

  setFast(on: boolean): void {
    this.fast = on;
  }

  tabPos(tab: Tab): { x: number; y: number } {
    const i = TABS.findIndex((t) => t.id === tab);
    return { x: (this.W / TABS.length) * (i + 0.5), y: this.L.navTop + this.L.navH / 2 };
  }

  petsChanged(): void {
    this.game.events.emit("pets-changed");
  }

  afterPurchase(): void {
    questEvent("buy");
    this.rollScreen.refreshDie();
    this.game.events.emit("pets-changed");
  }

  showModal(m: Modal): Modal {
    this.openModal?.close();
    this.openModal = m;
    return m;
  }

  toast(str: string, color = "#ffffff"): void {
    const y = this.tab === "battle" ? this.L.hudBottom + 260 : this.L.headerBottom + 60;
    const t = fitText(text(this, this.W / 2, y, str, 40, color).setDepth(7000), this.W - 80);
    const s = t.scale;
    t.setScale(s * 0.6);
    this.tweens.add({ targets: t, scale: s, duration: 160, ease: "Back.out" });
    this.tweens.add({ targets: t, y: t.y - 60, alpha: 0, delay: 1200, duration: 500, onComplete: () => t.destroy() });
  }

  /** Coins burst out of a point and fly into the money counter. */
  coinShower(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const c = this.add.image(x, y, "icon_cash").setScale(0.5).setDepth(7000);
      this.tweens.add({
        targets: c, x: x + Phaser.Math.Between(-140, 140), y: y - Phaser.Math.Between(40, 180), duration: 280, ease: "Quad.out",
        onComplete: () => this.tweens.add({
          targets: c, x: this.cashPill.x, y: this.cashPill.y, scale: 0.3, duration: 500, delay: i * 35, ease: "Cubic.in",
          onComplete: () => {
            c.destroy();
            sfx.coin();
            this.cashPill.bump();
          },
        }),
      });
    }
  }

  // ───────────────────────── tabs ─────────────────────────

  private buildNav(): void {
    const { W } = this;
    const { navTop, navH } = this.L;
    const bar = this.add.graphics().setDepth(4000);
    bar.fillStyle(0x5b3a24, 1).fillRect(0, navTop, W, navH);
    bar.fillStyle(INK_N, 1).fillRect(0, navTop - 4, W, 8);
    bar.fillStyle(0x6e4a30, 1).fillRect(0, navTop + 4, W, 10);
    bar.setInteractive(new Phaser.Geom.Rectangle(0, navTop, W, navH), Phaser.Geom.Rectangle.Contains);
    const tw = W / TABS.length;
    TABS.forEach((t, i) => {
      const x = tw * (i + 0.5);
      const y = navTop + navH / 2;
      const bg = this.add.image(0, 0, btnTexture(this, "peach", tw - 14, navH - 24));
      const icon = this.add.image(0, -20, t.icon).setScale(0.8);
      const lbl = text(this, 0, 52, t.label, 30);
      const badge = this.add.container(tw / 2 - 40, -navH / 2 + 34, [this.add.circle(0, 0, 19, 0xf03e3e).setStrokeStyle(5, INK_N), text(this, 0, -1, "!", 28)]).setVisible(false);
      this.tweens.add({ targets: badge, scale: 1.18, duration: 420, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      const box = this.add.container(x, y, [bg, icon, lbl, badge]).setDepth(4001).setSize(tw, navH).setInteractive({ useHandCursor: true });
      box.on("pointerdown", () => this.tweens.add({ targets: box, scale: 0.92, duration: 60 }));
      box.on("pointerout", () => box.setScale(1));
      box.on("pointerup", () => {
        box.setScale(1);
        this.setTab(t.id);
      });
      this.nav[t.id] = { box, bg, icon, label: lbl, badge };
    });
  }

  setTab(tab: Tab, quiet = false): void {
    if (tab === this.tab && !this.mapOpen && !quiet) return;
    if (!quiet) sfx.click();
    this.openModal?.close();
    if (this.mapOpen) {
      this.map.hide();
      this.mapOpen = false;
    }
    if (this.tab === "upgrades") this.tree.hide();
    else if (this.tab !== "battle") this.screens[this.tab].hide();
    this.tab = tab;
    if (tab === "upgrades") this.tree.show();
    else if (tab !== "battle") this.screens[tab].show();
    this.hud.setVisible(tab === "battle");
    this.header.setVisible(tab !== "battle");
    this.title.setText(TITLES[tab]);
    this.scene.get("Battle").cameras.main.setVisible(tab === "battle");
    for (const t of TABS) {
      const n = this.nav[t.id];
      const active = t.id === tab;
      n.bg.setVisible(active);
      this.tweens.add({ targets: n.icon, scale: active ? 1 : 0.72, y: active ? -30 : -14, duration: 160, ease: "Back.out" });
      n.label.setAlpha(active ? 1 : 0.75).setFontSize(active ? 32 : 26);
      n.icon.setAlpha(active ? 1 : 0.85);
    }
  }

  private openMap(): void {
    sfx.click();
    this.openModal?.close();
    this.mapOpen = true;
    this.hud.setVisible(false);
    this.header.setVisible(true);
    this.title.setText("MAP");
    this.scene.get("Battle").cameras.main.setVisible(false);
    this.map.show();
  }

  // ───────────────────────── top bar ─────────────────────────

  /** Top bar of every screen except Battle: title, settings and money. */
  private buildHeader(): void {
    const g = this.add.graphics();
    g.fillStyle(0x3a2516, 0.9).fillRect(0, 0, this.W, this.L.headerBottom - 20);
    g.fillStyle(INK_N, 1).fillRect(0, this.L.headerBottom - 24, this.W, 6);
    this.title = text(this, 130, 165, "", 72, "#ffe6b8").setOrigin(0, 0.5);
    this.header = this.add.container(0, 0, [g, this.title]).setDepth(3400);
    // shared by all screens
    iconButton(this, 62, 165, "icon_gear", 86, () => this.showSettings()).setDepth(3500);
    this.cashPill = new Pill(this, this.W - 190, 160, 330, 84, "icon_cash", 44);
    this.gemPill = new Pill(this, this.W - 160, 252, 270, 72, "icon_gem", 36);
    this.cashPill.setDepth(3500);
    this.gemPill.setDepth(3500);
  }

  private buildHud(): void {
    const W = this.W;
    const band = this.add.graphics();
    band.fillStyle(0x5b3a24, 1).fillRect(0, 0, W, 58);
    band.fillStyle(INK_N, 1).fillRect(0, 56, W, 4);
    this.hudBars = this.add.graphics();
    this.progressText = text(this, W / 2, 90, "", 30);
    this.levelText = text(this, 415, 142, "", 26);
    this.stageText = text(this, 130, 194, "", 34).setOrigin(0, 0.5);
    this.crystalIcon = this.add.image(46, 246, crystalKey(regionForStage(save.stage).id)).setScale(0.28);
    this.luckPill = new Pill(this, 196, 304, 340, 64, "icon_clover", 32, "glass");
    this.luckPill.setSize(340, 64).setInteractive({ useHandCursor: true }).on("pointerup", () => this.setTab("roll"));
    this.dicePill = new Pill(this, 520, 304, 270, 64, "icon_dice", 32, "glass");
    this.dicePill.setSize(270, 64).setInteractive({ useHandCursor: true }).on("pointerup", () => this.setTab("roll"));
    this.potionPill = new Pill(this, W - 160, 336, 270, 64, "icon_potion", 30, "glass");
    this.skillBar = this.add.container(0, this.L.navTop - 64);
    this.hud = this.add.container(0, 0, [
      band, this.hudBars, this.progressText, this.levelText, this.stageText, this.crystalIcon, this.luckPill, this.dicePill, this.potionPill, this.skillBar,
    ]).setDepth(10);

    // quest tracker
    const qw = 400;
    this.questGlow = this.add.image(0, 0, "glow").setTint(0xffe066).setScale(2.6, 1).setVisible(false);
    this.tweens.add({ targets: this.questGlow, alpha: { from: 0.25, to: 0.8 }, duration: 600, yoyo: true, repeat: -1 });
    this.questG = this.add.graphics();
    this.questLabel = text(this, -116, -18, "", 28).setOrigin(0, 0.5);
    this.questCount = text(this, 30, 26, "", 22);
    const tracker = this.add.container(W - qw / 2 - 16, this.L.hudBottom + 100, [
      this.questGlow, this.add.image(0, 0, panelTexture(this, "glass", qw, 104)), this.add.image(-qw / 2 + 54, 0, "icon_quest").setScale(0.74),
      this.questLabel, this.questG, this.questCount,
    ]).setSize(qw, 104).setInteractive({ useHandCursor: true }).on("pointerup", () => this.showQuests());
    this.hud.add(tracker);

    // small buttons under the minimap
    const side = (i: number, icon: string, str: string, fn: () => void, badge?: () => boolean) => {
      const x = 100;
      const y = this.L.hudBottom + 290 + i * 140;
      this.hud.add(button(this, x, y, 160, 128, "peach", str, fn, { icon, iconSize: 60, stack: true, size: 26 }));
      if (badge) this.addBadge(x + 60, y - 50, badge);
    };
    side(0, "icon_map", "Map", () => this.openMap());
    side(1, "icon_quest", "Quests", () => this.showQuests(), () => save.quests.some(questDone));
    side(2, "icon_gift", "Daily", () => this.showDaily(), () => dailyDay() >= 0);
  }

  private addBadge(x: number, y: number, show: () => boolean): void {
    const obj = this.add.container(x, y, [this.add.circle(0, 0, 21, 0xf03e3e).setStrokeStyle(5, INK_N), text(this, 0, -1, "!", 32)]).setVisible(false);
    this.tweens.add({ targets: obj, scale: 1.18, duration: 420, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.hud.add(obj);
    this.badges.push({ obj, show });
  }

  private updateHud(time: number): void {
    const W = this.W;
    const g = this.hudBars;
    g.clear();
    // stage clock (or the boss's health)
    if (battle.bossFrac >= 0) {
      drawBar(g, 24, 74, W - 48, 34, battle.bossFrac, 0xf26464);
      this.progressText.setText(`BOSS  ${Math.ceil(battle.bossFrac * 100)}%`);
    } else {
      const f = battle.time / STAGE_MS;
      drawBar(g, 24, 74, W - 48, 34, f, f > 0.8 ? 0xffa64d : 0xffe0a3);
      for (let m = 1; m < MINUTES; m++) g.fillStyle(INK_N, 0.6).fillRect(24 + ((W - 48) * m) / MINUTES - 2, 74, 4, 34);
      this.progressText.setText(`${mmss(battle.time)} / ${mmss(STAGE_MS)}`);
    }
    // level and XP
    drawBar(g, 130, 130, 570, 24, battle.xp, 0x5ac8ff);
    this.levelText.setText(`Lv ${battle.level}`);
    this.stageText.setText(`Stage ${save.stage}  •  ${regionForStage(save.stage).name}`);
    fitText(this.stageText, 570);
    // the crystal
    const c = battle.crystal;
    drawBar(g, 86, 234, 420, 24, c, c > 0.4 ? 0x67c3ff : 0xf26464);
    this.crystalIcon.setScale(c < 0.4 && time % 500 < 250 ? 0.34 : 0.28);
    this.progressText.setColor(c < 0.4 && time % 600 < 300 ? "#ff8a8a" : "#ffffff");
    this.luckPill.setValue(`Luck ${luckText(luck())}`);
    this.dicePill.setValue(`${fmt(save.dice)} dice`);
    const active = potionActive();
    this.potionPill.setVisible(active);
    if (active) {
      const s = Math.ceil((save.potionUntil - Date.now()) / 1000);
      this.potionPill.setValue(`x${potionMult()} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
    }
  }

  /** The skills you picked this stage, along the bottom of the field. */
  private drawSkillBar(): void {
    this.skillBar.removeAll(true);
    this.crystalIcon.setTexture(crystalKey(regionForStage(save.stage).id));
    Object.entries(battle.skills).forEach(([id, lv], i) => {
      const def = SKILL_BY_ID[id as SkillId];
      const x = 60 + i * 86;
      this.skillBar.add([
        this.add.circle(x, 0, 38, def.color).setStrokeStyle(5, INK_N),
        this.add.image(x, -2, def.icon).setDisplaySize(52, 52),
        text(this, x + 24, 26, `${lv}`, 26, lv === MAX_SKILL ? "#ffe066" : "#ffffff"),
      ]);
    });
  }

  /** Level up: the fight freezes and you pick one of three skills. */
  private showSkillChoice(info: { choices: SkillId[]; levels: Partial<Record<SkillId, number>>; level: number }): void {
    this.picker?.destroy();
    const { W, H } = this;
    const dim = this.add.rectangle(0, 0, W, H, 0x1a0e08, 0.78).setOrigin(0).setInteractive();
    const rays = this.add.image(W / 2, H * 0.24, "rays").setTint(0xffe066).setAlpha(0.35).setScale(1.4);
    const title = text(this, W / 2, H * 0.22, "LEVEL UP!", 104, "#ffe066");
    const sub = text(this, W / 2, H * 0.22 + 90, `Level ${info.level}  •  choose a skill`, 40);
    const root = this.add.container(0, 0, [dim, rays, title, sub]).setDepth(5600);
    this.picker = root;
    this.tweens.add({ targets: rays, angle: 360, duration: 12000, repeat: -1 });
    title.setScale(0);
    this.tweens.add({ targets: title, scale: 1, duration: 350, ease: "Back.out" });
    let ready = false;
    this.time.delayedCall(450, () => (ready = true));
    info.choices.forEach((id, i) => {
      const def = SKILL_BY_ID[id];
      const lv = info.levels[id] ?? 0;
      const y = H * 0.4 + i * 280;
      const stars = [...Array(MAX_SKILL)].map((_, k) => this.add.image(-170 + k * 52, 66, "icon_star").setScale(0.4).setAlpha(k < lv ? 1 : k === lv ? 0.9 : 0.25).setTint(k === lv ? 0x8af06a : 0xffffff));
      const card = this.add.container(W / 2, y, [
        this.add.image(0, 0, panelTexture(this, "cream", 920, 250)),
        this.add.circle(-330, 0, 88, def.color).setStrokeStyle(8, INK_N),
        this.add.image(-330, -2, def.icon).setDisplaySize(120, 120),
        label(this, -190, -58, def.name, 50, "#4a2f1d").setOrigin(0, 0.5),
        text(this, 360, -58, lv === 0 ? "NEW!" : `Lv ${lv + 1}`, 38, lv === 0 ? "#ff8aa8" : "#8af06a"),
        fitText(label(this, -190, 2, def.text(lv), 34, "#7a5236").setOrigin(0, 0.5), 600),
        ...stars,
      ]).setSize(920, 250).setScale(0.6).setAlpha(0).setInteractive({ useHandCursor: true });
      this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 260, delay: 120 + i * 90, ease: "Back.out" });
      card.on("pointerdown", () => ready && this.tweens.add({ targets: card, scale: 0.95, duration: 60 }));
      card.on("pointerup", () => {
        if (!ready) return;
        ready = false;
        sfx.buy();
        this.tweens.add({ targets: card, scale: 1.08, duration: 120, yoyo: true });
        this.tweens.add({ targets: root, alpha: 0, delay: 200, duration: 160, onComplete: () => {
          root.destroy();
          if (this.picker === root) this.picker = null;
          this.game.events.emit("skill-picked", id);
        } });
      });
      root.add(card);
    });
  }

  /** You fell or the crystal broke: show how it went, revive once for gems, or try again. */
  private stageFailed(r: StageResult): void {
    const h = 1060;
    let revived = false;
    const m = this.showModal(modal(this, 900, h, r.reason === "hero" ? "YOU FELL!" : "CRYSTAL BROKE!", "red", () => {
      this.openModal = null;
      if (!revived) this.game.events.emit("retry");
    }));
    const row = (y: number, icon: string, str: string, color = "#4a2f1d") => m.body.add([
      this.add.image(-300, y, icon).setScale(0.6),
      label(this, -240, y, str, 40, color).setOrigin(0, 0.5),
    ]);
    m.body.add(text(this, 0, -h / 2 + 140, `Stage ${r.stage}`, 64, "#c9663a"));
    row(-h / 2 + 260, "icon_clock", `Survived ${mmss(r.time)} / ${mmss(STAGE_MS)}`);
    row(-h / 2 + 345, "icon_skull", `${fmt(r.kills)} monsters defeated`);
    row(-h / 2 + 430, "icon_cash", `+${fmt(Math.floor(r.earned))} money`, "#3f9a4f");
    row(-h / 2 + 515, "icon_dice", `+${r.dice} dice found`, "#c9663a");
    m.body.add(label(this, 0, 90, "Roll new pets and buy upgrades to get stronger, then try again!", 30, "#9a7a5a", 760));
    if (r.canRevive) {
      m.body.add(button(this, 0, 230, 560, 130, save.gems >= r.reviveGems ? "purple" : "grey", `REVIVE  ${r.reviveGems}`, () => {
        if (save.gems < r.reviveGems) {
          sfx.error();
          this.toast("Not enough gems!", "#ff9a9a");
          return;
        }
        revived = true;
        this.game.events.emit("revive");
        m.close();
      }, { icon: "icon_gem", iconSize: 60, size: 46 }));
    }
    m.body.add(button(this, 0, r.canRevive ? 390 : 300, 560, 130, "green", "TRY AGAIN", () => m.close(), { size: 48 }));
  }

  private updateGoals(): void {
    for (const b of this.badges) b.obj.setVisible(b.show());
    const owned = Object.keys(save.pets);
    this.nav.shop.badge.setVisible(freeGiftReady() || dailyDay() >= 0);
    this.nav.pets.badge.setVisible((save.equipped.length < petSlots() && owned.length > save.equipped.length) || anyLevelReady());
    this.nav.upgrades.badge.setVisible(TREE.some((n) => canBuy(n)));
    this.nav.roll.badge.setVisible(save.dice > 0 && (save.dice >= 10 || save.luckyBoost > 0 || save.luckyCount >= luckyEvery() - 1));
    const ready = save.quests.find(questDone);
    const q = ready ?? [...save.quests].sort((a, b) => b.progress / questGoal(b) - a.progress / questGoal(a))[0];
    if (!q) return;
    this.questGlow.setVisible(!!ready);
    fitText(this.questLabel.setText(ready ? "Quest done! Tap to claim" : questText(q)).setColor(ready ? "#ffe066" : "#ffffff"), 280);
    this.questCount.setText(q.type === "rare" ? `${q.progress}/1` : `${fmt(q.progress)}/${fmt(q.target)}`);
    this.questG.clear();
    drawBar(this.questG, -116, 14, 292, 24, q.progress / questGoal(q), ready ? 0xffd23f : 0x7ad651);
  }

  // ───────────────────────── rolling ─────────────────────────

  roll(auto = false): void {
    if (this.celebrating || this.rollScreen.revealing || this.time.now < this.rollReadyAt) return;
    if (save.dice <= 0) {
      if (save.autoRoll) save.autoRoll = false;
      if (!auto) {
        sfx.error();
        this.toast("No dice left! Find dice on the battle map", "#ff9a9a");
      }
      return;
    }
    save.dice--;
    const lucky = save.luckyBoost > 0 || save.luckyCount >= luckyEvery() - 1;
    if (save.luckyBoost > 0) save.luckyBoost--;
    else save.luckyCount = lucky ? 0 : save.luckyCount + 1;
    const results = rollMany(dicePerRoll(), luck() * (lucky ? luckyMult() : 1));
    this.rollReadyAt = this.time.now + rollTime();
    questEvent("roll", results.length);
    questEvent("rare", Math.max(...results.map((r) => rarityRank(r.item.rarity))));
    if (results.some((r) => r.isNew)) this.time.delayedCall(2400, () => this.indexMilestone());
    this.autoEquip(results);
    this.rollScreen.addHistory(results);
    if (this.tab === "roll" && !this.mapOpen) {
      this.rollScreen.reveal(results, lucky, () => this.afterReveal(results, 3));
    } else {
      this.miniReveal(results);
      this.afterReveal(results, 5);
    }
  }

  /** Fill empty team slots with new pets so players see them fight right away. */
  private autoEquip(results: RollResult[]): void {
    let changed = false;
    for (const r of results) {
      if (save.equipped.length < petSlots() && !save.equipped.includes(r.item.id)) {
        save.equipped.push(r.item.id);
        changed = true;
      }
    }
    if (changed) {
      persist();
      this.petsChanged();
    }
  }

  /** Big pulls get the full-screen moment. */
  private afterReveal(results: RollResult[], minRank: number): void {
    const best = results.reduce((a, b) => (b.item.oneIn > a.item.oneIn ? b : a));
    const rank = rarityRank(best.item.rarity);
    if (rank >= minRank && (best.isNew || best.item.oneIn >= luck() * 500)) this.celebrate(best);
  }

  /** While you are on another screen, rolled pets pop up quietly above the Roll tab. */
  private miniReveal(results: RollResult[]): void {
    const { x } = this.tabPos("roll");
    const baseY = this.L.navTop - 70;
    results.slice(0, 3).forEach((r, i) => {
      const info = RARITY_INFO[r.item.rarity];
      const c = this.add.container(Math.min(x, this.W - 200), baseY - i * 90, [
        this.add.image(0, 0, panelTexture(this, "glass", 340, 80)),
        this.add.circle(-130, 0, 32, info.color).setStrokeStyle(4, INK_N),
        this.add.image(-130, 4, petTexture(this, r.item.id)).setScale(0.36),
        fitText(text(this, 20, -14, r.item.name, 28, info.css), 230),
        text(this, 20, 18, r.isNew ? "NEW!" : `${info.label}`, 22, r.isNew ? "#ff8aa8" : "#fff3dc"),
      ]).setDepth(4500).setAlpha(0).setScale(0.6);
      this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 200, ease: "Back.out" });
      this.tweens.add({ targets: c, alpha: 0, y: c.y - 40, delay: 1300, duration: 300, onComplete: () => c.destroy() });
    });
    const rank = Math.max(...results.map((r) => rarityRank(r.item.rarity)));
    if (rank >= 3) sfx.reveal(rank);
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
    const card = petCard(this, W / 2, cy, res.item.id, { isNew: res.isNew }).setScale(0);
    const odds = text(this, W / 2, cy + 345, oneIn(res.item.oneIn), 66, "#ffe680");
    const tap = text(this, W / 2, cy + 470, "TAP TO CONTINUE", 40);
    const root = this.add.container(0, 0, [dim, rays, glow, card, title, odds, tap]).setDepth(6000);
    this.cameras.main.flash(300, 255, 250, 230);
    sfx.fanfare();
    buzz(200);
    this.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
    this.tweens.add({ targets: card, scale: 1.75, duration: 500, ease: "Back.out" });
    this.tweens.add({ targets: card, y: cy - 14, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: 500 });
    title.setScale(0);
    this.tweens.add({ targets: title, scale: 1, duration: 450, delay: 150, ease: "Back.out" });
    this.tweens.add({ targets: tap, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this.tweens.add({ targets: root, alpha: 0, duration: 220, onComplete: () => (root.destroy(), (this.celebrating = false)) });
    };
    this.time.delayedCall(700, () => dim.once("pointerup", finish));
    if (save.autoRoll) this.time.delayedCall(3000, finish);
  }

  private indexMilestone(): void {
    if (!checkIndexMilestones()) return;
    sfx.levelUp();
    this.toast(`${save.indexMilestones * INDEX_STEP} pets found! Luck x${indexBonus().toFixed(2)} forever`, "#8fe3ff");
  }

  // ───────────────────────── stage and land moments ─────────────────────────

  /** "STAGE 7 CLEAR!" with stars popping in and the money counting up. */
  private stageClear(info: { stage: number; earned: number; gems: number; dice: number; final: boolean }): void {
    const { W } = this;
    const cy = this.tab === "battle" ? this.L.hudBottom + 360 : this.L.headerBottom + 260;
    const band = this.add.graphics();
    band.fillStyle(0x1a0e08, 0.75).fillRect(0, -170, W, 340);
    band.fillStyle(0xffd23f, 1).fillRect(0, -170, W, 8).fillRect(0, 162, W, 8);
    const rays = this.add.image(W / 2, -40, "rays").setTint(0xffd23f).setAlpha(0.45).setScale(1.1);
    const title = fitText(text(this, W / 2, -70, info.final ? "YOU CONQUERED EVERY LAND!" : `STAGE ${info.stage} CLEAR!`, info.final ? 62 : 90, "#ffe066"), W - 60);
    const stars = [0, 1, 2].map((i) => this.add.image(W / 2 + (i - 1) * 120, 30, "icon_star").setScale(0));
    const earned = text(this, W / 2 - 280, 110, "+0", 52, "#8af06a").setOrigin(0, 0.5);
    const root = this.add.container(0, cy, [
      band, rays, title, ...stars, this.add.image(W / 2 - 330, 112, "icon_cash").setScale(0.6), earned,
      this.add.image(W / 2 + 70, 112, "icon_gem").setScale(0.55), text(this, W / 2 + 110, 110, `+${info.gems}`, 52, "#8fe3ff").setOrigin(0, 0.5),
      this.add.image(W / 2 + 270, 112, "icon_dice").setScale(0.55), text(this, W / 2 + 310, 110, `+${info.dice}`, 52, "#ffe066").setOrigin(0, 0.5),
    ]).setDepth(6200).setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: 200 });
    this.tweens.add({ targets: rays, angle: 180, duration: 3000 });
    const ts = title.scale;
    title.setScale(0);
    this.tweens.add({ targets: title, scale: ts, duration: 400, ease: "Back.out" });
    sfx.fanfare();
    buzz(150);
    stars.forEach((s, i) => this.time.delayedCall(350 + i * 260, () => {
      sfx.lucky();
      this.tweens.add({ targets: s, scale: 0.95, angle: 360, duration: 300, ease: "Back.out" });
    }));
    const counter = { v: 0 };
    this.tweens.add({ targets: counter, v: info.earned, duration: 1300, delay: 400, ease: "Cubic.out", onUpdate: () => earned.setText(`+${fmt(counter.v)}`) });
    this.coinShower(W / 2 - 280, cy + 110, 10);
    this.time.delayedCall(info.final ? 5000 : 3000, () => this.tweens.add({ targets: root, alpha: 0, duration: 300, onComplete: () => root.destroy() }));
  }

  private landUnlocked(name: string): void {
    const { W, H } = this;
    const rays = this.add.image(W / 2, H * 0.4, "rays").setTint(0xffe066).setAlpha(0.6).setScale(2);
    const t1 = text(this, W / 2, H * 0.4 - 60, "NEW LAND!", 80, "#ffe066");
    const t2 = text(this, W / 2, H * 0.4 + 40, name, 96, "#ffffff");
    const root = this.add.container(0, 0, [rays, t1, t2]).setDepth(6300);
    t2.setScale(0);
    this.tweens.add({ targets: t2, scale: 1, duration: 500, delay: 200, ease: "Back.out" });
    this.tweens.add({ targets: rays, angle: 180, duration: 3500 });
    this.time.delayedCall(3000, () => this.tweens.add({ targets: root, alpha: 0, duration: 400, onComplete: () => root.destroy() }));
  }

  // ───────────────────────── popups ─────────────────────────

  private showQuests(): void {
    const h = 1000;
    const m = this.showModal(modal(this, 900, h, "QUESTS", "green", () => (this.openModal = null)));
    const content = this.add.container(0, 0);
    m.body.add(content);
    const draw = () => {
      content.removeAll(true);
      const r = questReward();
      save.quests.forEach((q, i) => {
        const y = -h / 2 + 240 + i * 230;
        const done = questDone(q);
        const frac = q.progress / questGoal(q);
        const g = this.add.graphics();
        drawBar(g, -370, y + 2, 400, 32, frac, done ? 0xffd23f : 0x7ad651);
        content.add([
          this.add.image(0, y, panelTexture(this, "row", 800, 200)),
          this.add.image(-335, y - 50, "icon_quest").setScale(0.62),
          fitText(label(this, -285, y - 50, questText(q), 36, "#4a2f1d").setOrigin(0, 0.5), 400),
          g,
          text(this, -170, y + 17, q.type === "rare" ? `${q.progress}/1` : `${fmt(q.progress)}/${fmt(q.target)}`, 24),
          label(this, -370, y + 62, `Reward: ${r.gems} gems + ${fmt(r.cash)} money`, 26, "#7a5236").setOrigin(0, 0.5),
          button(this, 255, y, 240, 116, done ? "green" : "grey", done ? "CLAIM" : `${Math.floor(frac * 100)}%`, () => {
            const got = claimQuest(i);
            if (!got) return;
            sfx.fanfare();
            buzz(40);
            this.coinShower(this.W / 2 + 255, this.H / 2 + y, 10);
            this.toast(`+${got.gems} gems   +${fmt(got.cash)} money`, "#8af06a");
            draw();
          }, { size: 40 }).setEnabled(done),
        ]);
      });
      content.add(label(this, 0, h / 2 - 90, `Quests done: ${save.questsDone}. Every 3 quests the next ones get harder and pay more!`, 26, "#9a7a5a", 760));
    };
    draw();
  }

  /** 7-day login streak. */
  showDaily(): void {
    const h = 1060;
    const m = this.showModal(modal(this, 920, h, "DAILY REWARD", "gold", () => (this.openModal = null)));
    const day = dailyDay();
    DAILY.forEach((r, i) => {
      const x = i < 4 ? -315 + i * 210 : -210 + (i - 4) * 210;
      const y = i < 4 ? -250 : 30;
      const claimed = day >= 0 ? i < day : i < save.dailyStreak;
      const today = i === day;
      const icon = r.gems ? "icon_gem" : r.potionMin ? "icon_potion" : "icon_cash";
      const lines = [r.gems ? `${r.gems} gems` : "", r.cashMin ? `${fmt(dailyCash(r))}` : "", r.potionMin ? `${r.potionMin}m potion` : ""].filter(Boolean);
      if (today) {
        const glow = this.add.image(x, y, "glow").setTint(0xffe066).setScale(1.4);
        m.body.add(glow);
        this.tweens.add({ targets: glow, scale: 1.6, alpha: 0.6, duration: 600, yoyo: true, repeat: -1 });
      }
      m.body.add([
        this.add.image(x, y, panelTexture(this, today ? "cream" : "inset", 190, 250)),
        label(this, x, y - 96, `Day ${i + 1}`, 30, today ? "#c9663a" : "#7a5236"),
        this.add.image(x, y - 18, icon).setScale(i === 6 ? 1.05 : 0.85).setAlpha(claimed ? 0.45 : 1),
        fitText(label(this, x, y + 74, lines.join("\n"), 24, "#4a2f1d"), 176),
      ]);
      if (claimed) m.body.add(this.add.image(x + 58, y - 88, "icon_check").setScale(0.6));
    });
    m.body.add(label(this, 0, 240, day >= 0 ? "Come back every day! Missing a day restarts the streak." : "Claimed! Come back tomorrow for the next one.", 28, "#7a5236", 760));
    m.body.add(button(this, 0, h / 2 - 140, 460, 130, day >= 0 ? "green" : "grey", day >= 0 ? "CLAIM" : "CLAIMED", () => {
      if (!claimDaily()) return;
      sfx.fanfare();
      buzz(60);
      this.coinShower(this.W / 2, this.H / 2 + h / 2 - 140, 14);
      this.toast(`Day ${day + 1} reward collected!`, "#ffe066");
      m.close();
    }, { size: 46 }).setEnabled(day >= 0));
  }

  showOdds(): void {
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

  private showSettings(): void {
    const h = 980;
    const m = this.showModal(modal(this, 860, h, "SETTINGS", "peach", () => (this.openModal = null)));
    m.body.add(label(this, 0, -h / 2 + 150,
      `Best stage: ${save.bestStage}/${MAX_STAGE}\nMonsters defeated: ${fmt(save.totalKills)}\nRolls: ${fmt(save.totalRolls)}\nRarest roll: ${oneIn(save.bestRoll)}\nPets found: ${save.discovered.length}/${PET_LIST.length}`, 34, "#7a5236"));
    const snd: Button = button(this, -190, -100, 360, 96, isMuted() ? "grey" : "green", isMuted() ? "Sound: OFF" : "Sound: ON", () => {
      setMuted(!isMuted());
      snd.setLabel(isMuted() ? "Sound: OFF" : "Sound: ON").setColor(isMuted() ? "grey" : "green");
    }, { size: 32 });
    const mus: Button = button(this, 190, -100, 360, 96, music.isOn() ? "green" : "grey", music.isOn() ? "Music: ON" : "Music: OFF", () => {
      music.setOn(!music.isOn());
      mus.setLabel(music.isOn() ? "Music: ON" : "Music: OFF").setColor(music.isOn() ? "green" : "grey");
    }, { size: 32 });
    m.body.add([snd, mus]);
    m.body.add(label(this, 0, 0, "Testing tools (removed before release)", 26, "#9a7a5a"));
    const dev = (y: number, x: number, str: string, fn: () => void) =>
      m.body.add(button(this, x, y, 360, 96, "grey", str, () => {
        fn();
        persist();
      }, { size: 30 }));
    dev(90, -190, "+10K money", () => (save.cash += 1e4));
    dev(90, 190, "+1B money", () => (save.cash += 1e9));
    dev(210, -190, "+100 gems", () => (save.gems += 100));
    dev(210, 190, "+100 dice", () => (save.dice += 100));
    m.body.add(button(this, 0, 350, 460, 110, "red", "RESET SAVE", () => {
      resetSave();
      window.location.reload();
    }, { size: 36 }));
  }

  /** "Welcome back" reward — the idle part of the game. */
  private offlineEarnings(): boolean {
    const away = (Date.now() - lastSeenAtLoad) / 1000;
    if (away < 60 || save.cashPerSec <= 0) return false;
    const seconds = Math.min(away, 8 * 3600);
    const cash = Math.floor(save.cashPerSec * seconds * offlineRate());
    if (cash <= 0) return false;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const m = this.showModal(modal(this, 880, 820, "WELCOME BACK!", "gold", () => {
      this.openModal = null;
      if (dailyDay() >= 0) this.time.delayedCall(400, () => this.showDaily());
    }));
    const collect = (mult: number) => {
      save.cash += cash * mult;
      persist();
      this.coinShower(this.W / 2, this.H / 2, 16);
      m.close();
    };
    m.body.add([
      this.add.image(0, -150, "glow").setScale(1.6).setTint(0xffe066).setAlpha(0.6),
      this.add.image(0, -100, "hero").setScale(1.5),
      label(this, 0, 20, `Your pets collected money for ${hours ? `${hours}h ` : ""}${mins}m while you were away`, 32, "#7a5236", 700),
      this.add.image(-150, 135, "icon_cash").setScale(0.95),
      fitText(text(this, -80, 132, `+${fmt(cash)}`, 84, "#8af06a").setOrigin(0, 0.5), 360),
      button(this, -195, 300, 360, 130, "green", "COLLECT", () => collect(1), { size: 44 }),
      // In the real game this would show a rewarded ad first
      button(this, 195, 300, 360, 130, "purple", "x2", () => collect(2), { icon: "icon_ad", iconSize: 70, size: 52 }),
    ]);
    return true;
  }
}
