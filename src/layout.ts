/** Shared screen layout. The game is 1080 wide; height grows to fill tall phones. */
export const GAME_W = 1080;
export const BASE_H = 1920;

export interface Layout {
  H: number;
  /** bottom edge of the top HUD */
  hudBottom: number;
  /** where the hero stands (feet) */
  catX: number;
  catY: number;
  /** y of the cliff edge at the left and right side of the screen */
  cliffLeft: number;
  cliffRight: number;
  /** centre of the first side button */
  sideTop: number;
  /** centre of the round pet slots row */
  slotsY: number;
  /** centre of the roll button row */
  rollY: number;
  /** centre of the bottom card row */
  cardsY: number;
}

export function layoutFor(H: number): Layout {
  const hudBottom = 330;
  const cliffLeft = Math.round(H * 0.62);
  const cliffRight = Math.round(H * 0.53);
  return {
    H,
    hudBottom,
    catX: 540,
    catY: Math.round(hudBottom + (cliffRight - hudBottom) * 0.76),
    cliffLeft,
    cliffRight,
    sideTop: H - 515 - 590,
    slotsY: H - 515,
    rollY: H - 342,
    cardsY: H - 135,
  };
}
