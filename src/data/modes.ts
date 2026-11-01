import { mainMode } from "./stages";
import { storyFor } from "./story";

/**
 * Every stage has a mode. The main stages (data/stages.ts) take turns through Guard (crystal), Dice
 * Hunt, Air Zone, Dice Rain and Boss Battle. The story chapters (data/story.ts) have their own: 1 the
 * Path to the village, 2 the Village hunt, 3 Feed the Beast, 4 the Big Boss, 5 the Path to the sea,
 * 6 the Sea, 7 Land Ho!, 8 the Lighthouse, 9 Quake Island, 10 the Volcano.
 */
export type StageMode = "air" | "crystal" | "feed" | "dice" | "boss" | "path" | "hunt" | "sea" | "ocean" | "light" | "quake" | "volcano";

/** New players get the Dice Rain event for their first two weeks. */
export const DICE_EVENT_DAYS = 14;

const CHAPTER_MODES: StageMode[] = ["path", "hunt", "feed", "boss", "path", "sea", "ocean", "light", "quake", "volcano"];

export const modeForStage = (stage: number): StageMode => mainMode(stage);
export const chapterMode = (ch: number): StageMode => CHAPTER_MODES[Math.min(CHAPTER_MODES.length, Math.max(1, ch)) - 1];

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
    goal: "Stay in the air zone for 3:00!",
  },
  crystal: {
    name: "GUARD", banner: "GUARD THE CRYSTAL!", icon: "mode_crystal", color: 0xff7ad8, css: "#ffc2f0",
    goal: "Guard the crystal for 3:00!",
  },
  feed: {
    name: "FEED THE BEAST", banner: "FEED THE BEAST!", icon: "mode_feed", color: 0xffa040, css: "#ffd29a",
    goal: "Feed the beast 6 snacks!",
  },
  dice: {
    name: "DICE RAIN", banner: "DODGE THE DICE!", icon: "mode_dice", color: 0xffe066, css: "#fff2a8",
    goal: "Dodge the giant dice for 3:00!",
  },
  boss: {
    name: "BOSS BATTLE", banner: "BOSS BATTLE!", icon: "mode_boss", color: 0xff4a4a, css: "#ffb0b0",
    goal: "Beat the boss and its 3 kids in 3:00!",
  },
  path: {
    name: "THE PATH", banner: "RUN!", icon: "icon_clock", color: 0x6ab84a, css: "#c8f0a0",
    goal: "Reach the end of the path!",
  },
  sea: {
    name: "SEA STORM", banner: "SEA STORM!", icon: "mode_sea", color: 0x3a8ae0, css: "#9ad8ff",
    goal: "Survive the sea, then the tsunami!",
  },
  ocean: {
    name: "LAND HO!", banner: "FIND LAND!", icon: "mode_sea", color: 0x2a9ad8, css: "#a8e8ff",
    goal: "Sail the ocean and find the big island!",
  },
  light: {
    name: "LIGHTHOUSE", banner: "LIGHT IT UP!", icon: "mode_light", color: 0xffb03a, css: "#ffe0a0",
    goal: "Light the 4 fire bowls and the lighthouse!",
  },
  quake: {
    name: "QUAKE ISLAND", banner: "THE ISLAND IS BREAKING!", icon: "mode_quake", color: 0xff6a2a, css: "#ffc08a",
    goal: "Survive the quake for 2:00!",
  },
  volcano: {
    name: "THE VOLCANO", banner: "MAGMA KING!", icon: "mode_volcano", color: 0xff5a1a, css: "#ffb08a",
    goal: "Beat the Magma King in the volcano!",
  },
  hunt: {
    name: "DICE HUNT", banner: "FIND THE DICE!", icon: "die_A", color: 0xffb03a, css: "#ffe0a0",
    goal: "Find 12 dice in 3:00!",
  },
};

/** The mode's info for a main stage. */
export function stageInfo(stage: number): ModeInfo {
  return MODE_INFO[modeForStage(stage)];
}

/** A story chapter's: its own name, banner and goal where it has them. */
export function chapterInfo(ch: number): ModeInfo {
  const info = MODE_INFO[chapterMode(ch)];
  const story = storyFor(ch);
  return story ? { ...info, name: story.title, banner: story.title, goal: story.goal } : info;
}

/** Air Zone: the zone covers 10% of the map and moves every 30 s; the next one shows 8 s early. */
export const AIR_EVERY = 30000;
export const AIR_PREVIEW = 8000;
/** seconds of air outside the zone */
export const AIR_SECS = 9;

/**
 * Feed the Beast: the beast asks for 6 different things, one after another (the first at 0:08, each
 * 5 s after the last is done); a happy beast gets restless again in 60 s. The stage lasts 2:30.
 */
export const FEEDS = 6;
export const FEED_FIRST = 8000;
export const FEED_GAP = 5000;
export const FEED_MS = 150000;
/** what the beast can ask for */
export type BeastWish = "snack" | "water" | "ball" | "pet" | "guard" | "gems";
export const WISH_ICON: Record<BeastWish, string> = {
  snack: "mode_feed", water: "beast_bucket", ball: "beast_ball", pet: "pk_heart", guard: "icon_sword", gems: "icon_gem",
};
export const WISH_ASK: Record<BeastWish, string> = {
  snack: "It's hungry! Bring it the snack",
  water: "It's thirsty! Carry the water bucket (don't get hit: it spills!)",
  ball: "It wants to play! Kick the ball into its cage",
  pet: "It's lonely! Stand by the cage to cuddle it",
  guard: "It's scared! Beat the monsters round the cage",
  gems: "It loves shiny things! Find 3 gems and bring them",
};
export const WISH_THANKS: Record<BeastWish, string> = { snack: "YUM!", water: "GLUG GLUG!", ball: "WHEE!", pet: "PURR...", guard: "PHEW!", gems: "SHINY!" };
/** cuddling takes this long; guarding means beating this many monsters; this many gems */
export const PET_MS = 4000;
export const GUARDS = 10;
export const GEMS = 3;
export const HUNGER_MS = 60000;
/** a beast fed 6 times helps you, so the boss is tougher */
export const FRIEND_BOSS_HP = 1.8;

/** Boss Battle: the big boss and its kids */
export const BIG_BOSS_HP = 1.5;
export const BOSS_KIDS = 3;
export const KID_HP = 0.3;
