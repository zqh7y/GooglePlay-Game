/** Design width; the height grows to fill taller phones (Scale.EXPAND). */
export const GAME_W = 1080;
export const BASE_H = 1920;

export interface Layout {
  H: number;
  /** bottom of the top bar on the battle screen */
  hudBottom: number;
  /** bottom of the slim top bar on the other screens */
  headerBottom: number;
  /** top of the bottom tab bar */
  navTop: number;
  navH: number;
}

export function layoutFor(H: number): Layout {
  const navH = 196;
  return { H, hudBottom: 330, headerBottom: 300, navTop: H - navH, navH };
}
