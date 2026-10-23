import Phaser from "phaser";
import { canvasTexture, darken, lighten, rgba, starPath } from "../art/draw";
import { Layout } from "../layout";
import { Modal } from "./widgets";

export type Tab = "shop" | "pets" | "battle" | "roll" | "upgrades";

/** What the screens need from the UI scene that hosts them. */
export interface Host {
  L: Layout;
  toast(str: string, color?: string): void;
  petsChanged(): void;
  afterPurchase(): void;
  showModal(m: Modal): Modal;
  coinShower(x: number, y: number, n: number): void;
  tabPos(tab: Tab): { x: number; y: number };
  roll(): void;
  showDaily(): void;
  showOdds(): void;
  isFast(): boolean;
  setFast(on: boolean): void;
  setTab(tab: Tab): void;
}

/** Soft patterned wallpaper for a screen: dice for rolling, paws for pets, coins for the shop. */
export function screenBg(scene: Phaser.Scene, kind: "roll" | "pets" | "shop" | "map"): string {
  const base = { roll: 0x4b3d86, pets: 0x9ad8b0, shop: 0xf6c98e, map: 0x8fcfe8 }[kind];
  return canvasTexture(scene, `bg_${kind}`, 360, 360, (ctx) => {
    ctx.fillStyle = rgba(base);
    ctx.fillRect(0, 0, 360, 360);
    const ink = rgba(kind === "roll" ? lighten(base, 0.12) : darken(base, 0.07));
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    for (const [x, y, rot] of [[60, 60, 0.2], [240, 90, -0.3], [150, 230, 0.5], [320, 300, 0], [30, 300, -0.4]] as [number, number, number][]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      if (kind === "roll") {
        ctx.beginPath();
        ctx.roundRect(-22, -22, 44, 44, 10);
        ctx.fill();
        ctx.fillStyle = rgba(base);
        for (const [dx, dy] of [[-10, -10], [10, 10], [0, 0]]) {
          ctx.beginPath();
          ctx.arc(dx, dy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = ink;
      } else if (kind === "pets") {
        ctx.beginPath();
        ctx.ellipse(0, 6, 13, 11, 0, 0, Math.PI * 2);
        for (const [dx, dy] of [[-14, -10], [-5, -18], [5, -18], [14, -10]]) ctx.ellipse(dx, dy, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === "shop") {
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.lineWidth = 6;
        ctx.stroke();
      } else {
        starPath(ctx, 0, 0, 14, 0.45);
        ctx.fill();
      }
      ctx.restore();
    }
    if (kind === "roll") {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (const [x, y] of [[110, 140], [300, 200], [200, 40], [90, 330], [330, 20]]) {
        starPath(ctx, x, y, 5, 0.4, 4);
        ctx.fill();
      }
    }
  });
}

/** A full screen above the world and below the tab bar. */
export abstract class Screen {
  readonly root: Phaser.GameObjects.Container;

  constructor(protected scene: Phaser.Scene, protected host: Host, bg: "roll" | "pets" | "shop" | "map" | null) {
    const { width: W } = scene.scale;
    this.root = scene.add.container(0, 0).setDepth(3000).setVisible(false);
    if (bg) {
      const back = scene.add.tileSprite(0, 0, W, host.L.navTop, screenBg(scene, bg)).setOrigin(0).setInteractive();
      const shade = scene.add.graphics();
      shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.22, 0.22).fillRect(0, host.L.navTop - 400, W, 400);
      this.root.add([back, shade]);
    }
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(): void {
    this.root.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 160 });
    this.onShow();
  }

  hide(): void {
    this.root.setVisible(false);
    this.onHide();
  }

  protected onShow(): void {}
  protected onHide(): void {}
  update(_time: number): void {}
}
