import Phaser from "phaser";
import { canvasTexture } from "./draw";

const INK = "#111111";

/** Icons for the five stage modes, the beast's cage, its snack and the giant falling die. */
export function makeModeTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, "mode_air", 120, 120, (c) => {
    c.beginPath();
    c.arc(60, 60, 50, 0, Math.PI * 2);
    const g = c.createRadialGradient(44, 40, 6, 60, 60, 52);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.5, "#aef4ff");
    g.addColorStop(1, "#3cc0f0");
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 7;
    c.strokeStyle = INK;
    c.stroke();
    c.fillStyle = "#ffffff";
    c.strokeStyle = INK;
    c.lineWidth = 6;
    c.font = "bold 46px sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.strokeText("O₂", 60, 64);
    c.fillText("O₂", 60, 64);
  });
  canvasTexture(scene, "mode_crystal", 120, 120, (c) => {
    c.beginPath();
    c.moveTo(60, 8);
    c.lineTo(100, 50);
    c.lineTo(60, 112);
    c.lineTo(20, 50);
    c.closePath();
    const g = c.createLinearGradient(20, 8, 100, 112);
    g.addColorStop(0, "#ffd6f4");
    g.addColorStop(1, "#d23aa8");
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 7;
    c.strokeStyle = INK;
    c.lineJoin = "round";
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.beginPath();
    c.moveTo(60, 18);
    c.lineTo(80, 48);
    c.lineTo(60, 48);
    c.fill();
  });
  // a cartoon drumstick (the beast's snack)
  canvasTexture(scene, "mode_feed", 120, 120, (c) => {
    c.lineWidth = 7;
    c.strokeStyle = INK;
    c.fillStyle = "#fff4e0";
    for (const [x, y] of [[90, 92], [102, 80]]) {
      c.beginPath();
      c.arc(x, y, 12, 0, Math.PI * 2);
      c.stroke();
      c.fill();
    }
    c.beginPath();
    c.moveTo(70, 70);
    c.lineTo(94, 88);
    c.lineWidth = 16;
    c.stroke();
    c.strokeStyle = "#fff4e0";
    c.lineWidth = 8;
    c.stroke();
    c.beginPath();
    c.ellipse(48, 48, 40, 30, Math.PI / 4, 0, Math.PI * 2);
    const g = c.createLinearGradient(10, 10, 80, 80);
    g.addColorStop(0, "#f0a050");
    g.addColorStop(1, "#b0541c");
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 7;
    c.strokeStyle = INK;
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.45)";
    c.beginPath();
    c.ellipse(36, 34, 14, 7, -Math.PI / 4, 0, Math.PI * 2);
    c.fill();
  });
  const die = (key: string, size: number, pips: number) =>
    canvasTexture(scene, key, size, size, (c) => {
      const s = size / 120;
      c.scale(s, s);
      c.beginPath();
      c.roundRect(10, 10, 100, 100, 22);
      const g = c.createLinearGradient(10, 10, 110, 110);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, "#d8dcea");
      c.fillStyle = g;
      c.fill();
      c.lineWidth = 7;
      c.strokeStyle = INK;
      c.stroke();
      const at: Record<number, [number, number][]> = {
        3: [[35, 35], [60, 60], [85, 85]],
        5: [[35, 35], [85, 35], [60, 60], [35, 85], [85, 85]],
        6: [[35, 32], [85, 32], [35, 60], [85, 60], [35, 88], [85, 88]],
      };
      c.fillStyle = "#e8434f";
      for (const [x, y] of at[pips]) {
        c.beginPath();
        c.arc(x, y, 10, 0, Math.PI * 2);
        c.fill();
      }
    });
  die("mode_dice", 120, 5);
  die("big_die", 240, 6);
  die("big_die3", 240, 3);
  canvasTexture(scene, "mode_boss", 120, 120, (c) => {
    // a horned skull
    c.lineWidth = 7;
    c.strokeStyle = INK;
    c.lineJoin = "round";
    c.fillStyle = "#ffd23f";
    for (const d of [-1, 1]) {
      c.beginPath();
      c.moveTo(60 + d * 26, 40);
      c.quadraticCurveTo(60 + d * 56, 30, 60 + d * 50, 4);
      c.quadraticCurveTo(60 + d * 40, 30, 60 + d * 14, 34);
      c.closePath();
      c.fill();
      c.stroke();
    }
    c.beginPath();
    c.arc(60, 58, 38, Math.PI * 0.85, Math.PI * 2.15);
    c.lineTo(80, 104);
    c.lineTo(40, 104);
    c.closePath();
    c.fillStyle = "#ff5a5a";
    c.fill();
    c.stroke();
    c.fillStyle = INK;
    for (const d of [-1, 1]) {
      c.beginPath();
      c.ellipse(60 + d * 15, 60, 10, 12, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.fillRect(52, 84, 4, 14);
    c.fillRect(64, 84, 4, 14);
  });
  canvasTexture(scene, "beast_cage", 560, 520, (c) => {
    c.lineJoin = "round";
    const bar = (x0: number, y0: number, x1: number, y1: number, w: number) => {
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.lineCap = "round";
      c.lineWidth = w + 10;
      c.strokeStyle = INK;
      c.stroke();
      c.lineWidth = w;
      c.strokeStyle = "#9aa4b8";
      c.stroke();
      c.lineWidth = w * 0.3;
      c.strokeStyle = "rgba(255,255,255,0.6)";
      c.beginPath();
      c.moveTo(x0 - w * 0.2, y0 + 6);
      c.lineTo(x1 - w * 0.2, y1 - 6);
      c.stroke();
    };
    for (let i = 0; i < 7; i++) bar(40 + i * 80, 40, 40 + i * 80, 480, 18);
    bar(24, 40, 536, 40, 28);
    bar(24, 480, 536, 480, 28);
    // a padlock
    c.fillStyle = "#ffcf3a";
    c.strokeStyle = INK;
    c.lineWidth = 7;
    c.beginPath();
    c.arc(280, 250, 30, Math.PI, 0);
    c.stroke();
    c.beginPath();
    c.roundRect(240, 250, 80, 66, 12);
    c.fill();
    c.stroke();
  });
}
