import Phaser from "phaser";
import { Ctx, canvasTexture, circle, ellipse, linear, radial } from "./draw";

const INK = "#2a1c1c";

/** Fill a path with a paint, then outline it in ink. */
function shape(c: Ctx, path: () => void, paint: string | CanvasGradient, lw = 4): void {
  c.beginPath();
  path();
  c.fillStyle = paint;
  c.fill();
  c.lineWidth = lw;
  c.lineJoin = "round";
  c.strokeStyle = INK;
  c.stroke();
}

function shine(c: Ctx, x: number, y: number, rx: number, ry: number): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, -0.5, 0, Math.PI * 2);
  c.fillStyle = "rgba(255,255,255,0.55)";
  c.fill();
}

/** Every gadget picture: `gd_<kind>` (used for the projectiles and the icons), plus the black hole. */
const ART: Record<string, [number, number, (c: Ctx) => void]> = {
  // a four-pointed throwing star with a hole in the middle
  shuriken: [72, 72, (c) => {
    shape(c, () => {
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 4;
        const r = i % 2 ? 12 : 32;
        const x = 36 + Math.cos(a) * r;
        const y = 36 + Math.sin(a) * r;
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.closePath();
    }, linear(c, 0, 4, 0, 68, [[0, "#f4f8ff"], [1, "#8a98b0"]]));
    shape(c, () => circle(c, 36, 36, 7), "#3a3a4a", 3);
  }],
  // a round saw blade with teeth
  saw: [88, 88, (c) => {
    shape(c, () => {
      const n = 12;
      for (let i = 0; i < n * 2; i++) {
        const a = (i * Math.PI) / n;
        const r = i % 2 ? 32 : 41;
        const x = 44 + Math.cos(a + (i % 2 ? 0.12 : 0)) * r;
        const y = 44 + Math.sin(a + (i % 2 ? 0.12 : 0)) * r;
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.closePath();
    }, radial(c, 44, 44, 42, [[0, "#ffffff"], [1, "#9aa6b8"]]));
    shape(c, () => circle(c, 44, 44, 16), linear(c, 0, 28, 0, 60, [[0, "#ffcf3a"], [1, "#ff8a2a"]]), 3.5);
    shape(c, () => circle(c, 44, 44, 5), "#3a3a4a", 3);
  }],
  // a cartoon rocket pointing right
  rocket: [100, 48, (c) => {
    shape(c, () => {
      c.moveTo(8, 24);
      c.lineTo(20, 12);
      c.lineTo(20, 36);
      c.closePath();
    }, "#ffcf3a", 3);
    shape(c, () => {
      c.moveTo(22, 12);
      c.lineTo(70, 12);
      c.quadraticCurveTo(96, 14, 96, 24);
      c.quadraticCurveTo(96, 34, 70, 36);
      c.lineTo(22, 36);
      c.closePath();
    }, linear(c, 0, 12, 0, 36, [[0, "#ffffff"], [1, "#c8ccd8"]]));
    shape(c, () => {
      c.moveTo(78, 13);
      c.quadraticCurveTo(96, 14, 96, 24);
      c.quadraticCurveTo(96, 34, 78, 35);
      c.closePath();
    }, "#ff4a4a", 3);
    for (const [y0, y1] of [[12, 2], [36, 46]]) shape(c, () => {
      c.moveTo(24, y0);
      c.lineTo(18, y1);
      c.lineTo(40, y0);
      c.closePath();
    }, "#ff4a4a", 3);
    shape(c, () => circle(c, 56, 24, 6), "#5ac8ff", 3);
  }],
  // a mine: a dark dome with a red light
  mine: [76, 56, (c) => {
    shape(c, () => ellipse(c, 38, 42, 32, 10), "#3a3a4a");
    shape(c, () => {
      c.moveTo(10, 42);
      c.quadraticCurveTo(14, 10, 38, 10);
      c.quadraticCurveTo(62, 10, 66, 42);
      c.closePath();
    }, linear(c, 0, 10, 0, 42, [[0, "#6a6a7a"], [1, "#2a2a3a"]]));
    shape(c, () => circle(c, 38, 18, 7), "#ff4a4a", 3);
    shine(c, 24, 24, 7, 4);
  }],
  // a little bomber drone with four rotors and one eye
  drone: [112, 72, (c) => {
    for (const x of [14, 98]) {
      c.strokeStyle = INK;
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(x, 22);
      c.lineTo(56, 38);
      c.stroke();
      shape(c, () => ellipse(c, x, 18, 16, 5), "rgba(200,230,255,0.85)", 3);
    }
    shape(c, () => c.roundRect(28, 26, 56, 32, 14), linear(c, 0, 26, 0, 58, [[0, "#7ad8ff"], [1, "#2a8ac8"]]));
    shape(c, () => circle(c, 56, 42, 10), "#ffffff", 3);
    c.beginPath();
    circle(c, 58, 43, 5);
    c.fillStyle = INK;
    c.fill();
    shape(c, () => c.roundRect(48, 56, 16, 10, 4), "#3a3a4a", 3);
  }],
  // a yellow V boomerang
  boomerang: [84, 84, (c) => {
    shape(c, () => {
      c.moveTo(10, 20);
      c.quadraticCurveTo(14, 8, 26, 12);
      c.lineTo(44, 50);
      c.lineTo(72, 30);
      c.quadraticCurveTo(82, 32, 76, 44);
      c.lineTo(44, 74);
      c.quadraticCurveTo(36, 76, 32, 68);
      c.closePath();
    }, linear(c, 0, 8, 0, 76, [[0, "#fff27a"], [1, "#ffa62e"]]));
    c.strokeStyle = "#e85a3a";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(22, 22);
    c.lineTo(38, 56);
    c.lineTo(66, 38);
    c.stroke();
  }],
  // a striped bouncy ball
  ball: [60, 60, (c) => {
    shape(c, () => circle(c, 30, 30, 25), radial(c, 24, 22, 30, [[0, "#ffb8ec"], [1, "#e83aa8"]]));
    c.save();
    c.beginPath();
    circle(c, 30, 30, 23);
    c.clip();
    c.fillStyle = "#ffe066";
    c.fillRect(4, 24, 52, 10);
    c.restore();
    shine(c, 22, 20, 7, 4);
  }],
  // a cartoon grenade with its pin
  grenade: [62, 74, (c) => {
    c.strokeStyle = INK;
    c.lineWidth = 3.5;
    c.beginPath();
    c.arc(46, 14, 8, 0, Math.PI * 2);
    c.stroke();
    shape(c, () => c.roundRect(22, 10, 18, 12, 3), "#8a94a8", 3);
    shape(c, () => ellipse(c, 31, 46, 23, 25), linear(c, 0, 20, 0, 72, [[0, "#8ae66a"], [1, "#3f8a3a"]]));
    c.strokeStyle = "rgba(20,60,20,0.5)";
    c.lineWidth = 3;
    for (const x of [24, 38]) {
      c.beginPath();
      c.moveTo(x, 24);
      c.lineTo(x, 68);
      c.stroke();
    }
    shine(c, 22, 38, 6, 4);
  }],
  // a black hole: a swirl of purple around a dark middle
  hole: [150, 150, (c) => {
    const g = radial(c, 75, 75, 74, [[0, "rgba(10,0,30,1)"], [0.35, "rgba(40,10,90,0.95)"], [0.7, "rgba(160,90,255,0.55)"], [1, "rgba(160,90,255,0)"]]);
    c.fillStyle = g;
    c.fillRect(0, 0, 150, 150);
    c.strokeStyle = "rgba(220,190,255,0.8)";
    c.lineWidth = 4;
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      for (let i = 0; i <= 30; i++) {
        const a = k * ((Math.PI * 2) / 3) + i * 0.16;
        const r = 18 + i * 1.7;
        const x = 75 + Math.cos(a) * r;
        const y = 75 + Math.sin(a) * r;
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.stroke();
    }
  }],
};

export function makeGadgetTextures(scene: Phaser.Scene): void {
  for (const [id, [w, h, draw]] of Object.entries(ART)) canvasTexture(scene, `gd_${id}`, w, h, draw);
}
