/** Shared screen layout. The game is 1080 wide; height grows to fill tall phones. */
export const GAME_W = 1080;
export const BASE_H = 1920;
/** Height of the bottom UI (tabs content + nav bar). The battle gets everything above it. */
export const PANEL_H = 1060;
export const NAV_H = 170;

/** Tallest the battle gets; extra height on long phones goes to the UI below it. */
export const MAX_BATTLE_H = 1000;

export const battleHeight = (screenH: number) => Math.min(screenH - PANEL_H, MAX_BATTLE_H);
