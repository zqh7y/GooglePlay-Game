import Phaser from "phaser";
import { canvasTexture } from "./draw";

/** Comic-book hit effects: a spiky starburst ("POW!" goes on top) and a little cartoon star. */
export function makeComicTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, "comic_burst", 240, 200, (c) => {
    const spikes = 12;
    const shape = (rOut: number, rIn: number) => {
      c.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? rIn : rOut * (0.85 + 0.15 * ((i * 7) % 3) / 2);
        c.lineTo(120 + Math.cos(a) * r * 1.15, 100 + Math.sin(a) * r * 0.95);
      }
      c.closePath();
    };
    shape(96, 62);
    c.fillStyle = "#ff3b3b";
    c.fill();
    c.lineWidth = 8;
    c.strokeStyle = "#1a1030";
    c.stroke();
    shape(72, 48);
    c.fillStyle = "#ffe066";
    c.fill();
  });
  canvasTexture(scene, "comic_star", 64, 64, (c) => {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 12 : 28;
      c.lineTo(32 + Math.cos(a) * r, 33 + Math.sin(a) * r);
    }
    c.closePath();
    c.fillStyle = "#ffe066";
    c.fill();
    c.lineWidth = 5;
    c.strokeStyle = "#1a1030";
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.beginPath();
    c.arc(26, 26, 5, 0, Math.PI * 2);
    c.fill();
  });
}
