import Phaser from "phaser";
import { MUTATIONS, MutationId } from "../data/mutations";
import { INK, Ctx, boltPath, canvasTexture, circle, rgba } from "./draw";

const S = 64;

/** White glyph for each mutation, drawn around the centre of a 64x64 badge. */
const GLYPH: Record<MutationId, (c: Ctx) => void> = {
  swift: (c) => {
    boltPath(c, 32, 32, 20);
    c.fill();
  },
  lives: (c) => {
    c.beginPath();
    c.moveTo(32, 46);
    c.bezierCurveTo(10, 32, 14, 14, 26, 16);
    c.quadraticCurveTo(31, 17, 32, 22);
    c.quadraticCurveTo(33, 17, 38, 16);
    c.bezierCurveTo(50, 14, 54, 32, 32, 46);
    c.fill();
  },
  blink: (c) => {
    c.lineWidth = 6;
    c.lineCap = "round";
    c.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = i * 0.3;
      const r = 3 + i * 0.42;
      const x = 32 + Math.cos(a) * r;
      const y = 32 + Math.sin(a) * r;
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.stroke();
  },
  armor: (c) => {
    c.beginPath();
    c.moveTo(32, 13);
    c.lineTo(48, 19);
    c.quadraticCurveTo(48, 40, 32, 51);
    c.quadraticCurveTo(16, 40, 16, 19);
    c.closePath();
    c.fill();
  },
  regen: (c) => {
    c.fillRect(27, 14, 10, 36);
    c.fillRect(14, 27, 36, 10);
  },
  giant: (c) => {
    c.beginPath();
    c.moveTo(32, 12);
    c.lineTo(50, 32);
    c.lineTo(39, 32);
    c.lineTo(39, 50);
    c.lineTo(25, 50);
    c.lineTo(25, 32);
    c.lineTo(14, 32);
    c.closePath();
    c.fill();
  },
  split: (c) => {
    circle(c, 23, 34, 9);
    c.fill();
    circle(c, 41, 34, 9);
    c.fill();
    c.fillRect(30, 14, 4, 34);
  },
  ghost: (c) => {
    c.beginPath();
    c.moveTo(18, 48);
    c.lineTo(18, 30);
    c.arc(32, 30, 14, Math.PI, 0);
    c.lineTo(46, 48);
    c.lineTo(41, 44);
    c.lineTo(36, 48);
    c.lineTo(32, 44);
    c.lineTo(28, 48);
    c.lineTo(23, 44);
    c.closePath();
    c.fill();
    c.fillStyle = "#4a2f1d";
    circle(c, 27, 30, 3);
    c.fill();
    circle(c, 37, 30, 3);
    c.fill();
  },
  vampire: (c) => {
    c.beginPath();
    c.moveTo(16, 20);
    c.lineTo(48, 20);
    c.lineTo(48, 26);
    c.lineTo(16, 26);
    c.closePath();
    c.fill();
    for (const x of [22, 42]) {
      c.beginPath();
      c.moveTo(x - 6, 25);
      c.lineTo(x + 6, 25);
      c.lineTo(x, 46);
      c.closePath();
      c.fill();
    }
  },
  bomb: (c) => {
    circle(c, 30, 36, 14);
    c.fill();
    c.fillRect(34, 16, 6, 10);
    c.fillStyle = "#ffe066";
    circle(c, 42, 15, 5);
    c.fill();
  },
};

/** Little round badges floating over mutated monsters: `mut_<id>`. */
export function makeMutationTextures(scene: Phaser.Scene): void {
  for (const m of MUTATIONS) {
    canvasTexture(scene, `mut_${m.id}`, S, S, (c) => {
      circle(c, 32, 32, 29);
      c.fillStyle = INK;
      c.fill();
      circle(c, 32, 32, 24);
      c.fillStyle = rgba(m.id === "ghost" ? 0x8a9ab4 : m.color);
      c.fill();
      circle(c, 32, 26, 16);
      c.fillStyle = rgba(0xffffff, 0.18);
      c.fill();
      c.fillStyle = "#ffffff";
      c.strokeStyle = "#ffffff";
      GLYPH[m.id](c);
    });
  }
}
