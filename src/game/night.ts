import Phaser from "phaser";

/** A spot of light in the night: world position and radius. */
export interface Light {
  x: number;
  y: number;
  r: number;
}

/** pixels of the world per pixel of the darkness (it is soft, so it can be drawn small) */
const K = 6;

/**
 * Night over the field: a dark blue sheet over the world with soft round holes cut out of it
 * wherever there is light (your lantern, torches, windows). It covers only what the camera sees
 * and is drawn small and scaled up, so it stays cheap. It is not black: the map still shows,
 * it just looks like night.
 */
export class Night {
  private rt: Phaser.GameObjects.RenderTexture;
  private stamp: Phaser.GameObjects.Image;
  private pad: number;
  /** 0 = day, 1 = black; eases toward `want` */
  dark: number;
  want: number;

  constructor(private scene: Phaser.Scene, dark: number, depth: number, private color = 0x0a0e2a) {
    // big enough for the widest view the fight camera shows (zoomed out to ~0.55)
    const w = Math.ceil(scene.scale.width / 0.55 / K) + 40;
    const h = Math.ceil(scene.scale.height / 0.55 / K) + 40;
    this.pad = 20 * K;
    this.rt = scene.add.renderTexture(0, 0, w, h).setOrigin(0).setScale(K).setDepth(depth);
    this.stamp = scene.make.image({ key: "night_light", add: false });
    this.dark = this.want = dark;
  }

  update(lights: Light[], delta: number): void {
    this.dark += (this.want - this.dark) * Math.min(1, delta / 900);
    const cam = this.scene.cameras.main;
    const v = cam.worldView;
    const ox = v.x - this.pad;
    const oy = v.y - this.pad;
    const rt = this.rt;
    rt.setPosition(ox, oy);
    rt.clear();
    if (this.dark < 0.01) return;
    rt.fill(this.color, this.dark);
    const [x1, y1] = [v.right + this.pad, v.bottom + this.pad];
    for (const l of lights) {
      if (l.x + l.r < ox || l.x - l.r > x1 || l.y + l.r < oy || l.y - l.r > y1) continue;
      this.stamp.setScale((l.r * 2) / 128 / K);
      rt.erase(this.stamp, (l.x - ox) / K, (l.y - oy) / K);
    }
  }

  destroy(): void {
    this.rt.destroy();
    this.stamp.destroy();
  }
}
