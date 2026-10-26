import Phaser from "phaser";
import { canvasTexture } from "./draw";

const INK = "#111111";

/** Icons for the five stage modes, the beast's cage, its snack and the giant falling die. */
export function makeModeTextures(scene: Phaser.Scene): void {
  /** A 3D die: front, top and side faces with shading and pips. */
  const cube = (key: string, pips: number) =>
    canvasTexture(scene, key, 260, 260, (c) => {
      const f = 150;
      const d = 60;
      const x0 = 30;
      const y0 = 30 + d;
      const pip = (x: number, y: number, r: number) => {
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fillStyle = "#e8434f";
        c.fill();
        c.fillStyle = "rgba(255,255,255,0.5)";
        c.beginPath();
        c.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
        c.fill();
      };
      c.lineJoin = "round";
      c.lineWidth = 7;
      c.strokeStyle = INK;
      // top face
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x0 + d, y0 - d);
      c.lineTo(x0 + d + f, y0 - d);
      c.lineTo(x0 + f, y0);
      c.closePath();
      c.fillStyle = "#ffffff";
      c.fill();
      c.stroke();
      // side face
      c.beginPath();
      c.moveTo(x0 + f, y0);
      c.lineTo(x0 + f + d, y0 - d);
      c.lineTo(x0 + f + d, y0 - d + f);
      c.lineTo(x0 + f, y0 + f);
      c.closePath();
      c.fillStyle = "#b8bfd4";
      c.fill();
      c.stroke();
      // front face
      c.beginPath();
      c.rect(x0, y0, f, f);
      const g = c.createLinearGradient(x0, y0, x0 + f, y0 + f);
      g.addColorStop(0, "#f4f6ff");
      g.addColorStop(1, "#d6dbea");
      c.fillStyle = g;
      c.fill();
      c.stroke();
      const at: Record<number, [number, number][]> = {
        3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
        6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
      };
      for (const [u, v] of at[pips]) pip(x0 + u * f, y0 + v * f, 14);
      // two pips on the top, squashed by the angle
      c.save();
      c.translate(x0 + d / 2 + f / 2, y0 - d / 2);
      c.scale(1, 0.45);
      pip(-32, 0, 13);
      pip(32, 0, 13);
      c.restore();
    });
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
  cube("big_die", 6);
  cube("big_die3", 3);
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

  // a chunky wooden signboard on two posts (text goes on top in the game)
  canvasTexture(scene, "sign_board", 360, 260, (c) => {
    c.lineJoin = "round";
    c.lineWidth = 7;
    c.strokeStyle = INK;
    for (const x of [90, 250]) {
      c.fillStyle = "#7a4a26";
      c.fillRect(x, 120, 26, 130);
      c.strokeRect(x, 120, 26, 130);
      c.fillStyle = "#5a3418";
      c.fillRect(x + 17, 124, 6, 122);
    }
    // the board's thickness, then its face
    c.fillStyle = "#6a3c1c";
    c.beginPath();
    c.roundRect(22, 30, 324, 150, 18);
    c.fill();
    c.stroke();
    c.beginPath();
    c.roundRect(14, 14, 320, 150, 18);
    const g = c.createLinearGradient(0, 14, 0, 164);
    g.addColorStop(0, "#e2a868");
    g.addColorStop(1, "#b8743a");
    c.fillStyle = g;
    c.fill();
    c.stroke();
    c.strokeStyle = "rgba(90,52,24,0.45)";
    c.lineWidth = 4;
    for (const y of [64, 114]) {
      c.beginPath();
      c.moveTo(24, y);
      c.lineTo(324, y);
      c.stroke();
    }
    c.fillStyle = "#3a2010";
    for (const [x, y] of [[34, 32], [314, 32], [34, 146], [314, 146]]) {
      c.beginPath();
      c.arc(x, y, 6, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "rgba(255,255,255,0.25)";
    c.fillRect(30, 20, 290, 10);
  });
  // a yellow warning sign on a post
  canvasTexture(scene, "sign_warn", 180, 240, (c) => {
    c.lineJoin = "round";
    c.lineWidth = 7;
    c.strokeStyle = INK;
    c.fillStyle = "#9aa4b8";
    c.fillRect(80, 120, 20, 116);
    c.strokeRect(80, 120, 20, 116);
    c.beginPath();
    c.moveTo(90, 14);
    c.lineTo(170, 150);
    c.lineTo(10, 150);
    c.closePath();
    c.fillStyle = "#c08a10";
    c.save();
    c.translate(6, 8);
    c.fill();
    c.restore();
    c.fillStyle = "#ffd23f";
    c.fill();
    c.stroke();
    c.fillStyle = INK;
    c.fillRect(84, 58, 12, 50);
    c.beginPath();
    c.arc(90, 124, 8, 0, Math.PI * 2);
    c.fill();
  });
  // a soft pillar of light for the air zone's corners
  canvasTexture(scene, "zone_pillar", 64, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, "rgba(120,255,170,0)");
    g.addColorStop(0.5, "rgba(200,255,220,0.9)");
    g.addColorStop(1, "rgba(120,255,170,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 512);
    const v = c.createLinearGradient(0, 0, 0, 512);
    v.addColorStop(0, "rgba(0,0,0,1)");
    v.addColorStop(0.6, "rgba(0,0,0,0)");
    c.globalCompositeOperation = "destination-out";
    c.fillStyle = v;
    c.fillRect(0, 0, 64, 512);
  });
  // cracks left in the ground by a giant die
  canvasTexture(scene, "dice_crack", 300, 150, (c) => {
    c.strokeStyle = "rgba(40,24,10,0.75)";
    c.lineCap = "round";
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      c.lineWidth = 7 - (i % 3) * 2;
      c.beginPath();
      c.moveTo(150, 75);
      let x = 150;
      let y = 75;
      for (let k = 1; k <= 3; k++) {
        x += Math.cos(a + (k % 2 ? 0.3 : -0.3)) * 40;
        y += Math.sin(a + (k % 2 ? 0.3 : -0.3)) * 20;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    c.fillStyle = "rgba(40,24,10,0.35)";
    c.beginPath();
    c.ellipse(150, 75, 60, 28, 0, 0, Math.PI * 2);
    c.fill();
  });
  // the stone platform under the beast's cage (top and its thick side)
  canvasTexture(scene, "cage_base", 640, 220, (c) => {
    c.lineWidth = 8;
    c.strokeStyle = INK;
    c.fillStyle = "#6c7488";
    c.beginPath();
    c.ellipse(320, 120, 300, 90, 0, 0, Math.PI);
    c.lineTo(20, 80);
    c.ellipse(320, 80, 300, 90, 0, Math.PI, 0, true);
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.ellipse(320, 80, 300, 90, 0, 0, Math.PI * 2);
    const g = c.createRadialGradient(300, 60, 20, 320, 80, 300);
    g.addColorStop(0, "#d8deea");
    g.addColorStop(1, "#9aa4b8");
    c.fillStyle = g;
    c.fill();
    c.stroke();
    c.strokeStyle = "rgba(60,66,84,0.5)";
    c.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      c.beginPath();
      c.moveTo(320 + Math.cos(a) * 110, 80 + Math.sin(a) * 33);
      c.lineTo(320 + Math.cos(a) * 290, 80 + Math.sin(a) * 87);
      c.stroke();
    }
  });
}
