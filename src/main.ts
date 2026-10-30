import { loadFonts } from "./fonts";
import { collectMissing, installTextHook, loadLang, missing } from "./i18n";

/**
 * Start-up: the 3D loading screen shows while the game loads behind it. New players then see the
 * story intro once. `?nointro` starts the game straight away (tests); `?intro` always shows the story.
 */
const params = new URLSearchParams(location.search);
const nextFrame = () => new Promise<void>((res) => requestAnimationFrame(() => res()));

async function main(): Promise<void> {
  await loadFonts();
  // the player's language (set before any text is drawn)
  await loadLang();
  if (params.has("i18ncheck")) {
    collectMissing();
    (window as unknown as { __missing: Set<string> }).__missing = missing;
  }
  installTextHook();
  const gameModule = import("./game");
  if (params.has("nointro")) {
    (await gameModule).startGame();
    return;
  }
  const intro = await import("./intro/intro").then((m) => m.openIntro()).catch((e) => {
    console.warn("Intro failed to start:", e);
    return null;
  });
  intro?.progress(0.3);
  // let the loading screen draw before the game's start-up work takes over
  await nextFrame();
  await nextFrame();
  const g = await gameModule;
  intro?.progress(0.45);
  const { game, ready } = g.startGame((f) => intro?.progress(f));
  if (!intro) return;
  await ready;
  // the game waits, frozen, until the player taps in
  game.loop.sleep();
  intro.done();
  await intro.waitTap();
  if (!g.save.introSeen || params.has("intro")) {
    await intro.story(g.STORY_PETS.map(g.petPicture));
    g.save.introSeen = true;
    g.persist();
  }
  g.music.play("calm");
  game.loop.wake();
  await intro.close();
}

void main();
