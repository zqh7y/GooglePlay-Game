import Phaser from "phaser";
import { INK_N, darken, rgba } from "../art/draw";
import { petTexture } from "../art/pets";
import { btnTexture, panelTexture, ribbonTexture } from "../art/ui";
import { crystalKey } from "../art/world";
import { MAX_STAGE, MINUTES, STAGE_MS } from "../data/balance";
import { BOOSTS, BoostDef } from "../data/boosts";
import { GADGETS, GADGET_SLOTS, STARTER_GADGET, gadgetKey, gadgetName } from "../data/gadgets";
import { CLASS_SIZES, ITEMS, PET_LIST } from "../data/items";
import { mutationsAt } from "../data/mutations";
import { RUSH_BOSSES, RUSH_MS, bossForStage } from "../data/bosses";
import { RARITY_INFO, rarityRank } from "../data/rarity";
import { Region, regionForStage } from "../data/regions";
import { MAX_SKILL, SKILL_BY_ID, SKILL_SLOTS, SkillId } from "../data/skills";
import { DICE_LUCK, DICE_TIERS, TIER_INFO, Tier, rollDiceTier, tierIndex } from "../data/tiers";
import { TREE } from "../data/tree";
import { GAME_W, Layout, TOP_ROW, TOP_Y, layoutFor } from "../layout";
import {
  DAILY, INDEX_STEP, checkIndexMilestones, claimDaily, claimQuest, dailyCash, dailyDay, ensureQuests, indexBonus, questDone, questEvent,
  questGoal, questReward, questText,
} from "../systems/goals";
import { RollResult, classChances, luckFloor, rollMany } from "../systems/roll";
import { lastSeenAtLoad, persist, resetSave, save, totalDice } from "../systems/save";
import { buzz, isMuted, music, setMuted, sfx, unlockAudio } from "../systems/sound";
import {
  autoUnlocked, canBuy, critChance, critDamage, dicePerRoll, luck, luckyEvery, luckyMult, moveSpeedMult, offlineRate, petSlots, potionActive, potionMult, rollTime,
} from "../systems/stats";
import { heroMaxHp, teamDps } from "../systems/power";
import { fmt, luckText, oneIn } from "../ui/format";
import { MapScreen } from "../ui/mapScreen";
import { PetsScreen, anyLevelReady } from "../ui/petsScreen";
import { GIFT_EVERY, RollScreen, SUPER_EVERY, SUPER_MULT } from "../ui/rollScreen";
import { Host, Screen, Tab } from "../ui/screens";
import { ShopScreen, freeGiftReady } from "../ui/shopScreen";
import { TreeScreen } from "../ui/treeScreen";
import { animateClassTexts, classBadge, classText } from "../ui/classText";
import { BtnColor } from "../art/ui";
import { Button, Modal, Pill, button, drawBar, fitText, iconButton, label, modal, petCard, ribbonBanner, text } from "../ui/widgets";
import { BattleMode, BattleScene, GadgetFound, RunStats, RushResult, StageResult, battle, mmss } from "./Battle";

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "shop", icon: "icon_shop", label: "Shop" },
  { id: "pets", icon: "icon_paw", label: "Pets" },
  { id: "battle", icon: "icon_sword", label: "Battle" },
  { id: "roll", icon: "icon_dice", label: "Roll" },
  { id: "upgrades", icon: "icon_tree", label: "Upgrades" },
];

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
  private cashPill!: Pill;
  private gemPill!: Pill;
  private diceTop!: Pill;
  private gear!: Phaser.GameObjects.Image;
  // battle tab: the lobby and the in-fight overlay
  private hud!: Phaser.GameObjects.Container;
  private lobby!: Phaser.GameObjects.Container;
  private run!: Phaser.GameObjects.Container;
  private mode: BattleMode | "" = "";
  private lobbyTitle!: Phaser.GameObjects.Text;
  private lobbyLand!: Phaser.GameObjects.Text;
  private lobbyBest!: Phaser.GameObjects.Text;
  /** which monster mutations this stage has */
  private lobbyMuts!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Graphics;
  private joyG!: Phaser.GameObjects.Graphics;
  private mini!: Phaser.GameObjects.Image;
  private petals!: Phaser.GameObjects.Particles.ParticleEmitter;
  private overlayTimer = 0;
  private shieldText!: Phaser.GameObjects.Text;
  /** the gadget panel: one slot per gadget you carry */
  private gadgetSlots: { icon: Phaser.GameObjects.Image; badge: Phaser.GameObjects.Arc; tier: Phaser.GameObjects.Text; lv: Phaser.GameObjects.Text; key: string }[] = [];
  private hudBars!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
  private crystalIcon!: Phaser.GameObjects.Image;
  private luckPill!: Pill;
  /** total damage per second of the hero and pets, above the BATTLE button */
  private dpsPill!: Pill;
  /** the Boss Rush button shows the next boss */
  private rushFace!: Phaser.GameObjects.Image;
  private rushNum!: Phaser.GameObjects.Text;
  /** Battle Boosts waiting for the next fight */
  private boostRow!: Phaser.GameObjects.Container;
  private boostKey = "";
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
  private navBar!: Phaser.GameObjects.Graphics;

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
    Object.assign(this, { openModal: null, celebrating: false, picker: null, badges: [], tab: "battle", mapOpen: false, nav: {}, mode: "" });
    ensureQuests();
    // teams are at most three pets now
    if (save.equipped.length > petSlots()) {
      save.equipped = save.equipped.slice(0, petSlots());
      persist();
    }
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
      ["banner", this.onBanner],
      ["cash-fly", this.onCashFly],
      ["gadget-found", this.gadgetFound],
      ["battle-ready", this.onBattleReady],
      ["boss-warning", this.bossWarning],
      ["boss-intro", this.bossIntro],
      ["rush-over", this.rushOver],
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

  /** A die was picked up in battle: it pops up and drops into place. */
  private onDice(tier: Tier): void {
    const y = this.L.hudBottom + 230;
    const c = this.add.container(this.W / 2, y, [
      this.add.image(-30, 0, `die_${tier}`).setScale(0.8),
      text(this, 40, 0, "+1", 48, TIER_INFO[tier].css),
    ]).setDepth(7000).setScale(0.4);
    this.tweens.add({ targets: c, scale: 1, duration: 200, ease: "Back.out" });
    this.tweens.add({ targets: c, y: y - 70, alpha: 0, delay: 500, duration: 400, onComplete: () => c.destroy() });
  }

  private onBanner(str: string, color: BtnColor, ms: number): void {
    ribbonBanner(this, this.W / 2, this.L.hudBottom + 150, str, color, ms, 5200);
  }

  /** Coins from a defeated monster (screen position) fly into the money counter. */
  private onCashFly(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const c = this.add.image(x, y, "icon_cash").setScale(0.45).setDepth(3600).setAngle(Phaser.Math.Between(-30, 30));
      this.tweens.add({
        targets: c, x: x + Phaser.Math.Between(-80, 80), y: y - Phaser.Math.Between(30, 110), duration: 260, ease: "Quad.out",
        onComplete: () => this.tweens.add({
          targets: c, x: this.cashPill.x - 120, y: this.cashPill.y, scale: 0.32, angle: 0, duration: 520, delay: i * 40, ease: "Cubic.in",
          onComplete: () => {
            c.destroy();
            sfx.coin();
            this.cashPill.bump();
          },
        }),
      });
    }
  }

  private onBattleReady(land: Region): void {
    this.mini.setTexture(`mini_${land.id}`).setDisplaySize(180, 180);
    this.petals.setParticleTint(land.ambient);
    this.crystalIcon.setTexture(crystalKey(land.id));
    this.drawSkillBar();
  }

  private get battleScene(): BattleScene {
    return this.scene.get("Battle") as BattleScene;
  }

  /** The fight only runs while you look at it and no popup is open. */
  private syncBattle(): void {
    const run = this.tab === "battle" && !this.mapOpen && !this.openModal && !battle.choosing && !this.celebrating && !this.picker;
    const paused = this.scene.isPaused("Battle");
    if (run && paused) this.scene.resume("Battle");
    else if (!run && !paused && this.scene.isActive("Battle")) this.scene.pause("Battle");
    const fight = this.tab === "battle" && !this.mapOpen && battle.mode === "run";
    music.play(fight ? (battle.rush ? "boss" : battle.bossFight ? (battle.bossFrac >= 0 ? "boss" : "calm") : "battle") : "calm");
  }

  /** Lobby or fight: during a fight only the battle is on screen (no tab bar, no shops). */
  private refreshMode(): void {
    if (battle.mode === this.mode) return;
    this.mode = battle.mode;
    const lobby = this.mode === "lobby";
    this.lobby.setVisible(lobby);
    this.run.setVisible(!lobby);
    for (const t of TABS) this.nav[t.id].box.setVisible(lobby);
    this.navBar.setVisible(lobby);
    this.gear.setVisible(lobby || this.tab !== "battle");
    this.placeTopBar(!lobby);
    this.mini.setVisible(!lobby);
    if (lobby) {
      this.lobbyTitle.setText(`Stage ${save.stage}`);
      this.lobbyLand.setText(regionForStage(save.stage).name);
      this.lobbyBest.setText(`Best: stage ${save.bestStage} / ${MAX_STAGE}`);
      const next = Math.min(RUSH_BOSSES, save.bossRush);
      this.rushFace.setTexture(bossForStage(next).tex);
      this.rushFace.setScale(96 / Math.max(this.rushFace.width, this.rushFace.height));
      this.rushNum.setText(save.bossRush > RUSH_BOSSES ? "ALL BEATEN!" : `Boss ${next}`);
      const muts = mutationsAt(save.stage);
      fitText(this.lobbyMuts.setText(muts.length ? `Mutations: ${muts.map((m) => m.name).join(", ")}` : "No mutated monsters yet"), this.W - 80);
    }
  }

  update(time: number, delta: number): void {
    animateClassTexts(time);
    this.badgeTimer -= delta;
    if (this.badgeTimer <= 0) {
      this.badgeTimer = 400;
      this.updateGoals();
      // the world only needs drawing while you look at it
      const b = this.scene.get("Battle");
      b.cameras.main.setVisible(this.tab === "battle" && !this.mapOpen);
    }
    this.syncBattle();
    this.refreshMode();
    this.cashPill.setValue(fmt(save.cash));
    this.gemPill.setValue(fmt(save.gems));
    this.diceTop.setValue(fmt(totalDice()));
    if (this.tab === "battle" && !this.mapOpen) {
      this.updateHud(time);
      const b = this.battleScene;
      if (b.sys.isActive() || b.sys.isPaused()) {
        b.drawJoystick(this.joyG);
        this.overlayTimer -= delta;
        if (this.overlayTimer <= 0 && battle.mode !== "lobby") {
          this.overlayTimer = 100;
          b.drawOverlay(this.overlay, 22, this.L.hudBottom + 24, 180, this.L.hudBottom + 30, this.H - 140);
        }
      }
    }
    this.rollScreen.setReadyAt(this.rollReadyAt);
    for (const s of Object.values(this.screens)) s.update(time);
    if (this.mapOpen) this.map.update();
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
    this.navBar = bar;
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
    this.scene.get("Battle").cameras.main.setVisible(tab === "battle");
    this.gear.setVisible(tab !== "battle" || battle.mode === "lobby");
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
    this.joyG.clear();
    this.header.setVisible(true);
    this.scene.get("Battle").cameras.main.setVisible(false);
    this.map.show();
  }

  // ───────────────────────── top bar ─────────────────────────

  /**
   * Slim top bar on every screen: settings, money, gems and dice in one row (tap them to go
   * where you get more). During a fight only the money stays, in the top right corner.
   */
  private buildHeader(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1a0e08, 0x1a0e08, 0x1a0e08, 0x1a0e08, 0.5, 0.5, 0, 0).fillRect(0, 0, this.W, this.L.headerBottom + 20);
    this.header = this.add.container(0, 0, [g]).setDepth(3400);
    this.gear = iconButton(this, TOP_ROW.gear, TOP_Y, "icon_gear", 78, () => this.showSettings()).setDepth(3500);
    this.cashPill = new Pill(this, TOP_ROW.cash, TOP_Y, 300, 76, "icon_cash", 40);
    this.gemPill = new Pill(this, TOP_ROW.gems, TOP_Y, 230, 76, "icon_gem", 38);
    this.diceTop = new Pill(this, TOP_ROW.dice, TOP_Y, 250, 76, "icon_dice", 38);
    const tap = (pill: Pill, w: number, tab: Tab) => {
      pill.setDepth(3500).setSize(w, 76).setInteractive({ useHandCursor: true });
      pill.on("pointerdown", () => this.tweens.add({ targets: pill, scale: 0.92, duration: 60 }));
      pill.on("pointerout", () => pill.setScale(1));
      pill.on("pointerup", () => {
        pill.setScale(1);
        if (battle.mode === "lobby" || this.tab !== "battle") this.setTab(tab);
      });
    };
    tap(this.cashPill, 300, "shop");
    tap(this.gemPill, 230, "shop");
    tap(this.diceTop, 250, "roll");
  }

  /** Top row in the lobby and the menus; just the money in the corner during a fight. */
  private placeTopBar(fight: boolean): void {
    if (fight) this.cashPill.setPosition(this.W - 180, 160);
    else this.cashPill.setPosition(TOP_ROW.cash, TOP_Y);
    this.gemPill.setVisible(!fight);
    this.diceTop.setVisible(!fight);
  }

  private buildHud(): void {
    const { W, H } = this;
    this.hud = this.add.container(0, 0).setDepth(10);
    // falling petals in the land's colour
    this.petals = this.add.particles(0, 0, "petal", {
      x: { min: -100, max: W }, y: { min: 0, max: 300 }, lifespan: 9000, speedX: { min: 20, max: 60 }, speedY: { min: 40, max: 90 },
      rotate: { start: 0, end: 360 }, alpha: { start: 0.9, end: 0 }, frequency: 420,
    });
    this.hud.add(this.petals);

    // ── the lobby: stage card, quests and the big BATTLE button
    this.lobby = this.add.container(0, 0);
    this.lobbyTitle = text(this, 40, 178, "", 64, "#ffe6b8").setOrigin(0, 0.5);
    this.lobbyLand = text(this, 40, 236, "", 34).setOrigin(0, 0.5);
    this.lobbyBest = text(this, 40, 280, "", 26, "#ffe6b8").setOrigin(0, 0.5);
    this.lobbyMuts = text(this, 40, 318, "", 24, "#e0c4ff").setOrigin(0, 0.5);
    const shade = this.add.graphics();
    shade.fillStyle(0x3a2516, 0.55).fillRect(0, 0, W, 344);
    this.lobby.add([shade, this.lobbyTitle, this.lobbyLand, this.lobbyBest, this.lobbyMuts]);
    const bottom = this.L.navTop;
    this.dpsPill = new Pill(this, W / 2 - 196, bottom - 330, 372, 76, "icon_sword", 34, "glass");
    this.dpsPill.setSize(372, 76).setInteractive({ useHandCursor: true }).on("pointerup", () => this.showHero());
    this.luckPill = new Pill(this, W / 2 + 196, bottom - 330, 372, 76, "icon_clover", 34, "glass");
    this.luckPill.setSize(372, 76).setInteractive({ useHandCursor: true }).on("pointerup", () => this.setTab("roll"));
    this.potionPill = new Pill(this, W - 160, 336, 270, 64, "icon_potion", 30, "glass");
    const go = button(this, W / 2 - 112, bottom - 170, 600, 190, "orange", "BATTLE", () => {
      unlockAudio();
      this.game.events.emit("battle-start");
    }, { icon: "icon_sword", iconSize: 84, size: 76, sub: "Survive 5:00 and beat the boss" });
    // Boss Rush: the next boss's face and number
    this.rushFace = this.add.image(0, -24, "e_golem");
    this.rushNum = text(this, 0, 58, "", 26);
    const rush = this.add.container(W - 128, bottom - 170, [
      this.add.image(0, 0, btnTexture(this, "purple", 230, 190)),
      this.add.image(0, -24, "glow").setTint(0xff5a8a).setScale(0.55).setAlpha(0.7),
      this.rushFace, text(this, 0, 32, "BOSS RUSH", 28), this.rushNum,
    ]).setSize(230, 190).setInteractive({ useHandCursor: true });
    rush.on("pointerdown", () => this.tweens.add({ targets: rush, scale: 0.92, duration: 60 }));
    rush.on("pointerout", () => rush.setScale(1));
    rush.on("pointerup", () => {
      rush.setScale(1);
      unlockAudio();
      sfx.click();
      this.game.events.emit("rush-start");
    });
    this.tweens.add({ targets: this.rushFace, angle: { from: -6, to: 6 }, duration: 600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.lobby.add(rush);
    this.tweens.add({ targets: go, scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.boostRow = this.add.container(W / 2, bottom - 432);
    this.lobby.add([this.dpsPill, this.luckPill, this.potionPill, this.boostRow, go]);
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
    this.lobby.add(tracker);
    // small round shortcuts down the left side
    const side = (i: number, icon: string, str: string, fn: () => void, badge?: () => boolean) => {
      const x = 64;
      const y = this.L.hudBottom + 70 + i * 122;
      const b = this.add.container(x, y, [
        this.add.circle(0, 0, 42, 0x3a2516, 0.7).setStrokeStyle(4, 0xffe6b8, 0.85),
        this.add.image(0, -2, icon).setScale(54 / Math.max(this.textures.getFrame(icon).width, this.textures.getFrame(icon).height)),
        text(this, 0, 52, str, 22, "#fff3dc"),
      ]).setSize(96, 120).setInteractive({ useHandCursor: true });
      b.on("pointerdown", () => this.tweens.add({ targets: b, scale: 0.88, duration: 60 }));
      b.on("pointerout", () => b.setScale(1));
      b.on("pointerup", () => {
        b.setScale(1);
        sfx.click();
        fn();
      });
      this.lobby.add(b);
      if (badge) this.addBadge(x + 32, y - 32, badge);
    };
    side(0, "icon_map", "Map", () => this.openMap());
    side(1, "icon_quest", "Quests", () => this.showQuests(), () => save.quests.some(questDone));
    side(2, "icon_gift", "Daily", () => this.showDaily(), () => dailyDay() >= 0);
    side(3, "hero", "Hero", () => this.showHero());

    // ── the fight: clock, level, crystal, gun, pause and stats
    this.run = this.add.container(0, 0).setVisible(false);
    const band = this.add.graphics();
    band.fillStyle(0x5b3a24, 1).fillRect(0, 0, W, 58);
    band.fillStyle(INK_N, 1).fillRect(0, 56, W, 4);
    this.hudBars = this.add.graphics();
    this.progressText = text(this, W / 2, 90, "", 30);
    this.levelText = text(this, 460, 142, "", 26);
    this.stageText = text(this, 220, 192, "", 32).setOrigin(0, 0.5);
    this.crystalIcon = this.add.image(240, 248, crystalKey(regionForStage(save.stage).id)).setScale(0.24);
    this.shieldText = text(this, 457, 248, "", 24);
    // your gadgets: three slots with icon, tier and level
    const gunPanel = this.add.container(W - 190, 300, [this.add.image(0, 0, panelTexture(this, "glass", 340, 120))]);
    this.gadgetSlots = [];
    for (let i = 0; i < GADGET_SLOTS; i++) {
      const x = (i - 1) * 108;
      const icon = this.add.image(x, -4, "gd_shuriken").setVisible(false);
      const badge = this.add.circle(x - 34, -36, 18, 0xb8c2cc).setStrokeStyle(4, INK_N).setVisible(false);
      const tier = text(this, x - 34, -38, "", 20);
      const lv = text(this, x + 22, 36, "", 20);
      gunPanel.add([this.add.circle(x, 0, 46, 0x000000, 0.25), icon, badge, tier, lv]);
      this.gadgetSlots.push({ icon, badge, tier, lv, key: "" });
    }
    gunPanel.setSize(340, 120).setInteractive({ useHandCursor: true }).on("pointerup", () => this.showStats());
    this.skillBar = this.add.container(0, H - 80);
    this.run.add([
      band, this.hudBars, this.progressText, this.levelText, this.stageText, this.crystalIcon, this.shieldText, gunPanel, this.skillBar,
      iconButton(this, 62, 165, "icon_pause", 86, () => this.showPause()),
      iconButton(this, 160, 165, "icon_odds", 86, () => this.showStats()),
    ]);
    this.hud.add([this.lobby, this.run]);
    // minimap, arrows and joystick (drawn by the battle, in screen space)
    this.mini = this.add.image(22, this.L.hudBottom + 24, "__DEFAULT").setOrigin(0).setDisplaySize(180, 180).setAlpha(0.92).setVisible(false);
    this.overlay = this.add.graphics();
    this.joyG = this.add.graphics();
    this.hud.add([this.mini, this.overlay, this.joyG]);
  }

  private addBadge(x: number, y: number, show: () => boolean): void {
    const obj = this.add.container(x, y, [this.add.circle(0, 0, 15, 0xf03e3e).setStrokeStyle(4, INK_N), text(this, 0, -1, "!", 24)]).setVisible(false);
    this.tweens.add({ targets: obj, scale: 1.18, duration: 420, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.lobby.add(obj);
    this.badges.push({ obj, show });
  }

  /** "Boosts: [gun] x1 [heart] x2" above the BATTLE button; tap it to buy more in the shop. */
  private drawBoostRow(owned: BoostDef[]): void {
    const row = this.boostRow;
    row.removeAll(true);
    if (!owned.length) return;
    const w = 190 + owned.length * 150;
    row.add([this.add.image(0, 0, panelTexture(this, "glass", w, 92)), text(this, -w / 2 + 90, 0, "BOOSTS", 28, "#9ae6ff")]);
    owned.forEach((b, i) => {
      const x = -w / 2 + 230 + i * 150;
      const icon = this.add.image(x - 22, 0, b.icon);
      icon.setScale(62 / Math.max(icon.width, icon.height));
      row.add([icon, text(this, x + 36, 4, `x${save.boosts[b.id]}`, 30)]);
    });
    row.setSize(w, 92).setInteractive({ useHandCursor: true }).off("pointerup").on("pointerup", () => this.setTab("shop"));
    row.setScale(0.6);
    this.tweens.add({ targets: row, scale: 1, duration: 300, ease: "Back.out" });
  }

  private updateHud(time: number): void {
    if (battle.mode === "lobby") {
      this.luckPill.setValue(`Luck ${luckText(luck())}`);
      this.dpsPill.setValue(`${fmt(teamDps().total)} DPS`);
      const owned = BOOSTS.filter((b) => save.boosts[b.id]);
      const key = owned.map((b) => `${b.id}${save.boosts[b.id]}`).join();
      if (key !== this.boostKey) {
        this.boostKey = key;
        this.drawBoostRow(owned);
      }
      const active = potionActive();
      this.potionPill.setVisible(active);
      if (active) {
        const s = Math.ceil((save.potionUntil - Date.now()) / 1000);
        this.potionPill.setValue(`x${potionMult()} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
      }
      return;
    }
    const W = this.W;
    const g = this.hudBars;
    g.clear();
    if (battle.rush) {
      this.rushHud(time);
    } else if (battle.bossFrac >= 0) {
      drawBar(g, 24, 74, W - 48, 34, battle.bossFrac, 0xf26464);
      this.progressText.setText(`BOSS  ${Math.ceil(battle.bossFrac * 100)}%`);
    } else {
      const f = battle.time / STAGE_MS;
      drawBar(g, 24, 74, W - 48, 34, f, f > 0.8 ? 0xffa64d : 0xffe0a3);
      for (let m = 1; m < MINUTES; m++) g.fillStyle(INK_N, 0.6).fillRect(24 + ((W - 48) * m) / MINUTES - 2, 74, 4, 34);
      this.progressText.setText(`${mmss(battle.time)} / ${mmss(STAGE_MS)}`);
    }
    // level and XP (the Boss Rush clock instead, in a Boss Rush)
    if (battle.rush) {
      const f = battle.rushLeft / RUSH_MS;
      drawBar(g, 220, 130, 480, 24, f, f > 0.5 ? 0x7ad651 : f > 0.25 ? 0xffb22e : 0xf26464);
      this.levelText.setText(`${(battle.rushLeft / 1000).toFixed(1)}s`).setColor(f < 0.25 && time % 400 < 200 ? "#ff8a8a" : "#ffffff");
      this.stageText.setText(`Boss Rush  •  best: boss ${save.bossRushBest}`);
    } else {
      drawBar(g, 220, 130, 480, 24, battle.xp, 0x5ac8ff);
      this.levelText.setText(`Lv ${battle.level}`).setColor("#ffffff");
      this.stageText.setText(`Stage ${save.stage}  •  ${regionForStage(save.stage).name}`);
    }
    fitText(this.stageText, 480);
    // the crystal, and whether its shield is up
    const c = battle.crystal;
    drawBar(g, 274, 236, 366, 26, battle.bossFight ? 0 : c, battle.shielded ? 0x9ae6ff : c > 0.4 ? 0x67c3ff : 0xf26464);
    const left = Math.ceil(battle.shieldLeft / 1000);
    if (battle.rush) this.shieldText.setText(`Beat it in ${RUSH_MS / 1000}s or it gets away!`).setColor("#e6d4ff");
    else if (battle.bossFight) this.shieldText.setText("CRYSTAL TAKEN! Beat the boss").setColor("#ffd0d0");
    else this.shieldText.setText(battle.shielded ? `SHIELD ${left}s` : `OPEN  •  shield in ${left}s`).setColor(battle.shielded ? "#ffffff" : c < 0.4 ? "#ffd0d0" : "#ffffff");
    fitText(this.shieldText, 340);
    this.crystalIcon.setScale(c < 0.4 && !battle.shielded && time % 500 < 250 ? 0.3 : 0.24);
    this.progressText.setColor(c < 0.4 && time % 600 < 300 ? "#ff8a8a" : "#ffffff");
    // your gadgets
    this.gadgetSlots.forEach((slot, i) => {
      const g = battle.gadgets[i];
      const key = g ? `${g.kind}${g.tier}${g.level}` : "";
      if (key === slot.key) return;
      slot.key = key;
      slot.icon.setVisible(!!g);
      slot.badge.setVisible(!!g);
      slot.tier.setText(g ? g.tier : "");
      slot.lv.setText(g ? `Lv${g.level}` : "");
      if (!g) return;
      slot.icon.setTexture(gadgetKey(g.kind));
      slot.icon.setScale(70 / Math.max(slot.icon.width, slot.icon.height));
      slot.badge.setFillStyle(TIER_INFO[g.tier].color);
      slot.tier.setFontSize(g.tier.length > 2 ? 14 : 20);
      this.tweens.add({ targets: slot.icon, scale: slot.icon.scale * 1.3, duration: 140, yoyo: true });
    });
  }

  /** The skills you picked this stage, along the bottom of the field. */
  private drawSkillBar(): void {
    this.skillBar.removeAll(true);
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
    const used = Object.keys(info.levels).length;
    const sub = text(this, W / 2, H * 0.22 + 90, used >= SKILL_SLOTS ? `Level ${info.level}  •  all ${SKILL_SLOTS} skill slots used: level them up!` : `Level ${info.level}  •  skill slots ${used}/${SKILL_SLOTS}`, 38);
    fitText(sub, W - 80);
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

  /** You fell, the crystal broke or you gave up: how it went, revive once for gems, or try again. */
  private stageFailed(r: StageResult): void {
    const h = 1180;
    let choice: "revive" | "retry" | "lobby" = "lobby";
    const title = r.reason === "hero" ? "YOU FELL!" : r.reason === "crystal" ? "CRYSTAL BROKE!" : "YOU GAVE UP";
    const m = this.showModal(modal(this, 900, h, title, "red", () => {
      this.openModal = null;
      if (choice !== "revive") this.game.events.emit("retry", choice === "retry");
    }));
    m.body.add(text(this, 0, -h / 2 + 140, `Stage ${r.stage}`, 64, "#c9663a"));
    this.statRows(m, r.stats, r.time, -h / 2 + 240, false);
    m.body.add(label(this, 0, 150, "Roll new pets and buy upgrades to get stronger, then try again!", 30, "#9a7a5a", 760));
    let y = 290;
    if (r.canRevive) {
      m.body.add(button(this, 0, y, 560, 120, save.gems >= r.reviveGems ? "purple" : "grey", `REVIVE  ${r.reviveGems}`, () => {
        if (save.gems < r.reviveGems) {
          sfx.error();
          this.toast("Not enough gems!", "#ff9a9a");
          return;
        }
        choice = "revive";
        this.game.events.emit("revive");
        m.close();
      }, { icon: "icon_gem", iconSize: 56, size: 44 }));
      y += 140;
    }
    m.body.add(button(this, -150, y, 280, 120, "green", "TRY AGAIN", () => {
      choice = "retry";
      m.close();
    }, { size: 36 }));
    m.body.add(button(this, 150, y, 280, 120, "peach", "LOBBY", () => m.close(), { size: 36 }));
  }

  /** Rows of run statistics (used by the stats popup and the defeat screen). */
  private statRows(m: Modal, st: RunStats, time: number, y0: number, full: boolean): number {
    const rows: [string, string, string][] = [
      ["icon_clock", `Survived ${mmss(time)} / ${mmss(STAGE_MS)}`, "#4a2f1d"],
      ["icon_skull", `${fmt(st.kills)} monsters defeated`, "#4a2f1d"],
      ["icon_sword", `${fmt(st.damage)} damage dealt`, "#4a2f1d"],
      ["icon_cash", `+${fmt(Math.floor(st.earned))} money`, "#3f9a4f"],
    ];
    if (full) {
      rows.push(["icon_bolt", `${fmt(battle.dps)} damage per second now`, "#4a2f1d"]);
      rows.push(["icon_gift", `${st.airdrops} airdrops opened  •  ${fmt(st.shots)} shots`, "#4a2f1d"]);
      rows.push(["icon_shield", `You took ${fmt(st.hurt)}  •  crystal took ${fmt(st.crystalHurt)}`, "#4a2f1d"]);
    }
    let y = y0;
    for (const [icon, str, color] of rows) {
      m.body.add([this.add.image(-330, y, icon).setScale(0.55), fitText(label(this, -280, y, str, 36, color).setOrigin(0, 0.5), 640)]);
      y += 76;
    }
    // dice found, per tier
    const found = DICE_TIERS.filter((t) => st.dice[t] > 0);
    m.body.add(label(this, -330, y, found.length ? "Dice found:" : "No dice found", 34, "#c9663a").setOrigin(0, 0.5));
    found.forEach((t, i) => m.body.add([
      this.add.image(-60 + i * 110, y, `die_${t}`).setScale(0.6),
      text(this, -60 + i * 110 + 34, y + 20, `${st.dice[t]}`, 28),
    ]));
    return y + 76;
  }

  /** Pause: the fight freezes until you resume (or give up). */
  private showPause(): void {
    if (battle.mode !== "run") return;
    sfx.click();
    const h = 900;
    const m = this.showModal(modal(this, 820, h, "PAUSED", "peach", () => (this.openModal = null)));
    m.body.add(text(this, 0, -h / 2 + 140, `Stage ${save.stage}  •  ${mmss(battle.time)}`, 52, "#c9663a"));
    m.body.add(button(this, 0, -h / 2 + 280, 520, 140, "green", "RESUME", () => m.close(), { size: 54 }));
    const snd: Button = button(this, -180, -h / 2 + 440, 330, 100, isMuted() ? "grey" : "mint", isMuted() ? "Sound: OFF" : "Sound: ON", () => {
      setMuted(!isMuted());
      snd.setLabel(isMuted() ? "Sound: OFF" : "Sound: ON").setColor(isMuted() ? "grey" : "mint");
    }, { size: 30 });
    const mus: Button = button(this, 180, -h / 2 + 440, 330, 100, music.isOn() ? "mint" : "grey", music.isOn() ? "Music: ON" : "Music: OFF", () => {
      music.setOn(!music.isOn());
      mus.setLabel(music.isOn() ? "Music: ON" : "Music: OFF").setColor(music.isOn() ? "mint" : "grey");
    }, { size: 30 });
    m.body.add([snd, mus]);
    m.body.add(button(this, 0, -h / 2 + 580, 520, 110, "blue", "STATS", () => {
      m.close();
      this.time.delayedCall(150, () => this.showStats());
    }, { icon: "icon_odds", iconSize: 50, size: 40 }));
    let sure = false;
    const quit: Button = button(this, 0, -h / 2 + 730, 520, 110, "red", "GIVE UP", () => {
      if (!sure) {
        sure = true;
        quit.setLabel("SURE? TAP AGAIN");
        return;
      }
      m.close();
      this.game.events.emit("give-up");
    }, { size: 38 });
    m.body.add(quit);
  }

  /** Everything about the current fight: numbers, your gadgets, skills and dice found. */
  private showStats(): void {
    if (battle.mode === "lobby") return;
    sfx.click();
    const h = 1360;
    const m = this.showModal(modal(this, 940, h, "STATS", "blue", () => (this.openModal = null)));
    const top = -h / 2 + 170;
    m.body.add([
      this.add.image(0, top, panelTexture(this, "row", 840, 170)),
      label(this, 0, top - 62, `Lv ${battle.level}  •  ${fmt(battle.dps)} DPS`, 28, "#7a5236"),
    ]);
    battle.gadgets.forEach((g, i) => {
      const x = (i - 1) * 270;
      const info = TIER_INFO[g.tier];
      const icon = this.add.image(x - 70, top + 14, gadgetKey(g.kind));
      icon.setScale(84 / Math.max(icon.width, icon.height));
      m.body.add([
        icon,
        this.add.circle(x - 104, top - 22, 22, info.color).setStrokeStyle(4, INK_N),
        text(this, x - 104, top - 24, g.tier, g.tier.length > 2 ? 16 : 24),
        fitText(label(this, x + 50, top - 2, gadgetName(g.kind, g.tier), 26, rgba(darken(info.color, 0.3))), 150),
        label(this, x + 50, top + 32, `Lv ${g.level}`, 24, "#7a5236"),
      ]);
    });
    let y = this.statRows(m, battle.stats, battle.time, top + 160, true);
    m.body.add(label(this, -330, y, "Skills:", 34, "#c9663a").setOrigin(0, 0.5));
    const picked = Object.entries(battle.skills) as [SkillId, number][];
    if (!picked.length) m.body.add(label(this, -190, y, "none yet - collect bones and meat to level up", 28, "#9a7a5a").setOrigin(0, 0.5));
    picked.forEach(([id, lv], i) => {
      const def = SKILL_BY_ID[id];
      const x = -330 + (i % 7) * 105 + 40;
      const yy = y + 80 + Math.floor(i / 7) * 110;
      m.body.add([
        this.add.circle(x, yy, 44, def.color).setStrokeStyle(5, INK_N),
        this.add.image(x, yy - 2, def.icon).setDisplaySize(58, 58),
        text(this, x + 30, yy + 30, `${lv}`, 28, lv === MAX_SKILL ? "#ffe066" : "#ffffff"),
      ]);
    });
    y += 80 + Math.ceil(Math.max(1, picked.length) / 7) * 110;
    m.body.add(button(this, 0, Math.min(h / 2 - 90, y + 40), 460, 120, "green", "BACK TO FIGHT", () => m.close(), { size: 40 }));
  }

  /** An airdrop opened: show the gadget, its tier and what happened (new, upgraded, level, scrapped). */
  private gadgetFound(f: GadgetFound): void {
    const { W } = this;
    const info = TIER_INFO[f.tier];
    const rank = tierIndex(f.tier);
    const y = this.L.hudBottom + 360;
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (rank >= 3) {
      const rays = this.add.image(0, 0, "rays").setTint(info.color).setAlpha(0.5).setScale(1.2);
      this.tweens.add({ targets: rays, angle: 180, duration: 2600 });
      parts.push(rays);
    }
    const icon = this.add.image(-200, 10, gadgetKey(f.kind));
    icon.setScale(170 / Math.max(icon.width, icon.height));
    const what = {
      new: ["NEW GADGET!", "#8af06a"],
      tier: [`UPGRADED TO ${f.tier}!`, "#8af06a"],
      level: [`LEVEL ${f.level}!`, "#8af06a"],
      replace: [`Swapped out the ${f.replaced ? GADGETS[f.replaced].name : ""}`, "#ffe066"],
      scrap: [`Scrapped: +${fmt(f.scrap)} money`, "#e8e0d0"],
    }[f.result];
    parts.push(
      this.add.image(0, 0, panelTexture(this, "glass", 820, 270)), icon,
      this.add.circle(-350, -80, 44, info.color).setStrokeStyle(7, INK_N),
      text(this, -350, -82, f.tier, f.tier.length > 2 ? 30 : 44),
      fitText(text(this, 160, -76, gadgetName(f.kind, f.tier), 50, info.css), 420),
      fitText(label(this, 160, -22, GADGETS[f.kind].desc, 24, "#fff3dc", 440), 440),
      fitText(text(this, 160, 66, what[0], f.result === "scrap" ? 32 : 44, what[1]), 420),
    );
    const c = this.add.container(W / 2, y, parts).setDepth(5100).setScale(0.3).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 300, ease: "Back.out" });
    this.tweens.add({ targets: c, alpha: 0, y: y - 60, delay: rank >= 3 ? 2600 : 2000, duration: 350, onComplete: () => c.destroy() });
    if (f.result !== "scrap" && rank >= 4) this.onBanner(`${info.name.toUpperCase()} GADGET!`, "gold", 1200);
  }

  /** 5:00: the screen flashes red and a WARNING sign blinks while the storm takes the crystal. */
  private bossWarning(): void {
    const { W, H } = this;
    const edge = this.add.graphics().setDepth(5300);
    for (let i = 0; i < 6; i++) {
      const a = 0.5 - i * 0.08;
      const w = 30 + i * 22;
      edge.lineStyle(w, 0xff2a2a, a).strokeRect(w / 2, w / 2, W - w, H - w);
    }
    edge.setAlpha(0);
    this.tweens.add({ targets: edge, alpha: 1, duration: 300, yoyo: true, repeat: 4, onComplete: () => edge.destroy() });
    const band = this.add.rectangle(W / 2, H * 0.36, W, 220, 0x1a0808, 0.75).setDepth(5310);
    const warn = text(this, W / 2, H * 0.36 - 30, "WARNING!", 110, "#ff4a4a").setDepth(5320);
    const sub = text(this, W / 2, H * 0.36 + 60, "Something is coming for the crystal...", 38, "#ffe0e0").setDepth(5320);
    this.tweens.add({ targets: warn, alpha: 0.3, duration: 250, yoyo: true, repeat: 5 });
    this.time.delayedCall(2600, () => this.tweens.add({ targets: [band, warn, sub], alpha: 0, duration: 400, onComplete: () => [band, warn, sub].forEach((o) => o.destroy()) }));
    [0, 700, 1400].forEach((t) => this.time.delayedCall(t, () => sfx.alarm()));
  }

  /** The boss lands: a big title card with its name. */
  private bossIntro(info: { name: string; tex: string }): void {
    const { W, H } = this;
    const cy = H * 0.4;
    const band = this.add.graphics().setDepth(5300);
    band.fillStyle(0x1a0808, 0.85).fillRect(0, cy - 190, W, 380);
    band.fillStyle(0xff4a4a, 1).fillRect(0, cy - 190, W, 10).fillRect(0, cy + 180, W, 10);
    const rays = this.add.image(W - 250, cy, "rays").setTint(0xff6a3a).setAlpha(0.5).setScale(1.3).setDepth(5301);
    const portrait = this.add.image(W + 300, cy + 120, info.tex).setOrigin(0.5, 0.94).setScale(1.9).setDepth(5302);
    const title = text(this, -400, cy - 80, "BOSS FIGHT!", 96, "#ff5a5a").setOrigin(0, 0.5).setDepth(5303);
    const name = text(this, -400, cy + 40, info.name.toUpperCase(), 64, "#ffe066").setOrigin(0, 0.5).setDepth(5303);
    const hint = text(this, 60, cy + 120, "Only you and your pets. Watch for the red marks!", 30, "#ffe0e0").setOrigin(0, 0.5).setDepth(5303).setAlpha(0);
    this.tweens.add({ targets: rays, angle: 180, duration: 3000 });
    this.tweens.add({ targets: portrait, x: W - 250, duration: 450, ease: "Back.out" });
    this.tweens.add({ targets: title, x: 60, duration: 400, ease: "Back.out", delay: 100 });
    this.tweens.add({ targets: name, x: 60, duration: 400, ease: "Back.out", delay: 250 });
    this.tweens.add({ targets: hint, alpha: 1, duration: 300, delay: 600 });
    this.cameras.main.flash(250, 255, 120, 80);
    sfx.fanfare();
    buzz(300);
    const all = [band, rays, portrait, title, name, hint];
    this.time.delayedCall(2200, () => this.tweens.add({ targets: all, alpha: 0, duration: 350, onComplete: () => all.forEach((o) => o.destroy()) }));
  }

  private updateGoals(): void {
    for (const b of this.badges) b.obj.setVisible(b.show());
    const owned = Object.keys(save.pets);
    this.nav.shop.badge.setVisible(freeGiftReady() || dailyDay() >= 0);
    this.nav.pets.badge.setVisible((save.equipped.length < petSlots() && owned.length > save.equipped.length) || anyLevelReady() || save.newPets.length > 0);
    this.nav.upgrades.badge.setVisible(TREE.some((n) => canBuy(n)));
    const dice = totalDice();
    this.nav.roll.badge.setVisible(dice > 0 && (dice >= 10 || save.luckyBoost > 0 || save.luckyCount >= luckyEvery() - 1));
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
    // rolls use the chosen dice tier; when it runs out, the next tier that has dice
    let tier = save.diceTier;
    if (save.dice[tier] <= 0) tier = DICE_TIERS.find((t) => save.dice[t] > 0) ?? tier;
    if (save.dice[tier] <= 0) {
      if (save.autoRoll) save.autoRoll = false;
      if (!auto) {
        sfx.error();
        this.toast("No dice left! Find dice in battle", "#ff9a9a");
      }
      return;
    }
    save.dice[tier]--;
    save.diceTier = tier;
    const lucky = save.luckyBoost > 0 || save.luckyCount >= luckyEvery() - 1;
    if (save.luckyBoost > 0) save.luckyBoost--;
    else save.luckyCount = lucky ? 0 : save.luckyCount + 1;
    // every 50th roll is a SUPER ROLL; rolling again soon builds a hot streak
    const superRoll = save.superCount >= SUPER_EVERY - 1;
    save.superCount = superRoll ? 0 : save.superCount + 1;
    const streak = this.rollScreen.bumpStreak(this.time.now);
    const prevBest = save.bestRoll;
    const results = rollMany(dicePerRoll(), luck() * DICE_LUCK[tier] * (lucky ? luckyMult() : 1) * (superRoll ? SUPER_MULT : 1) * streak);
    const best = results.reduce((a, b) => (b.item.oneIn > a.item.oneIn ? b : a));
    const record = best.item.oneIn > prevBest && rarityRank(best.item.rarity) >= 1;
    // every 25 rolls: a little gift of dice and gems
    let gift: { tier: Tier; dice: number; gems: number } | null = null;
    if (++save.giftCount >= GIFT_EVERY) {
      save.giftCount = 0;
      gift = { tier: rollDiceTier(save.stage + 10), dice: 3, gems: 2 };
      save.dice[gift.tier] += gift.dice;
      save.gems += gift.gems;
    }
    persist();
    this.rollReadyAt = this.time.now + rollTime();
    questEvent("roll", results.length);
    questEvent("rare", Math.max(...results.map((r) => rarityRank(r.item.rarity))));
    if (results.some((r) => r.isNew)) this.time.delayedCall(2400, () => this.indexMilestone());
    this.autoEquip(results);
    this.rollScreen.addHistory(results);
    if (this.tab === "roll" && !this.mapOpen) {
      this.rollScreen.reveal(results, { lucky, superRoll, record }, () => {
        this.afterReveal(results, 3, record);
        if (gift) this.rollScreen.giftPop(gift.tier, gift.dice, gift.gems);
      });
    } else {
      this.miniReveal(results);
      this.afterReveal(results, 5, record);
      if (gift) this.toast(`Roll gift: +${gift.dice} ${gift.tier} dice, +${gift.gems} gems!`, "#ffe066");
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

  /** Big pulls (new, far beyond your luck, or a new record) get the full-screen moment. */
  private afterReveal(results: RollResult[], minRank: number, record: boolean): void {
    const best = results.reduce((a, b) => (b.item.oneIn > a.item.oneIn ? b : a));
    const rank = rarityRank(best.item.rarity);
    if (rank >= minRank && (best.isNew || record || best.item.oneIn >= luck() * 500)) this.celebrate(best, record);
  }

  /** While you are on another screen, rolled pets pop up quietly above the Roll tab. */
  private miniReveal(results: RollResult[]): void {
    const { x } = this.tabPos("roll");
    const baseY = this.L.navTop - 70;
    results.slice(0, 3).forEach((r, i) => {
      const cls = r.item.cls;
      const c = this.add.container(Math.min(x, this.W - 200), baseY - i * 90, [
        this.add.image(0, 0, panelTexture(this, "glass", 340, 80)),
        this.add.circle(-130, 0, 32, TIER_INFO[cls].color).setStrokeStyle(4, INK_N),
        this.add.image(-130, 4, petTexture(this, r.item.id)).setScale(0.36),
        fitText(classText(this, 20, -14, r.item.name, 28, cls), 230),
        text(this, 20, 18, r.isNew ? `NEW!  Class ${cls}` : `Class ${cls}`, 22, r.isNew ? "#ff8aa8" : TIER_INFO[cls].css),
      ]).setDepth(4500).setAlpha(0).setScale(0.6);
      this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 200, ease: "Back.out" });
      this.tweens.add({ targets: c, alpha: 0, y: c.y - 40, delay: 1300, duration: 300, onComplete: () => c.destroy() });
    });
    const rank = Math.max(...results.map((r) => rarityRank(r.item.rarity)));
    if (rank >= 3) sfx.reveal(rank);
  }

  /** Full-screen moment for great pulls. */
  private celebrate(res: RollResult, record = false): void {
    this.celebrating = true;
    const { W, H } = this;
    const info = RARITY_INFO[res.item.rarity];
    const cy = H * 0.42;
    const dim = this.add.rectangle(0, 0, W, H, 0x2a1a10, 0.82).setOrigin(0).setInteractive();
    const rays = this.add.image(W / 2, cy, "rays").setScale(2.3).setTint(info.color).setAlpha(0.5);
    const glow = this.add.image(W / 2, cy, "glow").setScale(3.2).setTint(info.color).setAlpha(0.85);
    const title = text(this, W / 2, cy - 470, `${info.label.toUpperCase()}!`, 116, info.css);
    const card = petCard(this, W / 2, cy, res.item.id, { isNew: res.isNew }).setScale(0);
    const odds = classText(this, W / 2 + 70, cy + 345, oneIn(res.item.oneIn), 66, res.item.cls);
    const badge = classBadge(this, odds.x - odds.width / 2 - 80, cy + 345, res.item.cls, 84);
    const tap = text(this, W / 2, cy + 470, "TAP TO CONTINUE", 40);
    const root = this.add.container(0, 0, [dim, rays, glow, card, title, odds, badge, tap]).setDepth(6000);
    if (record) {
      const rec = this.add.container(W / 2, cy - 360, [
        this.add.image(0, 0, ribbonTexture(this, "gold", 560, 104)), text(this, 0, -12, "NEW RECORD!", 48),
      ]).setScale(0);
      root.add(rec);
      this.tweens.add({ targets: rec, scale: 1, duration: 400, delay: 600, ease: "Back.out", onStart: () => sfx.record() });
    }
    // confetti in the pet's colours
    const confetti = this.add.particles(0, -30, "petal", {
      x: { min: 0, max: W }, speedY: { min: 250, max: 650 }, speedX: { min: -220, max: 220 }, rotate: { start: 0, end: 720 },
      lifespan: 3200, gravityY: 300, scale: { min: 0.9, max: 1.7 }, tint: [info.color, 0xffffff, 0xffe066, 0xff7ab8, 0x5ac8ff], frequency: 40, quantity: 2,
    });
    root.add(confetti);
    this.time.delayedCall(1600, () => confetti.stop());
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
  private stageClear(info: { stage: number; earned: number; gems: number; dice: Record<Tier, number>; final: boolean }): void {
    const dice = DICE_TIERS.reduce((s, t) => s + info.dice[t], 0);
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
      this.add.image(W / 2 + 270, 112, "icon_dice").setScale(0.55), text(this, W / 2 + 310, 110, `+${dice}`, 52, "#ffe066").setOrigin(0, 0.5),
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

  /** Boss Rush top bar: the boss number and name over its health. */
  private rushHud(_time: number): void {
    const g = this.hudBars;
    const def = bossForStage(Math.min(RUSH_BOSSES, battle.rushBoss));
    drawBar(g, 24, 74, this.W - 48, 34, Math.max(0, battle.bossFrac), def.color);
    fitText(this.progressText.setText(`BOSS ${battle.rushBoss}  •  ${def.name}${battle.bossFrac >= 0 ? `  ${Math.ceil(battle.bossFrac * 100)}%` : ""}`), this.W - 80);
  }

  /** End of a Boss Rush: how far you got and where you will start next time. */
  private rushOver(r: RushResult): void {
    const h = 1080;
    let again = false;
    const title = r.reason === "done" ? "ALL BOSSES BEATEN!" : r.reason === "time" ? "TIME'S UP!" : r.reason === "hero" ? "YOU FELL!" : "BOSS RUSH OVER";
    const m = this.showModal(modal(this, 900, h, title, r.reason === "done" ? "gold" : "purple", () => {
      this.openModal = null;
      this.game.events.emit(again ? "rush-start" : "retry", false);
    }));
    const b = m.body;
    const top = -h / 2;
    const next = Math.min(RUSH_BOSSES, r.next);
    const def = bossForStage(next);
    b.add(text(this, 0, top + 140, r.beaten ? `${r.beaten} boss${r.beaten > 1 ? "es" : ""} beaten!` : "No bosses beaten this time", 52, "#c9663a"));
    const face = this.add.image(0, top + 330, def.tex);
    face.setScale(200 / Math.max(face.width, face.height));
    b.add([this.add.image(0, top + 330, "glow").setTint(def.color).setScale(1.1).setAlpha(0.6), face]);
    b.add(label(this, 0, top + 470, r.reason === "done" ? "You beat all 100 bosses!" : `Next time you start at BOSS ${next}: ${def.name}`, 32, "#7a5236", 760));
    b.add(label(this, 0, top + 540, `Best: boss ${save.bossRushBest}`, 28, "#9a7a5a"));
    const dice = DICE_TIERS.reduce((s2, t) => s2 + r.dice[t], 0);
    const rows: [string, string][] = [["icon_cash", fmt(r.earned)], ["icon_gem", `+${r.gems}`], ["icon_dice", `+${dice}`]];
    rows.forEach(([icon, v], i) => {
      const x = (i - 1) * 260;
      b.add([this.add.image(x - 60, top + 640, icon).setScale(0.6), text(this, x + 30, top + 640, v, 40, "#ffffff").setOrigin(0, 0.5).setStroke("#4a2f1d", 7)]);
    });
    b.add(label(this, 0, top + 730, "Get stronger pets and upgrades to beat bosses faster!", 28, "#9a7a5a", 760));
    if (r.next <= RUSH_BOSSES) {
      b.add(button(this, -165, h / 2 - 120, 300, 120, "purple", "AGAIN", () => {
        again = true;
        m.close();
      }, { size: 40 }));
    }
    b.add(button(this, r.next <= RUSH_BOSSES ? 165 : 0, h / 2 - 120, 300, 120, "peach", "LOBBY", () => m.close(), { size: 40 }));
  }

  /** Your hero up close: walking on a lit stage, total damage per second and where it comes from. */
  private showHero(): void {
    const dps = teamDps();
    const h = 1320;
    const m = this.showModal(modal(this, 940, h, "MY HERO", "orange", () => {
      this.openModal = null;
      walk.remove();
    }));
    const b = m.body;
    const top = -h / 2;
    const heroY = top + 400;
    const rays = this.add.image(0, heroY - 120, "rays").setTint(0xffe066).setAlpha(0.35).setScale(0.85);
    this.tweens.add({ targets: rays, angle: 360, duration: 16000, repeat: -1 });
    const hero = this.add.image(0, heroY, "hero").setOrigin(0.5, 0.95);
    hero.setScale(300 / hero.height);
    let frame = 0;
    const walk = this.time.addEvent({ delay: 230, loop: true, callback: () => hero.setTexture(++frame % 2 ? "hero_w1" : "hero_w2") });
    this.tweens.add({ targets: hero, y: heroY - 10, duration: 460, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    b.add([
      this.add.image(0, top + 250, panelTexture(this, "inset", 820, 330)), rays,
      this.add.ellipse(0, heroY - 6, 300, 60, 0x2a1a10, 0.35), hero,
      text(this, 0, top + 470, "TOTAL DAMAGE PER SECOND", 28, "#9a7a5a").setStroke("#ffffff", 0),
      text(this, 0, top + 535, fmt(dps.total), 84, "#ffcf3a"),
    ]);
    // where the damage comes from
    const rows: [string, string, number][] = [["hero", `Hero  (${GADGETS[STARTER_GADGET].name})`, dps.hero]];
    for (const [id, v] of Object.entries(dps.perPet)) rows.push([petTexture(this, id), ITEMS[id].name, v]);
    const g = this.add.graphics();
    b.add(g);
    rows.forEach(([icon, name, v], i) => {
      const y = top + 640 + i * 78;
      const img = this.add.image(-370, y, icon);
      img.setScale(60 / Math.max(img.width, img.height));
      b.add([img, label(this, -320, y - 14, name, 28).setOrigin(0, 0.5), text(this, 380, y - 14, fmt(v), 32, "#ffe066").setOrigin(1, 0.5)]);
      drawBar(g, -320, y + 12, 700, 14, dps.total ? v / dps.total : 0, i ? 0x7ad651 : 0xffb22e);
    });
    // other numbers
    const stats: [string, string, string][] = [
      ["icon_shield", "Health", fmt(heroMaxHp())],
      ["icon_boot", "Speed", `x${moveSpeedMult().toFixed(2)}`],
      ["icon_target", "Crit chance", `${Math.round(critChance() * 100)}%`],
      ["icon_star", "Crit damage", `x${critDamage().toFixed(1)}`],
    ];
    stats.forEach(([icon, name, v], i) => {
      const x = i % 2 ? 210 : -210;
      const y = top + 980 + Math.floor(i / 2) * 110;
      b.add([
        this.add.image(x, y, panelTexture(this, "row", 400, 92)),
        this.add.image(x - 150, y, icon).setScale(0.5),
        label(this, x - 110, y - 16, name, 24, "#9a7a5a").setOrigin(0, 0.5),
        text(this, x - 110, y + 16, v, 32, "#ffffff").setOrigin(0, 0.5),
      ]);
    });
  }

  showOdds(): void {
    const L = luck();
    const chances = classChances(L);
    const h = 360 + DICE_TIERS.length * 92;
    const m = this.showModal(modal(this, 940, h, "YOUR ODDS", "green", () => (this.openModal = null)));
    m.body.add(text(this, 0, -h / 2 + 110, `Luck ${luckText(L)}`, 46, "#b6f59a"));
    m.body.add(label(this, 0, -h / 2 + 162, `Worst possible roll: ${luckFloor(L).name}`, 28));
    // chance per roll of each pet class
    DICE_TIERS.forEach((c, i) => {
      const y = -h / 2 + 240 + i * 92;
      const p = chances[i];
      m.body.add([
        this.add.image(0, y, panelTexture(this, "row", 840, 80)),
        classBadge(this, -350, y, c, 58),
        classText(this, -270, y - 2, `Class ${c}`, 36, c).setOrigin(0, 0.5),
        label(this, 60, y, `${CLASS_SIZES[i]} pets`, 26, "#9a7a5a"),
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
    dev(210, 190, "+100 dice", () => (save.dice.A += 100));
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
