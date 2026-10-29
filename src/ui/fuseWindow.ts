import Phaser from "phaser";
import { petTexture } from "../art/pets";
import { vividCard } from "../art/ps";
import { ITEMS } from "../data/items";
import type { Tier } from "../data/tiers";
import { FUSE_CLASSES, FUSE_COST, canFuse, fuse, nextClass, spareCopies } from "../systems/fuse";
import { persist } from "../systems/save";
import { buzz, sfx } from "../systems/sound";
import { classBadge } from "./classText";
import { fmt } from "./format";
import { Host } from "./screens";
import { button, drawBar, label, modal, text } from "./widgets";

/**
 * The Fuse window: a row per class with your spare copies, a bar to 100 and FUSE (100 of them
 * become 1 random pet of the next class), and FUSE ALL at the bottom.
 */
export function openFuse(s: Phaser.Scene, host: Host): void {
  sfx.click();
  const W = 1000;
  const H = 1460;
  const top = -H / 2;
  const m = host.showModal(modal(s, W, H, "", "red", undefined, undefined, true));
  const b = m.body;
  b.add(s.add.image(0, 0, vividCard(s, 0xff6a3a, W, H)));
  const icon = s.add.image(-250, top + 108, "icon_fuse").setScale(1.3);
  s.tweens.add({ targets: icon, angle: { from: -12, to: 12 }, duration: 600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  b.add([
    icon,
    text(s, 40, top + 106, "FUSE", 110, "#ffffff", { stroke: 16 }),
    label(s, 0, top + 210, `${FUSE_COST} spare pets of a class  =  1 pet of the next class\n(you never lose a pet you own, only extra copies)`, 30, "#ffffff"),
  ]);
  const rows = s.add.container(0, 0);
  b.add(rows);
  const draw = () => {
    rows.removeAll(true);
    FUSE_CLASSES.forEach((cls, i) => {
      const y = top + 330 + i * 132;
      const have = spareCopies(cls);
      const n = Math.floor(have / FUSE_COST);
      const g = s.add.graphics();
      g.fillStyle(0x000000, 0.22).fillRoundedRect(-450, y - 54 + 6, 900, 108, 26);
      g.fillStyle(0xffffff, 0.92).fillRoundedRect(-450, y - 54, 900, 108, 26);
      drawBar(g, -300, y + 12, 300, 24, n ? 1 : have / FUSE_COST, n ? 0x7ad651 : 0x5ac8ff);
      rows.add([
        g,
        classBadge(s, -385, y, cls, 58),
        text(s, -300, y - 22, `${fmt(have)} / ${FUSE_COST}`, 32, "#3a2a1a", { stroke: false }).setOrigin(0, 0.5),
        text(s, 50, y - 4, "→", 54, "#ffb03b"),
        classBadge(s, 150, y, nextClass(cls), 58),
        button(s, 340, y, 190, 84, n ? "green" : "grey", n > 1 ? `FUSE x${n}` : "FUSE", () => go([cls], n), { size: 28 }),
      ]);
    });
  };
  const go = (classes: Tier[], times: number) => {
    const got: Record<string, number> = {};
    for (const cls of classes) {
      for (let k = 0; k < times || (times === 0 && spareCopies(cls) >= FUSE_COST); k++) {
        const p = fuse(cls);
        if (!p) break;
        got[p.id] = (got[p.id] ?? 0) + 1;
      }
    }
    const ids = Object.keys(got);
    if (!ids.length) {
      host.toast(`You need ${FUSE_COST} spare pets of a class. Roll more!`, "#ffe680");
      return;
    }
    sfx.levelUp();
    buzz(80);
    m.close();
    persist();
    host.petsChanged();
    host.showRewards("FUSED!", ids.sort((a, c) => ITEMS[c].index - ITEMS[a].index).map((id) => ({ icon: petTexture(s, id), amount: `x${got[id]}`, give: () => undefined })));
  };
  draw();
  b.add(button(s, 0, H / 2 - 110, 480, 120, canFuse() ? "gold" : "grey", "FUSE ALL", () => go(FUSE_CLASSES, 0), { icon: "icon_fuse", iconSize: 52, size: 40 }));
}
