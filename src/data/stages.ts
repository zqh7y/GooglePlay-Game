import type { StageMode } from "./modes";

/**
 * The main game: 30 stages in 5 places (Forest, Sakura, Antarctica, Moon, Sea), 6 stages in each.
 * Five modes take turns (Guard, Dice Hunt, Air Zone, Dice Rain, Boss Battle: every 5th stage is a
 * Boss Battle). Every stage lasts 3:00 and something happens each minute: at 1:00 the stage's own
 * twist (no two stages have the same one), at 2:00 its place's event, at 3:00 the boss.
 * The story (data/story.ts, chapters 1-10) is played on the side for rewards.
 */
export const LAST_STAGE = 30;
export const STAGES_PER_PLACE = 6;
export const MAIN_MODES: StageMode[] = ["crystal", "hunt", "air", "dice", "boss"];
export const mainMode = (stage: number): StageMode => MAIN_MODES[(Math.max(1, stage) - 1) % MAIN_MODES.length];

/** How strong a stage is on the old 1-100 difficulty curve: gentle early, steeper later. */
const POWER = [1, 2, 3, 6, 8, 10, 12, 13, 14, 16, 17, 19, 20, 21, 22, 23, 26, 30, 33, 36, 39, 42, 48, 58, 70, 82, 91, 97, 99, 100];
export const power = (stage: number) => POWER[Math.min(LAST_STAGE, Math.max(1, Math.round(stage))) - 1];

/** Dice to find in a Dice Hunt. */
export const MAIN_HUNT_DICE = 12;

export type TwistKind =
  | "chest" | "golden" | "bloom" | "diceShower" | "frenzy" | "dark" | "petals" | "fireworks" | "totem" | "bombs"
  | "swarm" | "icicles" | "slippery" | "giant" | "magnet" | "lowgrav" | "meteors" | "ufo" | "crabs" | "lightning";

export interface Twist {
  kind: TwistKind;
  /** its name (the banner at 1:00) and what to do */
  name: string;
  tip: string;
  icon: string;
}

/** Each stage's own twist (stage 1 is the first). */
export const TWISTS: Twist[] = [
  // Forest
  { kind: "chest", name: "LUCKY CHEST", tip: "A treasure chest fell! Stand on it to open it", icon: "chest" },
  { kind: "golden", name: "GOLDEN SLIME", tip: "Catch the golden slime before it runs away!", icon: "die_S" },
  { kind: "bloom", name: "HEALING BLOOM", tip: "Hearts grew all around: grab them!", icon: "pk_heart" },
  { kind: "diceShower", name: "DICE SHOWER", tip: "Dice are falling from the sky: grab them!", icon: "die_A" },
  { kind: "frenzy", name: "MUSHROOM FRENZY", tip: "The monsters are going wild: keep moving!", icon: "e_mush_r" },
  { kind: "dark", name: "FIREFLY NIGHT", tip: "Night falls on the forest... stay near the light", icon: "lantern" },
  // Sakura
  { kind: "petals", name: "PETAL STORM", tip: "The blossoms heal you while they fall", icon: "tree_pink" },
  { kind: "fireworks", name: "FIREWORKS", tip: "Fireworks blast the monsters!", icon: "icon_star" },
  { kind: "totem", name: "LANTERN TOTEM", tip: "Stand by the lantern totem for double damage!", icon: "torch3d" },
  { kind: "bombs", name: "CHERRY BOMBS", tip: "Monsters burst when they fall: start a chain!", icon: "pk_bomb" },
  { kind: "golden", name: "GOLDEN KOI", tip: "A golden spirit swims by: catch it!", icon: "die_S" },
  { kind: "swarm", name: "SPIRIT SWARM", tip: "A swarm of little spirits! Cut through them", icon: "e_bat_pk" },
  // Antarctica
  { kind: "icicles", name: "ICICLE RAIN", tip: "Icicles are falling: watch the circles!", icon: "icon_bolt" },
  { kind: "slippery", name: "SLIPPERY ICE", tip: "The ice is slippery: you slide when you stop!", icon: "e_slime_i" },
  { kind: "giant", name: "FROZEN GIANT", tip: "A giant woke up! Beat it for a treasure", icon: "e_mush_w" },
  { kind: "dark", name: "POLAR NIGHT", tip: "The long night falls... stay near the light", icon: "lantern" },
  { kind: "chest", name: "ICE CHEST", tip: "A frozen chest! Stand on it to open it", icon: "chest" },
  { kind: "magnet", name: "AURORA MAGNET", tip: "The aurora pulls every gem to you!", icon: "pk_magnet" },
  // Moon
  { kind: "lowgrav", name: "LOW GRAVITY", tip: "You bounce fast, they float slow!", icon: "e_alien" },
  { kind: "meteors", name: "METEOR SHOWER", tip: "Meteors! Watch the circles", icon: "meteor_a" },
  { kind: "ufo", name: "UFO BEAM", tip: "A UFO beams the monsters up: lead them under it!", icon: "e_ufo" },
  { kind: "diceShower", name: "STAR SHOWER", tip: "Star dice are falling: grab them!", icon: "die_S" },
  { kind: "frenzy", name: "MOON FRENZY", tip: "The aliens are going wild: keep moving!", icon: "e_alien" },
  { kind: "swarm", name: "ALIEN SWARM", tip: "A swarm of little saucers! Cut through them", icon: "e_ufo" },
  // Sea
  { kind: "crabs", name: "CRAB MARCH", tip: "An army of crabs is marching in!", icon: "e_crab" },
  { kind: "lightning", name: "THUNDERSTORM", tip: "Lightning strikes! Watch the circles", icon: "icon_bolt" },
  { kind: "giant", name: "PIRATE GIANT", tip: "A giant pirate crab! Beat it for a treasure", icon: "e_crab_b" },
  { kind: "bloom", name: "SEASHELL HEARTS", tip: "Hearts washed up on the beach: grab them!", icon: "pk_heart" },
  { kind: "bombs", name: "BUBBLE BOMBS", tip: "Monsters pop when they fall: start a chain!", icon: "pk_bomb" },
  { kind: "lightning", name: "THE LAST STORM", tip: "The last storm: lightning everywhere!", icon: "icon_bolt" },
];

export const twistFor = (stage: number): Twist => TWISTS[Math.min(LAST_STAGE, Math.max(1, stage)) - 1];

/** What each place throws at you at 2:00. */
export type PlaceEventKind = "stampede" | "wind" | "blizzard" | "comets" | "tide";

export interface PlaceEvent {
  kind: PlaceEventKind;
  name: string;
  tip: string;
}

export const PLACE_EVENTS: Record<string, PlaceEvent> = {
  forest: { kind: "stampede", name: "STAMPEDE!", tip: "A herd is charging through: get out of the way!" },
  sakura: { kind: "wind", name: "SPRING WIND!", tip: "A strong wind blows you sideways!" },
  antarctica: { kind: "blizzard", name: "BLIZZARD!", tip: "A blizzard slows you down... icicles fall!" },
  moon: { kind: "comets", name: "COMET STORM!", tip: "Comets are raining down: keep moving!" },
  sea: { kind: "tide", name: "HIGH TIDE!", tip: "The tide brings crabs from every side!" },
};
