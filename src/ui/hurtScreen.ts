import Phaser from "phaser";
import { canvasTexture } from "../art/draw";

/**
 * Low health: the edges of the screen go red and a few cracks creep in from the corners, more the
 * lower your health. Under a quarter it beats like a heart. It starts at half health and stays
 * subtle, so it never hides the fight.
 */
export class HurtScreen {
  private edge: Phaser.GameObjects.Image;
  private cracks: Phaser.GameObjects.Image;
  private level = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    const { width: W, height: H } = scene.scale;
    canvasTexture(scene, "hurt_edge", W, H, (c) => {
      const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.5);
      g.addColorStop(0, "rgba(220,20,20,0)");
      g.addColorStop(0.45, "rgba(225,25,25,0.45)");
      g.addColorStop(0.8, "rgba(190,0,0,0.85)");
      g.addColorStop(1, "rgba(140,0,0,1)");
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    });
    canvasTexture(scene, "hurt_cracks", W, H, (c) => {
      // thin dark cracks from each corner, with a light edge like broken glass
      let seed = 7;
      const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const crack = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
        const pts: [number, number][] = [[x, y]];
        let [px, py] = [x, y];
        for (let i = 0; i < 6; i++) {
          a += (r() - 0.5) * 0.7;
          px += Math.cos(a) * (len / 6);
          py += Math.sin(a) * (len / 6);
          pts.push([px, py]);
          if (depth > 0 && r() < 0.35) crack(px, py, a + (r() < 0.5 ? -0.8 : 0.8), len * 0.45, w * 0.6, depth - 1);
        }
        for (const [col, lw, dx] of [["rgba(255,220,220,0.35)", w + 2, 1.5], ["rgba(40,0,0,0.85)", w, 0]] as const) {
          c.beginPath();
          pts.forEach(([qx, qy], i) => (i ? c.lineTo(qx + dx, qy + dx) : c.moveTo(qx + dx, qy + dx)));
          c.strokeStyle = col;
          c.lineWidth = lw;
          c.lineCap = "round";
          c.lineJoin = "round";
          c.stroke();
        }
      };
      const corners: [number, number, number][] = [[0, 0, 0.8], [W, 0, Math.PI - 0.8], [0, H, -0.8], [W, H, Math.PI + 0.8]];
      for (const [x, y, a] of corners) for (let k = 0; k < 3; k++) crack(x, y, a + (k - 1) * 0.35, 260 + r() * 160, 5, 2);
    });
    this.edge = scene.add.image(0, 0, "hurt_edge").setOrigin(0).setDepth(depth).setAlpha(0).setVisible(false);
    this.cracks = scene.add.image(0, 0, "hurt_cracks").setOrigin(0).setDepth(depth).setAlpha(0).setVisible(false);
  }

  /** `hp` is your health share (0..1), or null when you are not in a fight. */
  update(hp: number | null, time: number, delta: number): void {
    // 0 at half health and up, 1 at no health; eased so it moves smoothly
    const want = hp === null ? 0 : Phaser.Math.Clamp((0.5 - hp) / 0.5, 0, 1);
    this.level += (want - this.level) * Math.min(1, delta / 300);
    const on = this.level > 0.01;
    this.edge.setVisible(on);
    this.cracks.setVisible(on && this.level > 0.35);
    if (!on) return;
    // a heartbeat (two quick beats) once it is low
    const beat = this.level > 0.5 ? Math.max(0, Math.sin(time / 130)) ** 6 * (time % 1100 < 520 ? 1 : 0) : 0;
    this.edge.setAlpha(Math.min(1, this.level * 0.9 + beat * 0.2));
    this.cracks.setAlpha(Math.min(0.75, (this.level - 0.35) * 1.3));
  }
}
