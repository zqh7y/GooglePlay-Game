/**
 * Testing tools for the developer. DEV_TOOLS shows the x1/x3 fight speed button for everyone
 * (with it off, the button shows only in developer mode: tap the Map title 5 times).
 * Turn it off before the game goes to the store.
 */
export const DEV_TOOLS = true;

/** Where the speed button sits during a fight (the battle ignores touches there). */
export const SPEED_BTN = { x: 1000, y: 470, w: 130, h: 84 };
/** The god mode button, under it. */
export const GOD_BTN = { x: 1000, y: 570, w: 130, h: 84 };

/** God mode (for testers): only with the developer tools or developer mode on. */
export const godMode = (dev: boolean, god: boolean): boolean => god && (DEV_TOOLS || dev);
