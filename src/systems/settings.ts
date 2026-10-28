import Phaser from "phaser";
import { save } from "./save";
import { setVibrate } from "./sound";

/** Weather and zone effects (fog, light pillars, torch fire, the dizzy edge) are on. Toaster mode turns them off too. */
export const effectsOn = () => save.settings.effects && !save.settings.toaster;

/** No screen shake: the camera's shake does nothing. */
export function applyShake(scene: Phaser.Scene): void {
  const cam = scene.cameras?.main as (Phaser.Cameras.Scene2D.Camera & { shake: unknown }) | undefined;
  if (!cam) return;
  if (save.settings.shake) delete (cam as { shake?: unknown }).shake;
  else cam.shake = () => cam;
}

/** After a switch changes: vibration, and the shake on every scene. */
export function applySettings(game: Phaser.Game): void {
  setVibrate(save.settings.vibrate);
  for (const sc of game.scene.getScenes(false)) applyShake(sc);
}
