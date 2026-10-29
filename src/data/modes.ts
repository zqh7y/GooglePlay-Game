/**
 * Every stage has one of five modes, in a repeating cycle: 1 Air Zone, 2 Crystal, 3 Feed the Beast,
 * 4 Dice Rain, 5 Boss Battle, then 6 is Air Zone again, and so on up to stage 100. Stage 1 is the
 * exception: it is always a Crystal stage.
 */
export type StageMode = "air" | "crystal" | "feed" | "dice" | "boss";

/** Dice Rain is not in the cycle: it is the beginners' event (see DICE_EVENT_DAYS) */
export const MODE_ORDER: StageMode[] = ["air", "crystal", "feed", "crystal", "boss"];

/** New players get the Dice Rain event for their first two weeks. */
export const DICE_EVENT_DAYS = 14;

/** Stage 1 is always a Crystal stage (the easiest start); after that the cycle runs as usual. */
export const modeForStage = (stage: number): StageMode =>
  stage <= 1 ? "crystal" : MODE_ORDER[(Math.max(1, stage) - 1) % MODE_ORDER.length];

export interface ModeInfo {
  name: string;
  /** the big banner when the fight starts */
  banner: string;
  /** one line: what you have to do */
  goal: string;
  icon: string;
  color: number;
  css: string;
}

export const MODE_INFO: Record<StageMode, ModeInfo> = {
  air: {
    name: "AIR ZONE", banner: "STAY IN THE AIR!", icon: "mode_air", color: 0x4fd8ff, css: "#9ef0ff",
    goal: "Stay in the air zone!",
  },
  crystal: {
    name: "CRYSTAL", banner: "SURVIVE 5:00!", icon: "mode_crystal", color: 0xff7ad8, css: "#ffc2f0",
    goal: "Guard the crystal!",
  },
  feed: {
    name: "FEED THE BEAST", banner: "FEED THE BEAST!", icon: "mode_feed", color: 0xffa040, css: "#ffd29a",
    goal: "Feed the beast 6 snacks!",
  },
  dice: {
    name: "DICE RAIN", banner: "DODGE THE DICE!", icon: "mode_dice", color: 0xffe066, css: "#fff2a8",
    goal: "Dodge the giant dice!",
  },
  boss: {
    name: "BOSS BATTLE", banner: "BOSS BATTLE!", icon: "mode_boss", color: 0xff4a4a, css: "#ffb0b0",
    goal: "Beat 4 bosses!",
  },
};

/** Air Zone: the zone covers 10% of the map and moves every 30 s; the next one shows 8 s early. */
export const AIR_EVERY = 30000;
export const AIR_PREVIEW = 8000;
/** seconds of air outside the zone */
export const AIR_SECS = 9;

/** Feed the Beast: 6 snacks, one every 45 s from 0:20; a full beast gets hungry in 60 s. */
export const FEEDS = 6;
export const FEED_FIRST = 20000;
export const FEED_EVERY = 45000;
export const HUNGER_MS = 60000;
/** a beast fed 6 times helps you, so the boss is tougher */
export const FRIEND_BOSS_HP = 1.8;

/** Boss Battle: the big boss and its kids */
export const BIG_BOSS_HP = 1.5;
export const BOSS_KIDS = 3;
export const KID_HP = 0.3;
