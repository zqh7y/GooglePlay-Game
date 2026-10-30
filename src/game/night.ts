import Phaser from "phaser";

/** world size of the hole in the night texture, and of the whole texture (radius) */
const HOLE = 1000;
const REACH = 8000;

/**
 * Night over the field: one big dark-blue picture with a soft round hole in the middle, centred on
 * you (your light). Torches, windows and the lost dice glow on top of it (their warm glows sit just
 * above it). It is one plain image, so it costs almost nothing to draw (cutting holes into a
 * full-screen texture every frame lagged badly). It is not black: the map still shows, it just
 * looks like night.
 */
export class Night {
  private img: Phaser.GameObjects.Image;
  /** 0 = day, 1 = black; eases toward `want` */
  dark: number;
  want: number;

  constructor(private scene: Phaser.Scene, dark: number, depth: number, color = 0x0a0e2a) {
    const key = `night_${color}`;
    if (!scene.textures.exists(key)) {
      const size = 512;
      const tex = scene.textures.createCanvas(key, size, size)!;
      const c = tex.getContext();
      const r = size / 2;
      const h = (HOLE / REACH) * r;
      const g = c.createRadialGradient(r, r, 0, r, r, r);
      const rgb = `${(color >> 16) & 255},${(color >> 8) & 255},${color & 255}`;
      g.addColorStop(0, `rgba(${rgb},0)`);
      g.addColorStop((h * 0.45) / r, `rgba(${rgb},0.08)`);
      g.addColorStop(h / r, `rgba(${rgb},0.7)`);
      g.addColorStop((h * 1.6) / r, `rgba(${rgb},1)`);
      g.addColorStop(1, `rgba(${rgb},1)`);
      c.fillStyle = g;
      c.fillRect(0, 0, size, size);
      tex.refresh();
    }
    this.img = scene.add.image(0, 0, key).setDepth(depth);
    this.dark = this.want = dark;
  }

  /** Each frame: the hole follows your light (radius `r`); when the camera is off somewhere else it still covers the view. */
  update(x: number, y: number, r: number, delta: number): void {
    this.dark += (this.want - this.dark) * Math.min(1, delta / 900);
    const v = this.scene.cameras.main.worldView;
    const far = Math.hypot(v.centerX - x, v.centerY - y) + Math.hypot(v.width, v.height) / 2 + 300;
    const k = Math.max(r / HOLE, far / REACH);
    this.img.setPosition(x, y).setScale((k * REACH * 2) / 512).setAlpha(this.dark).setVisible(this.dark > 0.01);
  }

  destroy(): void {
    this.img.destroy();
  }
}
