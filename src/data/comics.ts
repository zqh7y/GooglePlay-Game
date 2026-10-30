/**
 * The little manga between stages: the first time you start each of the first ten stages, two comic
 * panels play (about 5 s, tap to skip): a close-up of you saying something, then you arriving in the
 * new place with a narration box, then the stage's name is stamped on.
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
}

export const COMICS: Record<number, Comic> = {
  1: { say: "Huh?! Where am I?", caption: "The dark woods... something is watching.", place: ["tree_green", "lantern", "tree_pink"], sky: 0x1a2a4a, pop: 0x7ac8ff },
  2: { say: "A village! Finally!", caption: "But the Storm got here first...", place: ["house_a", "torch3d", "ruin"], sky: 0x2a2450, pop: 0xffd24a },
  3: { say: "What was that ROAR?!", caption: "Something big is locked up in the village.", place: ["cage_front", "food_bowl"], sky: 0x2a1e44, pop: 0xffa040 },
  4: { say: "Uh oh... that's BIG.", caption: "The Storm's big boss has come for you!", place: ["boss"], sky: 0x3a1a2a, pop: 0xff5a5a },
  5: { say: "I can smell the sea!", caption: "The path winds down to the beach.", place: ["palm", "pier", "palm"], sky: 0x1a3a5a, pop: 0x7ae6ff },
  6: { say: "All aboard!", caption: "A tiny boat. A big, angry sea.", place: ["sea_boat", "sea_whale"], sky: 0x1a4a7a, pop: 0x5ac8ff },
  7: { say: "Land must be out there...", caption: "Sail on and find the big island!", place: ["sea_island", "sea_bigisland"], sky: 0x2a6a9a, pop: 0x8af06a },
  8: { say: "An old lighthouse!", caption: "If it shone again, the Storm would be afraid.", place: ["brazier_lit", "lighthouse", "brazier"], sky: 0x1a1a3a, pop: 0xffe066 },
  9: { say: "The ground is shaking!", caption: "The volcano woke up... the island is breaking apart!", place: ["lighthouse_lit", "volcano_pro"], sky: 0x3a1a1a, pop: 0xff8a3a },
  10: { say: "Hot hot HOT!", caption: "The eruption threw you into the volcano. Something stirs below...", place: ["volcano_pro", "b_magmaking"], sky: 0x3a1410, pop: 0xff7a2a },
};
