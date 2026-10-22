import lilita from "@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2?inline";
import fredoka from "@fontsource/fredoka/files/fredoka-latin-600-normal.woff2?inline";

/**
 * Loads the game fonts from inside the bundle (no network needed, so they also work
 * offline in the Android app). Text drawn before this finishes would use a fallback font.
 */
export async function loadFonts(): Promise<void> {
  const faces = [
    new FontFace("Lilita One", `url(${lilita})`),
    new FontFace("Fredoka", `url(${fredoka})`, { weight: "600" }),
  ];
  await Promise.all(
    faces.map(async (face) => {
      try {
        document.fonts.add(await face.load());
      } catch {
        // fall back to system fonts
      }
    }),
  );
}
