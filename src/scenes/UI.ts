import Phaser from "phaser";
import { INK_N } from "../art/draw";
import { petKey, petTexture } from "../art/pets";
import { CARD_H, CARD_W, btnTexture, dieTexture, panelTexture, pillTexture, slotTexture } from "../art/ui";
import { MAX_STAGE } from "../data/balance";
import { ItemDef, PET_LIST } from "../data/items";
import { RARITY_INFO, RARITY_ORDER, rarityRank } from "../data/rarity";
import { REGIONS, STAGES_PER_REGION, regionForStage, regionUnlocked } from "../data/regions";
import { Branch, TREE, TreeNode, effectText } from "../data/tree";
import { WORLD, getWorld, regionAt } from "../game/world";
import { GAME_W, Layout, layoutFor } from "../layout";
import {
  DAILY, checkIndexMilestones, claimDaily, claimQuest, dailyCash, dailyDay, ensureQuests, indexBonus, questDone, questEvent,
  questGoal, questReward, questText, INDEX_STEP,
} from "../systems/goals";
import { RollResult, luckFloor, rollMany, tierChances } from "../systems/roll";
import { lastSeenAtLoad, persist, resetSave, save } from "../systems/save";
import { buzz, isMuted, setMuted, sfx, unlockAudio } from "../systems/sound";
import {
  POTION_GEMS, autoUnlocked, buyNode, canBuy, cashMult, dicePerRoll, dieSkin, luck, luckyEvery, luckyMult, nodeOwned, nodeUnlocked,
  offlineRate, petSlots, potionActive, potionMinutes, potionMult, rollTime,
} from "../systems/stats";
import { fmt, luckText, oneIn } from "../ui/format";
import { PetsScreen, anyLevelReady } from "../ui/petsScreen";
import { TreeScreen } from "../ui/treeScreen";
import { Button, Modal, Pill, button, drawBar, fitText, iconButton, label, modal, petCard, text } from "../ui/widgets";
import { WAVES_PER_STAGE, battle } from "./Battle";

const MAX_SLOTS = 6;

/** Quick-buy cards at the bottom: each buys the cheapest open hexagon of one tree branch. */
const BRANCHES: { title: string; icon: string; branch: Branch; value: () => string }[] = [
  { title: "Luck", icon: "icon_clover", branch: "luck", value: () => luckText(luck()) },
  { title: "Rolling", icon: "icon_clock", branch: "roll", value: () => `${(rollTime() / 1000).toFixed(2)}s` },
  { title: "Money", icon: "icon_cash", branch: "money", value: () => `x${fmt(cashMult())}` },
];

/**
 * Everything drawn over the world: HUD, side buttons, roll button, upgrade cards,
 * the roll reveal, celebrations and popups.
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
  private landText!: Phaser.GameObjects.Text;
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
  private cards: { box: Phaser.GameObjects.Container; value: Phaser.GameObjects.Text; cost: Phaser.GameObjects.Text; node: Phaser.GameObjects.Text }[] = [];
  private petsBtn!: Button;

  // rolling
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private rollReadyAt = 0;
  private revealing = false;
  private celebrating = false;
  private fast = false;

  // screens
  private openModal: Modal | null = null;
  private pets!: PetsScreen;
  private tree: TreeScreen | null = null;

  // goals
  private badges: { obj: Phaser.GameObjects.Container; show: () => boolean }[] = [];
  private badgeTimer = 0;
  private questG!: Phaser.GameObjects.Graphics;
  private questLabel!: Phaser.GameObjects.Text;
  private questCount!: Phaser.GameObjects.Text;
  private questGlow!: Phaser.GameObjects.Image;
  private huntBtn!: Button;

  constructor() {
    super("UI");
  }

  create(): void {
    this.H = this.scale.height;
    this.L = layoutFor(this.H);
    Object.assign(this, { openModal: null, tree: null, revealing: false, celebrating: false, lastWave: "", cards: [], badges: [] });
    this.buildHud();
    ensureQuests();
    this.buildSideButtons();
    this.buildQuestTracker();
    this.buildBottom();
    this.pets = new PetsScreen(this, () => this.petsChanged(), (s, c) => this.toast(s, c));
    this.burst = this.add.particles(0, 0, "spark", {
      speed: { min: 200, max: 620 }, lifespan: 800, scale: { start: 0.9, end: 0 }, rotate: { min: 0, max: 180 }, gravityY: 500, emitting: false,
    }).setDepth(4250);
    this.input.on("pointerdown", () => unlockAudio());
    const on: [string, (...a: never[]) => void][] = [
      ["toast", this.toast],
      ["cash-arrived", this.onCash],
      ["stage-clear", this.stageClear],
      ["land-unlocked", this.landUnlocked],
      ["entered-land", this.enteredLand],
      ["wave-cleared", this.waveCleared],
      ["open-map", this.showMap],
    ];
    for (const [ev, fn] of on) this.game.events.on(ev, fn, this);
    this.events.once("shutdown", () => {
      for (const [ev, fn] of on) this.game.events.off(ev, fn, this);
    });
    this.warmPetTextures();
    if (!this.offlineEarnings() && dailyDay() >= 0) this.time.delayedCall(900, () => this.showDaily());
  }

  /** Draw all pet pictures a few at a time after start, so the roll reels can flash any pet without a hitch. */
  private warmPetTextures(): void {
    let i = 0;
    this.time.addEvent({ delay: 40, repeat: PET_LIST.length - 1, callback: () => petTexture(this, PET_LIST[i++].id) });
  }

  private onCash(): void {
    this.cashPill.bump();
  }

  private petsChanged(): void {
    this.buildSlots();
    this.game.events.emit("pets-changed");
  }

  update(time: number, delta: number): void {
    this.badgeTimer -= delta;
    if (this.badgeTimer <= 0) {
      this.badgeTimer = 400;
      this.updateGoals();
    }
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
    this.pathMarker = this.add.image(0, 116, "hero").setScale(0.24);
    this.tweens.add({ targets: this.pathMarker, y: 108, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.stageText = text(this, 400, 216, "", 38);
    this.landText = text(this, 400, 252, "", 24, "#ffe6b8");
    this.cashPill = new Pill(this, W - 190, 160, 330, 84, "icon_cash", 44);
    this.gemPill = new Pill(this, W - 160, 252, 270, 72, "icon_gem", 36);
    this.luckPill = new Pill(this, 400, 300, 380, 70, "icon_clover", 36, "glass");
    this.luckPill.setSize(380, 70).setInteractive({ useHandCursor: true }).on("pointerup", () => this.showOdds());
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
    this.tweens.add({ targets: this.pathMarker, x: xs[save.wave - 1], duration: 400, ease: "Back.out" });
    this.stageText.setText(`Stage ${save.stage}-${save.wave}`);
    this.landText.setText(`${regionForStage(save.stage).name}  •  max ${MAX_STAGE}`);
  }

  private updateHud(time: number): void {
    const key = `${save.stage}-${save.wave}`;
    if (key !== this.lastWave) {
      this.lastWave = key;
      this.drawPath();
    }
    this.hudBars.clear();
    if (battle.bossFrac >= 0) {
      drawBar(this.hudBars, 24, 74, this.W - 48, 30, battle.bossFrac, 0xf26464);
      this.progressText.setText(`BOSS  ${Math.ceil(battle.bossFrac * 100)}%`);
    } else {
      drawBar(this.hudBars, 24, 74, this.W - 48, 30, battle.progress, 0xffe0a3);
      this.progressText.setText(battle.village < 1 ? `Heart ${Math.ceil(battle.village * 100)}%` : `${Math.floor(battle.progress * 100)}%`);
    }
    this.progressText.setColor(battle.village < 0.4 && time % 600 < 300 ? "#ff8a8a" : "#ffffff");
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
    const t = fitText(text(this, this.W / 2, this.L.hudBottom + 260, str, 40, color).setDepth(7000), this.W - 80);
    const s = t.scale;
    t.setScale(s * 0.6);
    this.tweens.add({ targets: t, scale: s, duration: 160, ease: "Back.out" });
    this.tweens.add({ targets: t, y: t.y - 60, alpha: 0, delay: 1200, duration: 500, onComplete: () => t.destroy() });
  }

  // ───────────────────────── side buttons ─────────────────────────

  private buildSideButtons(): void {
    const { sideTop } = this.L;
    this.badges = [];
    const side = (left: boolean, i: number, icon: string, str: string, onClick: () => void, badge?: () => boolean) => {
      const x = left ? 70 : this.W - 70;
      const y = sideTop + i * 145;
      const b = button(this, x, y, 180, 134, "peach", str, onClick, { icon, iconSize: 68, stack: true, size: 30 });
      if (badge) this.addBadge(x + (left ? 66 : -66), y - 54, badge);
      return b;
    };
    this.petsBtn = side(true, 0, "icon_paw", "Pets", () => this.pets.open("pets"), () => this.petsBadge());
    side(true, 1, "icon_book", "Index", () => this.pets.open("index"));
    side(true, 2, "icon_potion", "Potion", () => this.showPotion(), () => save.gems >= POTION_GEMS && !potionActive());
    side(true, 3, "icon_map", "Map", () => this.showMap());
    side(false, 0, "icon_tree", "Tree", () => this.openTree(), () => TREE.some((n) => canBuy(n)));
    side(false, 1, "icon_odds", "Odds", () => this.showOdds());
    side(false, 2, "icon_gift", "Daily", () => this.showDaily(), () => dailyDay() >= 0);
    this.huntBtn = button(this, this.W - 100, this.L.hudBottom + 222, 172, 92, save.autoHunt ? "green" : "grey", "Hunt", () => {
      save.autoHunt = !save.autoHunt;
      persist();
      this.huntBtn.setColor(save.autoHunt ? "green" : "grey");
      this.toast(save.autoHunt ? "Auto hunt ON: your hero chases monsters" : "Auto hunt OFF: drag to move", "#ffe680");
    }, { icon: "icon_sword", iconSize: 46, size: 30 });
  }

  private addBadge(x: number, y: number, show: () => boolean): void {
    const obj = this.add.container(x, y, [this.add.circle(0, 0, 21, 0xf03e3e).setStrokeStyle(5, INK_N), text(this, 0, -1, "!", 32)])
      .setVisible(false).setDepth(10);
    this.tweens.add({ targets: obj, scale: 1.18, duration: 420, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.badges.push({ obj, show });
  }

  private petsBadge(): boolean {
    const owned = Object.keys(save.pets);
    return (save.equipped.length < petSlots() && owned.length > save.equipped.length) || anyLevelReady();
  }

  // ───────────────────────── quests, daily, map ─────────────────────────

  /** Small panel under the HUD that always shows the next goal. */
  private buildQuestTracker(): void {
    const w = 400;
    const h = 104;
    this.questGlow = this.add.image(0, 0, "glow").setTint(0xffe066).setScale(2.6, 1).setVisible(false);
    this.tweens.add({ targets: this.questGlow, alpha: { from: 0.25, to: 0.8 }, duration: 600, yoyo: true, repeat: -1 });
    this.questG = this.add.graphics();
    this.questLabel = text(this, -116, -18, "", 28).setOrigin(0, 0.5);
    this.questCount = text(this, 30, 26, "", 22);
    this.add.container(this.W - w / 2 - 16, this.L.hudBottom + 100, [
      this.questGlow,
      this.add.image(0, 0, panelTexture(this, "glass", w, h)),
      this.add.image(-w / 2 + 54, 0, "icon_quest").setScale(0.74),
      this.questLabel, this.questG, this.questCount,
    ]).setSize(w, h).setInteractive({ useHandCursor: true }).on("pointerup", () => {
      sfx.click();
      this.showQuests();
    });
  }

  private updateGoals(): void {
    for (const b of this.badges) b.obj.setVisible(b.show());
    const ready = save.quests.find(questDone);
    const q = ready ?? [...save.quests].sort((a, b) => b.progress / questGoal(b) - a.progress / questGoal(a))[0];
    if (!q) return;
    this.questGlow.setVisible(!!ready);
    fitText(this.questLabel.setText(ready ? "Quest done! Tap to claim" : questText(q)).setColor(ready ? "#ffe066" : "#ffffff"), 280);
    this.questCount.setText(q.type === "rare" ? `${q.progress}/1` : `${fmt(q.progress)}/${fmt(q.target)}`);
    this.questG.clear();
    drawBar(this.questG, -116, 14, 292, 24, q.progress / questGoal(q), ready ? 0xffd23f : 0x7ad651);
  }

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
            this.cameras.main.flash(150, 255, 240, 170);
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
  private showDaily(): void {
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
      this.cameras.main.flash(200, 255, 240, 160);
      this.coinShower(this.W / 2, this.H / 2 + h / 2 - 140, 14);
      this.toast(`Day ${day + 1} reward collected!`, "#ffe066");
      m.close();
    }, { size: 46 }).setEnabled(day >= 0));
  }

  /** The whole world: lands, clouds over the ones you have not reached, you, the fight and treasure. */
  private showMap(): void {
    if (this.openModal) return;
    const h = 1240;
    const m = this.showModal(modal(this, 1000, h, "WORLD MAP", "blue", () => (this.openModal = null)));
    const S = 880;
    const top = -h / 2 + 110;
    const k = S / WORLD;
    m.body.add(this.add.image(0, top + S / 2, "world_map").setDisplaySize(S, S));
    const g = this.add.graphics();
    const cell = 50;
    for (let y = 0; y < WORLD; y += cell) {
      for (let x = 0; x < WORLD; x += cell) {
        if (!regionUnlocked(regionAt(x + cell / 2, y + cell / 2), save.bestStage)) g.fillStyle(0xe8ecf6, 0.92).fillRect(-S / 2 + x * k, top + y * k, cell * k + 0.6, cell * k + 0.6);
      }
    }
    g.lineStyle(8, INK_N, 1).strokeRoundedRect(-S / 2 - 4, top - 4, S + 8, S + 8, 16);
    m.body.add(g);
    const fight = regionForStage(save.stage);
    for (const r of REGIONS) {
      const x = -S / 2 + r.heart[0] * k;
      const y = top + r.heart[1] * k;
      const open = regionUnlocked(r, save.bestStage);
      if (!open) m.body.add(this.add.image(x, y - 30, "icon_lock").setScale(0.6));
      m.body.add(text(this, x, y + 20, r.name, 30, open ? "#ffffff" : "#c8d0e0"));
      m.body.add(text(this, x, y + 52, `Stages ${r.from}-${r.from + STAGES_PER_REGION - 1}`, 22, open ? "#ffe680" : "#a8b0c0"));
      if (r === fight) {
        const sword = this.add.image(x, y - 34, "icon_sword").setScale(0.6);
        m.body.add(sword);
        this.tweens.add({ targets: sword, scale: 0.75, duration: 400, yoyo: true, repeat: -1 });
      }
    }
    for (const c of getWorld().chests) {
      if ((save.chests[c.id] ?? 0) > Date.now() || !regionUnlocked(regionAt(c.x, c.y), save.bestStage)) continue;
      m.body.add(this.add.image(-S / 2 + c.x * k, top + c.y * k, "icon_gift").setScale(0.32));
    }
    const me = this.add.image(-S / 2 + battle.heroX * k, top + battle.heroY * k, "hero").setScale(0.22);
    m.body.add(me);
    this.tweens.add({ targets: me, y: me.y - 8, duration: 400, yoyo: true, repeat: -1 });
    const here = regionAt(battle.heroX, battle.heroY);
    m.body.add(label(this, 0, h / 2 - 150, `You are in ${here.name}. Defending ${fight.name}.`, 30, "#4a2f1d", 900));
    m.body.add(label(this, 0, h / 2 - 98, "Gifts mark treasure chests: walk over them to open!", 26, "#9a7a5a", 900));
  }

  private indexMilestone(): void {
    if (!checkIndexMilestones()) return;
    sfx.levelUp();
    this.toast(`${save.indexMilestones * INDEX_STEP} pets found! Luck x${indexBonus().toFixed(2)} forever`, "#8fe3ff");
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
      icon: dieTexture(this, dieSkin(), 5), iconSize: 80, size: 56, sub: "",
    });
    this.tweens.add({ targets: this.rollBtn.icon, angle: { from: -8, to: 8 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
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
      const value = text(this, 0, -26, "", 48);
      const node = label(this, 0, 18, "", 22, "#2f6f5c");
      const costBg = this.add.image(0, 60, pillTexture(this, "dark", 240, 58));
      const cash = this.add.image(-88, 60, "icon_cash").setScale(0.5);
      const cost = text(this, 14, 58, "", 32, "#ffffff");
      c.add([bg, title, icon, value, node, costBg, cash, cost]);
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
        holdTimer = this.time.addEvent({ delay: 160, startAt: -280, loop: true, callback: () => this.buyBranch(i, true) });
      });
      c.on("pointerup", stop);
      c.on("pointerout", stop);
      this.cards.push({ box: c, value, cost, node });
    });
  }

  /** The cheapest hexagon you can open in a branch right now. */
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
      this.tweens.add({ targets: this.cards[i].value, scale: 1.3, duration: 100, yoyo: true });
      this.toast(`${node.name}: ${effectText(node)}`, "#b6f59a");
      this.afterPurchase();
    } else if (!quiet) {
      sfx.error();
      this.toast("Not enough money!", "#ff9a9a");
    }
  }

  private afterPurchase(): void {
    questEvent("buy");
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
      const id = save.equipped[i];
      if (locked) {
        this.slotRow.add(this.add.image(x, y, "icon_lock").setScale(0.45));
      } else if (id) {
        this.slotRow.add(this.add.image(x, y + 4, petTexture(this, id)).setScale(0.5));
        this.slotRow.add(text(this, x + 34, y + 38, `${save.pets[id]?.level ?? 1}`, 22, "#ffe066"));
      } else {
        this.slotRow.add(text(this, x, y, "+", 54, "#d9bb8c", { stroke: false }));
      }
      slot.setInteractive({ useHandCursor: true }).on("pointerup", () => this.pets.open("pets"));
    }
  }

  private updateBottom(time: number): void {
    const left = this.rollReadyAt - time;
    const busy = this.revealing || this.celebrating;
    const every = luckyEvery();
    const luckyNext = save.luckyCount >= every - 1;
    this.rollBtn.setLabel(left > 0 ? `${(left / 1000).toFixed(1)}s` : "ROLL");
    this.rollBtn.setSub(luckyNext ? "LUCKY ROLL!" : `Lucky in ${Math.max(1, every - save.luckyCount - 1)}`);
    this.rollBtn.subText?.setColor(luckyNext ? "#fff27a" : "#ffffff");
    this.rollBtn.setColor(left > 0 || busy ? "peach" : luckyNext ? "gold" : "orange");
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
        card.node.setText("All bought!");
        card.cost.setText("MAX");
        return;
      }
      card.node.setText(`${node.name}: ${effectText(node)}`);
      fitText(card.node, 290);
      card.cost.setText(fmt(node.cost)).setColor(save.cash >= node.cost ? "#ffffff" : "#ff9a9a");
      fitText(card.cost, 160);
    });
  }

  // ───────────────────────── rolling ─────────────────────────

  private tryRoll(): void {
    if (this.revealing || this.celebrating || this.time.now < this.rollReadyAt) return;
    const lucky = save.luckyCount >= luckyEvery() - 1;
    save.luckyCount = lucky ? 0 : save.luckyCount + 1;
    const results = rollMany(dicePerRoll(), luck() * (lucky ? luckyMult() : 1));
    this.rollReadyAt = this.time.now + rollTime();
    questEvent("roll", results.length);
    questEvent("rare", Math.max(...results.map((r) => rarityRank(r.item.rarity))));
    if (results.some((r) => r.isNew)) this.time.delayedCall(2400, () => this.indexMilestone());
    this.game.events.emit("rolled", results);
    this.autoEquip(results);
    this.reveal(results, lucky);
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

  /** A pet to flash on the reel: mostly below the real result, sometimes a teasing rarer one. */
  private fakePet(rank: number): ItemDef {
    const r = Math.random();
    const tier = r < 0.5 ? Math.max(0, rank - 1 - Math.floor(Math.random() * 2)) : r < 0.82 ? rank : Math.min(9, rank + 1 + Math.floor(Math.random() * 2));
    return PET_LIST[Math.min(PET_LIST.length - 1, tier * 10 + Math.floor(Math.random() * 10))];
  }

  /**
   * Slot-machine reels at the bottom: they spin, slow down and land on the rolled pets.
   * Rare pulls get suspense first (a slower reel, a drum roll and a growing glow).
   */
  private reveal(results: RollResult[], lucky: boolean): void {
    this.revealing = true;
    const n = results.length;
    const y = this.L.slotsY - 70;
    const scale = n <= 1 ? 1 : n <= 3 ? 0.86 : 0.66;
    const spacing = Math.min(CARD_W * scale + 14, 980 / n);
    const bestRank = Math.max(...results.map((r) => rarityRank(r.item.rarity)));
    const suspense = !this.fast && bestRank >= 3;
    // faster rolling (from the tree) also speeds the reels up, so speed upgrades really pay off
    const quick = Phaser.Math.Clamp(rollTime() / 2000, 0.12, 1) * (this.fast ? 0.5 : 1);
    const spin = Math.max(140, 1000 * quick) + (suspense ? 500 + bestRank * 90 : 0);
    const hold = Math.max(120, 700 * quick) + (suspense ? 300 : 0);
    const fly = Math.max(140, 360 * quick);
    this.slotRow.setAlpha(0.12);
    if (lucky) {
      sfx.lucky();
      const t = text(this, this.W / 2, y - 200, `LUCKY ROLL!  x${luckyMult()} LUCK`, 50, "#ffe066").setDepth(4300).setScale(0);
      this.tweens.add({ targets: t, scale: 1, duration: 220, ease: "Back.out" });
      this.tweens.add({ targets: t, angle: { from: -4, to: 4 }, duration: 120, yoyo: true, repeat: 5 });
      this.tweens.add({ targets: t, alpha: 0, y: t.y - 50, delay: 1000, duration: 400, onComplete: () => t.destroy() });
      this.cameras.main.flash(150, 255, 230, 120);
    }
    let dim: Phaser.GameObjects.Rectangle | null = null;
    if (suspense) {
      dim = this.add.rectangle(0, 0, this.W, this.H, 0x1a0e08, 0).setOrigin(0).setDepth(4100);
      this.tweens.add({ targets: dim, fillAlpha: 0.45, duration: spin });
    }
    let done = 0;

    results.forEach((res, i) => {
      const x = this.W / 2 + (i - (n - 1) / 2) * spacing;
      const rank = rarityRank(res.item.rarity);
      const color = RARITY_INFO[res.item.rarity].color;
      const glow = this.add.image(x, y, "glow").setDepth(4190).setAlpha(0.35).setScale(scale * 1.8);
      const rays = this.add.image(x, y, "rays").setDepth(4180).setAlpha(0).setScale(scale * 0.6);
      const frame = this.add.image(0, 0, "card_common");
      const rar = text(this, 0, -CARD_H / 2 + 25, "", 24);
      const pet = this.add.image(0, -12, "icon_dice").setScale(1.3);
      const odds = text(this, 0, CARD_H / 2 - 66, "", 22, "#fff3dc");
      const name = text(this, 0, CARD_H / 2 - 27, "", 25);
      const card = this.add.container(x, y + 200, [frame, rar, pet, odds, name]).setDepth(4200).setScale(0);
      const show = (def: ItemDef, real: boolean) => {
        frame.setTexture(`card_${def.rarity}`);
        fitText(rar.setText(RARITY_INFO[def.rarity].label.toUpperCase()), CARD_W - 40);
        fitText(name.setText(def.name), CARD_W - 36);
        odds.setText(oneIn(def.oneIn));
        const key = petKey(def.id);
        if (real) pet.setTexture(petTexture(this, def.id)).setScale(0.9);
        else if (this.textures.exists(key)) pet.setTexture(key).setScale(0.9);
        else pet.setTexture("icon_dice").setScale(1.3).setAngle(Phaser.Math.Between(-20, 20));
        glow.setTint(RARITY_INFO[def.rarity].color);
      };
      this.tweens.add({ targets: card, scale, y, duration: 220, delay: i * 60, ease: "Back.out" });

      let t = 0;
      let k = 0;
      const tick = () => {
        show(this.fakePet(rank), false);
        sfx.tick(k++);
        const p = t / spin;
        this.tweens.add({ targets: card, y: y - 10, duration: 30, yoyo: true });
        if (suspense && p > 0.55) {
          // building tension: shaking card, pulsing glow
          card.setAngle(Phaser.Math.Between(-4, 4));
          glow.setAlpha(0.35 + p * 0.5).setScale(scale * (1.8 + p * 0.8));
        }
        const delay = 40 + (suspense ? 200 : 120) * p * p;
        t += delay;
        this.time.delayedCall(delay, t < spin ? tick : land);
      };
      const land = () => {
        show(res.item, true);
        card.setAngle(0);
        pet.setAngle(0);
        sfx.reveal(rank);
        glow.setAlpha(0.95);
        if (rank >= 3) {
          rays.setTint(color);
          this.tweens.add({ targets: rays, alpha: 0.85, scale: scale * (0.75 + rank * 0.05), duration: 250 });
          this.tweens.add({ targets: rays, angle: 120, duration: hold + rank * 60 + 300 });
          this.cameras.main.flash(180, (color >> 16) & 255, (color >> 8) & 255, color & 255);
        }
        this.tweens.add({ targets: card, scaleX: scale * 1.22, scaleY: scale * 0.84, duration: 80, yoyo: true, ease: "Quad.out" });
        this.tweens.add({ targets: glow, scale: scale * (2.2 + rank * 0.25), alpha: 0.6, duration: 260 });
        if (rank >= 1) {
          this.burst.setParticleTint(color);
          this.burst.explode(8 + rank * 9, x, y);
        }
        if (rank >= 2) {
          const call = text(this, x, y - (CARD_H * scale) / 2 - 34, `${RARITY_INFO[res.item.rarity].label.toUpperCase()}!`, 34 + rank * 3, RARITY_INFO[res.item.rarity].css)
            .setDepth(4300).setScale(0);
          this.tweens.add({ targets: call, scale: 1, duration: 200, ease: "Back.out" });
          this.tweens.add({ targets: call, alpha: 0, y: call.y - 30, delay: hold + 150, duration: 300, onComplete: () => call.destroy() });
        }
        if (rank >= 4) {
          this.cameras.main.shake(180 + rank * 30, 0.004 + rank * 0.001);
          buzz(40 + rank * 15);
          this.confetti(1200);
        }
        if (res.isNew) {
          const tag = text(this, CARD_W / 2 - 16, -CARD_H / 2 - 2, "NEW!", 34, "#ff6a8a").setAngle(14).setScale(2.5);
          card.add(tag);
          this.tweens.add({ targets: tag, scale: 1, duration: 200, ease: "Back.out" });
          this.tweens.add({ targets: tag, scale: 1.2, duration: 300, yoyo: true, repeat: 2, delay: 200 });
        } else if (save.pets[res.item.id]) {
          const p = save.pets[res.item.id];
          const tag = text(this, 0, CARD_H / 2 + 26, `+1 copy  (Lv.${p.level})`, 26, "#b6f59a");
          card.add(tag);
        }
        this.time.delayedCall(hold + rank * 60, () => {
          this.tweens.add({ targets: [glow, rays], alpha: 0, duration: 200, onComplete: () => (glow.destroy(), rays.destroy()) });
          // fly into the Pets button with a sparkle trail
          const trail = this.add.particles(0, 0, "spark", {
            follow: card, lifespan: 300, scale: { start: 0.5, end: 0 }, tint: color, frequency: 30, speed: 20,
          }).setDepth(4190);
          this.tweens.add({
            targets: card, x: this.petsBtn.x, y: this.petsBtn.y, scale: 0.06, angle: 200, duration: fly, ease: "Cubic.in",
            onComplete: () => {
              card.destroy();
              trail.stop();
              this.time.delayedCall(400, () => trail.destroy());
              this.tweens.add({ targets: this.petsBtn, scale: 1.15, duration: 80, yoyo: true });
              if (++done === n) {
                dim?.destroy();
                this.finishReveal(results);
              }
            },
          });
        });
      };
      this.time.delayedCall(i * 60 + 140, tick);
    });
  }

  private finishReveal(results: RollResult[]): void {
    this.revealing = false;
    this.slotRow.setAlpha(1);
    const best = results.reduce((a, b) => (b.item.oneIn > a.item.oneIn ? b : a));
    const rank = rarityRank(best.item.rarity);
    if ((best.isNew && rank >= 3) || (rank >= 3 && best.item.oneIn >= luck() * 500)) this.celebrate(best);
  }

  private confetti(ms: number): Phaser.GameObjects.Particles.ParticleEmitter {
    const c = this.add.particles(0, -30, "puff", {
      x: { min: 0, max: this.W }, speedY: { min: 250, max: 560 }, speedX: { min: -120, max: 120 }, lifespan: 4200,
      scaleX: { min: 0.25, max: 0.5 }, scaleY: { min: 0.5, max: 0.9 }, rotate: { min: 0, max: 360 },
      tint: [0xff6b81, 0xffe066, 0x6ff08a, 0x5ac8ff, 0xb98aff, 0xffffff], frequency: 25, quantity: 2,
    }).setDepth(6500);
    this.time.delayedCall(ms, () => c.stop());
    this.time.delayedCall(ms + 4500, () => c.destroy());
    return c;
  }

  /** Coins burst out of a point and fly into the money counter. */
  private coinShower(x: number, y: number, n: number): void {
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
    const card = petCard(this, W / 2, cy, res.item.id, { isNew: res.isNew }).setScale(0);
    const odds = text(this, W / 2, cy + 345, oneIn(res.item.oneIn), 66, "#ffe680");
    const tap = text(this, W / 2, cy + 470, "TAP TO CONTINUE", 40);
    const root = this.add.container(0, 0, [dim, rays, glow, card, title, odds, tap]).setDepth(6000);
    const confetti = this.confetti(4000);
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

  // ───────────────────────── stage and land moments ─────────────────────────

  private waveCleared(): void {
    const t = text(this, this.W / 2, this.L.hudBottom + 160, "WAVE CLEAR!", 64, "#b6f59a").setDepth(6100).setScale(0);
    this.tweens.add({ targets: t, scale: 1, duration: 220, ease: "Back.out" });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 50, delay: 700, duration: 300, onComplete: () => t.destroy() });
  }

  /** "STAGE 7 CLEAR!" with stars popping in, money counting up and confetti. */
  private stageClear(info: { stage: number; earned: number; gems: number; final: boolean }): void {
    const { W } = this;
    const cy = this.L.hudBottom + 360;
    const band = this.add.graphics();
    band.fillStyle(0x1a0e08, 0.72).fillRect(0, -170, W, 340);
    band.fillStyle(0xffd23f, 1).fillRect(0, -170, W, 8).fillRect(0, 162, W, 8);
    const rays = this.add.image(W / 2, -40, "rays").setTint(0xffd23f).setAlpha(0.45).setScale(1.1);
    const title = text(this, W / 2, -70, info.final ? "YOU CONQUERED EVERY LAND!" : `STAGE ${info.stage} CLEAR!`, info.final ? 62 : 90, "#ffe066");
    fitText(title, W - 60);
    const stars = [0, 1, 2].map((i) => this.add.image(W / 2 + (i - 1) * 120, 30, "icon_star").setScale(0));
    const coins = this.add.image(W / 2 - 150, 112, "icon_cash").setScale(0.6);
    const earned = text(this, W / 2 - 100, 110, "+0", 52, "#8af06a").setOrigin(0, 0.5);
    const gem = this.add.image(W / 2 + 170, 112, "icon_gem").setScale(0.55);
    const gems = text(this, W / 2 + 210, 110, `+${info.gems}`, 52, "#8fe3ff").setOrigin(0, 0.5);
    const root = this.add.container(0, cy, [band, rays, title, ...stars, coins, earned, gem, gems]).setDepth(6200).setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: 200 });
    this.tweens.add({ targets: rays, angle: 180, duration: 3000 });
    title.setScale(0);
    this.tweens.add({ targets: title, scale: title.scale || 1, duration: 400, ease: "Back.out" });
    sfx.fanfare();
    buzz(150);
    stars.forEach((s, i) => {
      this.time.delayedCall(350 + i * 260, () => {
        sfx.lucky();
        this.tweens.add({ targets: s, scale: 0.95, angle: 360, duration: 300, ease: "Back.out" });
        this.burst.setParticleTint(0xffe066);
        this.burst.explode(16, s.x, cy + 30);
      });
    });
    const counter = { v: 0 };
    this.tweens.add({
      targets: counter, v: info.earned, duration: 1300, delay: 400, ease: "Cubic.out",
      onUpdate: () => earned.setText(`+${fmt(counter.v)}`),
    });
    this.confetti(info.final ? 4000 : 1400);
    this.coinShower(W / 2, cy + 110, 12);
    this.time.delayedCall(info.final ? 5000 : 3000, () => this.tweens.add({ targets: root, alpha: 0, duration: 300, onComplete: () => root.destroy() }));
  }

  private landUnlocked(name: string): void {
    const { W, H } = this;
    const rays = this.add.image(W / 2, H * 0.4, "rays").setTint(0xffe066).setAlpha(0.6).setScale(2);
    const t1 = text(this, W / 2, H * 0.4 - 60, "NEW LAND UNLOCKED!", 70, "#ffe066");
    const t2 = text(this, W / 2, H * 0.4 + 40, name, 96, "#ffffff");
    const root = this.add.container(0, 0, [rays, t1, t2]).setDepth(6300);
    t2.setScale(0);
    this.tweens.add({ targets: t2, scale: 1, duration: 500, delay: 200, ease: "Back.out" });
    this.tweens.add({ targets: rays, angle: 180, duration: 3500 });
    this.confetti(2000);
    this.time.delayedCall(3200, () => this.tweens.add({ targets: root, alpha: 0, duration: 400, onComplete: () => root.destroy() }));
  }

  private enteredLand(name: string): void {
    const t = text(this, this.W / 2, this.L.hudBottom + 470, name, 54, "#fff3dc").setDepth(6000).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 300, yoyo: true, hold: 1200, onComplete: () => t.destroy() });
  }

  // ───────────────────────── upgrade tree ─────────────────────────

  private openTree(): void {
    if (this.tree) return;
    this.pets.close();
    this.openModal?.close();
    this.tree = new TreeScreen(this, () => this.afterPurchase(), (s, c) => this.toast(s, c), () => (this.tree = null));
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
      const glow = this.add.image(0, -150, "glow").setTint(0x9cf06a).setScale(1.3).setAlpha(0.7);
      content.add(glow);
      this.tweens.add({ targets: glow, scale: 1.5, duration: 700, yoyo: true, repeat: -1 });
      const pot = this.add.image(0, -150, "icon_potion").setScale(2);
      content.add(pot);
      this.tweens.add({ targets: pot, angle: { from: -6, to: 6 }, duration: 600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
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
        sfx.lucky();
        this.cameras.main.flash(200, 180, 255, 160);
        draw();
      }, { sub: `${POTION_GEMS} gems`, subIcon: "icon_gem", size: 46 }).setEnabled(save.gems >= POTION_GEMS));
    };
    draw();
  }

  private showSettings(): void {
    const h = 980;
    const m = this.showModal(modal(this, 860, h, "SETTINGS", "peach", () => (this.openModal = null)));
    m.body.add(label(this, 0, -h / 2 + 150,
      `Best stage: ${save.bestStage}/${MAX_STAGE}\nMonsters defeated: ${fmt(save.totalKills)}\nRolls: ${fmt(save.totalRolls)}\nRarest roll: ${oneIn(save.bestRoll)}\nPets found: ${save.discovered.length}/${PET_LIST.length}`, 34, "#7a5236"));
    const snd: Button = button(this, 0, -100, 380, 96, isMuted() ? "grey" : "green", isMuted() ? "Sound: OFF" : "Sound: ON", () => {
      setMuted(!isMuted());
      snd.setLabel(isMuted() ? "Sound: OFF" : "Sound: ON").setColor(isMuted() ? "grey" : "green");
    }, { size: 32 });
    m.body.add(snd);
    m.body.add(label(this, 0, 0, "Testing tools (removed before release)", 26, "#9a7a5a"));
    const dev = (y: number, x: number, str: string, fn: () => void) =>
      m.body.add(button(this, x, y, 360, 96, "grey", str, () => {
        fn();
        persist();
      }, { size: 30 }));
    dev(90, -190, "+10K money", () => (save.cash += 1e4));
    dev(90, 190, "+1B money", () => (save.cash += 1e9));
    dev(210, -190, "+100 gems", () => (save.gems += 100));
    dev(210, 190, "+1Qa money", () => (save.cash += 1e15));
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
      this.add.image(0, -100, "hero").setScale(1.1),
      label(this, 0, 20, `Your team fought for ${hours ? `${hours}h ` : ""}${mins}m while you were away`, 32, "#7a5236", 700),
      this.add.image(-150, 135, "icon_cash").setScale(0.95),
      fitText(text(this, -80, 132, `+${fmt(cash)}`, 84, "#8af06a").setOrigin(0, 0.5), 360),
      button(this, -195, 300, 360, 130, "green", "COLLECT", () => collect(1), { size: 44 }),
      // In the real game this would show a rewarded ad first
      button(this, 195, 300, 360, 130, "purple", "x2", () => collect(2), { icon: "icon_ad", iconSize: 70, size: 52 }),
    ]);
    return true;
  }
}
