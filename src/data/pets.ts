/**
 * The 100 collectable pets, from most common to rarest.
 * Each row: name, species, body colour, accent colour ("" = automatic),
 * accessories, body pattern, eye style.
 *
 * Their "1 in N" chance comes from their position in this list:
 * the first is 1 in 2 and the last is 1 in 500Sp (5e26).
 * Every 10 pets is one rarity tier (Common, Uncommon, ... Secret).
 */
export type Species =
  | "blob" | "bunny" | "cat" | "pup" | "bird" | "frog" | "snail" | "cricket" | "bat" | "fish"
  | "beetle" | "hamster" | "bear" | "fox" | "penguin" | "ghost" | "dragon" | "axolotl" | "turtle" | "owl";

export type PetRow = [name: string, species: Species, color: string, accent: string, accs: string, pattern: string, eyes: string];

export const PET_ROWS: PetRow[] = [
  // Common
  ["Gumdrop", "blob", "#ffd34d", "", "", "", ""],
  ["Mochi", "bunny", "#f7efe6", "#ffc2d4", "", "", ""],
  ["Pip", "bird", "#ff9a4a", "#ffe0b8", "", "", ""],
  ["Kitty", "cat", "#f4b26a", "#ffe2c2", "", "", ""],
  ["Puppy", "pup", "#e6c59f", "#fff2e0", "", "", ""],
  ["Froggy", "frog", "#8fd46b", "#e9f7c8", "", "", ""],
  ["Shelly", "snail", "#f2d6a2", "#c98a5a", "", "", ""],
  ["Hammy", "hamster", "#f5c58a", "#fff3e0", "", "", ""],
  ["Chirpy", "cricket", "#86c25e", "#5d9a3e", "", "", ""],
  ["Bubbles", "fish", "#ff7a5a", "#ffc36b", "", "", ""],
  // Uncommon
  ["Sprout Blob", "blob", "#9bdc5a", "", "sprout", "", ""],
  ["Blossom", "bunny", "#ffc8dc", "#fff0f5", "flower", "", "happy"],
  ["Bluebird", "bird", "#6fb8ff", "#e2f2ff", "", "", ""],
  ["Tabby", "cat", "#e89a4a", "#fff0dc", "", "stripes", ""],
  ["Spotty", "pup", "#f5efe6", "#ffffff", "", "spots", ""],
  ["Teddy", "bear", "#c48a5a", "#f2d2ae", "", "", ""],
  ["Kit Fox", "fox", "#f08a3c", "#fff4e6", "", "", ""],
  ["Waddles", "penguin", "#3d4a6b", "#ffffff", "", "", ""],
  ["Batty", "bat", "#8a6ad0", "#5f45a0", "", "", ""],
  ["Shelldon", "turtle", "#9ad46e", "#5f9a48", "", "", ""],
  // Rare
  ["Axie", "axolotl", "#ffb3c8", "#ff7aa2", "", "", ""],
  ["Stag Beetle", "beetle", "#9a6440", "#5a3a26", "", "", ""],
  ["Hooty", "owl", "#b48a64", "#f2dcc0", "", "", ""],
  ["Booboo", "ghost", "#f4f0ff", "#c9bfff", "", "", ""],
  ["Bow Kitty", "cat", "#ffd6e6", "#ffffff", "bow", "", ""],
  ["Lily Frog", "frog", "#6cc45a", "#e3f5c0", "flower", "", "happy"],
  ["Coral Fish", "fish", "#ff8fb0", "#7fe0e8", "", "spots", ""],
  ["Toadstool Snail", "snail", "#f6e2c0", "#e8534f", "", "spots", ""],
  ["Beanie Pup", "pup", "#d9a066", "#ffefd9", "beanie", "", ""],
  ["Panda", "bear", "#f7f3ee", "#2f2a33", "", "panda", ""],
  // Epic
  ["Ember Blob", "blob", "#ff7a3d", "", "flame", "", ""],
  ["Frost Bunny", "bunny", "#bfefff", "#ffffff", "crystal", "frost", ""],
  ["Thunder Bird", "bird", "#ffd23f", "#fff6c2", "bolt", "", ""],
  ["Wizard Frog", "frog", "#66c27a", "#e3f5c0", "wizard", "", ""],
  ["Baby Dragon", "dragon", "#7cd36a", "#fff0b0", "", "", ""],
  ["Snow Fox", "fox", "#eef6ff", "#ffffff", "", "frost", ""],
  ["Lava Beetle", "beetle", "#e8432e", "#5a2420", "", "cracks", ""],
  ["Night Owl", "owl", "#4a4a8a", "#9fa8e8", "moon", "", "glow"],
  ["Pumpkin Ghost", "ghost", "#ffa23c", "#ffd36b", "sprout", "", "happy"],
  ["Sakura Axolotl", "axolotl", "#ffc0d6", "#ff8fb8", "flower", "", "happy"],
  // Legendary
  ["King Hammy", "hamster", "#f5c58a", "#fff3e0", "crown", "", "happy"],
  ["Fire Dragon", "dragon", "#ff6a3a", "#ffd36b", "flame", "", ""],
  ["Crystal Turtle", "turtle", "#8fe8ff", "#4fb8e8", "crystal", "", ""],
  ["Golden Fish", "fish", "#ffcc33", "#fff1a8", "", "gold", ""],
  ["Storm Bat", "bat", "#4f5f90", "#2f3a66", "bolt", "", "glow"],
  ["Royal Kitty", "cat", "#fff0f6", "#ffd6e6", "crown", "", ""],
  ["Moon Bunny", "bunny", "#4a56a0", "#9fa8e8", "moon", "stars", ""],
  ["Ice Dragon", "dragon", "#9fe3ff", "#ffffff", "crystal", "frost", ""],
  ["Shadow Cat", "cat", "#4b3a78", "#7a66b8", "", "", "glow"],
  ["Ruby Beetle", "beetle", "#d9304a", "#7a1a2a", "crown", "gold", ""],
  // Mythic
  ["Angel Blob", "blob", "#fff8e6", "", "halo,wings", "", "happy"],
  ["Demon Pup", "pup", "#c23b4a", "#ff8a8a", "horns,batwings", "", "glow"],
  ["Phantom", "ghost", "#6a5acd", "#3a2f8a", "", "", "glow"],
  ["Star Bird", "bird", "#ffe066", "#fff8d0", "star", "stars", ""],
  ["Thunder Dragon", "dragon", "#ffd23f", "#fff6c2", "bolt", "", ""],
  ["Diamond Bear", "bear", "#aeefff", "#e8fbff", "crystal", "frost", ""],
  ["Flame Penguin", "penguin", "#c8372a", "#ffe0c0", "flame", "", ""],
  ["Galaxy Fox", "fox", "#3a3a8c", "#8f8fe8", "", "galaxy", ""],
  ["Elder Turtle", "turtle", "#c9b27a", "#6f8f4a", "sprout", "", "happy"],
  ["King Frog", "frog", "#5fbf5a", "#e3f5c0", "crown", "", ""],
  // Divine
  ["Holy Bunny", "bunny", "#fffbe8", "#ffe7a8", "halo,wings", "", "happy"],
  ["Seraph Owl", "owl", "#fff4d6", "#ffe0a0", "halo,wings", "", ""],
  ["Sunfish", "fish", "#ffb02e", "#fff1a8", "crown", "gold", ""],
  ["Spirit Fox", "fox", "#bff0ff", "#ffffff", "halo", "", "glow"],
  ["Royal Dragon", "dragon", "#b06cff", "#ffe0a0", "crown", "", ""],
  ["Ghost King", "ghost", "#e6e0ff", "#b8a8ff", "crown", "", "glow"],
  ["Inferno Bear", "bear", "#d93a2a", "#ffb36b", "flame", "cracks", ""],
  ["Opal Axolotl", "axolotl", "#e8d8ff", "#b9a0ff", "crystal", "stars", ""],
  ["Gilded Beetle", "beetle", "#ffcc33", "#b8860b", "halo", "gold", ""],
  ["Halo Hammy", "hamster", "#fff2cc", "#ffffff", "halo,wings", "", "happy"],
  // Celestial
  ["Lunar Cat", "cat", "#2f3a7a", "#8f9ae8", "moon", "stars", ""],
  ["Comet Bird", "bird", "#9fb8ff", "#e8eeff", "star", "stars", "star"],
  ["Solar Dragon", "dragon", "#ffa62e", "#fff1a8", "crown,flame", "gold", ""],
  ["Starlight Pup", "pup", "#fff0a8", "#ffffff", "star", "stars", "happy"],
  ["Nebula Bat", "bat", "#5a3a9a", "#2f1f66", "", "galaxy", "glow"],
  ["Crystal Fox", "fox", "#c2f5ff", "#ffffff", "crystal", "frost", "star"],
  ["Astro Penguin", "penguin", "#2a2a5e", "#e8eeff", "star", "galaxy", ""],
  ["Celestial Bunny", "bunny", "#fffbe8", "#ffe7a8", "halo,moon", "stars", "star"],
  ["Chrono Owl", "owl", "#8fd4c8", "#e0fff8", "wizard", "stars", ""],
  ["Eclipse Cat", "cat", "#1f1f2f", "#4a4a6a", "moon", "", "glow"],
  // Cosmic
  ["Cosmic Blob", "blob", "#2a2a6e", "", "star", "galaxy", "star"],
  ["Void Dragon", "dragon", "#2a1a4a", "#6a4dff", "halo", "galaxy", "glow"],
  ["Titan Bear", "bear", "#ffd23f", "#fff1a8", "crown", "gold", ""],
  ["Quasar Fish", "fish", "#5ad1ff", "#b36bff", "bolt", "galaxy", "glow"],
  ["Seraph Fox", "fox", "#fff8e6", "#ffe7a8", "halo,wings", "gold", "happy"],
  ["Galaxy Turtle", "turtle", "#6a4dff", "#2f2a7a", "crystal", "galaxy", ""],
  ["Supernova Bird", "bird", "#ff7a2e", "#ffe066", "flame", "stars", "glow"],
  ["Omega Ghost", "ghost", "#1a1530", "#6a4dff", "crown", "galaxy", "glow"],
  ["Astral Axolotl", "axolotl", "#6a4dff", "#ff8fd8", "star", "galaxy", "star"],
  ["Meteor Beetle", "beetle", "#3a2a5a", "#ff7a2e", "flame", "cracks", "glow"],
  // Secret
  ["Emperor Frog", "frog", "#ffd23f", "#fff6c2", "crown", "gold", "happy"],
  ["Chaos Dragon", "dragon", "#8a1a3a", "#ff4a6a", "horns,batwings", "cracks", "glow"],
  ["Heavenly Pup", "pup", "#fffbe8", "#ffe7a8", "halo,wings", "gold", "happy"],
  ["Big Bang Bear", "bear", "#2a1f5a", "#ff7ad9", "star", "galaxy", "star"],
  ["Eternal Owl", "owl", "#fff6dc", "#ffd36b", "halo,wings", "gold", "star"],
  ["Paradox Cat", "cat", "#1a1a2e", "#6a4dff", "halo,batwings", "galaxy", "glow"],
  ["Infinity Snail", "snail", "#e8f0ff", "#4a2fa0", "crown", "galaxy", "star"],
  ["Genesis Dragon", "dragon", "#fff4d6", "#ffd36b", "halo,wings", "gold", "star"],
  ["Omniverse Blob", "blob", "#12102a", "", "crown,wings", "galaxy", "glow"],
  ["The Golden Cat", "cat", "#ffc933", "#fff1a8", "crown,star", "gold", "happy"],
];
