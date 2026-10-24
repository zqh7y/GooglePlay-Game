import Phaser from "phaser";
import { INK, Ctx, canvasTexture, circle, ellipse, fill, outline, radial, twinkle } from "./draw";
import { toon } from "./toon";

/** Icons for online play: the leaderboard trophy and the world (for "players who own this"). */

function trophy(c: Ctx): void {
  const t = toon(c, INK, 5);
  // handles
  for (const k of [-1, 1]) t.tube(() => c.arc(48 + k * 26, 34, 13, k > 0 ? -1.4 : Math.PI - 1.4 + 2.8, k > 0 ? 1.4 : Math.PI + 1.4), 7, 0xffc23a);
  t.part(() => {
    c.moveTo(24, 18);
    c.lineTo(72, 18);
    c.quadraticCurveTo(72, 62, 48, 64);
    c.quadraticCurveTo(24, 62, 24, 18);
  }, 0xffd23f, () => t.paint("rgba(255,255,255,0.35)", () => t.E(36, 32, 6, 12, 0.2)));
  t.part(() => t.rect(48, 70, 12, 14, 3), 0xffb02e);
  t.part(() => t.rect(48, 84, 40, 12, 4), 0x9a5a2a);
  t.paint("#fff3a8", () => {
    c.font = "bold 22px sans-serif";
    c.textAlign = "center";
    c.fillText("1", 48, 46);
  });
  twinkle(c, 78, 14, 9);
}

function globe(c: Ctx): void {
  circle(c, 48, 48, 38);
  fill(c, radial(c, 40, 38, 44, [[0, "#9ae6ff"], [1, "#2f7fd0"]]));
  // land
  c.fillStyle = "#6fd25a";
  ellipse(c, 34, 36, 14, 10, 0.4);
  c.fill();
  ellipse(c, 60, 58, 12, 16, -0.3);
  c.fill();
  ellipse(c, 64, 30, 7, 5);
  c.fill();
  circle(c, 48, 48, 38);
  outline(c, 6);
  c.strokeStyle = "rgba(255,255,255,0.45)";
  c.lineWidth = 3;
  ellipse(c, 48, 48, 18, 38);
  c.stroke();
  c.beginPath();
  c.moveTo(10, 48);
  c.lineTo(86, 48);
  c.stroke();
}

export function makeOnlineTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, "icon_trophy", 96, 96, trophy);
  canvasTexture(scene, "icon_globe", 96, 96, globe);
}

/** A white cartoon glove pointing up and left (the tutorial's pointer). */
function hand(c: Ctx): void {
  const t = toon(c, INK, 5);
  c.save();
  c.translate(60, 64);
  c.rotate(-0.55);
  // cuff
  t.part(() => t.rect(0, 40, 50, 22, 8), 0xd8e0e8);
  // palm and curled fingers
  t.part(() => {
    t.rect(0, 12, 50, 40, 16);
    t.E(-22, 14, 10, 13, 0.3);
  }, 0xffffff, () => t.paint("rgba(0,0,0,0.08)", () => t.rect(10, 18, 26, 30, 10)));
  for (const x of [-9, 6, 19]) t.part(() => t.rect(x, -2, 13, 16, 6), 0xffffff, undefined, 4);
  // the pointing finger
  t.part(() => t.rect(-14, -26, 14, 40, 7), 0xffffff, () => t.paint("rgba(0,0,0,0.08)", () => t.rect(-10, -26, 5, 36, 2)));
  c.restore();
}

export function makeTutorialTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, "tut_hand", 120, 130, hand);
}
