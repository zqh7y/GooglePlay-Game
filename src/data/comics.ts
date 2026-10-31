import type { ComicMood } from "../art/comic";

/**
 * The little manga between stages: the first time you start each of the first ten stages, a comic page
 * plays (about 5 s, tap to skip) in one of three layouts: the new place with a narration box, a close-up
 * of your face (its mood), the danger with a big sound effect and your line, then the stage's name.
 */
export interface Comic {
  /** what you say in the close-up */
  say: string;
  /** the narration box over the new place */
  caption: string;
  /** pictures that make up the new place (left to right) */
  place: string[];
  /** the place panel's sky / backdrop colour, and the close-up's halftone colour */
  sky: number;
  pop: number;
  /** your face in the close-up, and the big sound effect over the danger */
  mood: ComicMood;
  sfx: string;
}

export const COMICS: Record<number, Comic> = {
  1: { say: "Huh?! Where am I?", caption: "The dark woods... something is watching.", place: ["tree_green", "lantern", "tree_pink"], sky: 0x1a2a4a, pop: 0x7ac8ff, mood: "shock", sfx: "RUSTLE..." },
  2: { say: "A village! Finally!", caption: "But the Storm got here first...", place: ["house_a", "torch3d", "ruin"], sky: 0x2a2450, pop: 0xffd24a, mood: "happy", sfx: "CRACKLE!" },
  3: { say: "What was that ROAR?!", caption: "Something big is locked up in the village.", place: ["cage_front", "food_bowl"], sky: 0x2a1e44, pop: 0xffa040, mood: "scared", sfx: "ROOOAR!" },
  4: { say: "Uh oh... that's BIG.", caption: "The Storm's big boss has come for you!", place: ["boss"], sky: 0x3a1a2a, pop: 0xff5a5a, mood: "scared", sfx: "STOMP!" },
  5: { say: "I can smell the sea!", caption: "But a river cuts the path... and its bridge is broken!", place: ["palm", "plank", "bridge_broken"], sky: 0x1a3a5a, pop: 0x7ae6ff, mood: "happy", sfx: "SPLASH~" },
  6: { say: "All aboard!", caption: "A tiny boat. A big, angry sea.", place: ["sea_boat", "sea_whale"], sky: 0x1a4a7a, pop: 0x5ac8ff, mood: "determined", sfx: "WHOOSH!" },
  7: { say: "Land must be out there...", caption: "Sail on and find the big island!", place: ["sea_island", "sea_bigisland"], sky: 0x2a6a9a, pop: 0x8af06a, mood: "determined", sfx: "SPLOSH!" },
  8: { say: "An old lighthouse!", caption: "If it shone again, the Storm would be afraid.", place: ["brazier_lit", "lighthouse", "brazier"], sky: 0x1a1a3a, pop: 0xffe066, mood: "shock", sfx: "KRA-KOOM!" },
  9: { say: "The ground is shaking!", caption: "The volcano woke up... the island is breaking apart!", place: ["lighthouse_lit", "volcano_pro"], sky: 0x3a1a1a, pop: 0xff8a3a, mood: "scared", sfx: "RUMBLE!" },
  10: { say: "Hot hot HOT!", caption: "The eruption threw you into the volcano. Something stirs below...", place: ["volcano_pro", "b_magmaking"], sky: 0x3a1410, pop: 0xff7a2a, mood: "determined", sfx: "HISSSS!" },
};
