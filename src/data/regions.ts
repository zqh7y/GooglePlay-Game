/**
 * The five places of the main game, six stages each (see data/stages.ts): the Forest, Sakura,
 * Antarctica, the Moon and the Sea. Every place is an open arena with monsters from every side.
 */
export type RegionId = "forest" | "sakura" | "antarctica" | "moon" | "sea";

export interface Region {
  id: RegionId;
  name: string;
  /** first stage fought here */
  from: number;
  /** ground colours: base and two variations */
  ground: number;
  groundDark: number;
  groundLight: number;
  /** what the ground is sprinkled with */
  detail: "grass" | "wheat" | "moss" | "sand" | "snow" | "moon";
  /** colour of the crystal you protect */
  crystal: number;
  /** monster textures: two walkers and a flyer (the bosses are in data/bosses.ts) */
  enemies: [string, string, string];
  /** falling ambient particles: colour */
  ambient: number;
  /** big scenery (trees, rocks...) */
  trees: string[];
  /** small scenery */
  plants: string[];
}

export const REGIONS: Region[] = [
  {
    id: "forest", name: "Green Forest", from: 1,
    ground: 0x9fd36a, groundDark: 0x86c056, groundLight: 0xb6e080, detail: "grass", crystal: 0x5af08a,
    enemies: ["e_slime_g", "e_mush_r", "e_bat_p"], ambient: 0xd8ff8a,
    trees: ["tree_green", "tree_pine", "tree_green", "mushroom_big", "rock"], plants: ["bush", "flowers", "stump", "fern"],
  },
  {
    id: "sakura", name: "Sakura Valley", from: 7,
    ground: 0xb4dc84, groundDark: 0x9cc870, groundLight: 0xd8eca8, detail: "grass", crystal: 0xff7ab8,
    enemies: ["e_slime_pk", "e_mush_pk", "e_bat_pk"], ambient: 0xffb3d1,
    trees: ["tree_pink", "tree_pink", "tree_green", "rock"], plants: ["flowers", "bush", "flowers", "stump"],
  },
  {
    id: "antarctica", name: "Antarctica", from: 13,
    ground: 0xeef4fb, groundDark: 0xd8e6f4, groundLight: 0xffffff, detail: "snow", crystal: 0x7ad8ff,
    enemies: ["e_slime_i", "e_mush_w", "e_bat_i"], ambient: 0xffffff,
    trees: ["tree_snowpine", "tree_snowpine", "tree_snowround", "rock_snow"], plants: ["ice_spike", "rock_small", "ice_spike"],
  },
  {
    id: "moon", name: "The Moon", from: 19,
    ground: 0x9e9cb0, groundDark: 0x8a889e, groundLight: 0xb8b6c8, detail: "moon", crystal: 0xb87aff,
    enemies: ["e_alien", "e_mush_moon", "e_ufo"], ambient: 0xe8e0ff,
    trees: ["moon_rock", "moon_crystal", "moon_rock", "moon_rocket"], plants: ["moon_pebble", "moon_crystal_s", "moon_pebble"],
  },
  {
    id: "sea", name: "Sunny Sea", from: 25,
    ground: 0xf2dc9c, groundDark: 0xe4c884, groundLight: 0xfcecb8, detail: "sand", crystal: 0x4fd8ff,
    enemies: ["e_crab", "e_crab_b", "e_crow"], ambient: 0xffffff,
    trees: ["palm", "palm", "rock_sand", "palm"], plants: ["shell_pink", "starfish", "rock_small"],
  },
];

export const STAGES_PER_REGION = 6;

export const regionForStage = (stage: number) => REGIONS[Math.min(REGIONS.length - 1, Math.floor((stage - 1) / STAGES_PER_REGION))];
export const regionUnlocked = (r: Region, bestStage: number) => bestStage >= r.from;
