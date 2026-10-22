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

    // Player: a cat head
    tex("player", 64, 64, () => {
      g.fillStyle(0xfbbf24);
      g.fillTriangle(8, 26, 14, 2, 28, 18);
      g.fillTriangle(56, 26, 50, 2, 36, 18);
      g.fillCircle(32, 36, 24);
      g.fillStyle(0x1f2937);
      g.fillCircle(23, 34, 4);
      g.fillCircle(41, 34, 4);
      g.fillStyle(0xf472b6);
      g.fillTriangle(29, 42, 35, 42, 32, 46);
    });

    // Enemies (drawn white so they can be tinted)
    tex("slime", 48, 40, () => {
      g.fillStyle(0xffffff);
      g.fillEllipse(24, 24, 46, 32);
      g.fillStyle(0x111111);
      g.fillCircle(17, 20, 3);
      g.fillCircle(31, 20, 3);
    });
    tex("bat", 56, 32, () => {
      g.fillStyle(0xffffff);
      g.fillTriangle(0, 6, 22, 14, 18, 28);
      g.fillTriangle(56, 6, 34, 14, 38, 28);
      g.fillCircle(28, 16, 11);
      g.fillStyle(0x111111);
      g.fillCircle(24, 15, 2);
      g.fillCircle(32, 15, 2);
    });
    tex("brute", 64, 64, () => {
      g.fillStyle(0xffffff);
      g.fillRoundedRect(4, 8, 56, 52, 12);
      g.fillTriangle(10, 12, 16, 0, 22, 12);
      g.fillTriangle(42, 12, 48, 0, 54, 12);
      g.fillStyle(0x111111);
      g.fillRect(16, 24, 10, 5);
      g.fillRect(38, 24, 10, 5);
      g.fillRect(20, 44, 24, 4);
    });

    // Projectiles, pickups, effects
    tex("bullet", 16, 16, () => {
      g.fillStyle(0xffffff);
      g.fillCircle(8, 8, 7);
    });
    tex("blade", 40, 14, () => {
      g.fillStyle(0xffffff);
      g.fillEllipse(20, 7, 40, 12);
    });
    tex("gem", 16, 20, () => {
      g.fillStyle(0xffffff);
      g.fillTriangle(8, 0, 16, 10, 0, 10);
      g.fillTriangle(0, 10, 16, 10, 8, 20);
    });
    tex("particle", 8, 8, () => {
      g.fillStyle(0xffffff);
      g.fillCircle(4, 4, 4);
    });
    tex("ring", 256, 256, () => {
      g.fillStyle(0xffffff, 0.18);
      g.fillCircle(128, 128, 128);
      g.lineStyle(6, 0xffffff, 0.6);
      g.strokeCircle(128, 128, 124);
    });
    tex("grid", 80, 80, () => {
      g.fillStyle(0x1a1c33);
      g.fillRect(0, 0, 80, 80);
      g.lineStyle(2, 0x23264a);
      g.strokeRect(0, 0, 80, 80);
      g.fillStyle(0x23264a);
      g.fillCircle(40, 40, 3);
    });
    tex("glow", 256, 256, () => {
      for (let r = 128; r > 0; r -= 4) {
        g.fillStyle(0xffffff, 0.03);
        g.fillCircle(128, 128, r);
      }
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

    // Weapon icons (white, tinted per item)
    tex("icon_bolt", 64, 64, () => {
      g.fillStyle(0xffffff);
      g.fillTriangle(54, 32, 30, 14, 30, 50);
      g.fillRect(8, 26, 26, 12);
    });
    tex("icon_orbit", 64, 64, () => {
      g.lineStyle(4, 0xffffff, 0.5);
      g.strokeCircle(32, 32, 22);
      g.fillStyle(0xffffff);
      g.fillCircle(32, 10, 8);
      g.fillCircle(32, 54, 8);
      g.fillCircle(32, 32, 6);
    });
    tex("icon_aura", 64, 64, () => {
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(32, 32, 28);
      g.fillStyle(0xffffff, 0.6);
      g.fillCircle(32, 32, 18);
      g.fillStyle(0xffffff);
      g.fillCircle(32, 32, 8);
    });
    tex("icon_nova", 64, 64, () => {
      g.fillStyle(0xffffff);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillCircle(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22, 5);
      }
      g.fillCircle(32, 32, 9);
    });
    tex("icon_lightning", 64, 64, () => {
      g.fillStyle(0xffffff);
      g.fillPoints(
        [
          { x: 38, y: 2 }, { x: 14, y: 36 }, { x: 30, y: 36 },
          { x: 22, y: 62 }, { x: 50, y: 24 }, { x: 34, y: 24 },
        ],
        true,
      );
    });

    g.destroy();
    this.scene.start("Hub");
  }
}
