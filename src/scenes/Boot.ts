import Phaser from "phaser";

/**
 * Draws all placeholder art with code so the game runs with zero image files.
 * Replace these with real sprites later by loading images under the same keys.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const tex = (key: string, w: number, h: number, draw: () => void) => {
      g.clear();
      draw();
      g.generateTexture(key, w, h);
    };
    const catHead = (cx: number, cy: number, r: number, body: number) => {
      g.fillStyle(body);
      g.fillTriangle(cx - r, cy - r * 0.3, cx - r * 0.75, cy - r * 1.35, cx - r * 0.15, cy - r * 0.8);
      g.fillTriangle(cx + r, cy - r * 0.3, cx + r * 0.75, cy - r * 1.35, cx + r * 0.15, cy - r * 0.8);
      g.fillCircle(cx, cy, r);
      g.fillStyle(0x1f2937);
      g.fillCircle(cx - r * 0.38, cy - r * 0.05, r * 0.16);
      g.fillCircle(cx + r * 0.38, cy - r * 0.05, r * 0.16);
      g.fillStyle(0xffffff);
      g.fillCircle(cx - r * 0.33, cy - r * 0.12, r * 0.06);
      g.fillCircle(cx + r * 0.43, cy - r * 0.12, r * 0.06);
      g.fillStyle(0xf472b6);
      g.fillTriangle(cx - r * 0.1, cy + r * 0.2, cx + r * 0.1, cy + r * 0.2, cx, cy + r * 0.32);
    };

    // The hero: orange cat with a blaster, facing right
    tex("hero", 110, 100, () => {
      g.fillStyle(0xf59e0b);
      g.fillEllipse(44, 78, 52, 36); // body
      g.fillStyle(0x374151);
      g.fillRoundedRect(52, 58, 52, 16, 5); // gun
      g.fillRect(60, 70, 10, 14);
      g.fillStyle(0x60a5fa);
      g.fillRect(96, 61, 10, 10);
      catHead(40, 44, 28, 0xfbbf24);
      g.fillStyle(0xef4444);
      g.fillRect(14, 62, 52, 6); // scarf
    });

    // Pets (white so they can be tinted any colour)
    tex("pet_slime", 72, 62, () => {
      g.fillStyle(0x000000, 0.18);
      g.fillEllipse(36, 56, 60, 12);
      g.fillStyle(0xffffff);
      g.fillEllipse(36, 36, 64, 46);
      g.fillCircle(36, 22, 18);
      g.fillStyle(0x1f2937);
      g.fillCircle(26, 32, 5);
      g.fillCircle(46, 32, 5);
      g.fillStyle(0xffffff);
      g.fillCircle(27, 30, 2);
      g.fillCircle(47, 30, 2);
      g.lineStyle(3, 0x1f2937);
      g.beginPath();
      g.arc(36, 38, 7, 0.2, Math.PI - 0.2);
      g.strokePath();
    });
    tex("pet_cat", 72, 72, () => {
      catHead(36, 42, 26, 0xffffff);
    });

    // Enemies (white, tinted per type) — they walk in from the right, facing left
    tex("e_slime", 56, 44, () => {
      g.fillStyle(0xffffff);
      g.fillEllipse(28, 26, 54, 34);
      g.fillStyle(0x111111);
      g.fillCircle(17, 22, 4);
      g.fillCircle(30, 22, 4);
      g.fillRect(14, 31, 14, 3);
    });
    tex("e_bat", 64, 36, () => {
      g.fillStyle(0xffffff);
      g.fillTriangle(0, 6, 24, 16, 20, 32);
      g.fillTriangle(64, 6, 40, 16, 44, 32);
      g.fillCircle(32, 18, 12);
      g.fillStyle(0xdc2626);
      g.fillCircle(27, 16, 3);
      g.fillCircle(37, 16, 3);
    });
    tex("e_zombie", 60, 84, () => {
      g.fillStyle(0xffffff);
      g.fillRoundedRect(14, 30, 32, 40, 8);
      g.fillCircle(30, 20, 17);
      g.fillRect(0, 38, 22, 9); // reaching arm
      g.fillRect(16, 68, 10, 16);
      g.fillRect(34, 68, 10, 16);
      g.fillStyle(0x111111);
      g.fillCircle(22, 17, 4);
      g.fillCircle(34, 17, 3);
      g.fillRect(20, 27, 14, 3);
    });

    // Effects
    tex("bullet", 18, 18, () => {
      g.fillStyle(0xffffff);
      g.fillCircle(9, 9, 8);
    });
    tex("particle", 8, 8, () => {
      g.fillStyle(0xffffff);
      g.fillCircle(4, 4, 4);
    });
    tex("glow", 256, 256, () => {
      for (let r = 128; r > 0; r -= 4) {
        g.fillStyle(0xffffff, 0.03);
        g.fillCircle(128, 128, r);
      }
    });
    tex("grid", 80, 80, () => {
      g.fillStyle(0x1a1c33);
      g.fillRect(0, 0, 80, 80);
      g.lineStyle(2, 0x23264a);
      g.strokeRect(0, 0, 80, 80);
    });

    // Dice faces 1-6: white body, dark pips — tint with the die colour
    const S = 160;
    const pipPos: Record<number, [number, number][]> = {
      1: [[0.5, 0.5]],
      2: [[0.27, 0.27], [0.73, 0.73]],
      3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
      4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
      5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
      6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
    };
    for (let f = 1; f <= 6; f++) {
      tex(`face${f}`, S, S, () => {
        g.fillStyle(0x999999);
        g.fillRoundedRect(4, 10, S - 8, S - 12, 28);
        g.fillStyle(0xffffff);
        g.fillRoundedRect(4, 4, S - 8, S - 14, 28);
        g.fillStyle(0x2a2a2a);
        for (const [px, py] of pipPos[f]) g.fillCircle(px * S, py * (S - 10), 13);
      });
    }

    g.destroy();
    this.scene.start("Battle");
    this.scene.launch("UI");
  }
}
