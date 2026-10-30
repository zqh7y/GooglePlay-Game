/**
 * The story: the first five stages are chapters, each with its own map and goal, played at night
 * (the Storm took the light). After stage 5 the stages go round the usual modes.
 *   1 WAKE UP      a long path through the dark woods: reach the village in 2:00 (a lantern on the way)
 *   2 THE VILLAGE  find the 20 dice lost in the ruined village in 4:00, then beat its boss
 *   3 THE BEAST    feed the caged beast: it must not break out
 *   4 BIG BOSS     the huge boss and its 3 kids, with the beast on your side: 3:00
 *   5 TO THE SEA   the path down to the sea (fishing opens)
 * Rolling (and pets) opens once stage 2 is cleared; fishing, the Boss Rush and Dice Rain after stage 5.
 */
export const STORY_STAGES = 5;

export interface StoryChapter {
  /** the chapter's name (the lobby, the start screen, the story card) */
  title: string;
  /** a line or two of story, shown on the card when the fight starts */
  tale: string;
  /** what to do, in a few words */
  goal: string;
  /** time limit in ms (0 = none) */
  limit: number;
  /** how dark the night is (0 = day, 1 = black) */
  dark: number;
  /** three pictures and words for the card: what happens */
  steps: [string, string][];
}

export const STORY: Record<number, StoryChapter> = {
  1: {
    title: "WAKE UP", tale: "You wake up alone in the dark woods. Monsters are coming out of the trees... Run to the village!",
    goal: "Reach the village!", limit: 120000, dark: 0.62,
    steps: [["hero", "RUN UP"], ["lantern", "LANTERN"], ["house_a", "VILLAGE"]],
  },
  2: {
    title: "THE VILLAGE", tale: "The Storm wrecked the village and its dice are lost in the dark. Find all 20 before time runs out!",
    goal: "Find 20 dice!", limit: 240000, dark: 0.58,
    steps: [["die_A", "FIND 20"], ["torch3d", "TORCHES"], ["mode_boss", "BOSS"]],
  },
  3: {
    title: "THE BEAST", tale: "A hungry beast is locked in a cage. Bring it snacks and it will be your friend. Don't let it break out!",
    goal: "Feed the beast!", limit: 0, dark: 0.55,
    steps: [["mode_feed", "GRAB"], ["beast_cage", "FEED x6"], ["pk_heart", "FRIEND!"]],
  },
  4: {
    title: "BIG BOSS", tale: "The Storm's big boss and its 3 kids! Your beast fights with you. Beat the big boss in 3:00!",
    goal: "Beat the big boss!", limit: 180000, dark: 0.5,
    steps: [["mode_boss", "BIG BOSS"], ["mode_feed", "BEAST HELPS"], ["icon_clock", "3:00"]],
  },
  5: {
    title: "TO THE SEA", tale: "Your beast went home. Follow the path through the woods down to the sea!",
    goal: "Reach the sea!", limit: 170000, dark: 0.6,
    steps: [["hero", "RUN UP"], ["mode_boss", "2 BOSSES"], ["icon_fish", "THE SEA"]],
  },
};

export const storyFor = (stage: number): StoryChapter | null => STORY[stage] ?? null;

/** Story paths: when the bosses come down the path (ms into the run) and where the lantern lies (share of the way). */
export const PATH_BOSSES: Record<number, number[]> = { 1: [45000, 90000], 5: [50000, 105000] };
export const LANTERN_AT = 0.2;
/** the village: dice to find */
export const HUNT_DICE = 20;

/** What opens as you go: the stage you must have reached (bestStage) */
export const ROLL_OPEN = 3;
export const STORY_DONE = STORY_STAGES + 1;
export const rollOpen = (best: number) => best >= ROLL_OPEN;
/** fishing, the Boss Rush and the Dice Rain event */
export const storyDone = (best: number) => best >= STORY_DONE;
