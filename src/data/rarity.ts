/** Rarity tiers. Each tier holds 10 of the 100 pets (see data/pets.ts). */
export type Rarity =
  | "common" | "uncommon" | "rare" | "epic" | "legendary"
  | "mythic" | "divine" | "celestial" | "cosmic" | "secret";

export const RARITY_ORDER: Rarity[] = [
  "common", "uncommon", "rare", "epic", "legendary", "mythic", "divine", "celestial", "cosmic", "secret",
];

export const RARITY_INFO: Record<Rarity, { label: string; color: number; css: string }> = {
  common: { label: "Common", color: 0xb8ad9c, css: "#efe6d8" },
  uncommon: { label: "Uncommon", color: 0x7ccf5a, css: "#b6f59a" },
  rare: { label: "Rare", color: 0x4aa6ff, css: "#9fd2ff" },
  epic: { label: "Epic", color: 0xb06cff, css: "#dcb8ff" },
  legendary: { label: "Legendary", color: 0xffb22e, css: "#ffd775" },
  mythic: { label: "Mythic", color: 0xff5a8a, css: "#ff9fbd" },
  divine: { label: "Divine", color: 0xffd86b, css: "#fff1b3" },
  celestial: { label: "Celestial", color: 0x45d6d6, css: "#a8f7f7" },
  cosmic: { label: "Cosmic", color: 0x6a4dff, css: "#c2b3ff" },
  secret: { label: "Secret", color: 0xff7ad9, css: "#ffffff" },
};

export function rarityRank(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}

/** Rainbow colour that cycles over time. */
export function rainbowColor(time: number, offset = 0): number {
  const h = (((time / 1500 + offset) % 1) + 1) % 1;
  const ch = (n: number) => {
    const k = (n + h * 6) % 6;
    return Math.round(255 * (1 - 0.6 * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return (ch(5) << 16) | (ch(3) << 8) | ch(1);
}
