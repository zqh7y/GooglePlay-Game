import Phaser from "phaser";
import { makeTutorialTextures } from "../art/online";
import { panelTexture } from "../art/ui";
import { battle } from "../scenes/Battle";
import { persist, save } from "../systems/save";
import { sfx } from "../systems/sound";
import { Tab } from "./screens";
import { button, label, text } from "./widgets";

/** What the tutorial needs to know about the game (the UI scene answers). */
export interface TutorialHost {
  scene: Phaser.Scene;
  tab(): Tab;
  modalOpen(): boolean;
  pickerOpen(): boolean;
  mapOpen(): boolean;
  /** screen positions of things to point at (null when not on screen) */
  battleButton(): [number, number] | null;
  startButton(): [number, number] | null;
  rollButton(): [number, number] | null;
  tabSpot(tab: Tab): [number, number];
  /** in a fight: the nearest bones / meat, the crystal, the nearest open seal */
  spot(kind: "food" | "crystal" | "seal"): [number, number] | null;
}

interface Step {
  /** the step only shows while this holds (otherwise it waits, hidden) */
  when: () => boolean;
  text: () => string;
  target?: () => [number, number] | null;
  /** move on when this becomes true (checked once the step has been shown) */
  done?: () => boolean;
  /** an OK button moves on */
  ok?: boolean;
  /** move on after this long on screen */
  timeout?: number;
  /** a finger shows dragging across the screen */
  swipe?: boolean;
  /** passed over without showing (e.g. a fight step when the fight is already over) */
  skip?: () => boolean;
}

/**
 * The first-time guide: the little box ghost explains the game step by step with a speech bubble,
 * a pointing hand and a ring around what to tap. Each step waits for the right moment (no popup
 * open, the right screen) and moves on when you have done it. SKIP ends it; players with an older
 * save never see it. Progress is kept in `save.tutorial` (-1 = done).
 */
export class Tutorial {
  private root: Phaser.GameObjects.Container;
  private bubble: Phaser.GameObjects.Container;
  private hand: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Arc;
  private shownStep = -1;
  private shownText = "";
  private visibleMs = 0;
  private seen = false;
  private moved = 0;
  private rollsAtStart = 0;
  private steps: Step[];

  constructor(private host: TutorialHost) {
    const s = host.scene;
    makeTutorialTextures(s);
    this.ring = s.add.circle(0, 0, 70).setStrokeStyle(10, 0xffe066, 1).setVisible(false);
    s.tweens.add({ targets: this.ring, scale: { from: 0.8, to: 1.25 }, alpha: { from: 1, to: 0.2 }, duration: 800, repeat: -1 });
    this.hand = s.add.image(0, 0, "tut_hand").setOrigin(0.2, 0.25).setVisible(false);
    this.bubble = s.add.container(0, 0);
    this.root = s.add.container(0, 0, [this.ring, this.bubble, this.hand]).setDepth(6800).setVisible(false);
    const lobby = () => battle.mode === "lobby" && host.tab() === "battle" && !host.mapOpen();
    const fight = () => battle.mode === "run" && !battle.bossFight;
    // fight steps are passed over once the fight is over (it ended early)
    const over = () => battle.mode !== "run";
    const tabStep = (tab: Tab, str: string): Step => ({
      when: () => battle.mode === "lobby" && host.tab() !== tab && !host.modalOpen() && !host.mapOpen(),
      text: () => str,
      target: () => host.tabSpot(tab),
      done: () => host.tab() === tab,
    });
    const onTab = (tab: Tab, str: string): Step => ({ when: () => host.tab() === tab && !host.modalOpen(), text: () => str, ok: true });
    this.steps = [
      {
        when: () => lobby() && !host.modalOpen(),
        text: () => "Hi! I'm a little ghost who lives in a box. Monsters stole the light of the crystals... let's get it back together!",
        ok: true,
      },
      {
        when: lobby,
        text: () => (host.modalOpen() ? "Tap START!" : "Tap BATTLE to start your first fight!"),
        target: () => (host.modalOpen() ? host.startButton() : host.battleButton()),
        done: () => battle.mode === "run",
      },
      {
        when: () => fight() && !host.pickerOpen(),
        text: () => "Drag anywhere to walk. Your gadgets shoot all by themselves!",
        swipe: true,
        done: () => this.moved > 1500,
        timeout: 9000,
        skip: over,
      },
      {
        when: () => fight() && !host.pickerOpen(),
        text: () => "Monsters drop bones and meat. Walk over them to level up!",
        target: () => host.spot("food"),
        done: () => battle.level >= 2,
        skip: over,
      },
      {
        when: () => host.pickerOpen() && battle.mode === "run",
        text: () => "LEVEL UP! Every level, pick a new gadget or make one stronger.",
        done: () => !host.pickerOpen(),
        skip: over,
      },
      {
        when: () => fight() && !battle.shielded && battle.time > 40000 && !host.pickerOpen(),
        text: () => "The crystal's shield is down! Monsters will bite it now. Stay close and protect it!",
        target: () => host.spot("crystal"),
        timeout: 7000,
        skip: over,
      },
      {
        when: () => battle.mode === "run" && battle.bossFight && battle.sealsTotal > 0 && battle.bossFrac >= 0 && !host.pickerOpen(),
        text: () => "The BOSS heals itself! Stand on a glowing seal for 3 seconds to stop it.",
        target: () => host.spot("seal"),
        timeout: 9000,
        skip: over,
      },
      { ...tabStep("roll", "You found dice in the fight! Open Roll to roll for pets."), skip: () => save.totalRolls > 0 },
      {
        when: () => host.tab() === "roll" && !host.modalOpen(),
        text: () => "Tap ROLL! Every roll uses one die. Rarer dice bring rarer pets.",
        target: () => host.rollButton(),
        done: () => save.totalRolls > this.rollsAtStart,
      },
      tabStep("pets", "Your pets fight next to you! Open Pets to see them."),
      onTab("pets", "Tap a pet to see its power and equip it. Extra copies level it up!"),
      tabStep("upgrades", "Money from fights buys upgrades: luck, damage, more pets..."),
      onTab("upgrades", "The glowing hexagons are the ones you can buy right now."),
      tabStep("fish", "One more thing: your hero goes fishing, all the time!"),
      onTab("fish", "Catches come in even while you're away. Upgrade the line with shells."),
      {
        when: () => !host.modalOpen(),
        text: () => "That's everything! Clear stages, roll rare pets and reach STAGE 100. Good luck!",
        ok: true,
      },
    ];
  }

  get active(): boolean {
    return save.tutorial >= 0 && save.tutorial < this.steps.length;
  }

  private next(): void {
    save.tutorial++;
    if (save.tutorial >= this.steps.length) save.tutorial = -1;
    persist();
    this.shownStep = -1;
    this.seen = false;
    this.visibleMs = 0;
    this.rollsAtStart = save.totalRolls;
  }

  private end(): void {
    save.tutorial = -1;
    persist();
    this.root.setVisible(false);
  }

  update(delta: number): void {
    if (!this.active) {
      this.root.setVisible(false);
      return;
    }
    const step = this.steps[save.tutorial];
    if (!this.seen && step.skip?.()) {
      this.next();
      return;
    }
    if (battle.mode === "run" && battle.hp > 0) this.moved += this.host.scene.input.activePointer.isDown ? delta : 0;
    if (this.seen && step.done?.()) {
      sfx.lucky();
      this.next();
      return;
    }
    if (!step.when()) {
      this.root.setVisible(false);
      return;
    }
    this.seen = true;
    this.visibleMs += delta;
    if (step.timeout && this.visibleMs > step.timeout) {
      this.next();
      return;
    }
    this.root.setVisible(true);
    const str = step.text();
    const target = step.target?.() ?? null;
    if (this.shownStep !== save.tutorial || this.shownText !== str) this.drawBubble(step, str, target);
    this.placeHand(step, target);
  }

  private drawBubble(step: Step, str: string, target: [number, number] | null): void {
    const s = this.host.scene;
    const { width: W, height: H } = s.scale;
    const firstShow = this.shownStep !== save.tutorial;
    this.shownStep = save.tutorial;
    this.shownText = str;
    this.bubble.removeAll(true);
    // keep the bubble away from what it points at
    const low = target ? target[1] < H * 0.5 : step.swipe ? false : battle.mode === "run";
    const y = low ? H - 520 : 470;
    const w = 940;
    const h = step.ok ? 300 : 230;
    const face = s.add.image(-w / 2 + 80, -10, "hero").setScale(0.9);
    s.tweens.add({ targets: face, y: -20, duration: 600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const parts: Phaser.GameObjects.GameObject[] = [
      s.add.image(0, 0, panelTexture(s, "cream", w, h)),
      face,
      label(s, 70, step.ok ? -40 : -10, str, 34, "#4a2f1d", w - 240),
    ];
    const skip = text(s, w / 2 - 70, -h / 2 + 34, "SKIP", 26, "#9a7a5a", { stroke: false }).setInteractive({ useHandCursor: true });
    skip.on("pointerup", () => this.end());
    parts.push(skip);
    if (step.ok) {
      parts.push(button(s, 70, h / 2 - 66, 260, 90, "green", "OK!", () => {
        sfx.click();
        this.next();
      }, { size: 38 }));
    }
    this.bubble.add(parts).setPosition(W / 2, y);
    if (firstShow) {
      this.bubble.setScale(0.6).setAlpha(0);
      s.tweens.add({ targets: this.bubble, scale: 1, alpha: 1, duration: 260, ease: "Back.out" });
    }
  }

  private placeHand(step: Step, target: [number, number] | null): void {
    const t = this.host.scene.time.now;
    const { width: W, height: H } = this.host.scene.scale;
    if (step.swipe) {
      // a finger dragging left and right in the lower part of the screen
      const k = (Math.sin(t / 450) + 1) / 2;
      this.hand.setVisible(true).setPosition(W * 0.3 + W * 0.4 * k, H * 0.68).setAngle(0);
      this.ring.setVisible(false);
      return;
    }
    if (!target) {
      this.hand.setVisible(false);
      this.ring.setVisible(false);
      return;
    }
    const bob = Math.abs(Math.sin(t / 260)) * 26;
    this.ring.setVisible(true).setPosition(target[0], target[1]);
    this.hand.setVisible(true).setPosition(target[0] + bob, target[1] + bob).setAngle(0);
  }
}
