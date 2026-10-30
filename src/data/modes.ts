import { STORY_STAGES, storyFor } from "./story";

/**
 * Every stage has a mode. The first five are the story (see data/story.ts): 1 Path to the village,
 * 2 Village hunt, 3 Feed the Beast, 4 Boss Battle, 5 Path to the sea. From stage 6 the modes go
 * round a cycle of nine: the Sea (6), Land Ho! (7), the Lighthouse (8), Quake Island (9), the Volcano (10),
 * Crystal, Feed the Beast, Air Zone, Boss Battle, and again.
 */
export type StageMode = "air" | "crystal" | "feed" | "dice" | "boss" | "path" | "hunt" | "sea" | "ocean" | "light" | "quake" | "volcano";

/** Dice Rain is not in the cycle: it is the beginners' event (see DICE_EVENT_DAYS) */
export const MODE_ORDER: StageMode[] = ["sea", "ocean", "light", "quake", "volcano", "crystal", "feed", "air", "boss"];

/** New players get the Dice Rain event for their first two weeks. */
export const DICE_EVENT_DAYS = 14;

const STORY_MODES: StageMode[] = ["path", "hunt", "feed", "boss", "path"];

export const modeForStage = (stage: number): StageMode =>
  stage <= STORY_STAGES ? STORY_MODES[Math.max(1, stage) - 1] : MODE_ORDER[(stage - STORY_STAGES - 1) % MODE_ORDER.length];

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
    goal: "Find the dice!",
  },
};

/** The mode's info for a stage: story chapters use their own name, banner and goal. */
export function stageInfo(stage: number): ModeInfo {
  const info = MODE_INFO[modeForStage(stage)];
  const ch = storyFor(stage);
  return ch ? { ...info, name: ch.title, banner: ch.title, goal: ch.goal } : info;
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
