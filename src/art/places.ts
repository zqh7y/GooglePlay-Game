import Phaser from "phaser";
import { INK, Ctx, canvasTexture, circle, fill, fillOutline, linear, radial, rgba, starPath } from "./draw";

/** Things placed on the field: the boss seals. */

/** A rune circle lying flat on the ground: purple while open, gold once you closed it. */
function seal(on: boolean) {
  return (ctx: Ctx) => {
    const main = on ? "#ffcf3a" : "#a070e8";
    const light = on ? "#fff3a8" : "#ead8ff";
    const glow = on ? 0xffe066 : 0xb98aff;
    ctx.save();
    ctx.translate(150, 80);
    ctx.scale(1, 0.5);
    circle(ctx, 0, 0, 146);
    fill(ctx, radial(ctx, 0, 0, 146, [[0, rgba(glow, 0.6)], [0.7, rgba(glow, 0.25)], [1, rgba(glow, 0)]]));
    for (const [r, w, color] of [[128, 9, main], [96, 6, light]] as [number, number, string][]) {
      circle(ctx, 0, 0, r);
      ctx.lineWidth = w + 8;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = w;
      ctx.strokeStyle = color;
      ctx.stroke();
    }
    // runes between the rings
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.save();
      ctx.translate(Math.cos(a) * 112, Math.sin(a) * 112);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(0, 9);
      ctx.moveTo(-7, i % 2 ? -3 : 3);
      ctx.lineTo(7, i % 2 ? 3 : -3);
      ctx.lineWidth = 5;
      ctx.strokeStyle = light;
      ctx.stroke();
      ctx.restore();
    }
    starPath(ctx, 0, 0, 62, 0.42, 5);
    fillOutline(ctx, linear(ctx, 0, -62, 0, 62, [[0, light], [1, main]]), 6);
    ctx.restore();
  };
}

export function makePlaceTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, "seal", 300, 160, seal(false));
  canvasTexture(scene, "seal_on", 300, 160, seal(true));
}
