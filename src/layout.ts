/** Design width; the height grows to fill taller phones (Scale.EXPAND). */
export const GAME_W = 1080;
export const BASE_H = 1920;

export interface Layout {
  H: number;
  /** bottom of the top bar on the battle screen */
  hudBottom: number;
  /** bottom of the slim top bar (money, gems, dice) on the other screens */
  headerBottom: number;
  /** top of the bottom tab bar */
  navTop: number;
  navH: number;
}

export function layoutFor(H: number): Layout {
  const navH = 196;
  return { H, hudBottom: 330, headerBottom: 124, navTop: H - navH, navH };
}

/** The slim top bar on the menus: one row of settings, money, gems and dice (x positions). */
export const TOP_Y = 70;
export const TOP_ROW = { gear: 54, cash: 290, gems: 600, dice: 890 };
