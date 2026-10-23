/**
 * The world is one big map split into five lands. Each land holds 20 stages: monsters
 * pour out of portals and attack that land's heart (fountain, windmill, great tree...).
 * A land is covered in clouds until your best stage reaches it.
 */
export type RegionId = "village" | "farm" | "woods" | "desert" | "frost";

export interface Region {
  id: RegionId;
  name: string;
  /** first stage fought here */
  from: number;
  /** centre of the land, where its heart stands */
  heart: [number, number];
  heartTex: string;
  /** ground colour */
  ground: number;
  road: number;
  roadEdge: number;
  plaza: number;
  /** monster textures: two walkers and a flyer, plus the boss */
  enemies: [string, string, string];
  boss: string;
  /** falling ambient particles: colour */
  ambient: number;
  trees: string[];
}

export const REGIONS: Region[] = [
  {
    id: "village", name: "Sunny Village", from: 1, heart: [2000, 2050], heartTex: "fountain",
    ground: 0x9fd36a, road: 0xe6d3a3, roadEdge: 0xb89a68, plaza: 0xe4ddcc,
    enemies: ["e_slime_g", "e_mush_r", "e_bat_p"], boss: "e_golem", ambient: 0xffc4d6,
    trees: ["tree_green", "tree_pink", "tree_green", "bush"],
  },
  {
    id: "farm", name: "Harvest Farms", from: 21, heart: [3250, 2250], heartTex: "windmill",
    ground: 0xc4d670, road: 0xd9b47a, roadEdge: 0xa8824e, plaza: 0xe0c99a,
    enemies: ["e_slime_o", "e_mush_b", "e_crow"], boss: "e_pumpking", ambient: 0xffa64d,
    trees: ["tree_orange", "tree_yellow", "tree_green"],
  },
  {
    id: "woods", name: "Misty Woods", from: 41, heart: [2050, 820], heartTex: "great_tree",
    ground: 0x6fae58, road: 0xb89a6a, roadEdge: 0x86683e, plaza: 0x9fc27a,
    enemies: ["e_slime_v", "e_mush_c", "e_bat_d"], boss: "e_treant", ambient: 0xd8ff8a,
    trees: ["tree_pine", "tree_dark", "tree_pine", "mushroom_big"],
  },
  {
    id: "desert", name: "Sunset Dunes", from: 61, heart: [780, 3120], heartTex: "obelisk",
    ground: 0xecd08a, road: 0xd9a868, roadEdge: 0xb07e44, plaza: 0xe8c898,
    enemies: ["e_slime_s", "e_cactus", "e_vulture"], boss: "e_scorpion", ambient: 0xffe2a8,
    trees: ["palm", "cactus_big", "cactus_big", "rock_sand"],
  },
  {
    id: "frost", name: "Frost Peak", from: 81, heart: [720, 860], heartTex: "ice_crystal",
    ground: 0xeef4fb, road: 0xc4d4e6, roadEdge: 0x94aac4, plaza: 0xd6e4f2,
    enemies: ["e_slime_i", "e_mush_w", "e_bat_i"], boss: "e_yeti", ambient: 0xffffff,
    trees: ["tree_snowpine", "tree_snowpine", "tree_snowround"],
  },
];

export const STAGES_PER_REGION = 20;

export const regionForStage = (stage: number) => REGIONS[Math.min(REGIONS.length - 1, Math.floor((stage - 1) / STAGES_PER_REGION))];
export const regionUnlocked = (r: Region, bestStage: number) => bestStage >= r.from;
