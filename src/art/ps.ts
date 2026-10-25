import Phaser from "phaser";
import { canvasTexture, darken, lighten, rgba } from "./draw";
import { text } from "../ui/widgets";

const BLACK = "#111111";

/**
 * Pet Simulator style shop art: a paint splat that goes behind every reward (white, so a tint
 * colours it while its black outline stays black), a crown for VIP and a vivid sunburst card.
 */
export function makePsTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, "paint_splash", 200, 200, (c) => {
    // a lumpy blob with a few round drops around it
    const blob = () => {
      c.beginPath();
      const n = 14;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = 70 + ((i * 37) % 11) - 4 + (i % 3 === 0 ? 8 : 0);
        const x = 100 + Math.cos(a) * r;
        const y = 100 + Math.sin(a) * r * 0.94;
        if (i === 0) c.moveTo(x, y);
        else {
          const pa = ((i - 0.5) / n) * Math.PI * 2;
          c.quadraticCurveTo(100 + Math.cos(pa) * (r + 12), 100 + Math.sin(pa) * (r + 12) * 0.94, x, y);
        }
      }
      c.closePath();
    };
    const drops: [number, number, number][] = [[176, 52, 11], [28, 150, 9], [168, 168, 7], [34, 38, 6]];
    c.lineWidth = 7;
    c.strokeStyle = BLACK;
    blob();
    c.stroke();
    for (const [x, y, r] of drops) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = "#ffffff";
    blob();
    c.fill();
    for (const [x, y, r] of drops) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    // a paint shine
    c.fillStyle = "rgba(255,255,255,0.55)";
    c.beginPath();
    c.ellipse(76, 66, 26, 12, -0.6, 0, Math.PI * 2);
    c.fill();
  });

  canvasTexture(scene, "pass_vip", 160, 130, (c) => {
    c.beginPath();
    c.moveTo(18, 108);
    c.lineTo(10, 30);
    c.lineTo(50, 62);
    c.lineTo(80, 12);
    c.lineTo(110, 62);
    c.lineTo(150, 30);
    c.lineTo(142, 108);
    c.closePath();
    const g = c.createLinearGradient(0, 10, 0, 110);
    g.addColorStop(0, "#fff3a0");
    g.addColorStop(1, "#ffb020");
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 8;
    c.strokeStyle = BLACK;
    c.lineJoin = "round";
    c.stroke();
    c.fillStyle = "#ff4a5a";
    for (const x of [48, 80, 112]) {
      c.beginPath();
      c.arc(x, 88, 9, 0, Math.PI * 2);
      c.fill();
      c.lineWidth = 4;
      c.stroke();
    }
  });
}

/** A vivid card: colour gradient, sunburst rays, sparkles and a thick black outline. */
export function vividCard(scene: Phaser.Scene, color: number, w: number, h: number): string {
  return canvasTexture(scene, `ps_vivid_${color}_${w}_${h}`, w + 12, h + 16, (c) => {
    const shape = (x: number, y: number) => {
      c.beginPath();
      c.roundRect(x, y, w - 8, h - 8, 34);
    };
    shape(8, 16);
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.fill();
    c.save();
    shape(4, 4);
    c.clip();
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgba(lighten(color, 0.35)));
    g.addColorStop(0.55, rgba(color));
    g.addColorStop(1, rgba(darken(color, 0.3)));
    c.fillStyle = g;
    c.fillRect(0, 0, w + 12, h + 16);
    // sunburst from the middle
    const cx = w / 2;
    const cy = h * 0.45;
    const R = Math.hypot(w, h);
    c.fillStyle = "rgba(255,255,255,0.13)";
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      c.lineTo(cx + Math.cos(a + 0.17) * R, cy + Math.sin(a + 0.17) * R);
      c.fill();
    }
    const glow = c.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.6);
    glow.addColorStop(0, "rgba(255,255,255,0.45)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = glow;
    c.fillRect(0, 0, w + 12, h + 16);
    // sparkles
    c.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < Math.round((w * h) / 22000); i++) {
      const x = 20 + ((i * 7919) % (w - 40));
      const y = 20 + ((i * 104729) % (h - 40));
      const r = 3 + (i % 4) * 2;
      c.beginPath();
      c.moveTo(x, y - r * 2);
      c.lineTo(x + r * 0.5, y - r * 0.5);
      c.lineTo(x + r * 2, y);
      c.lineTo(x + r * 0.5, y + r * 0.5);
      c.lineTo(x, y + r * 2);
      c.lineTo(x - r * 0.5, y + r * 0.5);
      c.lineTo(x - r * 2, y);
      c.lineTo(x - r * 0.5, y - r * 0.5);
      c.fill();
    }
    // glossy top
    c.fillStyle = "rgba(255,255,255,0.18)";
    c.fillRect(0, 0, w + 12, 18);
    c.restore();
    shape(4, 4);
    c.lineWidth = 10;
    c.strokeStyle = BLACK;
    c.stroke();
  });
}

/**
 * An item on a paint splat, like an inventory slot: the splat in the item's colour, the item,
 * its count (x3) bottom right and an optional star badge for rare things.
 */
export function itemSplash(scene: Phaser.Scene, icon: string, size: number, color: number, count?: string, star = false): Phaser.GameObjects.Container {
  const splat = scene.add.image(0, 0, "paint_splash").setTint(color).setScale((size * 1.35) / 200).setAngle(Math.random() * 360);
  const img = scene.add.image(0, -size * 0.04, icon);
  img.setScale((size * 0.82) / Math.max(img.width, img.height));
  const parts: Phaser.GameObjects.GameObject[] = [splat, img];
  if (count) parts.push(text(scene, size * 0.42, size * 0.42, count, Math.round(size * 0.3), "#ffffff", { stroke: Math.max(6, Math.round(size * 0.07)) }).setOrigin(1, 0.5));
  if (star) parts.push(scene.add.star(-size * 0.48, -size * 0.48, 5, size * 0.09, size * 0.2, 0xffe066).setStrokeStyle(4, 0x111111));
  return scene.add.container(0, 0, parts);
}

/** A big tappable vivid card (lobby buttons): squishes when pressed. */
export function cardButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color: number, parts: Phaser.GameObjects.GameObject[], onTap: () => void): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y, [scene.add.image(2, 4, vividCard(scene, color, w, h)), ...parts]).setSize(w, h).setInteractive({ useHandCursor: true });
  c.on("pointerdown", () => scene.tweens.add({ targets: c, scale: 0.93, duration: 60 }));
  c.on("pointerout", () => c.setScale(1));
  c.on("pointerup", () => {
    c.setScale(1);
    onTap();
  });
  return c;
}

/** A round arrow button (left or right) with a black outline. */
export function arrowButton(scene: Phaser.Scene, x: number, y: number, dir: -1 | 1, onTap: () => void): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y, [
    scene.add.circle(0, 3, 34, 0x111111),
    scene.add.circle(0, 0, 30, 0xffcf3a).setStrokeStyle(6, 0x111111),
    (dir > 0 ? scene.add.triangle(3, 0, 0, 0, 0, 30, 24, 15, 0xffffff) : scene.add.triangle(-3, 0, 24, 0, 24, 30, 0, 15, 0xffffff)).setStrokeStyle(4, 0x111111),
  ]).setSize(84, 84).setInteractive({ useHandCursor: true });
  c.on("pointerdown", () => scene.tweens.add({ targets: c, scale: 0.85, duration: 60 }));
  c.on("pointerout", () => c.setScale(1));
  c.on("pointerup", () => {
    c.setScale(1);
    onTap();
  });
  return c;
}
