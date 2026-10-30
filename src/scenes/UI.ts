import Phaser from "phaser";
import { INK_N, canvasTexture, darken, lighten, rgba } from "../art/draw";
import { petTexture } from "../art/pets";
import { btnTexture, panelTexture } from "../art/ui";
import { crystalKey } from "../art/world";
import { MAX_STAGE, MINUTES, STAGE_MS, recommendedDps } from "../data/balance";
import { GADGETS, GADGET_SLOTS, MAX_GADGET_LEVEL, STARTER_GADGET, gadgetIcon, gadgetName, gadgetStats } from "../data/gadgets";
import { CLASS_SIZES, ITEMS, PET_LIST } from "../data/items";
import { mutationsAt } from "../data/mutations";
import { RUSH_MS, bossForStage } from "../data/bosses";
import { RARITY_INFO, rarityRank } from "../data/rarity";
import { Region, regionForStage } from "../data/regions";
import { MAX_SKILL, SKILL_BY_ID, SKILL_SLOTS, SkillId } from "../data/skills";
import { DICE_LUCK, DICE_TIERS, TIER_INFO, Tier, rollDiceTier, tierIndex } from "../data/tiers";
import { TREE } from "../data/tree";
import { GAME_W, Layout, TOP_ROW, TOP_Y, layoutFor } from "../layout";
import {
  DAILY, INDEX_STEP, checkIndexMilestones, claimDaily, claimQuest, dailyCash, dailyDay, ensureQuests, indexBonus, questDone, questEvent,
  QUEST_ICON, questGoal, questReward, questTitle,
} from "../systems/goals";
import { RollResult, rollMany } from "../systems/roll";
import { beginnerPow, classChances, stageLuck, topLuck } from "../data/luck";
import { makeEventTextures, makeFishIcon, makeFishTextures } from "../art/fishing";
import { PRIZES, ROW_COLORS } from "../data/fishing";
import { Catch, anyFishUpgrade, eventNext, eventReady, fishAway, fishTick } from "../systems/fishing";
import { FishScreen, prizeGift, prizeIcon } from "../ui/fishScreen";
import { makeOnlineTextures } from "../art/online";
import { canUsePlayGames, online, onlineEnabled, onlineTick, ownersOf, playerName, signInWithPlay, startOnline, syncSoon } from "../online/online";
import { askName, showLeaderboard } from "../ui/leaderboard";
import { Tutorial } from "../ui/tutorial";
import { addPet, lastSeenAtLoad, persist, resetSave, save, totalDice, stageCap, diceEventLeft } from "../systems/save";
import { RAIN_TRACK, RAIN_WIN_DROPS, RainReward } from "../data/diceEvent";
import { buzz, isMuted, music, setMuted, sfx, unlockAudio } from "../systems/sound";
import { applySettings } from "../systems/settings";
import { cardShowcase } from "../ui/cardOptions";
import {
  autoUnlocked, canBuy, critChance, critDamage, dicePerRoll, gemsPerBoss, luck, luckyEvery, luckyMult, moveSpeedMult, offlineRate, petSlots, potionActive, potionMult, rollTime,
} from "../systems/stats";
import { heroMaxHp, teamDps } from "../systems/power";
import { fmt, luckText, oneIn } from "../ui/format";
import { MapScreen } from "../ui/mapScreen";
import { GoalPins } from "../ui/goalPins";
import { LANGS, lang, setLang } from "../i18n";
import { HurtScreen } from "../ui/hurtScreen";
import { PetsScreen, anyLevelReady } from "../ui/petsScreen";
import { GIFT_EVERY, RollScreen, SUPER_MULT, superEvery } from "../ui/rollScreen";
import { Host, Screen, Tab } from "../ui/screens";
import { Reward, ShopScreen, freeGiftReady, playGiftReady, tickPlaytime } from "../ui/shopScreen";
import { TreeScreen } from "../ui/treeScreen";
import { animateClassTexts, classBadge, classText } from "../ui/classText";
import { BtnColor } from "../art/ui";
import { MODE_INFO, StageMode, modeForStage } from "../data/modes";
import type { DailyReward } from "../systems/goals";
import { arrowButton, cardButton, itemSplash, vividCard } from "../art/ps";
import { Button, Modal, Pill, button, drawBar, fitText, iconButton, label, modal, ribbonBanner, text } from "../ui/widgets";
import { badge } from "../ui/badge";
import { BattleMode, BattleScene, FightKind, GadgetOption, RunStats, RushResult, StageResult, battle, mmss } from "./Battle";

/** A tier's color dark enough to read on cream (commons in plain brown). */
const tierText = (t: Tier) => (t === "A" ? "#4a2f1d" : rgba(darken(TIER_INFO[t].color, 0.35)));

/** One card on the level-up and skill-drop pickers. */
interface PickCard {
  icon: string;
  color: number;
  tier?: Tier;
  name: string;
  nameColor: string;
  tag: string;
  tagColor: number;
  desc: string;
  /** filled stars, out of `max`; `newStar` (or -1) is the one you are about to gain */
  stars: number;
  max: number;
  newStar: number;
  /** a glowing border: something you do not have yet */
  fresh: boolean;
  glow: boolean;
}

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
/** "13d 4h", "5h 12m" or "9m" */
const dhm = (ms: number) => {
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m % 60}m`;
};

/** The lobby's quest card: its width, where its name and bar start (after the icon) and the bar's width. */
const QUEST_W = 420;
const QUEST_X = -QUEST_W / 2 + 112;
const QUEST_BAR = QUEST_W / 2 - 38 - QUEST_X;

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
  private mutRow!: Phaser.GameObjects.Container;
  private afkRing!: Phaser.GameObjects.Arc;
  private afkLabel!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Graphics;
  private joyG!: Phaser.GameObjects.Graphics;
  private mini!: Phaser.GameObjects.Image;
  private petals!: Phaser.GameObjects.Particles.ParticleEmitter;
  private overlayTimer = 0;
  private goalPins!: GoalPins;
  private hurt!: HurtScreen;
  private shieldText!: Phaser.GameObjects.Text;
  /** the gadget panel: one slot per gadget you carry */
  private gunPanel!: Phaser.GameObjects.Container;
  private gadgetSlots: { x: number; holder: Phaser.GameObjects.Container; sweep: Phaser.GameObjects.Graphics; key: string; left: number }[] = [];
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
  /** the luck potion: a big glowing icon with its timer under it */
  private potionBadge!: Phaser.GameObjects.Container;
  private potionTime!: Phaser.GameObjects.Text;
  private potionX!: Phaser.GameObjects.Text;
  private skillBar!: Phaser.GameObjects.Container;
  /** kill streak readout under the gadget panel */
  private streakHud!: Phaser.GameObjects.Text;
  private picker: Phaser.GameObjects.Container | null = null;
  private questG!: Phaser.GameObjects.Graphics;
  private questLabel!: Phaser.GameObjects.Text;
  private questCount!: Phaser.GameObjects.Text;
  private questGlow!: Phaser.GameObjects.Image;
  private questIcon!: Phaser.GameObjects.Image;
  private questCard!: Phaser.GameObjects.Image;
  private badges: { obj: Phaser.GameObjects.Container; show: () => boolean }[] = [];
  /** the big 5-4-3-2-1 before the boss comes (and before a Boss Rush boss gets away) */
  private countText!: Phaser.GameObjects.Text;
  private lastCount = 0;
  /** the fishing event's card in the lobby */
  private eventCard!: Phaser.GameObjects.Container;
  private diceEventCard!: Phaser.GameObjects.Container;
  private diceEventTime!: Phaser.GameObjects.Text;
  private diceEventBadge?: Phaser.GameObjects.Container;
  private eventBar!: Phaser.GameObjects.Graphics;
  private eventText!: Phaser.GameObjects.Text;
  private eventGlow!: Phaser.GameObjects.Image;
  private badgeTimer = 0;
  private nav: Record<Tab, NavTab> = {} as Record<Tab, NavTab>;
  private navBar!: Phaser.GameObjects.Graphics;

  // screens
  private screens!: Record<Exclude<Tab, "battle" | "upgrades">, Screen>;
  private rollScreen!: RollScreen;
  private tree!: TreeScreen;
  private map!: MapScreen;
  private openModal: Modal | null = null;
  private tutorial!: Tutorial;
  private goBtn!: Phaser.GameObjects.Container;
  private rushBtn!: Phaser.GameObjects.Container;
  /** "TRY ME!" over Boss Rush when you are far stronger than your stage */
  private rushHint!: Phaser.GameObjects.Container;
  private battleSub!: Phaser.GameObjects.Text;
  private stagePrev!: Phaser.GameObjects.Container;
  private stageNext!: Phaser.GameObjects.Container;
  private startBtn: Button | null = null;
  /** what the fishing line caught while you were away, shown once the other welcome popups are gone */
  private fishAwayResult: { catches: Catch[]; secs: number } | null = null;

  // rolling
  private rollReadyAt = 0;
  private celebrating = false;
  private fast = false;

  constructor() {
    super("UI");
  }

  create(): void {
    applySettings(this.game);
    // ?cards: the pet card ideas, for choosing a new look
    if (new URLSearchParams(location.search).has("cards")) (window as unknown as { cardShowcase: (n: number) => void }).cardShowcase = (n) => cardShowcase(this, n);
    this.H = this.scale.height;
    this.L = layoutFor(this.H);
    Object.assign(this, { openModal: null, celebrating: false, picker: null, badges: [], tab: "battle", mapOpen: false, nav: {}, mode: "" });
    ensureQuests();
    // teams are at most three pets now
    if (save.equipped.length > petSlots()) {
      save.equipped = save.equipped.slice(0, petSlots());
      persist();
    }
    makeOnlineTextures(this);
    this.buildHud();
    this.rollScreen = new RollScreen(this, this);
    this.screens = { roll: this.rollScreen, pets: new PetsScreen(this, this), shop: new ShopScreen(this, this), fish: new FishScreen(this, this) };
    this.tree = new TreeScreen(this, this.L, () => this.afterPurchase(), (s, c) => this.toast(s, c));
    this.map = new MapScreen(this, this, () => this.setTab("battle"));
    this.buildHeader();
    makeFishIcon(this);
    this.buildNav();
    this.input.on("pointerdown", () => unlockAudio());
    const on: [string, (...a: never[]) => void][] = [
      ["toast", this.toast],
      ["cash-arrived", this.onCash],
      ["stage-clear", this.stageClear],
      ["land-unlocked", this.landUnlocked],
      ["skill-choice", this.showSkillChoice],
      ["gadget-choice", this.showGadgetChoice],
      ["skills-changed", this.drawSkillBar],
      ["stage-start", this.drawSkillBar],
      ["stage-failed", this.stageFailed],
      ["dice", this.onDice],
      ["banner", this.onBanner],
      ["cash-fly", this.onCashFly],
      ["battle-ready", this.onBattleReady],
      ["boss-warning", this.bossWarning],
      ["mode-intro", this.modeIntro],
      ["boss-intro", this.bossIntro],
      ["rush-over", this.rushOver],
      ["rain-drops", (n: number) => this.toast(`+${n} Rain Drops for the Dice Rain event!`, "#9ae6ff")],
    ];
    for (const [ev, fn] of on) this.game.events.on(ev, fn, this);
    this.events.once("shutdown", () => {
      for (const [ev, fn] of on) this.game.events.off(ev, fn, this);
    });
    let i = 0;
    this.time.addEvent({ delay: 40, repeat: PET_LIST.length - 1, callback: () => petTexture(this, PET_LIST[i++].id) });
    this.setTab("battle", true);
    const away = fishAway();
    if (away.catches.length) this.fishAwayResult = away;
    // online: sign in and send your entry (quietly; the game works the same offline)
    window.setTimeout(() => void startOnline(), 1200);
    const spotOf = (o: Phaser.GameObjects.Container | null): [number, number] | null => {
      if (!o || !o.active || !o.visible) return null;
      const b = o.getBounds();
      return [b.centerX, b.centerY];
    };
    this.tutorial = new Tutorial({
      scene: this,
      tab: () => this.tab,
      modalOpen: () => !!this.openModal,
      mapOpen: () => this.mapOpen,
      battleButton: () => (this.lobby.visible ? spotOf(this.goBtn) : null),
      startButton: () => spotOf(this.startBtn),
      rollButton: () => this.rollScreen.rollButtonSpot(),
      tabSpot: (tab) => {
        const p = this.tabPos(tab);
        return [p.x, p.y];
      },
      rushButton: () => (this.lobby.visible ? spotOf(this.rushBtn) : null),
      bestTeamButton: () => (this.screens.pets as PetsScreen).bestTeamSpot(),
      teamChanges: () => (this.screens.pets as PetsScreen).teamChanges,
    });
    if (!this.offlineEarnings() && dailyDay() >= 0) this.time.delayedCall(900, () => this.showDaily());
    // the loading screen waits for this
    this.game.events.emit("ui-ready");
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
    // with AFK on, the lobby keeps going on every screen so your hero keeps collecting dice
    const afkLobby = battle.mode === "lobby" && save.afk && !battle.rush;
    const run = afkLobby || (this.tab === "battle" && !this.mapOpen && !this.openModal && !battle.choosing && !this.celebrating && !this.picker);
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
    // the minimap is only for fights, not the lobby
    this.mini.setVisible(!lobby);
    this.mini.setPosition(...this.miniSpot());
    this.overlay.clear();
    if (lobby) this.refreshLobby();
  }

  /** The lobby texts and buttons for the stage you are on. */
  private refreshLobby(): void {
    this.lobbyTitle.setText(`Stage ${save.stage}`);
    this.lobbyLand.setText(regionForStage(save.stage).name);
    this.lobbyBest.setText(`${save.bestStage} / ${MAX_STAGE}${save.stage < save.bestStage ? "   REPLAY" : ""}`);
    const mode = MODE_INFO[modeForStage(save.stage)];
    this.battleSub.setText(`${save.stage < save.bestStage ? "Replay " : ""}Stage ${save.stage}  •  ${mode.name}`).setColor(mode.css);
    this.stagePrev.setPosition(this.lobbyTitle.x + this.lobbyTitle.width + 56, 178).setVisible(save.stage > 1);
    this.stageNext.setPosition(this.stagePrev.x + 84, 178).setVisible(save.stage < Math.min(MAX_STAGE, stageCap()));
    this.rushFace.setTexture(bossForStage(save.stage).tex);
    this.rushFace.setScale(100 / Math.max(this.rushFace.width, this.rushFace.height));
    this.rushNum.setText(`Boss ${save.stage}  •  ${RUSH_MS / 1000}s each`);
    const muts = mutationsAt(save.stage);
    this.mutRow.removeAll(true);
    muts.forEach((m, i) => {
      if (this.textures.exists(`mut_${m.id}`)) this.mutRow.add(this.add.image(16 + i * 46, 0, `mut_${m.id}`).setScale(0.75));
    });
  }

  update(time: number, delta: number): void {
    animateClassTexts(time);
    this.badgeTimer -= delta;
    if (this.badgeTimer <= 0) {
      this.badgeTimer = 400;
      this.updateGoals();
      onlineTick();
      // the world only needs drawing while you look at it
      const b = this.scene.get("Battle");
      b.cameras.main.setVisible(this.tab === "battle" && !this.mapOpen);
    }
    this.syncBattle();
    this.refreshMode();
    this.cashPill.setValue(fmt(save.cash));
    this.gemPill.setValue(fmt(save.gems));
    this.diceTop.setValue(fmt(totalDice()));
    this.countdown();
    if (this.tab === "battle" && !this.mapOpen) {
      this.updateHud(time);
      const b = this.battleScene;
      if (b.sys.isActive() || b.sys.isPaused()) {
        b.drawJoystick(this.joyG);
        this.overlayTimer -= delta;
        if (this.overlayTimer <= 0) {
          this.overlayTimer = 100;
          const [mx, my] = this.miniSpot();
          if (battle.mode === "run") b.drawOverlay(this.overlay, mx, my, 180, this.L.hudBottom + 30, this.H - 140);
          else this.overlay.clear();
        }
        this.goalPins.update(b.goals(), this.L.hudBottom + 30, this.H - 140, time);
      } else this.goalPins.hide();
    } else this.goalPins.hide();
    this.hurt.update(this.tab === "battle" && !this.mapOpen && battle.mode === "run" ? battle.hp : null, time, delta);
    this.fishing();
    tickPlaytime(delta);
    this.rollScreen.setReadyAt(this.rollReadyAt);
    for (const s of Object.values(this.screens)) s.update(time);
    if (this.mapOpen) this.map.update();
    this.tree.update(delta);
    if (save.autoRoll && autoUnlocked()) this.roll(true);
    this.tutorial.update(delta);
  }

  // ───────────────────────── Host (used by the screens) ─────────────────────────

  isFast(): boolean {
    return this.fast;
  }

  setFast(on: boolean): void {
    this.fast = on;
  }

  tabPos(tab: Tab): { x: number; y: number } {
    // fishing is an event in the battle lobby
    if (tab === "fish") return { x: this.eventCard.x, y: this.eventCard.y };
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
    // however a popup goes away, it no longer blocks the lobby buttons
    m.root.once("destroy", () => {
      if (this.openModal === m) this.openModal = null;
    });
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
      // the fishing event belongs to the battle lobby
      const active = t.id === tab || (tab === "fish" && t.id === "battle");
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
    // best stage next to a trophy, and this stage's mutations as badges
    this.lobbyBest = text(this, 84, 282, "", 30, "#ffe6b8").setOrigin(0, 0.5);
    this.lobbyMuts = text(this, 40, 318, "", 24, "#e0c4ff").setOrigin(0, 0.5).setVisible(false);
    this.mutRow = this.add.container(40, 322);
    this.lobby.add([this.add.image(56, 282, "icon_trophy").setScale(0.42), this.mutRow]);
    const shade = this.add.graphics();
    shade.fillStyle(0x3a2516, 0.55).fillRect(0, 0, W, 344);
    this.lobby.add([shade, this.lobbyTitle, this.lobbyLand, this.lobbyBest, this.lobbyMuts]);
    const bottom = this.L.navTop;
    this.dpsPill = new Pill(this, W / 2 - 196, bottom - 330, 372, 76, "icon_sword", 34, "glass");
    this.dpsPill.setSize(372, 76).setInteractive({ useHandCursor: true }).on("pointerup", () => this.showHero());
    this.luckPill = new Pill(this, W / 2 + 196, bottom - 330, 372, 76, "icon_clover", 34, "glass");
    this.luckPill.setSize(372, 76).setInteractive({ useHandCursor: true }).on("pointerup", () => this.setTab("roll"));
    // the luck potion timer sits centred above your DPS and luck
    const pGlow = this.add.image(0, 0, "glow").setTint(0x9cff6a).setScale(1.3).setAlpha(0.8);
    this.tweens.add({ targets: pGlow, scale: 1.55, alpha: 0.45, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const pIcon = this.add.image(0, -6, "icon_potion").setScale(1.25);
    this.tweens.add({ targets: pIcon, angle: { from: -8, to: 8 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.potionX = text(this, 44, -50, "", 32, "#ffe066", { stroke: 8 });
    this.potionTime = text(this, 0, 74, "", 36, "#ffffff", { stroke: 9 });
    this.potionBadge = this.add.container(96, bottom - 470, [pGlow, pIcon, this.potionX, this.potionTime]);
    // BATTLE: a big sunny orange card with a sword on a paint splat
    const sword = itemSplash(this, "icon_sword", 130, 0xffe066).setPosition(-196, 0);
    this.tweens.add({ targets: sword, angle: { from: -8, to: 8 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.battleSub = text(this, 70, 52, "", 30, "#ffffff", { stroke: 8 });
    const go = this.goBtn = cardButton(this, 352, bottom - 172, 620, 210, 0xff8a2a, [
      sword, text(this, 70, -26, "BATTLE", 88, "#ffffff", { stroke: 14 }), this.battleSub,
    ], () => {
      unlockAudio();
      sfx.click();
      this.confirmStart("battle");
    });
    // BOSS RUSH: a dark red card, the boss's face in a ring of fire and a stopwatch
    const fire = this.add.image(0, -22, "rays").setTint(0xff7a2a).setScale(0.34).setAlpha(0.9);
    this.tweens.add({ targets: fire, angle: 360, duration: 4000, repeat: -1 });
    this.rushFace = this.add.image(0, -22, "e_golem");
    this.rushNum = text(this, 0, 76, "", 24, "#ffd0d0", { stroke: 6 });
    const rush = this.rushBtn = cardButton(this, W - 196, bottom - 172, 340, 210, 0xb01e3a, [
      fire, this.add.circle(0, -22, 56, 0x2a0a14).setStrokeStyle(6, 0x111111), this.rushFace,
      this.add.image(-128, -70, "icon_skull").setScale(0.55), this.add.image(128, -70, "icon_clock").setScale(0.55),
      text(this, 0, 44, "BOSS RUSH", 42, "#ffe066", { stroke: 10 }), this.rushNum,
    ], () => {
      unlockAudio();
      sfx.click();
      this.confirmStart("rush");
    });
    this.tweens.add({ targets: this.rushFace, angle: { from: -6, to: 6 }, duration: 600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.lobby.add(rush);
    // a red comic sticker on the corner of the Boss Rush card
    this.rushHint = this.add.container(W - 92, rush.y - 92, [
      this.add.image(0, 0, "comic_burst").setScale(0.95, 0.8),
      text(this, 0, -2, "TRY ME!", 38, "#ffffff", { stroke: 10 }),
    ]).setAngle(12).setScale(0.75).setVisible(false);
    this.tweens.add({ targets: this.rushHint, scale: 0.88, duration: 380, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.lobby.add(this.rushHint);
    this.tweens.add({ targets: go.list.slice(2, 3), scale: 1.08, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    // pick any stage you already reached
    this.stagePrev = arrowButton(this, 0, 178, -1, () => this.pickStage(save.stage - 1));
    this.stageNext = arrowButton(this, 0, 178, 1, () => this.pickStage(save.stage + 1));
    this.lobby.add([this.stagePrev, this.stageNext]);
    this.lobby.add([this.dpsPill, this.luckPill, this.potionBadge, go]);
    this.lobby.bringToTop(this.rushHint);
    // quest tracker
    // a vivid card: the quest's icon on a paint splat, a short name, a bar with the numbers on it
    // the icon has its own column on the left; the name and the bar start after it
    const qw = QUEST_W;
    this.questGlow = this.add.image(0, 0, "glow").setTint(0xffe066).setScale(2.6, 1).setVisible(false);
    this.tweens.add({ targets: this.questGlow, alpha: { from: 0.25, to: 0.8 }, duration: 600, yoyo: true, repeat: -1 });
    this.questG = this.add.graphics();
    this.questIcon = this.add.image(-qw / 2 + 56, 0, "icon_quest").setScale(0.5);
    const splat = this.add.image(-qw / 2 + 56, 0, "paint_splash").setTint(0xfff3a0).setScale(0.44);
    this.questLabel = text(this, QUEST_X, -26, "", 28, "#ffffff", { stroke: 8 }).setOrigin(0, 0.5);
    this.questCount = text(this, QUEST_X + QUEST_BAR / 2, 22, "", 22, "#ffffff", { stroke: 5 });
    this.questCard = this.add.image(0, 0, vividCard(this, 0x5fc85a, qw, 112));
    const tracker = this.add.container(W - qw / 2 - 16, this.L.hudBottom + 100, [
      this.questGlow, this.questCard, splat, this.questIcon, this.questLabel, this.questG, this.questCount,
    ]).setSize(qw, 112).setInteractive({ useHandCursor: true }).on("pointerup", () => this.showQuests());
    tracker.on("pointerdown", () => this.tweens.add({ targets: tracker, scale: 0.94, duration: 60 }));
    tracker.on("pointerout", () => tracker.setScale(1));
    this.lobby.add(tracker);
    // small round shortcuts down the left side
    // big icons with a shadow and a label under them, in two columns (no round backgrounds)
    const side = (i: number, icon: string, str: string, fn: () => void, badge?: () => boolean) => {
      const x = 74 + (i % 2) * 136;
      const y = this.L.hudBottom + 92 + Math.floor(i / 2) * 150;
      const k = 92 / Math.max(this.textures.getFrame(icon).width, this.textures.getFrame(icon).height);
      const pic = this.add.image(0, -8, icon).setScale(k);
      this.tweens.add({ targets: pic, y: -14, duration: 900 + i * 110, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      const b = this.add.container(x, y, [
        this.add.circle(0, -8, 52, 0x2f6f3a, 0).setStrokeStyle(5, 0x8af06a, 0),
        this.add.image(5, -2, icon).setScale(k).setTintFill(0x000000).setAlpha(0.3),
        pic,
        text(this, 0, 54, str, 27, "#ffffff", { stroke: 7 }),
      ]).setSize(124, 140).setInteractive({ useHandCursor: true });
      b.on("pointerdown", () => this.tweens.add({ targets: b, scale: 0.88, duration: 60 }));
      b.on("pointerout", () => b.setScale(1));
      b.on("pointerup", () => {
        b.setScale(1);
        sfx.click();
        fn();
      });
      this.lobby.add(b);
      if (badge) this.addBadge(x - 40, y - 52, badge);
      return b;
    };
    side(0, "icon_map", "Map", () => this.openMap());
    side(1, "icon_quest", "Quests", () => this.showQuests(), () => save.quests.some(questDone));
    side(2, "icon_gift", "Daily", () => this.showDaily(), () => dailyDay() >= 0);
    side(3, "hero", "Hero", () => this.showHero());
    const afk = side(4, "icon_auto", "AFK", () => {
      save.afk = !save.afk;
      persist();
      this.refreshAfk();
      this.toast(save.afk ? "AFK on: your hero walks around and picks up dice" : "AFK off: walk with the joystick", "#b6f59a");
    });
    side(5, "icon_trophy", "Ranks", () => showLeaderboard(this, this, () => (this.openModal = null)));
    this.buildEventCard();
    this.buildDiceEventCard();
    this.afkRing = afk.list[0] as Phaser.GameObjects.Arc;
    this.afkLabel = afk.list[3] as Phaser.GameObjects.Text;
    this.refreshAfk();

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
    // your gadgets: a medal each with tier and level; a dark sweep shows when it fires next
    const gunPanel = this.add.container(W - 200, 306, [this.add.image(0, 0, panelTexture(this, "glass", 384, 140))]);
    this.gunPanel = gunPanel;
    this.gadgetSlots = [];
    for (let i = 0; i < GADGET_SLOTS; i++) {
      const x = (i - 1) * 122;
      const holder = this.add.container(x, 0);
      const sweep = this.add.graphics();
      gunPanel.add([this.add.circle(x, 0, 52, 0x000000, 0.3).setStrokeStyle(4, 0xffffff, 0.22), text(this, x, -2, "+", 54, "#8a7a6a", { stroke: false }).setAlpha(0.5), holder, sweep]);
      this.gadgetSlots.push({ x, holder, sweep, key: "", left: 0 });
    }
    gunPanel.setSize(384, 140).setInteractive({ useHandCursor: true }).on("pointerup", () => this.showStats());
    this.skillBar = this.add.container(0, H - 84);
    this.streakHud = text(this, W - 200, 404, "", 30, "#ffb347");
    this.run.add([
      band, this.hudBars, this.progressText, this.levelText, this.stageText, this.crystalIcon, this.shieldText, gunPanel, this.skillBar, this.streakHud,
      iconButton(this, 62, 165, "icon_pause", 86, () => this.showPause()),
      iconButton(this, 160, 165, "icon_odds", 86, () => this.showStats()),
    ]);
    this.hud.add([this.lobby, this.run]);
    // minimap, arrows and joystick (drawn by the battle, in screen space)
    this.mini = this.add.image(22, this.L.hudBottom + 24, "__DEFAULT").setOrigin(0).setDisplaySize(180, 180).setAlpha(0.92).setVisible(false);
    this.overlay = this.add.graphics();
    this.joyG = this.add.graphics();
    this.hud.add([this.mini, this.overlay, this.joyG]);
    this.goalPins = new GoalPins(this, 11);
    // low health: red, cracked screen edges (under the HUD)
    this.hurt = new HurtScreen(this, 5);
    this.countText = text(this, W / 2, H * 0.36, "", 260, "#ffe066").setStroke("#1a1030", 26).setDepth(7400).setVisible(false);
  }

  /**
   * The fishing event's card on the right of the lobby: a little lake at sunset with a fish leaping
   * out of it, the bar to the next event reward, and a "!" when a reward or an upgrade is waiting.
   */
  private buildEventCard(): void {
    makeFishTextures(this);
    makeEventTextures(this);
    const x = this.W - 136;
    const y = this.L.hudBottom + 385;
    this.eventGlow = this.add.image(0, 0, "glow").setTint(0xffd23f).setScale(1.5, 1.6).setAlpha(0);
    this.tweens.add({ targets: this.eventGlow, alpha: { from: 0.25, to: 0.75 }, duration: 600, yoyo: true, repeat: -1 });
    const card = this.add.image(0, 0, "event_card");
    const fish = this.add.image(-60, 24, "event_fish").setScale(0.72).setAlpha(0).setFlipX(true);
    const ripple = (rx: number) => {
      const r = this.add.image(rx, 30, "ring").setScale(0.12, 0.04).setAlpha(0.9);
      c.addAt(r, 2);
      this.tweens.add({ targets: r, scaleX: 0.45, scaleY: 0.12, alpha: 0, duration: 700, onComplete: () => r.destroy() });
    };
    // the fish leaps out of the lake, now and then
    const leap = { k: 0 };
    let landed = false;
    this.tweens.add({
      targets: leap, k: 1, duration: 1000, repeat: -1, repeatDelay: 1700,
      onRepeat: () => {
        landed = false;
        ripple(-60);
      },
      onUpdate: () => {
        const k = leap.k;
        fish.setPosition(-60 + 120 * k, 26 - Math.sin(k * Math.PI) * 84).setAngle(-45 + 90 * k).setAlpha(k < 0.04 || k > 0.96 ? 0 : 1);
        if (k > 0.95 && !landed) {
          landed = true;
          ripple(60);
        }
      },
    });
    // a shine sweeps across the card
    const shine = this.add.image(-200, 0, "card_shine").setAlpha(0.5).setScale(1, 1.2);
    const mask = this.make.graphics({}, false);
    mask.fillStyle(0xffffff).fillRoundedRect(x - 112, y - 127, 224, 254, 24);
    shine.setMask(mask.createGeometryMask());
    this.tweens.add({ targets: shine, x: 200, duration: 900, repeat: -1, repeatDelay: 2600, ease: "Sine.inOut" });
    const ribbon = this.add.image(0, -126, "event_ribbon").setScale(0.84);
    const word = fitText(text(this, 0, -132, "EVENT", 32, "#fff3c8"), 170);
    this.tweens.add({ targets: [ribbon, word], scale: "*=1.06", duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.eventBar = this.add.graphics();
    this.eventText = text(this, 0, 104, "", 22);
    const c = this.add.container(x, y, [this.eventGlow, card, fish, shine, ribbon, word, fitText(text(this, 0, 66, "FISHING", 36), 220), this.eventBar, this.eventText])
      .setSize(240, 270).setInteractive({ useHandCursor: true });
    c.on("pointerdown", () => this.tweens.add({ targets: c, scale: 0.92, duration: 60 }));
    c.on("pointerout", () => c.setScale(1));
    c.on("pointerup", () => {
      c.setScale(1);
      this.setTab("fish");
    });
    this.eventCard = c;
    this.lobby.add(c);
    this.addBadge(x + 104, y - 112, () => eventReady() > 0 || anyFishUpgrade());
    this.refreshEventCard();
  }

  /** The beginners' Dice Rain event card (first 14 days): a bouncing die, the time left. */
  private buildDiceEventCard(): void {
    const x = this.W - 136;
    const y = this.L.hudBottom + 680;
    const glow = this.add.image(0, 0, "glow").setTint(0xffe066).setScale(1.5, 1.6).setAlpha(0.5);
    this.tweens.add({ targets: glow, alpha: 0.9, duration: 600, yoyo: true, repeat: -1 });
    const shadow = this.add.ellipse(0, 50, 90, 22, 0x000000, 0.3);
    const die = this.add.image(0, -10, "die_S").setScale(1.25);
    this.tweens.add({ targets: die, y: -40, angle: 20, duration: 450, yoyo: true, repeat: -1, ease: "Quad.out" });
    this.tweens.add({ targets: shadow, scaleX: 0.7, duration: 450, yoyo: true, repeat: -1, ease: "Quad.out" });
    const ribbon = this.add.image(0, -126, "event_ribbon").setScale(0.84).setTint(0xffd0ff);
    this.diceEventTime = text(this, 0, 104, "", 24, "#ffffff", { stroke: 6 });
    const c = this.add.container(x, y, [
      glow, this.add.image(0, 0, vividCard(this, 0xffa040, 230, 250)), shadow, die, ribbon,
      text(this, 0, -132, "NEW!", 32, "#fff3c8"), fitText(text(this, 0, 70, "DICE RAIN", 34, "#ffffff", { stroke: 8 }), 220), this.diceEventTime,
    ]).setSize(240, 270).setInteractive({ useHandCursor: true });
    c.on("pointerdown", () => this.tweens.add({ targets: c, scale: 0.92, duration: 60 }));
    c.on("pointerout", () => c.setScale(1));
    c.on("pointerup", () => {
      c.setScale(1);
      unlockAudio();
      sfx.click();
      this.showDiceEvent();
    });
    // a red "!" when prizes are waiting
    this.diceEventBadge = this.add.container(92, -112, [this.add.circle(0, 0, 22, 0xf03e3e).setStrokeStyle(5, 0xffffff), text(this, 0, -1, "!", 30, "#ffffff", { stroke: 5 })]);
    this.tweens.add({ targets: this.diceEventBadge, scale: 1.18, duration: 420, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    c.add(this.diceEventBadge);
    this.diceEventCard = c;
    this.lobby.add(c);
  }

  private refreshEventCard(): void {
    const left = diceEventLeft();
    this.diceEventCard?.setVisible(left > 0);
    if (left > 0) this.diceEventTime?.setText(dhm(left));
    this.diceEventBadge?.setVisible(this.rainReady() > 0);
    const e = save.fishing.event;
    const ready = eventReady();
    const n = eventNext();
    this.eventBar.clear();
    const f = ready ? 1 : (e.points - n.from) / Math.max(1, n.goal - n.from);
    drawBar(this.eventBar, -92, 92, 184, 24, Phaser.Math.Clamp(f, 0, 1), ready ? 0xffd23f : 0x5ac8ff);
    this.eventText.setText(ready ? "CLAIM!" : `${fmt(e.points)}/${fmt(n.goal)}`).setColor(ready ? "#ffe066" : "#ffffff");
    fitText(this.eventText, 176);
    this.eventGlow.setVisible(ready > 0);
  }

  /** A Dice Rain track prize as a reward to show and give. */
  private rainReward(r: RainReward): Reward {
    switch (r.kind) {
      case "dice": return { icon: `die_${r.tier}`, amount: `x${r.amount}`, give: () => (save.dice[r.tier!] += r.amount) };
      case "gems": return { icon: "icon_gem", amount: `x${r.amount}`, give: () => (save.gems += r.amount) };
      case "potion": return { icon: "icon_potion", amount: `${r.amount}m`, give: () => (save.potionUntil = Math.max(Date.now(), save.potionUntil) + r.amount * 60000) };
      case "lucky": return { icon: "icon_clover", amount: `x${r.amount}`, give: () => (save.luckyBoost += r.amount) };
      case "ticket": return { icon: "icon_ticket", amount: `x${r.amount}`, give: () => (save.tickets += r.amount) };
      case "pet": return { icon: petTexture(this, r.pet!), amount: "NEW!", give: () => addPet(r.pet!) };
    }
  }

  /** Track prizes reached but not claimed yet. */
  private rainReady(): number {
    let n = 0;
    while (save.rain.claimed + n < RAIN_TRACK.length && save.rain.drops >= RAIN_TRACK[save.rain.claimed + n].goal) n++;
    return n;
  }

  /**
   * The Dice Rain event: a big blue card with dice raining down, your Rain Drops, the 15 prizes
   * of its track (two exclusive pets on it), CLAIM ALL and PLAY.
   */
  private showDiceEvent(): void {
    const W = 1000;
    const H = 1560;
    const top = -H / 2;
    const m = this.showModal(modal(this, W, H, "", "blue", () => (this.openModal = null), undefined, true));
    const b = m.body;
    b.add(this.add.image(0, 0, vividCard(this, 0x3a8ae0, W, H)));
    // dice keep raining down behind the title
    for (let k = 0; k < 9; k++) {
      const tier = DICE_TIERS[k % 6];
      const x = -W / 2 + 80 + k * ((W - 160) / 8);
      const d = this.add.image(x, top + 40, `die_${tier}`).setScale(0.55).setAlpha(0);
      this.tweens.add({ targets: d, y: top + 300, alpha: { from: 0.9, to: 0 }, angle: 200, duration: 1600, delay: k * 230, repeat: -1, ease: "Quad.in" });
      b.add(d);
    }
    b.add([
      text(this, 0, top + 120, "DICE RAIN", 110, "#ffffff", { stroke: 16 }),
      this.add.image(0, top + 228, panelTexture(this, "glass", 640, 70)),
      text(this, 0, top + 226, `BEGINNER EVENT  •  ends in ${dhm(diceEventLeft())}`, 32, "#ffe066", { stroke: 7 }),
    ]);
    // your drops and the bar to the next prize
    const next = RAIN_TRACK[save.rain.claimed + this.rainReady()];
    const prev = save.rain.claimed + this.rainReady() > 0 ? RAIN_TRACK[save.rain.claimed + this.rainReady() - 1].goal : 0;
    const bar = this.add.graphics();
    drawBar(bar, -380, top + 360, 760, 40, next ? (save.rain.drops - prev) / (next.goal - prev) : 1, 0x5ac8ff);
    b.add([
      this.add.image(-300, top + 306, "die_C").setScale(0.62),
      text(this, -250, top + 304, `${save.rain.drops.toLocaleString("en-US")} Rain Drops`, 46, "#ffffff", { stroke: 9 }).setOrigin(0, 0.5),
      bar,
      text(this, 0, top + 380, next ? `next prize at ${next.goal.toLocaleString("en-US")}` : "TRACK COMPLETE!", 26, "#ffffff", { stroke: 6 }),
    ]);
    // the 15 prizes
    const TW = 172;
    const TH = 214;
    const g = this.add.graphics();
    b.add(g);
    RAIN_TRACK.forEach((t, i) => {
      const x = -2 * (TW + 12) + (i % 5) * (TW + 12);
      const y = top + 560 + Math.floor(i / 5) * (TH + 18);
      const claimed = i < save.rain.claimed;
      const ready = !claimed && save.rain.drops >= t.goal;
      const pet = t.reward.kind === "pet";
      const fill = claimed ? 0x7ad651 : ready ? 0xffd23f : pet ? 0xc9a0ff : 0xf2f6ff;
      g.fillStyle(0x000000, 0.25).fillRoundedRect(x - TW / 2 + 4, y - TH / 2 + 8, TW, TH, 22);
      g.fillStyle(pet ? 0x6a2ab0 : 0x1a3a6a, 1).fillRoundedRect(x - TW / 2, y - TH / 2, TW, TH, 22);
      g.fillStyle(fill, 1).fillRoundedRect(x - TW / 2 + 6, y - TH / 2 + 6, TW - 12, TH - 12, 18);
      const rw = this.rainReward(t.reward);
      const parts: Phaser.GameObjects.GameObject[] = [];
      if (ready || pet) {
        const rays = this.add.image(x, y - 22, "rays").setTint(ready ? 0xffffff : 0xffe066).setScale(0.32).setAlpha(0.7);
        this.tweens.add({ targets: rays, angle: 360, duration: 5000, repeat: -1 });
        parts.push(rays);
      }
      const icon = this.add.image(x, y - 22, rw.icon);
      icon.setScale((pet ? 120 : 92) / Math.max(icon.width, icon.height)).setAlpha(claimed ? 0.5 : 1);
      if (ready) this.tweens.add({ targets: icon, scale: icon.scale * 1.12, duration: 400, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      parts.push(icon, text(this, x + 40, y + 30, rw.amount, 30, "#ffffff", { stroke: 7 }));
      parts.push(text(this, x, y + 78, claimed ? "CLAIMED" : t.goal.toLocaleString("en-US"), 28, claimed ? "#ffffff" : ready ? "#4a2f1d" : "#3a5a80", { stroke: claimed ? 6 : false }));
      if (claimed) parts.push(this.add.image(x + 52, y - 70, "icon_check").setScale(0.5));
      if (pet && !claimed) parts.push(text(this, x, y - TH / 2 + 4, "EXCLUSIVE", 22, "#ffe066", { stroke: 6 }));
      b.add(parts);
    });
    b.add(label(this, 0, top + 1250, `Dodge the falling dice in the Dice Rain fight: every die = drops\n(rare dice give more). Survive 5:00 for +${RAIN_WIN_DROPS}. Rarest pets at the end!`, 28, "#ffffff"));
    // CLAIM ALL and PLAY
    const ready = this.rainReady();
    const by = H / 2 - 120;
    if (ready) {
      b.add(button(this, -230, by, 400, 120, "gold", `CLAIM ${ready}`, () => {
        const got: Reward[] = [];
        for (let k = 0; k < ready; k++) got.push(this.rainReward(RAIN_TRACK[save.rain.claimed++].reward));
        got.forEach((r) => r.give());
        persist();
        this.petsChanged();
        m.close();
        (this.screens.shop as ShopScreen).rewardShow("DICE RAIN!", null, got);
      }, { size: 40 }));
    }
    b.add(button(this, ready ? 230 : 0, by, ready ? 400 : 520, 120, "green", "PLAY", () => {
      m.close();
      this.time.delayedCall(150, () => this.confirmStart("event"));
    }, { size: 48 }));
  }

  /** The last five seconds before the boss arrives (or a Boss Rush boss escapes): big numbers. */
  private countdown(): void {
    let left = Infinity;
    if (battle.mode === "run" && this.tab === "battle" && !this.mapOpen) {
      if (battle.rush) left = battle.bossFrac >= 0 ? battle.rushLeft : Infinity;
      else if (!battle.bossFight) left = STAGE_MS - battle.time;
    }
    const n = left > 0 && left <= 5000 ? Math.ceil(left / 1000) : 0;
    if (n === this.lastCount) return;
    this.lastCount = n;
    if (!n) {
      this.countText.setVisible(false);
      return;
    }
    const rush = battle.rush;
    this.countText.setText(String(n)).setColor(n <= 2 ? "#ff4a4a" : rush ? "#e6b8ff" : "#ffe066").setVisible(true).setAlpha(1).setScale(2.2).setAngle(Phaser.Math.Between(-8, 8));
    this.tweens.killTweensOf(this.countText);
    this.tweens.add({ targets: this.countText, scale: 1, duration: 260, ease: "Back.out" });
    this.tweens.add({ targets: this.countText, alpha: 0.15, scale: 0.8, delay: 600, duration: 380 });
    sfx.charge(6 - n);
    buzz(40);
  }

  private addBadge(x: number, y: number, show: () => boolean): void {
    const obj = this.add.container(x, y, [this.add.circle(0, 0, 19, 0xf03e3e).setStrokeStyle(5, 0xffffff), text(this, 0, -1, "!", 28, "#ffffff", { stroke: 5 })]).setVisible(false);
    this.tweens.add({ targets: obj, scale: 1.18, duration: 420, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.lobby.add(obj);
    this.badges.push({ obj, show });
  }

  private updateHud(time: number): void {
    if (battle.mode === "lobby") {
      this.luckPill.setValue(`Luck ${luckText(stageLuck(luck(), save.bestStage))}`);
      // your DPS against what this stage's boss needs: green when you are ready
      const dps = teamDps().total;
      const rec = recommendedDps(save.stage);
      this.dpsPill.setValue(`${fmt(dps)} / ${fmt(rec)}`);
      this.dpsPill.value.setColor(dps >= rec ? "#b6ff8a" : "#ffb0a0");
      // way stronger than this stage: Boss Rush is calling
      this.rushHint.setVisible(dps >= rec * 1.5);
      const active = potionActive();
      this.potionBadge.setVisible(active);
      if (active) {
        const s = Math.ceil((save.potionUntil - Date.now()) / 1000);
        const hms = s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
        this.potionTime.setText(hms);
        this.potionX.setText(`x${potionMult()}`);
      }
      return;
    }
    const W = this.W;
    const g = this.hudBars;
    g.clear();
    // kill streak: every 50 in a row is +1% damage and attack speed
    const st = battle.streak;
    const bonus = Math.floor(st / 50);
    this.streakHud.setVisible(st >= 10).setText(bonus ? `STREAK ${st}  •  +${bonus}% DMG & SPD` : `STREAK ${st}`).setColor(bonus ? "#ff8a3a" : "#ffe066");
    fitText(this.streakHud, 360);
    if (battle.rush) {
      this.rushHud(time);
    } else if (battle.bossFrac >= 0) {
      drawBar(g, 24, 74, W - 48, 34, battle.bossFrac, 0xf26464);
      const healing = battle.sealsTotal > 0 && battle.seals < battle.sealsTotal;
      this.progressText.setText(`BOSS  ${Math.ceil(battle.bossFrac * 100)}%${healing ? "  •  HEALING" : ""}`);
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
    const goal = battle.rush ? null : battle.goal;
    if (goal) drawBar(g, 274, 236, 366, 26, goal.frac, goal.alarm && time % 500 < 250 ? 0xffffff : goal.color);
    else drawBar(g, 274, 236, 366, 26, battle.bossFight ? 0 : c, battle.shielded ? 0x9ae6ff : c > 0.4 ? 0x67c3ff : 0xf26464);
    this.crystalIcon.setTexture(goal ? goal.icon : crystalKey(regionForStage(save.stage).id));
    const left = Math.ceil(battle.shieldLeft / 1000);
    if (goal && !(battle.bossFight && battle.sealsTotal)) this.shieldText.setText(goal.text).setColor(goal.alarm ? "#ffd0d0" : "#ffffff");
    else if (battle.rush) this.shieldText.setText(`Beat it in ${RUSH_MS / 1000}s or it gets away!`).setColor("#e6d4ff");
    else if (battle.bossFight && battle.sealsTotal) {
      const all = battle.seals >= battle.sealsTotal;
      this.shieldText.setText(all ? "All seals closed: no more healing!" : `SEALS ${battle.seals}/${battle.sealsTotal}  •  stand on them 3s`).setColor(all ? "#ffe066" : "#e6d4ff");
    } else if (battle.bossFight) this.shieldText.setText("CRYSTAL TAKEN! Beat the boss").setColor("#ffd0d0");
    else this.shieldText.setText(battle.shielded ? `SHIELD ${left}s` : `OPEN  •  shield in ${left}s`).setColor(battle.shielded ? "#ffffff" : c < 0.4 ? "#ffd0d0" : "#ffffff");
    fitText(this.shieldText, 340);
    if (goal) this.crystalIcon.setScale(goal.alarm && time % 500 < 250 ? 0.6 : 0.5);
    else this.crystalIcon.setScale(c < 0.4 && !battle.shielded && time % 500 < 250 ? 0.3 : 0.24);
    this.progressText.setColor(c < 0.4 && time % 600 < 300 ? "#ff8a8a" : "#ffffff");
    // your gadgets
    this.gadgetSlots.forEach((slot, i) => {
      const g = battle.gadgets[i];
      const key = g ? `${g.kind}${g.tier}${g.level}` : "";
      if (key !== slot.key) {
        slot.key = key;
        slot.holder.removeAll(true);
        if (g) {
          slot.holder.add(badge(this, 0, 0, 112, TIER_INFO[g.tier].color, gadgetIcon(g.kind), { tier: g.tier, level: g.level, max: MAX_GADGET_LEVEL }));
          slot.holder.setScale(1.5);
          this.tweens.add({ targets: slot.holder, scale: 1, duration: 320, ease: "Back.out" });
        }
      }
      // how long until it fires again; a pop each time it does
      const left = g && g.cd ? Phaser.Math.Clamp(g.timer / g.cd, 0, 1) : 0;
      if (g && left > slot.left + 0.5) {
        this.tweens.killTweensOf(slot.holder);
        slot.holder.setScale(1.22);
        this.tweens.add({ targets: slot.holder, scale: 1, duration: 200, ease: "Quad.out" });
      }
      slot.left = left;
      slot.sweep.clear();
      if (left > 0.02) {
        slot.sweep.fillStyle(0x1a0e08, 0.5).slice(slot.x, 0, 52, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2, false).fillPath();
      }
    });
  }

  /** The skills you picked this stage, along the bottom of the field. */
  private drawSkillBar(): void {
    this.skillBar.removeAll(true);
    Object.entries(battle.skills).forEach(([id, lv], i) => {
      const def = SKILL_BY_ID[id as SkillId];
      this.skillBar.add(badge(this, this.skillX(i), 0, 92, def.color, def.icon, { level: lv, max: MAX_SKILL }));
    });
  }

  private skillX(i: number): number {
    return 62 + i * 100;
  }

  /** A skill drop (airdrop, orb or elite): the fight freezes and you pick one of three skills. */
  private showSkillChoice(info: { choices: SkillId[]; levels: Partial<Record<SkillId, number>>; level: number }): void {
    const owned = Object.keys(info.levels) as SkillId[];
    const used = owned.length;
    this.showPicker({
      title: "SKILL DROP!",
      color: 0xb98aff,
      sub: used >= SKILL_SLOTS ? `All ${SKILL_SLOTS} skill slots used: level them up!` : `Pick a skill  •  skill slots ${used}/${SKILL_SLOTS}`,
      cards: info.choices.map((id) => {
        const def = SKILL_BY_ID[id];
        const lv = info.levels[id] ?? 0;
        return {
          icon: def.icon, color: def.color, name: def.name, nameColor: "#4a2f1d",
          tag: lv === 0 ? "NEW!" : `Lv ${lv} → ${lv + 1}`, tagColor: lv === 0 ? 0xff5a8a : 0x4caf50,
          desc: def.text(lv), stars: lv + 1, max: MAX_SKILL, newStar: lv, fresh: lv === 0, glow: lv + 1 === MAX_SKILL,
        };
      }),
      target: (i) => {
        const at = owned.indexOf(info.choices[i]);
        return [this.skillX(at >= 0 ? at : used), this.skillBar.y];
      },
      pick: (i) => this.game.events.emit("skill-picked", info.choices[i]),
    });
  }

  /** Level up: the fight freezes and you pick a new gadget, a level or a better tier for one you carry. */
  private showGadgetChoice(info: { options: GadgetOption[]; level: number; slots: number }): void {
    this.showPicker({
      title: "LEVEL UP!",
      color: 0xffe066,
      sub: `Level ${info.level}  •  pick a gadget  •  slots ${info.slots}/${GADGET_SLOTS}`,
      cards: info.options.map((o) => {
        const tinfo = TIER_INFO[o.tier];
        const card: PickCard = {
          icon: gadgetIcon(o.kind), color: tinfo.color, tier: o.tier, name: gadgetName(o.kind, o.tier), nameColor: tierText(o.tier),
          tag: "NEW!", tagColor: 0xff5a8a, desc: GADGETS[o.kind].desc, stars: o.level, max: MAX_GADGET_LEVEL, newStar: -1, fresh: o.what === "new", glow: tierIndex(o.tier) >= 3,
        };
        const own = battle.gadgets.find((g) => g.kind === o.kind);
        if (own && o.what === "level") {
          const a = gadgetStats(o.kind, o.tier, own.level);
          const b = gadgetStats(o.kind, o.tier, o.level);
          card.tag = `Lv ${own.level} → ${o.level}`;
          card.tagColor = 0x4caf50;
          card.desc = `+${Math.round((b.dmg / a.dmg - 1) * 100)}% damage`;
          card.newStar = o.level - 1;
        }
        if (own && o.what === "tier") {
          const a = gadgetStats(o.kind, own.tier, o.level);
          const b = gadgetStats(o.kind, o.tier, o.level);
          card.tag = `${own.tier} → ${o.tier}`;
          card.tagColor = tinfo.color;
          const more = [`+${Math.round((b.dmg / a.dmg - 1) * 100)}% damage`, `${Math.round((1 - b.cd / a.cd) * 100)}% faster`];
          if (b.count > a.count) more.push(o.kind === "wisp" ? "+1 wisp" : "+1 shot");
          if (b.pierce > a.pierce) more.push(o.kind === "kite" ? "+1 jump" : "+1 pierce");
          card.desc = `${tinfo.name}: ${more.join(", ")}`;
        }
        if (o.what === "new") card.newStar = 0;
        return card;
      }),
      target: (i) => {
        const o = info.options[i];
        const at = battle.gadgets.findIndex((g) => g.kind === o.kind);
        const slot = this.gadgetSlots[at >= 0 ? at : Math.min(info.slots, GADGET_SLOTS - 1)];
        return [this.gunPanel.x + slot.x, this.gunPanel.y];
      },
      pick: (i) => {
        const o = info.options[i];
        if (tierIndex(o.tier) >= 4 && o.what !== "level") this.onBanner(`${TIER_INFO[o.tier].name.toUpperCase()} GADGET!`, "gold", 1200);
        this.game.events.emit("gadget-picked", i);
      },
    });
  }

  /**
   * The fight freezes and three cards fly in: a living medal, a name, what you get and stars.
   * Tap one: the others slide away and its medal flies to its place on the HUD.
   */
  private showPicker(o: { title: string; color: number; sub: string; cards: PickCard[]; target: (i: number) => [number, number]; pick: (i: number) => void }): void {
    this.picker?.destroy();
    const { W, H } = this;
    const dim = this.add.rectangle(0, 0, W, H, 0x1a0e08, 0.8).setOrigin(0).setInteractive();
    const rays = this.add.image(W / 2, H * 0.21, "rays").setTint(o.color).setAlpha(0.4).setScale(1.5);
    const title = text(this, W / 2, H * 0.21, o.title, 104, rgba(o.color));
    const sub = fitText(text(this, W / 2, H * 0.21 + 92, o.sub, 36), W - 80);
    const root = this.add.container(0, 0, [dim, rays, title, sub]).setDepth(5600);
    this.picker = root;
    this.tweens.add({ targets: rays, angle: 360, duration: 12000, repeat: -1 });
    title.setScale(0);
    this.tweens.add({
      targets: title, scale: 1, duration: 380, ease: "Back.out",
      onComplete: () => this.tweens.add({ targets: title, scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" }),
    });
    let ready = false;
    this.time.delayedCall(650, () => (ready = true));
    const cards: Phaser.GameObjects.Container[] = [];
    o.cards.forEach((cd, i) => {
      const y = H * 0.21 + 330 + i * 300;
      const med = badge(this, -318, 0, 200, cd.color, cd.icon, { tier: cd.tier, glow: cd.glow, live: true });
      const name = fitText(label(this, -190, -80, cd.name, 48, cd.nameColor).setOrigin(0, 0.5), 400);
      const tag = text(this, 0, -80, cd.tag, 34);
      tag.setX(440 - 22 - tag.width / 2);
      const pill = this.add.graphics();
      pill.fillStyle(cd.tagColor, 1).fillRoundedRect(tag.x - tag.width / 2 - 20, -110, tag.width + 40, 60, 30);
      pill.lineStyle(5, INK_N, 1).strokeRoundedRect(tag.x - tag.width / 2 - 20, -110, tag.width + 40, 60, 30);
      const desc = text(this, -190, 4, cd.desc, 31, "#7a5236", { stroke: false, wrap: 600, align: "left" }).setOrigin(0, 0.5);
      const stars = [...Array(cd.max)].map((_, k) => {
        const star = this.add.image(-166 + k * 56, 88, "icon_star").setScale(0.42).setAlpha(k < cd.stars ? 1 : 0.22);
        if (k === cd.newStar) {
          star.setTint(0x8af06a);
          this.tweens.add({ targets: star, scale: 0.56, duration: 420, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        }
        return star;
      });
      const shine = this.add.image(-400, 0, "card_shine").setAlpha(0);
      const sweep = { t: 0 };
      this.tweens.add({
        targets: sweep, t: 1, duration: 900, delay: 900 + i * 260, repeat: -1, repeatDelay: 2300, ease: "Sine.inOut",
        onUpdate: () => shine.setX(-400 + 800 * sweep.t).setAlpha(Math.sin(sweep.t * Math.PI) * 0.9),
      });
      const parts: Phaser.GameObjects.GameObject[] = [this.add.image(0, 0, panelTexture(this, "cream", 920, 270)), shine, med, name, pill, tag, desc, ...stars];
      if (cd.fresh) {
        const edge = this.add.graphics();
        edge.lineStyle(10, 0xff8aa8, 1).strokeRoundedRect(-466, -141, 932, 282, 34);
        this.tweens.add({ targets: edge, alpha: 0.25, duration: 520, yoyo: true, repeat: -1 });
        parts.unshift(edge);
      }
      const card = this.add.container(i % 2 ? W + 560 : -560, y, parts).setSize(920, 270).setInteractive({ useHandCursor: true });
      cards.push(card);
      this.tweens.add({ targets: card, x: W / 2, duration: 420, delay: 140 + i * 110, ease: "Back.out" });
      med.setScale(0);
      this.tweens.add({ targets: med, scale: 1, duration: 360, delay: 420 + i * 110, ease: "Back.out" });
      card.on("pointerdown", () => ready && this.tweens.add({ targets: card, scale: 0.96, duration: 60 }));
      card.on("pointerout", () => ready && card.setScale(1));
      card.on("pointerup", () => {
        if (!ready) return;
        ready = false;
        sfx.buy();
        buzz(25);
        cards.forEach((c, j) => j !== i && this.tweens.add({ targets: c, alpha: 0, x: c.x + (j < i ? -260 : 260), duration: 240 }));
        this.tweens.add({ targets: [title, sub, rays], alpha: 0, duration: 240 });
        card.setScale(1);
        this.tweens.add({ targets: card, scale: 1.06, duration: 120, yoyo: true });
        this.tweens.add({ targets: card, alpha: 0, delay: 260, duration: 220 });
        this.tweens.add({ targets: dim, alpha: 0, delay: 320, duration: 360 });
        // the medal flies to its place on the HUD
        const [tx, ty] = o.target(i);
        card.remove(med);
        root.add(med);
        med.setPosition(card.x + med.x, card.y);
        this.tweens.add({
          targets: med, x: tx, y: ty, scale: 0.55, duration: 560, delay: 180, ease: "Cubic.in",
          onComplete: () => {
            root.destroy();
            if (this.picker === root) this.picker = null;
            const ring = this.add.circle(tx, ty, 50).setStrokeStyle(10, o.cards[i].color).setDepth(5600);
            this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
            o.pick(i);
          },
        });
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
    this.statRows(m, r.stats, r.time, -h / 2 + 240);
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

  /** Rows of run statistics for the defeat screen. */
  private statRows(m: Modal, st: RunStats, time: number, y0: number): number {
    const rows: [string, string, string][] = [
      ["icon_clock", `Survived ${mmss(time)} / ${mmss(STAGE_MS)}`, "#4a2f1d"],
      ["icon_skull", `${fmt(st.kills)} monsters defeated`, "#4a2f1d"],
      ["icon_sword", `${fmt(st.damage)} damage dealt`, "#4a2f1d"],
      ["icon_cash", `+${fmt(Math.floor(st.earned))} money`, "#3f9a4f"],
    ];
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

  /** Everything about the current fight at a glance: your gadgets and skills as medals with their level, then the numbers. */
  private showStats(): void {
    if (battle.mode === "lobby") return;
    sfx.click();
    // tall enough that the dice row clears the button at the bottom
    const h = 1640;
    const m = this.showModal(modal(this, 960, h, "STATS", "blue", () => (this.openModal = null)));
    let y = -h / 2 + 150;
    m.body.add(text(this, 0, y, `Lv ${battle.level}  •  ${fmt(battle.dps)} DPS`, 46, "#ffe066"));
    // gadgets: tier chip top left, level bottom right
    y += 70;
    m.body.add([this.add.image(0, y + 130, panelTexture(this, "row", 880, 300)), label(this, -410, y + 4, "GADGETS", 30, "#c9663a").setOrigin(0, 0.5)]);
    for (let i = 0; i < GADGET_SLOTS; i++) {
      const g = battle.gadgets[i];
      const x = (i - 1) * 280;
      if (!g) {
        m.body.add([this.add.circle(x, y + 130, 74, 0x000000, 0.12).setStrokeStyle(5, 0x9a7a5a, 0.5), label(this, x, y + 128, "+", 70, "#b39a7a")]);
        continue;
      }
      const info = TIER_INFO[g.tier];
      m.body.add(badge(this, x, y + 120, 170, info.color, gadgetIcon(g.kind), { tier: g.tier, level: g.level, max: MAX_GADGET_LEVEL, glow: tierIndex(g.tier) >= 3, live: true }));
      m.body.add(fitText(label(this, x, y + 236, gadgetName(g.kind, g.tier), 28, tierText(g.tier)), 250));
    }
    // skills: level bottom right
    y += 330;
    m.body.add([this.add.image(0, y + 110, panelTexture(this, "row", 880, 250)), label(this, -410, y + 4, "SKILLS", 30, "#c9663a").setOrigin(0, 0.5)]);
    const picked = Object.entries(battle.skills) as [SkillId, number][];
    for (let i = 0; i < SKILL_SLOTS; i++) {
      const x = (i - (SKILL_SLOTS - 1) / 2) * 210;
      const sk = picked[i];
      if (!sk) {
        m.body.add([this.add.circle(x, y + 100, 60, 0x000000, 0.12).setStrokeStyle(5, 0x9a7a5a, 0.5), label(this, x, y + 98, "+", 60, "#b39a7a")]);
        continue;
      }
      const def = SKILL_BY_ID[sk[0]];
      m.body.add(badge(this, x, y + 96, 140, def.color, def.icon, { level: sk[1], max: MAX_SKILL, live: true }));
      m.body.add(fitText(label(this, x, y + 192, def.name, 24, "#7a5236"), 196));
    }
    if (!picked.length) m.body.add(label(this, 0, y + 196, "Skills drop from airdrops, orbs and strong monsters", 24, "#9a7a5a"));
    // the numbers: an icon and a value each
    y += 290;
    const st = battle.stats;
    const tiles: [string, string, string][] = [
      ["icon_clock", mmss(battle.time), "time"],
      ["icon_skull", fmt(st.kills), "defeated"],
      ["icon_sword", fmt(st.damage), "damage"],
      ["icon_bolt", fmt(battle.dps), "DPS"],
      ["icon_cash", `+${fmt(Math.floor(st.earned))}`, "money"],
      ["icon_gift", `${st.airdrops}`, "airdrops"],
      ["icon_shield", fmt(st.hurt), "you took"],
      ["icon_target", fmt(st.shots), "shots"],
    ];
    tiles.forEach(([icon, value, what], i) => {
      const x = (i % 2 ? 1 : -1) * 222;
      const yy = y + 50 + Math.floor(i / 2) * 116;
      m.body.add([
        this.add.image(x, yy, panelTexture(this, "row", 420, 100)),
        this.add.image(x - 152, yy, icon).setScale(0.62),
        fitText(text(this, x - 96, yy - 12, value, 44, i === 4 ? "#8af06a" : "#ffffff").setOrigin(0, 0.5), 290),
        label(this, x - 94, yy + 30, what, 22, "#9a7a5a").setOrigin(0, 0.5),
      ]);
    });
    // dice found
    y += 50 + 4 * 116;
    const found = DICE_TIERS.filter((t) => st.dice[t] > 0);
    if (!found.length) m.body.add(label(this, 0, y, "No dice found yet", 30, "#9a7a5a"));
    found.forEach((t, i) => {
      const x = (i - (found.length - 1) / 2) * 120;
      m.body.add([this.add.image(x, y, `die_${t}`).setScale(0.62), text(this, x + 34, y + 24, `${st.dice[t]}`, 32)]);
    });
    m.body.add(button(this, 0, h / 2 - 90, 460, 120, "green", "BACK TO FIGHT", () => m.close(), { size: 40 }));
  }

  /** 5:00: the screen flashes red and a WARNING sign blinks while the storm takes the crystal. */
  /** How to play this stage's mode, in pictures: three panels with an icon and a word or two. */
  private modeIntro(mode: StageMode): void {
    const W = this.W;
    const H = this.H;
    const info = MODE_INFO[mode];
    const steps: Record<StageMode, [string, string][]> = {
      air: [["hero", "STAY IN"], ["mode_air", "THE AIR"], ["icon_clock", "IT MOVES"]],
      crystal: [["mode_crystal", "GUARD IT"], ["icon_shield", "SHIELD"], ["mode_boss", "BOSS 5:00"]],
      feed: [["mode_feed", "GRAB"], ["beast_cage", "FEED x6"], ["pk_heart", "FRIEND!"]],
      dice: [["big_die", "FALLING"], ["sign_warn", "SHADOW"], ["hero", "DODGE!"]],
      boss: [["mode_boss", "HUGE BOSS"], ["mode_boss", "+3 KIDS"], ["icon_bolt", "FULL POWER"]],
    };
    const card = this.add.container(W / 2, H * 0.42).setDepth(5400).setScale(0);
    card.add([
      this.add.image(0, 0, vividCard(this, info.color, 900, 470)),
      this.add.image(-350, -150, info.icon).setScale(0.9),
      text(this, 30, -150, info.name, 70, "#ffffff", { stroke: 14 }),
    ]);
    steps[mode].forEach(([icon, word], i) => {
      const x = -290 + i * 290;
      const splat = this.add.image(x, 40, "paint_splash").setTint(0xffffff).setScale(1.05).setAngle(i * 80);
      const img = this.add.image(x, 30, icon);
      img.setScale(130 / Math.max(img.width, img.height));
      if (word === "+3 KIDS") img.setScale(img.scale * 0.6);
      card.add([splat, img, text(this, x, 160, word, 38, "#ffffff", { stroke: 10 })]);
      if (i < 2) card.add(this.add.triangle(x + 145, 40, 0, 0, 0, 44, 32, 22, 0xffe066).setStrokeStyle(6, 0x111111));
      this.tweens.add({ targets: img, y: 18, duration: 500, yoyo: true, repeat: -1, delay: i * 160, ease: "Sine.inOut" });
    });
    this.tweens.add({ targets: card, scale: 1, duration: 380, ease: "Back.out" });
    this.time.delayedCall(2900, () => this.tweens.add({ targets: card, scale: 0, alpha: 0, duration: 260, ease: "Back.in", onComplete: () => card.destroy() }));
  }

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
    const sub = text(this, W / 2, H * 0.36 + 60, battle.stageMode === "crystal" ? "Something is coming for the crystal..." : battle.stageMode === "boss" ? "A HUGE boss and its 3 kids!" : "The boss is coming...", 38, "#ffe0e0").setDepth(5320);
    this.tweens.add({ targets: warn, alpha: 0.3, duration: 250, yoyo: true, repeat: 5 });
    this.time.delayedCall(2600, () => this.tweens.add({ targets: [band, warn, sub], alpha: 0, duration: 400, onComplete: () => [band, warn, sub].forEach((o) => o.destroy()) }));
    [0, 700, 1400].forEach((t) => this.time.delayedCall(t, () => sfx.alarm()));
  }

  /** The boss lands: a big title card with its name. */
  private bossIntro(info: { name: string; tex: string; moves: string[] }): void {
    const { W, H } = this;
    const cy = H * 0.4;
    const band = this.add.graphics().setDepth(5300);
    band.fillStyle(0x1a0808, 0.85).fillRect(0, cy - 190, W, 380);
    band.fillStyle(0xff4a4a, 1).fillRect(0, cy - 190, W, 10).fillRect(0, cy + 180, W, 10);
    const rays = this.add.image(W - 250, cy, "rays").setTint(0xff6a3a).setAlpha(0.5).setScale(1.3).setDepth(5301);
    const portrait = this.add.image(W + 300, cy + 120, info.tex).setOrigin(0.5, 0.94).setScale(1.9).setDepth(5302);
    const title = text(this, -400, cy - 80, "BOSS FIGHT!", 96, "#ff5a5a").setOrigin(0, 0.5).setDepth(5303);
    const name = text(this, -400, cy + 40, info.name.toUpperCase(), 64, "#ffe066").setOrigin(0, 0.5).setDepth(5303);
    const hint = text(this, 60, cy + 112, `Moves: ${info.moves.join("  •  ")}`, 30, "#ffe0e0").setOrigin(0, 0.5).setDepth(5303).setAlpha(0);
    const tip = text(this, 60, cy + 152, "Dodge the red marks. Close the seals so it can't heal!", 24, "#ffb8b8").setOrigin(0, 0.5).setDepth(5303).setAlpha(0);
    this.tweens.add({ targets: rays, angle: 180, duration: 3000 });
    this.tweens.add({ targets: portrait, x: W - 250, duration: 450, ease: "Back.out" });
    this.tweens.add({ targets: title, x: 60, duration: 400, ease: "Back.out", delay: 100 });
    this.tweens.add({ targets: name, x: 60, duration: 400, ease: "Back.out", delay: 250 });
    this.tweens.add({ targets: [hint, tip], alpha: 1, duration: 300, delay: 600 });
    this.cameras.main.flash(250, 255, 120, 80);
    sfx.fanfare();
    buzz(300);
    const all = [band, rays, portrait, title, name, hint, tip];
    this.time.delayedCall(2200, () => this.tweens.add({ targets: all, alpha: 0, duration: 350, onComplete: () => all.forEach((o) => o.destroy()) }));
  }

  private updateGoals(): void {
    for (const b of this.badges) b.obj.setVisible(b.show());
    const owned = Object.keys(save.pets);
    this.nav.shop.badge.setVisible(freeGiftReady() || dailyDay() >= 0 || playGiftReady());
    this.nav.pets.badge.setVisible((save.equipped.length < petSlots() && owned.length > save.equipped.length) || anyLevelReady() || save.newPets.length > 0);
    this.nav.upgrades.badge.setVisible(TREE.some((n) => canBuy(n)));
    this.refreshEventCard();
    const dice = totalDice();
    this.nav.roll.badge.setVisible(dice > 0 && (dice >= 10 || save.luckyBoost > 0 || save.luckyCount >= luckyEvery() - 1));
    const ready = save.quests.find(questDone);
    const q = ready ?? [...save.quests].sort((a, b) => b.progress / questGoal(b) - a.progress / questGoal(a))[0];
    if (!q) return;
    this.questGlow.setVisible(!!ready);
    this.questIcon.setTexture(ready ? "icon_gift" : QUEST_ICON[q.type]);
    // every icon fits the same spot, whatever its size
    this.questIcon.setScale(68 / Math.max(this.questIcon.frame.width, this.questIcon.frame.height));
    this.questCard.setTexture(vividCard(this, ready ? 0xffc93a : 0x5fc85a, QUEST_W, 112));
    fitText(this.questLabel.setText(ready ? "CLAIM!" : questTitle(q)), QUEST_BAR);
    this.questCount.setText(q.type === "rare" ? `${q.progress}/1` : `${fmt(q.progress)} / ${fmt(q.target)}`);
    this.questG.clear();
    drawBar(this.questG, QUEST_X, 8, QUEST_BAR, 30, q.progress / questGoal(q), ready ? 0xffe066 : 0x7ad651);
  }

  /** Where the minimap sits: top left in a fight, top right (under the quests) while roaming the lobby. */
  private miniSpot(): [number, number] {
    return battle.mode === "lobby" ? [this.W - 202, this.L.hudBottom + 170] : [22, this.L.hudBottom + 24];
  }

  private refreshAfk(): void {
    this.afkLabel.setText(save.afk ? "AFK ON" : "AFK").setColor(save.afk ? "#8af06a" : "#ffffff");
    // a green ring behind the icon while AFK is on
    this.afkRing.setFillStyle(0x2f6f3a, save.afk ? 0.55 : 0).setStrokeStyle(5, 0x8af06a, save.afk ? 1 : 0);
  }

  /** Play a stage you already reached: the lobby (and its land) switches to it. */
  pickStage(n: number, play = false): void {
    if (battle.mode !== "lobby") return;
    const st = Phaser.Math.Clamp(n, 1, Math.min(MAX_STAGE, stageCap()));
    const newLand = regionForStage(st).id !== regionForStage(save.stage).id;
    this.game.events.emit("stage-pick", st);
    sfx.click();
    this.refreshLobby();
    if (play) this.setTab("battle");
    // a new land rebuilds the battle world first
    this.time.delayedCall(newLand ? 650 : 50, () => {
      this.refreshLobby();
      if (play) this.confirmStart("battle");
    });
  }

  /**
   * Are you sure? A big game-style start screen: the stage (or BOSS RUSH) up top, the mode, the boss
   * on a sunburst, three chips with what matters, and a huge START. START plays the enter animation.
   */
  private confirmStart(kind: FightKind): void {
    if (this.openModal && !this.openModal.root.active) this.openModal = null;
    if (battle.mode !== "lobby" || this.openModal) return;
    const rush = kind === "rush";
    const ev = kind === "event";
    const def = bossForStage(save.stage);
    const mode = MODE_INFO[ev ? "dice" : modeForStage(save.stage)];
    const w = 960;
    const h = 1280;
    let go = false;
    const m = this.showModal(modal(this, w, h, "", rush ? "purple" : "orange", () => {
      this.openModal = null;
      if (go) this.game.events.emit(rush ? "rush-start" : ev ? "event-start" : "battle-start");
    }, undefined, true));
    const b = m.body;
    const top = -h / 2;
    const color = rush ? 0xb36aff : mode.color;
    b.addAt(this.add.image(4, 10, vividCard(this, color, w - 20, h - 40)), 1);
    // the title and the mode
    b.add(fitText(text(this, 0, top + 110, rush ? "BOSS RUSH" : ev ? "DICE RAIN" : `STAGE ${save.stage}`, 104, "#ffffff", { stroke: 18 }), w - 160));
    const chipW = 520;
    const tag = this.add.graphics();
    tag.fillStyle(0x14213d, 0.55).fillRoundedRect(-chipW / 2, top + 180, chipW, 76, 38);
    b.add([tag,
      this.add.image(-chipW / 2 + 48, top + 218, rush ? "icon_clock" : mode.icon).setScale(rush ? 0.5 : 0.52),
      fitText(text(this, 30, top + 218, rush ? `${RUSH_MS / 1000}s PER BOSS` : ev ? `EVENT  •  ${dhm(diceEventLeft())}` : mode.name, 40, rush ? "#ffe066" : mode.css, { stroke: 9 }), chipW - 130),
    ]);
    // the boss on a spinning sunburst
    const by = top + 500;
    const rays = this.add.image(0, by, "rays").setScale(1.1).setAlpha(0.55);
    this.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
    const splat = this.add.image(0, by, "paint_splash").setScale(2.1).setAngle(20);
    const face = this.add.image(0, by + 10, def.tex);
    face.setScale(330 / Math.max(face.width, face.height));
    this.tweens.add({ targets: face, y: by - 8, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.tweens.add({ targets: face, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    b.add([rays, splat, face]);
    b.add(fitText(text(this, 0, by + 225, rush ? `BOSS ${save.stage}  •  ${def.name}` : def.name, 54, "#ffffff", { stroke: 12 }), w - 140));
    // three chips: what you need to know at a glance
    const dps = teamDps().total;
    const rec = recommendedDps(save.stage);
    const chips: [string, string, string][] = rush
      ? [["icon_clock", `${RUSH_MS / 1000}s`, "#ffffff"], ["icon_gem", "+3 / 5", "#9ae6ff"], ["icon_trophy", `${save.bossRushBest}`, "#ffe066"]]
      : [
        [modeForStage(save.stage) === "boss" ? "mode_boss" : "icon_clock", modeForStage(save.stage) === "boss" ? "x4" : "5:00", "#ffffff"],
        ["icon_sword", `${fmt(dps)}/${fmt(rec)}`, dps >= rec ? "#b6ff8a" : "#ffb0a0"],
        ev ? ["die_C", "DROPS", "#9ae6ff"] : ["icon_gem", `+${gemsPerBoss()}`, "#9ae6ff"],
      ];
    const cy = top + 900;
    chips.forEach(([icon, val, css], i) => {
      const x = (i - 1) * 290;
      const g = this.add.graphics();
      g.fillStyle(0x14213d, 0.5).fillRoundedRect(x - 130, cy - 90, 260, 180, 34);
      g.lineStyle(5, 0xffffff, 0.35).strokeRoundedRect(x - 130, cy - 90, 260, 180, 34);
      const ic = this.add.image(x, cy - 30, icon);
      ic.setScale(78 / Math.max(ic.width, ic.height));
      b.add([g, ic, fitText(text(this, x, cy + 50, val, 42, css, { stroke: 9 }), 230)]);
    });
    // this stage's mutations as badges, and the mode's goal in a few words
    if (!rush) {
      const muts = mutationsAt(save.stage);
      muts.forEach((mu, i) => {
        if (this.textures.exists(`mut_${mu.id}`)) b.add(this.add.image((i - (muts.length - 1) / 2) * 62, top + 1030, `mut_${mu.id}`).setScale(0.9));
      });
    }
    b.add(this.startBtn = button(this, 0, h / 2 - 130, 600, 156, "green", "START", () => {
      go = true;
      m.close();
    }, { size: 70 }));
    this.tweens.add({ targets: this.startBtn, scale: 1.06, duration: 520, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  }

  // ───────────────────────── rolling ─────────────────────────

  roll(auto = false): void {
    if (this.celebrating || this.rollScreen.busy || this.time.now < this.rollReadyAt) return;
    // one die per roll, up to the batch size (x1, x3 or x10): the chosen dice tier first,
    // and when it runs out, the next tier that has dice
    const dice: Tier[] = [];
    let tier = save.diceTier;
    while (dice.length < save.rollBatch) {
      if (save.dice[tier] <= 0) tier = DICE_TIERS.find((t) => save.dice[t] > 0) ?? tier;
      if (save.dice[tier] <= 0) break;
      save.dice[tier]--;
      dice.push(tier);
    }
    if (!dice.length) {
      if (save.autoRoll) save.autoRoll = false;
      if (!auto) {
        sfx.error();
        this.toast("No dice left! Find dice in battle", "#ff9a9a");
      }
      return;
    }
    save.diceTier = dice[0];
    // rolling again soon builds a hot streak
    const streak = this.rollScreen.bumpStreak(this.time.now);
    const prevBest = save.bestRoll;
    const results: RollResult[] = [];
    const gifts: { tier: Tier; dice: number; gems: number }[] = [];
    let lucky = false;
    let superRoll = false;
    for (const t of dice) {
      // every die is one roll: it can be the lucky roll, the SUPER ROLL (every 50th) or bring the gift (every 25th)
      const isLucky = save.luckyBoost > 0 || save.luckyCount >= luckyEvery() - 1;
      if (save.luckyBoost > 0) save.luckyBoost--;
      else save.luckyCount = isLucky ? 0 : save.luckyCount + 1;
      const isSuper = save.superCount >= superEvery() - 1;
      save.superCount = isSuper ? 0 : save.superCount + 1;
      lucky ||= isLucky;
      superRoll ||= isSuper;
      results.push(...rollMany(dicePerRoll(), luck() * DICE_LUCK[t] * (isLucky ? luckyMult() : 1) * (isSuper ? SUPER_MULT : 1) * streak));
      save.totalRolls++;
      if (++save.giftCount >= GIFT_EVERY) {
        save.giftCount = 0;
        const gift = { tier: rollDiceTier(save.stage + 10), dice: 3, gems: Math.random() < 0.2 ? 1 : 0 };
        save.dice[gift.tier] += gift.dice;
        save.gems += gift.gems;
        gifts.push(gift);
      }
    }
    const best = results.reduce((a, b) => (b.item.oneIn > a.item.oneIn ? b : a));
    const record = best.item.oneIn > prevBest && rarityRank(best.item.rarity) >= 1;
    persist();
    this.rollReadyAt = this.time.now + rollTime();
    questEvent("roll", dice.length);
    questEvent("rare", Math.max(...results.map((r) => rarityRank(r.item.rarity))));
    const anyNew = results.some((r) => r.isNew);
    if (anyNew) {
      syncSoon();
      this.rareOwnersNote(results);
    }
    this.autoEquip(results);
    this.rollScreen.addHistory(results);
    if (this.tab === "roll" && !this.mapOpen) {
      // a good roll stays up for a few seconds: a new pet, a record, or far beyond this die's luck
      const good = record || anyNew || best.item.oneIn >= luck() * DICE_LUCK[dice[0]] * 10;
      this.rollScreen.reveal(results, { lucky, superRoll, record, good }, () => {
        if (anyNew) this.indexMilestone();
        gifts.forEach((g, i) => this.time.delayedCall(i * 2200, () => this.rollScreen.giftPop(g.tier, g.dice, g.gems)));
      });
    } else {
      if (anyNew) this.time.delayedCall(2400, () => this.indexMilestone());
      this.miniReveal(results);
      this.sideReveal(results, record);
      for (const g of gifts) this.toast(`Roll gift: +${g.dice} ${g.tier} dice${g.gems ? `, +${g.gems} gem` : ""}!`, "#ffe066");
    }
  }

  /** A new S class (or rarer) pet: how many players in the world have it. */
  private rareOwnersNote(results: RollResult[]): void {
    const rare = results.filter((r) => r.isNew && tierIndex(r.item.cls) >= tierIndex("S")).sort((a, b) => b.item.oneIn - a.item.oneIn)[0];
    if (!rare) return;
    const n = ownersOf(rare.item.id);
    if (n === null) return;
    // you are about to be counted too
    const total = n + 1;
    this.time.delayedCall(3600, () => this.toast(total === 1 ? `You are the FIRST player in the world with ${rare.item.name}!` : `Only ${fmt(total)} players in the world have ${rare.item.name}!`, "#ff8ae6"));
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

  /**
   * Away from the Roll screen a great pull does not take over the screen: its card slides in from
   * the side with a glow, rays and sparkles, and slides out again.
   */
  private sideReveal(results: RollResult[], record: boolean): void {
    const best = results.reduce((a, b) => (b.item.oneIn > a.item.oneIn ? b : a));
    const rank = rarityRank(best.item.rarity);
    if (!(rank >= 3 && (best.isNew || record || best.item.oneIn >= luck() * 100))) return;
    const { W, H } = this;
    const info = RARITY_INFO[best.item.rarity];
    const cls = best.item.cls;
    const y = H * 0.44;
    const rays = this.add.image(-130, 0, "rays").setTint(info.color).setScale(0.55).setAlpha(0.7);
    this.tweens.add({ targets: rays, angle: 360, duration: 5000, repeat: -1 });
    const pet = this.add.image(-130, 6, petTexture(this, best.item.id)).setScale(0.75);
    this.tweens.add({ targets: pet, y: -6, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const card = this.add.container(W + 300, y, [
      this.add.image(4, 6, vividCard(this, info.color, 540, 260)),
      rays, this.add.image(-130, 0, "paint_splash").setScale(1.1).setTint(lighten(info.color, 0.5)), pet,
      fitText(text(this, 60, -70, record ? "NEW RECORD!" : best.isNew ? "NEW PET!" : `${info.label.toUpperCase()}!`, 40, "#ffe066", { stroke: 9 }).setOrigin(0, 0.5), 230),
      fitText(classText(this, 60, -10, best.item.name, 38, cls).setOrigin(0, 0.5), 230),
      fitText(text(this, 60, 50, `${oneIn(best.item.oneIn)}  •  ${cls}`, 30, "#ffffff", { stroke: 7 }).setOrigin(0, 0.5), 230),
    ]).setDepth(5600).setAngle(-4);
    this.tweens.add({ targets: card, x: W - 290, duration: 420, ease: "Back.out" });
    this.tweens.add({ targets: card, angle: 4, duration: 700, yoyo: true, repeat: 2, ease: "Sine.inOut" });
    const sparks = this.add.particles(0, 0, "spark", {
      speed: { min: 120, max: 380 }, lifespan: 700, scale: { start: 0.8, end: 0 }, tint: [info.color, 0xffffff, 0xffe066], emitting: false,
    }).setDepth(5601);
    this.time.delayedCall(380, () => sparks.explode(30 + rank * 8, W - 420, y));
    sfx.reveal(Math.min(6, rank));
    if (record) sfx.record();
    buzz(60);
    this.tweens.add({ targets: card, x: W + 320, duration: 380, delay: 3400, ease: "Back.in", onComplete: () => (card.destroy(), sparks.destroy()) });
  }

  /** While you are on another screen, rolled pets pop up quietly above the Roll tab. */
  private miniReveal(results: RollResult[]): void {
    const { x } = this.tabPos("roll");
    const baseY = this.L.navTop - 70;
    [...results].sort((a, b) => b.item.oneIn - a.item.oneIn).slice(0, 3).forEach((r, i) => {
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

  private indexMilestone(): void {
    if (!checkIndexMilestones()) return;
    sfx.levelUp();
    this.toast(`${save.indexMilestones * INDEX_STEP} pets found! Luck x${indexBonus().toFixed(2)} forever`, "#8fe3ff");
  }

  // ───────────────────────── stage and land moments ─────────────────────────

  /** "STAGE 7 CLEAR!" with stars popping in and the money counting up. */
  private stageClear(info: { event?: boolean; stage: number; earned: number; gems: number; dice: Record<Tier, number>; final: boolean }): void {
    syncSoon();
    const dice = DICE_TIERS.reduce((s, t) => s + info.dice[t], 0);
    const { W } = this;
    const cy = this.tab === "battle" ? this.L.hudBottom + 360 : this.L.headerBottom + 260;
    const band = this.add.graphics();
    band.fillStyle(0x1a0e08, 0.75).fillRect(0, -170, W, 340);
    band.fillStyle(0xffd23f, 1).fillRect(0, -170, W, 8).fillRect(0, 162, W, 8);
    const rays = this.add.image(W / 2, -40, "rays").setTint(0xffd23f).setAlpha(0.45).setScale(1.1);
    const title = fitText(text(this, W / 2, -70, info.final && !info.event ? "YOU CONQUERED EVERY LAND!" : info.event ? "DICE RAIN CLEAR!" : `STAGE ${info.stage} CLEAR!`, info.final ? 62 : 90, "#ffe066"), W - 60);
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
    const m = this.showModal(modal(this, 900, h, "QUESTS", "green", () => (this.openModal = null), undefined, true));
    const content = this.add.container(0, 0);
    m.body.addAt(content, 1);
    const draw = () => {
      content.removeAll(true);
      const r = questReward();
      const colors = [0x4fa8ff, 0xff8a3a, 0xb36aff];
      // a deep blue board behind the bright cards
      const board = this.add.graphics();
      board.fillStyle(0x1f3a6a, 1).fillRoundedRect(-450, -h / 2 + 20, 900, h - 30, 40);
      board.fillStyle(0xffffff, 0.06);
      for (let k = 0; k < 9; k++) board.fillRect(-430 + k * 100, -h / 2 + 30, 40, h - 50);
      board.lineStyle(10, 0x14213d, 1).strokeRoundedRect(-450, -h / 2 + 20, 900, h - 30, 40);
      content.add(board);
      save.quests.forEach((q, i) => {
        const y = -h / 2 + 230 + i * 236;
        const done = questDone(q);
        const frac = q.progress / questGoal(q);
        const g = this.add.graphics();
        drawBar(g, -230, y + 6, 330, 40, frac, done ? 0xffe066 : 0x7ad651);
        const splat = this.add.image(-330, y, "paint_splash").setTint(0xfff3a0).setScale(0.95).setAngle(i * 70);
        const icon = this.add.image(-330, y - 4, done ? "icon_gift" : QUEST_ICON[q.type]);
        icon.setScale(110 / Math.max(icon.width, icon.height));
        if (done) this.tweens.add({ targets: icon, angle: { from: -10, to: 10 }, duration: 200, yoyo: true, repeat: -1 });
        content.add([
          this.add.image(0, y, vividCard(this, done ? 0xffc93a : colors[i % colors.length], 820, 210)),
          splat, icon,
          fitText(text(this, -230, y - 52, questTitle(q), 40, "#ffffff", { stroke: 10 }).setOrigin(0, 0.5), 330),
          g,
          text(this, -65, y + 26, q.type === "rare" ? `${q.progress}/1` : `${fmt(q.progress)} / ${fmt(q.target)}`, 26, "#ffffff", { stroke: 6 }),
          // the reward as icons
          this.add.image(-210, y + 74, "icon_gem").setScale(0.36), text(this, -180, y + 74, `${r.gems}`, 28, "#ffffff", { stroke: 6 }).setOrigin(0, 0.5),
          this.add.image(-60, y + 74, "icon_cash").setScale(0.36), text(this, -30, y + 74, fmt(r.cash), 28, "#ffffff", { stroke: 6 }).setOrigin(0, 0.5),
          button(this, 265, y, 230, 120, done ? "green" : "grey", done ? "CLAIM" : `${Math.floor(frac * 100)}%`, () => {
            const got = claimQuest(i);
            if (!got) return;
            sfx.fanfare();
            buzz(40);
            this.coinShower(this.W / 2 + 255, this.H / 2 + y, 10);
            this.toast(`+${got.gems} gems   +${fmt(got.cash)} money`, "#8af06a");
            draw();
          }, { size: 42 }).setEnabled(done),
        ]);
      });
      // every 3 quests the next ones get harder: three stars
      const k = save.questsDone % 3;
      for (let i = 0; i < 3; i++) content.add(this.add.star(-60 + i * 60, h / 2 - 96, 5, 14, 30, i < k ? 0xffe066 : 0x8a7a6a).setStrokeStyle(5, 0x111111));
      content.add(text(this, 140, h / 2 - 96, `= harder & richer`, 28, "#ffffff", { stroke: 7 }).setOrigin(0, 0.5));
    };
    draw();
  }

  /** 7-day login streak. */
  /**
   * Daily Rewards, Pet Simulator style: a white window, six colourful day cards (today's has a
   * Claim! button, claimed ones a big tick) and a purple "OP REWARDS!" panel for day 7.
   */
  showDaily(): void {
    const w = 1000;
    const h = 1400;
    const m = this.showModal(modal(this, w, h, "", "gold", () => (this.openModal = null), undefined, true));
    const b = m.body;
    const top = -h / 2;
    const day = dailyDay();
    const win = this.add.graphics();
    win.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2 + 10, top + 70, w, h - 70, 44);
    win.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, top + 60, w, h - 70, 44);
    win.lineStyle(12, 0x26263a, 1).strokeRoundedRect(-w / 2, top + 60, w, h - 70, 44);
    b.addAt(win, 1);
    // the title with a little calendar, sitting on the top border
    const cal = this.add.graphics();
    cal.fillStyle(0xffffff, 1).fillRoundedRect(-58, -50, 116, 104, 16);
    cal.fillStyle(0xf04a5a, 1).fillRoundedRect(-58, -50, 116, 36, { tl: 16, tr: 16, bl: 0, br: 0 });
    cal.lineStyle(7, 0x111111, 1).strokeRoundedRect(-58, -50, 116, 104, 16);
    b.add([
      this.add.container(-w / 2 + 70, top + 60, [cal, text(this, 0, 16, `${day >= 0 ? day + 1 : ((Math.max(1, save.dailyStreak) - 1) % 7) + 1}`, 44, "#26263a")]).setAngle(-10),
      text(this, -w / 2 + 140, top + 60, "Daily Rewards", 84, "#ffffff", { stroke: 16 }).setOrigin(0, 0.5),
      text(this, 0, top + 170, day >= 0 ? "Reward ready to Claim!" : "Come back tomorrow!", 50, day >= 0 ? "#5fc83a" : "#8a8aa0", { stroke: 0 }),
    ]);
    const amount = (r: DailyReward) => r.dice ? `x${r.dice[1]}` : r.gems ? `x${r.gems}` : r.potionMin ? `${r.potionMin}m` : fmt(dailyCash(r));
    const claimed = (i: number) => (day >= 0 ? i < day : i < save.dailyStreak % 7 || save.dailyStreak % 7 === 0);
    const claim = () => {
      const r = claimDaily();
      if (!r) return;
      sfx.fanfare();
      buzz(60);
      this.coinShower(this.W / 2, this.H / 2, 14);
      this.toast(`Day ${day + 1}: ${r.name} collected!`, "#ffe066");
      m.close();
    };
    // six day cards, 3 x 2
    DAILY.slice(0, 6).forEach((r, i) => {
      const x = (i % 3 - 1) * 310;
      const y = top + 400 + Math.floor(i / 3) * 340;
      const today = i === day;
      const done = claimed(i);
      const card = this.add.container(x, y);
      card.add(this.add.image(4, 6, vividCard(this, i === 1 ? 0xff7ad8 : r.color, 290, 320)));
      if (i === 1) card.add(classText(this, 90, -150, "OP!", 40, "uSSS").setAngle(14));
      card.add(fitText(text(this, 0, -120, r.name, 34, "#ffffff", { stroke: 8 }), 250));
      const ic = this.add.image(0, -10, r.icon);
      ic.setScale(130 / Math.max(ic.width, ic.height));
      card.add([ic, text(this, 78, -50, amount(r), 40, "#ffffff", { stroke: 9 })]);
      if (today) {
        card.add(button(this, 0, 100, 220, 84, "green", "Claim!", claim, { size: 38 }));
        this.tweens.add({ targets: card, scale: 1.05, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      } else card.add(text(this, 0, 112, `Day ${i + 1}`, 52, "#ffffff", { stroke: 11 }));
      if (done) {
        card.setAlpha(0.55);
        card.add(this.add.image(0, -10, "icon_check").setScale(1.1));
      }
      b.add(card);
    });
    // day 7: the big purple OP panel
    const r7 = DAILY[6];
    const py = top + 1150;
    const op = this.add.container(0, py);
    op.add(this.add.image(4, 6, vividCard(this, r7.color, 920, 420)));
    op.add(classText(this, 0, -160, "OP REWARDS!", 64, "uSSS"));
    op.add(text(this, 0, -100, `x${r7.dice![1]} ${r7.dice![0]} Dice  •  ${r7.gems} Gems  •  ${r7.potionMin}m Potion`, 30, "#ffffff", { stroke: 7 }));
    const chest = this.add.image(-230, 50, "chest_gold");
    chest.setScale(200 / Math.max(chest.width, chest.height));
    const gem = this.add.image(-120, 100, "icon_gem").setScale(0.9).setAngle(-15);
    const die = this.add.image(-330, 110, `die_${r7.dice![0]}`).setScale(1.4).setAngle(12);
    this.tweens.add({ targets: chest, y: 36, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    op.add([chest, gem, die]);
    if (day === 6) op.add(button(this, 200, 60, 340, 120, "green", "Claim!", claim, { size: 50 }));
    else op.add(classText(this, 200, 60, "Day 7", 110, "uSSS"));
    if (claimed(6) && day !== 6) op.setAlpha(0.6);
    b.add(op);
  }

  /** Boss Rush top bar: the boss number and name over its health. */
  private rushHud(_time: number): void {
    const g = this.hudBars;
    const def = bossForStage(battle.rushBoss);
    drawBar(g, 24, 74, this.W - 48, 34, Math.max(0, battle.bossFrac), def.color);
    fitText(this.progressText.setText(`BOSS ${battle.rushBoss}  •  ${def.name}${battle.bossFrac >= 0 ? `  ${Math.ceil(battle.bossFrac * 100)}%` : ""}`), this.W - 80);
  }

  /** End of a Boss Rush: how far you got and where you will start next time. */
  private rushOver(r: RushResult): void {
    syncSoon();
    const h = 1080;
    let again = false;
    const title = r.reason === "done" ? "ALL BOSSES BEATEN!" : r.reason === "time" ? "TIME'S UP!" : r.reason === "hero" ? "YOU FELL!" : "BOSS RUSH OVER";
    const m = this.showModal(modal(this, 900, h, title, r.reason === "done" ? "gold" : "purple", () => {
      this.openModal = null;
      this.game.events.emit(again ? "rush-start" : "retry", false);
    }));
    const b = m.body;
    const top = -h / 2;
    const next = r.next;
    const def = bossForStage(next);
    b.add(text(this, 0, top + 140, r.beaten ? `${r.beaten} boss${r.beaten > 1 ? "es" : ""} beaten!` : "No bosses beaten this time", 52, "#c9663a"));
    const face = this.add.image(0, top + 330, def.tex);
    face.setScale(200 / Math.max(face.width, face.height));
    b.add([this.add.image(0, top + 330, "glow").setTint(def.color).setScale(1.1).setAlpha(0.6), face]);
    b.add(label(this, 0, top + 470, r.reason === "done" ? "You beat all 100 bosses!" : `You're on stage ${next} now. Next up: BOSS ${next}, ${def.name}`, 32, "#7a5236", 760));
    b.add(label(this, 0, top + 540, `Best: boss ${save.bossRushBest}`, 28, "#9a7a5a"));
    const dice = DICE_TIERS.reduce((s2, t) => s2 + r.dice[t], 0);
    const rows: [string, string][] = [["icon_cash", fmt(r.earned)], ["icon_gem", `+${r.gems}`], ["icon_dice", `+${dice}`]];
    rows.forEach(([icon, v], i) => {
      const x = (i - 1) * 260;
      b.add([this.add.image(x - 60, top + 640, icon).setScale(0.6), text(this, x + 30, top + 640, v, 40, "#ffffff").setOrigin(0, 0.5).setStroke("#4a2f1d", 7)]);
    });
    b.add(label(this, 0, top + 730, "Get stronger pets and upgrades to beat bosses faster!", 28, "#9a7a5a", 760));
    if (r.reason !== "done") {
      b.add(button(this, -165, h / 2 - 120, 300, 120, "purple", "AGAIN", () => {
        again = true;
        m.close();
      }, { size: 40 }));
    }
    b.add(button(this, r.reason !== "done" ? 165 : 0, h / 2 - 120, 300, 120, "peach", "LOBBY", () => m.close(), { size: 40 }));
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
    const L = stageLuck(luck(), save.bestStage);
    const chances = classChances(L);
    const h = 360 + DICE_TIERS.length * 92;
    const m = this.showModal(modal(this, 940, h, "YOUR ODDS", "green", () => (this.openModal = null)));
    m.body.add(text(this, 0, -h / 2 + 110, `Luck ${luckText(L)}`, 46, "#b6f59a"));
    const beginner = beginnerPow(save.bestStage) < 1 ? "  •  Beginner luck: full luck from stage 20" : "";
    m.body.add(label(this, 0, -h / 2 + 162, `Every roll draws its own luck: x1 to ${luckText(topLuck(L))}, ${luckText(L)} on average${beginner}`, 26, "#7a5236", 820));
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

  /** Settings: a cyan header, coloured tabs on the left and switch rows on the right. */
  private showSettings(tab = 0): void {
    const W = 1000;
    const H = 1080;
    const m = this.showModal(modal(this, W, H, "", "blue", () => (this.openModal = null), undefined, true));
    const g = this.add.graphics();
    m.body.add(g);
    const box = (x: number, y: number, w: number, h: number, fill: number, r: number, edge = darken(fill, 0.3)) => {
      g.fillStyle(0x000000, 0.25).fillRoundedRect(x - w / 2, y - h / 2 + 8, w, h, r);
      g.fillStyle(edge, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, r);
      g.fillStyle(fill, 1).fillRoundedRect(x - w / 2 + 5, y - h / 2 + 5, w - 10, h - 14, r - 4);
      g.fillStyle(0xffffff, 0.22).fillRoundedRect(x - w / 2 + 12, y - h / 2 + 9, w - 24, (h - 14) * 0.38, r - 8);
    };
    // header
    const top = -H / 2 + 75;
    box(0, top, W - 20, 140, 0x34c8f0, 30);
    m.body.add([
      this.add.image(-270, top - 4, "icon_gear").setScale(0.95),
      text(this, 30, top - 6, "SETTINGS", 72, "#ffffff", { stroke: 12 }),
    ]);
    // the light panel under it
    box(0, top + 80 + (H - 170) / 2, W - 20, H - 170, 0xe9f2fb, 34, 0x9ab4d0);
    const close = m.body.list.find((o) => o instanceof Phaser.GameObjects.Image && o.texture.key === "icon_close");
    if (close) m.body.bringToTop(close);

    const TABS: { name: string; icon: string; color: number }[] = [
      { name: "Audio", icon: this.glyph("note"), color: 0xc64ae8 },
      { name: "Graphics", icon: "icon_star", color: 0xff9a2a },
      { name: "Interface", icon: this.glyph("screen"), color: 0x3a8af0 },
      { name: "Account", icon: "icon_globe", color: 0x3ac06a },
    ];
    const tabX = -W / 2 + 160;
    TABS.forEach((t, i) => {
      const y = top + 180 + i * 170;
      const on = i === tab;
      box(tabX + (on ? 10 : 0), y, on ? 250 : 230, 150, on ? t.color : darken(t.color, 0.25), 26);
      if (on) g.fillStyle(t.color, 1).fillTriangle(tabX + 132, y - 26, tabX + 132, y + 26, tabX + 162, y);
      const c = this.add.container(tabX + (on ? 10 : 0), y, [
        this.fit(this.add.image(0, -16, t.icon), on ? 82 : 70).setAlpha(on ? 1 : 0.8),
        fitText(text(this, 0, 44, t.name, on ? 30 : 26, on ? "#ffffff" : "#e8e0f0", { stroke: 6 }), 210),
      ]).setSize(230, 150).setInteractive({ useHandCursor: true });
      if (!on) c.on("pointerup", () => {
        sfx.click();
        m.root.destroy();
        this.openModal = null;
        this.showSettings(i);
      });
      m.body.add(c);
    });

    // the rows
    const RX = 135;
    const RW = 680;
    m.body.add(text(this, RX, top + 135, TABS[tab].name, 54, "#3a5a80", { stroke: false }));
    let y = top + 260;
    const row = (icon: string, title: string, sub: string, ctrl?: (y: number) => Phaser.GameObjects.GameObject[]) => {
      box(RX, y, RW, 150, 0xffffff, 26, 0xc9d8e8);
      box(RX - RW / 2 + 82, y - 2, 118, 118, 0xff9a2a, 22);
      m.body.add([
        this.fit(this.add.image(RX - RW / 2 + 82, y - 6, icon), 84),
        fitText(text(this, RX - RW / 2 + 162, y - 24, title, 36, "#2a3a55", { stroke: false }).setOrigin(0, 0.5), ctrl ? 300 : 480),
        fitText(text(this, RX - RW / 2 + 162, y + 22, sub, 23, "#7a8aa0", { stroke: false }).setOrigin(0, 0.5), ctrl ? 300 : 480),
        ...(ctrl?.(y) ?? []),
      ]);
      y += 172;
    };
    const toggle = (get: () => boolean, set: (on: boolean) => void) => (yy: number) => {
      const b: Button = button(this, RX + RW / 2 - 100, yy - 4, 150, 86, get() ? "green" : "red", get() ? "ON" : "OFF", () => {
        set(!get());
        persist();
        applySettings(this.game);
        b.setLabel(get() ? "ON" : "OFF").setColor(get() ? "green" : "red");
      }, { size: 36 });
      return [b];
    };
    const action = (str: string, color: BtnColor, fn: () => void) => (yy: number) => [
      button(this, RX + RW / 2 - 110, yy - 4, 180, 86, color, str, fn, { size: 26 }),
    ];
    const st = save.settings;
    if (tab === 0) {
      row(this.glyph("note"), "Music", "Songs in the lobby and fights", toggle(() => music.isOn(), (on) => music.setOn(on)));
      row(this.glyph("speaker"), "Sound", "Hits, rolls and rewards", toggle(() => !isMuted(), (on) => setMuted(!on)));
      row(this.glyph("phone"), "Vibration", "Buzz on big moments", toggle(() => st.vibrate, (on) => (st.vibrate = on)));
    } else if (tab === 1) {
      row("icon_bolt", "Toaster mode", "Lowest graphics, smoothest play", toggle(() => st.toaster, (on) => (st.toaster = on)));
      row("icon_star", "Zone effects", "Fog, light beams and fire", toggle(() => st.effects, (on) => (st.effects = on)));
      row(this.glyph("shake"), "Screen shake", "Shake on hits and bombs", toggle(() => st.shake, (on) => (st.shake = on)));
      m.body.add(label(this, RX, y + 10, "Toaster mode and zone effects\nchange from the next fight.", 26, "#7a8aa0"));
    } else if (tab === 2) {
      row("icon_sword", "Damage numbers", "Numbers when you hit", toggle(() => st.dmgNumbers, (on) => (st.dmgNumbers = on)));
      row("pk_heart", "HP numbers", "Health under the bars", toggle(() => st.hpNumbers, (on) => (st.hpNumbers = on)));
      row("icon_book", "Story", "Watch the opening again", action("WATCH", "purple", () => {
        m.close();
        void this.replayStory();
      }));
      row("icon_globe", "Language", lang().name, action(lang().name, "blue", () => {
        m.close();
        this.showLanguages();
      }));
    } else {
      const who = !onlineEnabled() ? "Offline version" : online.provider === "playgames" ? "Google Play" : online.provider === "guest" ? "Guest" : online.status === "connecting" ? "Connecting..." : "Offline";
      row("icon_paw", playerName(), who, action("RENAME", "blue", () => {
        askName(this);
        m.close();
      }));
      const play = onlineEnabled() && canUsePlayGames() && online.provider !== "playgames";
      row("icon_globe", "Google Play", play ? "Keep your ranks on a new phone" : "In the Google Play app", action(play ? "SIGN IN" : "SOON", play ? "green" : "grey", () => {
        if (!play) return this.toast("Google Play sign-in is in the Android app (no sign-in needed to play)", "#ffe680");
        m.close();
        void signInWithPlay().then((ok) => this.toast(ok ? `Signed in with Google Play as ${playerName()}` : "Google Play sign-in didn't work, you can keep playing as you are", ok ? "#8af06a" : "#ffe680"));
      }));
      row("icon_trophy", `Best stage ${save.bestStage}/${MAX_STAGE}`, `${fmt(save.totalKills)} kills • ${fmt(save.totalRolls)} rolls • best ${oneIn(save.bestRoll)}`);
      if (!onlineEnabled() || new URLSearchParams(location.search).has("dev")) {
        const tool = (x: number, str: string, fn: () => void) =>
          button(this, x, y - 20, 150, 80, "grey", str, () => {
            fn();
            persist();
          }, { size: 24 });
        m.body.add([
          tool(RX - 243, "+1B $", () => (save.cash += 1e9)),
          tool(RX - 81, "+100 gem", () => (save.gems += 100)),
          tool(RX + 81, "+100 dice", () => (save.dice.A += 100)),
          tool(RX + 243, "+10K $", () => (save.cash += 1e4)),
        ]);
        y += 90;
      }
      let sure = false;
      const reset: Button = button(this, RX, H / 2 - 110, 420, 100, "red", "RESET SAVE", () => {
        if (!sure) {
          sure = true;
          reset.setLabel("TAP AGAIN");
          return;
        }
        resetSave();
        window.location.reload();
      }, { size: 34 });
      m.body.add(reset);
    }
  }

  /** The language picker: every language in its own words; picking one restarts the game in it. */
  private showLanguages(): void {
    const rows = Math.ceil(LANGS.length / 2);
    const h = 300 + rows * 116;
    const m = this.showModal(modal(this, 900, h, "LANGUAGE", "blue", () => (this.openModal = null)));
    m.body.add(label(this, 0, -h / 2 + 130, "Choose your language", 30, "#5a6a80"));
    LANGS.forEach((l, i) => {
      const x = (i % 2 ? 1 : -1) * 205;
      const y = -h / 2 + 230 + Math.floor(i / 2) * 116;
      const on = l.code === lang().code;
      m.body.add(button(this, x, y, 390, 100, on ? "green" : "blue", l.name, () => {
        if (on) return m.close();
        sfx.click();
        setLang(l.code);
        this.toast("The game restarts in the new language", "#ffe680");
        persist();
        this.time.delayedCall(400, () => window.location.reload());
      }, { size: 34 }));
    });
  }

  /** Scales a picture so its longest side is `size`. */
  private fit(img: Phaser.GameObjects.Image, size: number): Phaser.GameObjects.Image {
    return img.setScale(size / Math.max(img.width, img.height));
  }

  /** White icons for the settings rows that the game has no picture for. */
  private glyph(kind: "note" | "speaker" | "phone" | "screen" | "shake"): string {
    return canvasTexture(this, `glyph_${kind}`, 120, 120, (c) => {
      c.fillStyle = "#ffffff";
      c.strokeStyle = "#ffffff";
      c.lineCap = "round";
      c.lineJoin = "round";
      c.shadowColor = "rgba(0,0,0,0.35)";
      c.shadowOffsetY = 5;
      if (kind === "note") {
        c.beginPath(); c.ellipse(36, 88, 19, 15, -0.4, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(86, 76, 19, 15, -0.4, 0, Math.PI * 2); c.fill();
        c.fillRect(48, 22, 11, 66); c.fillRect(98, 10, 11, 66);
        c.beginPath(); c.moveTo(48, 22); c.lineTo(109, 10); c.lineTo(109, 30); c.lineTo(48, 42); c.fill();
      } else if (kind === "speaker") {
        c.beginPath(); c.moveTo(14, 44); c.lineTo(38, 44); c.lineTo(66, 18); c.lineTo(66, 102); c.lineTo(38, 76); c.lineTo(14, 76); c.closePath(); c.fill();
        c.lineWidth = 9;
        c.beginPath(); c.arc(70, 60, 20, -0.9, 0.9); c.stroke();
        c.beginPath(); c.arc(70, 60, 40, -0.9, 0.9); c.stroke();
      } else if (kind === "phone") {
        c.beginPath(); c.roundRect(36, 12, 48, 96, 10); c.fill();
        c.fillStyle = "#ff9a2a"; c.fillRect(43, 24, 34, 64);
        c.lineWidth = 7;
        for (const s of [-1, 1]) {
          c.beginPath(); c.moveTo(60 + s * 36, 36); c.lineTo(60 + s * 46, 48); c.lineTo(60 + s * 36, 60); c.lineTo(60 + s * 46, 72); c.lineTo(60 + s * 36, 84); c.stroke();
        }
      } else if (kind === "screen") {
        c.beginPath(); c.roundRect(10, 18, 100, 70, 10); c.fill();
        c.fillRect(48, 86, 24, 16); c.fillRect(32, 100, 56, 10);
        c.fillStyle = "#3a8af0"; c.fillRect(20, 28, 80, 50);
      } else {
        c.beginPath(); c.roundRect(32, 30, 56, 60, 10); c.fill();
        c.lineWidth = 8;
        for (const s of [-1, 1]) {
          c.beginPath(); c.moveTo(60 + s * 42, 30); c.lineTo(60 + s * 52, 60); c.lineTo(60 + s * 42, 90); c.stroke();
        }
      }
    });
  }

  /** Plays the opening story over the game; the game waits, frozen, until it ends. */
  private async replayStory(): Promise<void> {
    const [{ replayStory }, { STORY_PETS, petPicture }] = await Promise.all([import("../intro/intro"), import("../game")]);
    this.game.loop.sleep();
    try {
      await replayStory(STORY_PETS.map(petPicture));
    } finally {
      this.game.loop.wake();
      music.play(battle.mode === "run" ? "battle" : "calm");
    }
  }

  /** The fishing line never stops: catches come in on every screen (the fishing screen shows them). */
  private fishing(): void {
    const caught = fishTick();
    if (caught.length) {
      persist();
      this.game.events.emit("fish-caught", caught);
      if (caught.some((c) => c.ticket)) this.ticketShow("Your fishing line hooked it!");
      // something big while you are elsewhere: a little note
      const best = caught.reduce((a, c) => (PRIZES[c.prize].row > PRIZES[a.prize].row ? c : a));
      if (this.tab !== "fish" && PRIZES[best.prize].row >= 3) this.toast(`Fishing: caught a ${PRIZES[best.prize].name}!`, rgba(ROW_COLORS[PRIZES[best.prize].row]));
    }
    if (this.fishAwayResult && !this.openModal && battle.mode === "lobby" && this.time.now > 2500) {
      const r = this.fishAwayResult;
      this.fishAwayResult = null;
      this.showFishAway(r);
    }
  }

  /** Back after a while: everything the line caught (already in your pockets). */
  private showFishAway(r: { catches: Catch[]; secs: number }): void {
    const counts = new Map<number, number>();
    let shells = 0;
    for (const c of r.catches) {
      counts.set(c.prize, (counts.get(c.prize) ?? 0) + 1);
      shells += c.shells + (PRIZES[c.prize].kind === "shells" ? c.amount : 0);
    }
    const kinds = [...counts.entries()].sort((a, b) => PRIZES[b[0]].row - PRIZES[a[0]].row || b[1] - a[1]).slice(0, 12);
    const rows = Math.ceil(kinds.length / 4);
    const h = 560 + rows * 170;
    const m = this.showModal(modal(this, 920, h, "GONE FISHING", "blue", () => (this.openModal = null)));
    const hours = Math.floor(r.secs / 3600);
    const mins = Math.floor((r.secs % 3600) / 60);
    m.body.add([
      label(this, 0, -h / 2 + 130, `While you were away your line fished for ${hours ? `${hours}h ` : ""}${mins}m and caught ${fmt(r.catches.length)} things!`, 32, "#7a5236", 780),
      this.add.image(-90, -h / 2 + 220, "fish_shell").setScale(1),
      text(this, -50, -h / 2 + 220, `+${fmt(shells)} shells`, 44, "#ff8ab0").setOrigin(0, 0.5),
    ]);
    kinds.forEach(([idx, n], i) => {
      const p = PRIZES[idx];
      const x = ((i % 4) - 1.5) * 200;
      const y = -h / 2 + 330 + Math.floor(i / 4) * 170;
      const icon = this.add.image(x, y, prizeIcon(p));
      icon.setScale(100 / Math.max(icon.width, icon.height));
      m.body.add([
        this.add.circle(x, y, 70, ROW_COLORS[p.row], 0.3).setStrokeStyle(5, ROW_COLORS[p.row]),
        icon,
        text(this, x + 48, y + 46, `x${fmt(n)}`, 34),
      ]);
    });
    const best = kinds[0] ? PRIZES[kinds[0][0]] : null;
    if (best) m.body.add(fitText(label(this, 0, h / 2 - 200, `Best catch: ${best.name} (${prizeGift(best)})`, 30, "#4a2f1d"), 820));
    m.body.add(button(this, -170, h / 2 - 90, 300, 110, "green", "NICE!", () => m.close(), { size: 40 }));
    m.body.add(button(this, 170, h / 2 - 90, 300, 110, "blue", "GO FISH", () => {
      m.close();
      this.setTab("fish");
    }, { size: 36 }));
    sfx.gift();
    const won = r.catches.filter((c) => c.ticket).length;
    if (won) this.time.delayedCall(500, () => this.ticketShow(`Your line hooked ${won > 1 ? `${won} of them` : "one"} while you were away!`));
  }

  /**
   * A Golden Ticket! The rarest thing in the game gets the whole screen: the ticket spins in over
   * golden rays, the screen flashes, and it says where to spend it. In a fight, just a note.
   */
  showRewards(title: string, rewards: Reward[]): void {
    (this.screens.shop as ShopScreen).rewardShow(title, null, rewards);
  }

  ticketShow(how: string): void {
    sfx.superRoll();
    buzz(300);
    if (battle.mode === "run") {
      this.toast("A GOLDEN TICKET! (see the Shop's Event Shop)", "#ffe066");
      return;
    }
    const { W, H } = this;
    const dim = this.add.rectangle(0, 0, W, H, 0x120a20, 0.88).setOrigin(0).setInteractive();
    const rays = this.add.image(W / 2, H / 2 - 80, "rays").setScale(1.9).setTint(0xffd23f).setAlpha(0);
    const rays2 = this.add.image(W / 2, H / 2 - 80, "rays").setScale(1.3).setTint(0xff9aff).setAlpha(0);
    const glow = this.add.image(W / 2, H / 2 - 80, "glow").setTint(0xffe066).setScale(0).setAlpha(0.9);
    const ticket = this.add.image(W / 2, H / 2 - 80, "icon_ticket").setScale(0).setAngle(-540);
    const head = text(this, W / 2, H / 2 - 420, "GOLDEN TICKET!", 96, "#ffe066").setScale(0);
    const sub = label(this, W / 2, H / 2 + 170, `${how}\nSo rare, you're lucky to ever find one.\nSpend it in the Shop's EVENT SHOP.`, 36, "#ffffff", 900).setAlpha(0);
    const tap = text(this, W / 2, H / 2 + 400, "TAP TO CONTINUE", 40).setAlpha(0);
    const root = this.add.container(0, 0, [dim, rays, rays2, glow, ticket, head, sub, tap]).setDepth(6600);
    this.cameras.main.flash(400, 255, 230, 140);
    this.tweens.add({ targets: rays, alpha: 0.4, duration: 400 });
    this.tweens.add({ targets: rays2, alpha: 0.2, duration: 400 });
    this.tweens.add({ targets: rays, angle: 360, duration: 8000, repeat: -1 });
    this.tweens.add({ targets: rays2, angle: -360, duration: 12000, repeat: -1 });
    this.tweens.add({ targets: glow, scale: 3.4, duration: 600, ease: "Back.out" });
    this.tweens.add({ targets: ticket, scale: 3.2, angle: 0, duration: 900, ease: "Back.out" });
    this.tweens.add({ targets: ticket, y: H / 2 - 100, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: 900 });
    this.tweens.add({ targets: head, scale: 1, duration: 450, delay: 300, ease: "Back.out" });
    this.tweens.add({ targets: [sub, tap], alpha: 1, duration: 400, delay: 900 });
    this.time.delayedCall(250, () => sfx.fanfare());
    this.time.delayedCall(900, () => {
      for (let i = 0; i < 24; i++) {
        const sp = this.add.image(W / 2, H / 2 - 80, "spark").setScale(0.6).setTint([0xffe066, 0xffffff, 0xff9aff][i % 3]);
        root.add(sp);
        const a = (i / 24) * Math.PI * 2;
        this.tweens.add({ targets: sp, x: W / 2 + Math.cos(a) * 460, y: H / 2 - 80 + Math.sin(a) * 460, scale: 0, duration: 900, ease: "Quad.out", onComplete: () => sp.destroy() });
      }
      dim.once("pointerup", () => this.tweens.add({ targets: root, alpha: 0, duration: 250, onComplete: () => root.destroy() }));
    });
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
