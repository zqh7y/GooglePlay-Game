import Phaser from "phaser";
import { canvasTexture } from "../art/draw";
import { GAME_W } from "../layout";
import { text } from "./widgets";

/** Something the player has to get to: the air zone, the snack, the beast's cage. */
export interface Goal {
  /** where it is on the screen */
  sx: number;
  sy: number;
  icon: string;
  label: string;
  color: number;
  /** distance in metres (shown when it is off screen) */
  m: number;
}

const R = 62;

/**
 * Big goal markers: on screen a badge bobs over the goal with a pointer down to it; off screen
 * the badge sticks to the edge of the screen with an arrow pointing the way and the distance.
 */
export class GoalPins {
  private pins: { box: Phaser.GameObjects.Container; ring: Phaser.GameObjects.Image; disc: Phaser.GameObjects.Image; tip: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text; dist: Phaser.GameObjects.Text }[] = [];

  constructor(scene: Phaser.Scene, depth: number) {
    canvasTexture(scene, "goal_disc", R * 2 + 12, R * 2 + 12, (c) => {
      c.beginPath();
      c.arc(R + 6, R + 6, R, 0, Math.PI * 2);
      c.fillStyle = "#ffffff";
      c.fill();
      c.lineWidth = 7;
      c.strokeStyle = "#2a1a12";
      c.stroke();
    });
    canvasTexture(scene, "goal_ring", R * 2 + 40, R * 2 + 40, (c) => {
      c.beginPath();
      c.arc(R + 20, R + 20, R + 12, 0, Math.PI * 2);
      c.lineWidth = 8;
      c.strokeStyle = "#ffffff";
      c.stroke();
    });
    canvasTexture(scene, "goal_tip", 84, 66, (c) => {
      c.beginPath();
      c.moveTo(6, 6);
      c.lineTo(78, 6);
      c.lineTo(42, 60);
      c.closePath();
      c.fillStyle = "#ffffff";
      c.fill();
      c.lineWidth = 6;
      c.lineJoin = "round";
      c.strokeStyle = "#2a1a12";
      c.stroke();
    });
    for (let i = 0; i < 3; i++) {
      const ring = scene.add.image(0, 0, "goal_ring");
      const tip = scene.add.image(0, 0, "goal_tip");
      const disc = scene.add.image(0, 0, "goal_disc");
      const icon = scene.add.image(0, 0, "mode_air").setScale(0.75);
      const name = text(scene, 0, R + 18, "", 40);
      const dist = text(scene, 0, R + 44, "", 34, "#ffffff");
      const box = scene.add.container(0, 0, [ring, tip, disc, icon, name, dist]).setDepth(depth).setVisible(false);
      this.pins.push({ box, ring, disc, tip, icon, name, dist });
    }
  }

  update(goals: Goal[], top: number, bottom: number, time: number): void {
    this.pins.forEach((p, i) => {
      const g = goals[i];
      if (!g) {
        p.box.setVisible(false);
        return;
      }
      p.box.setVisible(true);
      p.disc.setTint(g.color);
      p.tip.setTint(g.color);
      p.ring.setTint(g.color).setScale(1 + ((time / 900) % 1) * 0.5).setAlpha(1 - ((time / 900) % 1));
      if (p.icon.texture.key !== g.icon) {
        p.icon.setTexture(g.icon);
        p.icon.setScale(92 / Math.max(p.icon.frame.width, p.icon.frame.height));
      }
      p.name.setText(g.label);
      const pad = R + 46;
      const on = g.sx > pad && g.sx < GAME_W - pad && g.sy > top + pad + 60 && g.sy < bottom - pad;
      if (on) {
        // over the goal, bobbing, with the pointer down to it
        const bob = Math.sin(time / 180) * 10;
        p.box.setPosition(g.sx, g.sy - 230 + bob).setScale(1);
        p.tip.setPosition(0, R + 6).setRotation(0);
        p.name.setPosition(0, -R - 30).setOrigin(0.5);
        p.dist.setText("");
      } else {
        // stuck to the edge of the screen, pointing the way
        const cx = GAME_W / 2;
        const cy = (top + bottom) / 2;
        const a = Math.atan2(g.sy - cy, g.sx - cx);
        const kx = (GAME_W / 2 - pad) / Math.max(0.001, Math.abs(Math.cos(a)));
        const ky = ((bottom - top) / 2 - pad - 30) / Math.max(0.001, Math.abs(Math.sin(a)));
        const k = Math.min(kx, ky);
        const pulse = 1 + Math.sin(time / 140) * 0.06;
        p.box.setPosition(cx + Math.cos(a) * k, cy + Math.sin(a) * k).setScale(pulse);
        p.tip.setPosition(Math.cos(a) * (R + 18), Math.sin(a) * (R + 18)).setRotation(a - Math.PI / 2);
        const below = Math.sin(a) < 0.3;
        // labels go toward the middle of the screen so they never hang off the side
        const ox = Math.cos(a) < -0.5 ? 0 : Math.cos(a) > 0.5 ? 1 : 0.5;
        const tx = ox === 0 ? -R : ox === 1 ? R : 0;
        p.name.setPosition(tx, below ? R + 34 : -R - 76).setOrigin(ox, 0.5);
        p.dist.setPosition(tx, below ? R + 74 : -R - 36).setOrigin(ox, 0.5).setText(`${Math.max(1, Math.round(g.m))}m`);
      }
    });
  }

  hide(): void {
    for (const p of this.pins) p.box.setVisible(false);
  }
}
