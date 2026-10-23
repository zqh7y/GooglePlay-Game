import jua from "@fontsource/jua/files/jua-latin-400-normal.woff2?inline";

/**
 * Loads the game font from inside the bundle (no network needed, so it also works
 * offline in the Android app). Text drawn before this finishes would use a fallback font.
 */
export async function loadFonts(): Promise<void> {
  try {
    document.fonts.add(await new FontFace("Jua", `url(${jua})`).load());
  } catch {
    // fall back to system fonts
  }
}
