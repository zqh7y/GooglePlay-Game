/** Places you can travel to. Each has its own look, and pays (and hits) harder. */
export interface Theme {
  grass: number;
  grassDark: number;
  path: number;
  pathEdge: number;
  plaza: number;
  soil: number;
  water: number;
  /** tree textures used around the map */
  trees: string[];
  /** roof colours for houses */
  roofs: number[];
  wall: number;
  crops: string[];
  snow: boolean;
  barns: boolean;
  windmill: boolean;
  props: string[];
}

export interface AreaDef {
  id: string;
  name: string;
  /** best stage needed to travel here */
  unlock: number;
  cash: number;
  hp: number;
  theme: Theme;
}

export const AREAS: AreaDef[] = [
  {
    id: "village", name: "Sunny Village", unlock: 1, cash: 1, hp: 1,
    theme: {
      grass: 0xb9df7e, grassDark: 0x93c45e, path: 0xecd39b, pathEdge: 0xc9a46a, plaza: 0xe2dccf, soil: 0x9c6a43, water: 0x7fd3f0,
      trees: ["tree_green", "tree_pink", "tree_green"], roofs: [0xe8534f, 0x4f8fe8, 0xf0a030], wall: 0xfff0d8,
      crops: ["crop_wheat", "crop_carrot", "crop_cabbage"], snow: false, barns: false, windmill: false, props: ["crate", "barrel", "hay"],
    },
  },
  {
    id: "farm", name: "Harvest Farms", unlock: 10, cash: 6, hp: 4,
    theme: {
      grass: 0xd2e185, grassDark: 0xb0c25e, path: 0xe8c98a, pathEdge: 0xc29a5c, plaza: 0xe6d6b8, soil: 0x8f5c38, water: 0x7fd3f0,
      trees: ["tree_orange", "tree_green", "tree_yellow"], roofs: [0xc9423a, 0xe8853f], wall: 0xffe8c4,
      crops: ["crop_pumpkin", "crop_corn", "crop_wheat"], snow: false, barns: true, windmill: true, props: ["hay", "hay", "crate", "barrel"],
    },
  },
  {
    id: "woods", name: "Misty Woods", unlock: 25, cash: 50, hp: 25,
    theme: {
      grass: 0x8fc46a, grassDark: 0x6fa452, path: 0xcdb58a, pathEdge: 0xa08560, plaza: 0xc9c2b0, soil: 0x6e4a32, water: 0x6fbfd8,
      trees: ["tree_pine", "tree_dark", "tree_pine", "tree_dark"], roofs: [0x7a5236, 0x8a4f9e, 0x4f7a3e], wall: 0xe8d0a8,
      crops: ["crop_mushroom", "crop_cabbage"], snow: false, barns: false, windmill: false, props: ["stump", "rock", "barrel", "mushroom_big"],
    },
  },
  {
    id: "frost", name: "Frost Peak", unlock: 45, cash: 400, hp: 160,
    theme: {
      grass: 0xeef5fb, grassDark: 0xcfdeea, path: 0xc8d6e4, pathEdge: 0x9fb2c6, plaza: 0xd8e2ec, soil: 0x9fb2c6, water: 0xa8e4ff,
      trees: ["tree_snowpine", "tree_snowpine", "tree_snowround"], roofs: [0x4f8fe8, 0x8a5cd6, 0xe8534f], wall: 0xf4ecff,
      crops: ["crop_crystal"], snow: true, barns: false, windmill: false, props: ["snowman", "crate", "rock"],
    },
  },
];

export const AREA_BY_ID: Record<string, AreaDef> = Object.fromEntries(AREAS.map((a) => [a.id, a]));
