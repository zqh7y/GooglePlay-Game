import Phaser from "phaser";
import { INK, Ctx, canvasTexture } from "./draw";
import { groundShadow, lin, poly } from "./story";

/**
 * The volcano stage (9): molten lava, the crater's ash floor, the Magma King's lava bombs, the water
 * geysers that crack its armour, the mode's icon and the smoking volcano in the lobby.
 */
export function makeVolcanoTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists("lava_tile")) return;
  // lava: bright molten cells with dark cooling crust between them (wraps round, so it tiles)
  canvasTexture(scene, "lava_tile", 256, 256, (c) => {
    c.fillStyle = "#c8300c";
    c.fillRect(0, 0, 256, 256);
    let s = 7;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
      const [x, y, rad] = [r() * 256, r() * 256, 22 + r() * 30];
      for (const dx of [-256, 0, 256]) {
        for (const dy of [-256, 0, 256]) {
          const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
          g.addColorStop(0, "rgba(255,240,140,0.95)");
          g.addColorStop(0.45, "rgba(255,150,30,0.8)");
          g.addColorStop(1, "rgba(255,80,10,0)");
          c.fillStyle = g;
          c.beginPath();
          c.arc(x + dx, y + dy, rad, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
    c.strokeStyle = "rgba(60,14,6,0.55)";
    c.lineWidth = 5;
    for (let i = 0; i < 14; i++) {
      let [x, y] = [r() * 256, r() * 256];
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (r() - 0.5) * 70;
        y += (r() - 0.5) * 70;
        c.lineTo(x, y);
      }
      c.stroke();
    }
  });
  // the crater floor: dark ash and basalt with a few warm cracks (wraps round)
  canvasTexture(scene, "ash_tile", 256, 256, (c) => {
    c.fillStyle = "#5e4c48";
    c.fillRect(0, 0, 256, 256);
    let s = 11;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 260; i++) {
      const [x, y, rad] = [r() * 256, r() * 256, 1 + r() * 4];
      c.fillStyle = r() < 0.5 ? "rgba(130,110,104,0.7)" : "rgba(40,28,26,0.6)";
      c.beginPath();
      c.arc(x, y, rad, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < 10; i++) {
      const [x, y, w, h] = [r() * 236, r() * 236, 30 + r() * 50, 20 + r() * 30];
      c.fillStyle = "rgba(100,84,78,0.55)";
      c.beginPath();
      c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = "rgba(255,110,30,0.35)";
    c.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      let [x, y] = [20 + r() * 216, 20 + r() * 216];
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        x += (r() - 0.5) * 40;
        y += (r() - 0.5) * 40;
        c.lineTo(x, y);
      }
      c.stroke();
    }
  });
  // a lava bomb: a glowing rock with a fiery tail
  canvasTexture(scene, "lava_bomb", 120, 160, (c) => {
    const tail = c.createLinearGradient(0, 0, 0, 100);
    tail.addColorStop(0, "rgba(255,120,20,0)");
    tail.addColorStop(1, "rgba(255,180,40,0.9)");
    c.fillStyle = tail;
    c.beginPath();
    c.moveTo(40, 0);
    c.lineTo(80, 0);
    c.lineTo(92, 100);
    c.lineTo(28, 100);
    c.closePath();
    c.fill();
    c.lineWidth = 5;
    c.strokeStyle = INK;
    const g = c.createRadialGradient(52, 104, 4, 60, 112, 40);
    g.addColorStop(0, "#fff3a0");
    g.addColorStop(0.35, "#ff8a1a");
    g.addColorStop(1, "#5a1a0a");
    c.fillStyle = g;
    c.beginPath();
    c.arc(60, 114, 38, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.strokeStyle = "rgba(40,10,6,0.8)";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(38, 104);
    c.lineTo(56, 118);
    c.lineTo(50, 138);
    c.moveTo(70, 96);
    c.lineTo(80, 120);
    c.stroke();
  });
  // a water geyser vent: a ring of mossy stones round a pool of blue water
  canvasTexture(scene, "geyser", 220, 150, (c) => {
    c.lineJoin = "round";
    c.lineWidth = 5;
    c.strokeStyle = INK;
    groundShadow(c, 110, 112, 104, 26);
    c.beginPath();
    c.ellipse(110, 92, 100, 46, 0, 0, Math.PI * 2);
    c.fillStyle = lin(c, 10, 0, 210, 0, ["#9a9298", "#6a6268", "#3a3438"]);
    c.fill();
    c.stroke();
    const w = c.createRadialGradient(100, 82, 4, 110, 88, 70);
    w.addColorStop(0, "#e8fbff");
    w.addColorStop(0.4, "#6ad0ff");
    w.addColorStop(1, "#1a5aa8");
    c.beginPath();
    c.ellipse(110, 86, 70, 28, 0, 0, Math.PI * 2);
    c.fillStyle = w;
    c.fill();
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.8)";
    for (const [x, y, r] of [[86, 80, 6], [126, 90, 4], [110, 76, 3]]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    for (const [x, y] of [[22, 96], [60, 128], [160, 128], [198, 96], [110, 136]]) {
      c.beginPath();
      c.ellipse(x, y, 20, 13, 0, 0, Math.PI * 2);
      c.fillStyle = "#7a7278";
      c.fill();
      c.stroke();
    }
  });
  // a ball of water flying at the boss
  canvasTexture(scene, "water_ball", 96, 96, (c) => {
    const g = c.createRadialGradient(40, 38, 4, 48, 48, 44);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, "#9ae6ff");
    g.addColorStop(1, "rgba(40,120,220,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(48, 48, 44, 0, Math.PI * 2);
    c.fill();
  });
  canvasTexture(scene, "mode_volcano", 128, 128, (c) => volcano(c, 128, 128, true));
  canvasTexture(scene, "volcano_mini", 560, 420, (c) => volcano(c, 560, 420, false));
}

/** A volcano: a dark cone with lava running down from its glowing crater (and a round badge for the icon). */
function volcano(c: Ctx, w: number, h: number, icon: boolean): void {
  c.lineJoin = "round";
  c.lineWidth = icon ? 6 : 8;
  c.strokeStyle = INK;
  if (icon) {
    const bg = c.createLinearGradient(0, 8, 0, 120);
    bg.addColorStop(0, "#5a1a2a");
    bg.addColorStop(1, "#ff7a2a");
    c.fillStyle = bg;
    c.beginPath();
    c.arc(64, 64, 56, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  } else groundShadow(c, w / 2, h - 16, w * 0.46, 26);
  const k = w / 128;
  const base = icon ? 106 : h - 20;
  const top = icon ? 40 : 80;
  const cone: [number, number][] = [[w * 0.08, base], [w * 0.4, top], [w * 0.6, top], [w * 0.92, base]];
  poly(c, cone, lin(c, w * 0.1, 0, w * 0.9, 0, ["#7a5a50", "#4a3632", "#2a1c1a"]));
  // lava running down from the crater
  c.save();
  c.beginPath();
  c.moveTo(cone[0][0], cone[0][1]);
  for (const p of cone.slice(1)) c.lineTo(p[0], p[1]);
  c.closePath();
  c.clip();
  c.strokeStyle = "#ff8a1a";
  c.lineCap = "round";
  for (const [x0, x1, lw] of [[0.47, 0.32, 9], [0.53, 0.66, 7], [0.5, 0.48, 6]]) {
    c.lineWidth = lw * k * 0.7;
    c.beginPath();
    c.moveTo(w * x0, top);
    c.quadraticCurveTo(w * (x0 + x1) / 2 + 6 * k, (top + base) / 2, w * x1, base);
    c.stroke();
  }
  c.restore();
  c.beginPath();
  c.ellipse(w / 2, top, w * 0.1, 6 * k * (icon ? 1 : 0.6), 0, 0, Math.PI * 2);
  c.fillStyle = "#ffd040";
  c.fill();
  c.stroke();
  if (icon) {
    c.fillStyle = "rgba(60,50,60,0.85)";
    for (const [x, y, r] of [[60, 28, 9], [72, 20, 7], [56, 16, 6]]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  }
}
