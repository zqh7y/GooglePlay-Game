/**
 * Five lands, 20 stages each. Every land is an open nature arena with a glowing crystal in
 * the middle that you protect; monsters come in from every side.
 */
export type RegionId = "village" | "farm" | "woods" | "desert" | "frost";

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
  detail: "grass" | "wheat" | "moss" | "sand" | "snow";
  /** colour of the crystal you protect */
  crystal: number;
  /** monster textures: two walkers and a flyer, plus the boss */
  enemies: [string, string, string];
  boss: string;
  /** falling ambient particles: colour */
  ambient: number;
  /** big scenery (trees, rocks...) */
  trees: string[];
  /** small scenery */
  plants: string[];
}

export const REGIONS: Region[] = [
  {
    id: "village", name: "Sunny Meadow", from: 1,
    ground: 0x9fd36a, groundDark: 0x86c056, groundLight: 0xb6e080, detail: "grass", crystal: 0xff7ab8,
    enemies: ["e_slime_g", "e_mush_r", "e_bat_p"], boss: "e_golem", ambient: 0xffc4d6,
    trees: ["tree_green", "tree_pink", "tree_green", "rock"], plants: ["bush", "flowers", "flowers", "stump"],
  },
  {
    id: "farm", name: "Golden Fields", from: 21,
    ground: 0xc9d672, groundDark: 0xb4c25a, groundLight: 0xdce48c, detail: "wheat", crystal: 0xffc93a,
    enemies: ["e_slime_o", "e_mush_b", "e_crow"], boss: "e_pumpking", ambient: 0xffa64d,
    trees: ["tree_orange", "tree_yellow", "tree_orange", "rock"], plants: ["pumpkin", "hay", "flowers", "bush"],
  },
  {
    id: "woods", name: "Misty Forest", from: 41,
    ground: 0x6aa852, groundDark: 0x5a9446, groundLight: 0x80b866, detail: "moss", crystal: 0x5af08a,
    enemies: ["e_slime_v", "e_mush_c", "e_bat_d"], boss: "e_treant", ambient: 0xd8ff8a,
    trees: ["tree_pine", "tree_dark", "tree_pine", "mushroom_big"], plants: ["stump", "logs", "fern", "bush"],
  },
  {
    id: "desert", name: "Sunset Dunes", from: 61,
    ground: 0xecd08a, groundDark: 0xdcbc72, groundLight: 0xf6e2a8, detail: "sand", crystal: 0x4ff0d8,
    enemies: ["e_slime_s", "e_cactus", "e_vulture"], boss: "e_scorpion", ambient: 0xffe2a8,
    trees: ["cactus_big", "palm", "rock_sand", "cactus_big"], plants: ["skull", "rock_small", "dry_bush"],
  },
  {
    id: "frost", name: "Frost Peak", from: 81,
    ground: 0xeef4fb, groundDark: 0xd8e6f4, groundLight: 0xffffff, detail: "snow", crystal: 0x7ad8ff,
    enemies: ["e_slime_i", "e_mush_w", "e_bat_i"], boss: "e_yeti", ambient: 0xffffff,
    trees: ["tree_snowpine", "tree_snowpine", "tree_snowround", "rock_snow"], plants: ["ice_spike", "rock_small", "dry_bush", "ice_spike"],
  },
];

export const STAGES_PER_REGION = 20;

export const regionForStage = (stage: number) => REGIONS[Math.min(REGIONS.length - 1, Math.floor((stage - 1) / STAGES_PER_REGION))];
export const regionUnlocked = (r: Region, bestStage: number) => bestStage >= r.from;
