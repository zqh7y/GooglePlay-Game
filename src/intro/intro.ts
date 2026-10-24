import { unlockAudio } from "../systems/sound";
import { loadingScene } from "./loading";
import { Overlay } from "./overlay";
import { StoryRun, playStory } from "./story";
import { World3D } from "./world3d";

/**
 * The 3D loading screen and the story intro, shown over the game while it starts.
 * Without WebGL the loading screen still works (logo and bar over a plain sky) and the story is
 * left out.
 */
export interface Intro {
  /** how far loading has got, 0..1 (the bar moves there smoothly) */
  progress(f: number): void;
  /** loading is complete: show TAP TO START once the bar is full */
  done(): void;
  /** resolves on the player's first tap after loading (which also turns the sound on) */
  waitTap(): Promise<void>;
  /** plays the story; resolves when it ends or is skipped */
  story(pets: HTMLCanvasElement[]): Promise<void>;
  /** fades the intro away to the game and frees the 3D world */
  close(): Promise<void>;
}

const MIN_LOADING_SECONDS = 1.6;

function makeWorld(ui: Overlay): World3D | null {
  try {
    return new World3D(ui.canvas);
  } catch (e) {
    console.warn("No 3D for the intro:", e);
    ui.canvas.remove();
    ui.root.style.background = "linear-gradient(#3f86e8, #ffcaa0 60%, #d8a8d8)";
    return null;
  }
}

/** Test hooks: `window.__intro` (seek the story clock, draw a frame). */
type Hooks = { world: World3D | null; story: StoryRun | null };
const hooks: Hooks = { world: null, story: null };
(window as unknown as { __intro: Hooks }).__intro = hooks;

export function openIntro(): Intro {
  const ui = new Overlay();
  const world = makeWorld(ui);
  hooks.world = world;
  let target = 0;
  let shown = 0;
  let loaded = false;
  let ready = false;
  let tapped: (() => void) | null = null;
  const opened = performance.now() / 1000;
  const tick = (now: number, dt: number) => {
    // the bar eases towards where loading is, and creeps on a little so it never looks stuck
    const goal = loaded ? 1 : Math.min(0.97, target + 0.06);
    shown += (goal - shown) * Math.min(1, dt * (loaded ? 5 : 2.2));
    ui.setProgress(shown, now);
    if (loaded && !ready && shown > 0.995 && performance.now() / 1000 - opened > MIN_LOADING_SECONDS) {
      ready = true;
      ui.showTap();
    }
  };
  if (world) {
    loadingScene(world);
    world.onTick(tick);
    world.start();
  } else {
    let last = performance.now();
    const loop = (ms: number) => {
      if (ready) return;
      tick(ms / 1000, Math.min(0.05, (ms - last) / 1000));
      last = ms;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  ui.root.addEventListener("pointerdown", () => {
    if (!ready || !tapped) return;
    unlockAudio();
    const go = tapped;
    tapped = null;
    go();
  });
  return {
    progress(f) {
      target = Math.max(target, f);
    },
    done() {
      loaded = true;
    },
    waitTap: () => new Promise<void>((res) => (tapped = res)),
    async story(pets) {
      if (!world) return;
      // a quick fade to black, then the film
      ui.fade(true, 0.45);
      await wait(500);
      hooks.story = playStory(world, ui, pets);
      ui.fade(false, 1.2);
      await hooks.story.done;
      ui.fade(true, 0.6);
      await wait(650);
    },
    async close() {
      await ui.close();
      world?.dispose();
      hooks.world = null;
      hooks.story = null;
    },
  };
}

/** Plays the story again over the running game (from Settings). */
export async function replayStory(pets: HTMLCanvasElement[]): Promise<void> {
  const ui = new Overlay();
  const world = makeWorld(ui);
  if (!world) {
    ui.root.remove();
    return;
  }
  hooks.world = world;
  ui.startStory();
  ui.fade(true, 0);
  world.start();
  hooks.story = playStory(world, ui, pets);
  await wait(50);
  ui.fade(false, 1.2);
  await hooks.story.done;
  ui.fade(true, 0.6);
  await wait(650);
  await ui.close();
  world.dispose();
  hooks.world = null;
  hooks.story = null;
}

const wait = (ms: number) => new Promise<void>((res) => window.setTimeout(res, ms));
