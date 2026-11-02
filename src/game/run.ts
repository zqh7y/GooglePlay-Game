import { REGIONS, regionForStage } from "../data/regions";
import { StageMode, chapterInfo, chapterMode, modeForStage, stageInfo } from "../data/modes";
import { power } from "../data/stages";
import { StoryChapter, chapterPower, storyFor } from "../data/story";
import { save } from "../systems/save";

/**
 * What is being played: a main stage (save.stage) or a story chapter (run.chapter, from the STORY card).
 * A chapter is played without touching your main stage, and it ends back in the lobby.
 */
export const run = { chapter: 0 };

/** the mode of what you are playing */
export const playMode = (): StageMode => (run.chapter ? chapterMode(run.chapter) : modeForStage(save.stage));
export const playInfo = () => (run.chapter ? chapterInfo(run.chapter) : stageInfo(save.stage));
/** the story chapter's script (only in a story run) */
export const playStory = (): StoryChapter | null => (run.chapter ? storyFor(run.chapter) : null);
/** where it is played: a chapter in the Forest, a main stage in its place */
export const playLand = () => (run.chapter ? REGIONS[0] : regionForStage(save.stage));
/**
 * How strong everything is (monsters, your health, rewards, bosses): main stages on the old 1-100 curve
 * (see data/stages.ts power), chapters at theirs (data/story.ts chapterPower).
 */
export const pw = (): number => (run.chapter ? chapterPower(run.chapter) : power(save.stage));
