import Phaser from "phaser";
import { onlineEnabled, ownersOf } from "../online/online";
import { INK, canvasTexture, linear, radial, rr } from "../art/draw";
import { petTexture } from "../art/pets";
import { CARD_H, CARD_W, panelTexture, slotTexture } from "../art/ui";
import { ITEMS, MAX_LEVEL, PET_LIST, copiesFor, isPremium, levelMult } from "../data/items";
import { RARITY_INFO } from "../data/rarity";
import { DICE_TIERS, TIER_INFO, tierIndex } from "../data/tiers";
import { INDEX_LUCK, INDEX_STEP, indexBonus } from "../systems/goals";
import { canLevelUp, levelUp, persist, save, toggleEquip } from "../systems/save";
import { buzz, sfx } from "../systems/sound";
import { MAX_PETS, dmgMult, petSlots } from "../systems/stats";
import { fmt, oneIn } from "./format";
import { classBadge, classText } from "./classText";
import { Host, Screen } from "./screens";
import { Modal, button, drawBar, fitText, label, modal, text } from "./widgets";
import { gemCard } from "./cardOptions";
import { FUSE_CLASSES, FUSE_COST, canFuse, fuse, nextClass, spareCopies } from "../systems/fuse";
import { vividCard } from "../art/ps";
import type { Tier } from "../data/tiers";

/** The Dark Gem card is 200 x 250; grow it to fill the old card's space. */
const CARD_SCALE = Math.min(CARD_W / 200, CARD_H / 250);

const KIND_LABEL = { shot: "Shooter", pierce: "Star thrower", splash: "Bomber", zap: "Pouncer", buff: "Support" };

type Sort = "power" | "rarity" | "level" | "new";
const SORTS: Sort[] = ["power", "rarity", "level", "new"];
const SORT_LABEL: Record<Sort, string> = { power: "Power", rarity: "Rarity", level: "Level", new: "Newest" };

/** Rough strength of a pet at its level, used by "Equip Best". */
export function petScore(id: string): number {
  const def = ITEMS[id];
  const m = levelMult(save.pets[id]?.level ?? 1);
  if (def.kind === "buff") return def.damage * m * 0.05 * (1 + def.index);
  return ((def.damage * m * def.count) / (def.cooldown / 1000)) * (def.kind === "splash" || def.kind === "pierce" ? 1.4 : 1);
}

/** The big "POWER" number shown for pets and the team. */
export const petPower = (id: string) => petScore(id) * dmgMult() * 10;
const teamPower = () => save.equipped.reduce((s, id) => s + petPower(id), 0);

export const anyLevelReady = () => Object.keys(save.pets).some(canLevelUp);
const readyCount = () => Object.keys(save.pets).filter(canLevelUp).length;

/** The team's stage: a purple room with three spotlights and a dark floor. */
function stageTexture(scene: Phaser.Scene, w: number, h: number): string {
  return canvasTexture(scene, `pets_stage_${w}_${h}`, w, h, (ctx) => {
    rr(ctx, 4, 4, w - 8, h - 8, 36);
    ctx.fillStyle = radial(ctx, w / 2, h * 0.1, w * 0.75, [[0, "#6a58c0"], [0.55, "#40337a"], [1, "#261d52"]]);
    ctx.fill();
    ctx.save();
    rr(ctx, 4, 4, w - 8, h - 8, 36);
    ctx.clip();
    for (const x of [w / 2 - 320, w / 2, w / 2 + 320]) {
      ctx.beginPath();
      ctx.moveTo(x - 36, 0);
      ctx.lineTo(x + 36, 0);
      ctx.lineTo(x + 140, h);
      ctx.lineTo(x - 140, h);
      ctx.closePath();
      ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, "rgba(255,240,200,0.32)"], [1, "rgba(255,240,200,0)"]]);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(20,10,40,0.35)";
    ctx.fillRect(0, h * 0.74, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    for (const [x, y, r] of [[60, 140, 3], [190, 70, 2], [w - 70, 150, 3], [w - 210, 60, 2], [w / 2 + 170, 190, 2], [w / 2 - 180, 200, 2]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    rr(ctx, 4, 4, w - 8, h - 8, 36);
    ctx.lineWidth = 8;
    ctx.strokeStyle = INK;
    ctx.stroke();
  });
}

/**
 * My Pets and the Index. At the top your team stands on a lit stage with its TEAM POWER;
 * below it the collection tracker, then every pet you own (or all 100 in the Index) with
 * level bars, NEW tags and glowing "ready to level" cards.
 */
export class PetsScreen extends Screen {
  private tab: "pets" | "index" = "pets";
  private sort: Sort = "power";
  private content: Phaser.GameObjects.Container;
  private list: Phaser.GameObjects.Container | null = null;
  private listTop = 0;
  private listBottom = 0;
  private listMax = 0;
  private items: { obj: Phaser.GameObjects.Container; onTap: () => void }[] = [];
  private detail: Modal | null = null;
  private drag = { on: false, y: 0, oy: 0, moved: false };
  private team: { img: Phaser.GameObjects.Image; id: string }[] = [];
  private powerText: Phaser.GameObjects.Text | null = null;
  private power = { shown: -1 };

  constructor(scene: Phaser.Scene, host: Host) {
    super(scene, host, "pets");
    const s = scene;
    this.content = s.add.container(0, 0);
    this.root.add(this.content);

    s.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.visible || !this.list || this.detail || p.y < this.listTop || p.y > this.listBottom) return;
      this.drag = { on: true, y: p.y, oy: this.list.y, moved: false };
    });
    s.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.drag.on || !p.isDown || !this.list) return;
      const dy = p.y - this.drag.y;
      if (Math.abs(dy) > 14) this.drag.moved = true;
      this.list.y = Phaser.Math.Clamp(this.drag.oy + dy, -this.listMax, 0);
    });
    s.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!this.drag.on) return;
      this.drag.on = false;
      if (this.drag.moved || !this.list) return;
      const hit = this.items.find(({ obj }) => {
        const m = obj.getWorldTransformMatrix();
        return Math.abs(p.x - m.tx) < (CARD_W * m.scaleX) / 2 && Math.abs(p.y - m.ty) < (CARD_H * m.scaleY) / 2;
      });
      hit?.onTap();
    });
  }

  protected onShow(): void {
    this.build();
  }

  /** Pets you have seen in the list are not NEW any more. */
  protected onHide(): void {
    if (save.newPets.length) {
      save.newPets = [];
      persist();
    }
  }

  private setTab(tab: "pets" | "index"): void {
    sfx.click();
    this.tab = tab;
    this.list = null;
    this.build();
  }

  /** Rebuild the screen, keeping the scroll position. */
  build(): void {
    const keepY = this.list?.y ?? 0;
    const s = this.scene;
    const W = s.scale.width;
    const L = this.host.L;
    this.content.removeAll(true);
    this.items = [];
    this.team = [];

    const y0 = L.headerBottom + 8;
    this.buildTeam(y0, 440);
    const collY = y0 + 440 + 16 + 72;
    this.buildCollection(collY);

    // tabs and sorting
    const tabY = collY + 72 + 16 + 48;
    this.content.add(button(s, 152, tabY, 272, 96, this.tab === "pets" ? "orange" : "grey", "MY PETS", () => this.setTab("pets"), { icon: "icon_paw", iconSize: 44, size: 28 }));
    this.content.add(button(s, 410, tabY, 232, 96, this.tab === "index" ? "blue" : "grey", "INDEX", () => this.setTab("index"), { icon: "icon_book", iconSize: 44, size: 28 }));
    // FUSE: 100 spare copies of a class = 1 pet of the next class
    const ready = canFuse();
    this.content.add(button(s, 650, tabY, 236, 96, ready ? "red" : "gold", "FUSE", () => this.openFuse(), { icon: "icon_fuse", iconSize: 44, size: 30 }));
    if (ready) {
      const badge = s.add.container(752, tabY - 42, [s.add.circle(0, 0, 20, 0xf03e3e).setStrokeStyle(5, 0xffffff), text(s, 0, -1, "!", 28, "#ffffff", { stroke: 5 })]);
      s.tweens.add({ targets: badge, scale: 1.18, duration: 420, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.content.add(badge);
    }
    if (this.tab === "pets") {
      this.content.add(button(s, 910, tabY, 250, 96, "purple", SORT_LABEL[this.sort], () => {
        sfx.click();
        this.sort = SORTS[(SORTS.indexOf(this.sort) + 1) % SORTS.length];
        this.list = null;
        this.build();
      }, { size: 30, sub: "sort" }));
    } else {
      this.content.add(text(s, 910, tabY, `${save.discovered.length}/${PET_LIST.length}`, 40, "#ffffff"));
    }

    // the grid
    const gridTop = tabY + 64;
    const gridBottom = L.navTop - 20;
    this.content.add(s.add.image(W / 2, (gridTop + gridBottom) / 2, panelTexture(s, "inset", 1040, gridBottom - gridTop)));
    const list = s.add.container(0, 0);
    const mask = s.make.graphics({}, false).fillRect(0, gridTop + 6, W, gridBottom - gridTop - 12);
    list.setMask(mask.createGeometryMask());
    this.content.add(list);
    // five cards per row
    const cols = 5;
    const colW = 200;
    const scale = 0.82;
    const rowH = CARD_H * scale + 22;
    const ids = this.tab === "pets" ? this.sorted() : PET_LIST.map((p) => p.id);
    // after your pets: the next ones to find, as "???" teasers that take you to the Roll screen
    const teasers = this.tab === "pets" ? PET_LIST.filter((p) => !save.discovered.includes(p.id)).sort((a, b) => a.oneIn - b.oneIn).slice(0, 5 + ((5 - (ids.length % 5)) % 5)) : [];
    teasers.forEach((p) => ids.push(p.id));
    ids.forEach((id, i) => {
      const x = W / 2 + ((i % cols) - (cols - 1) / 2) * colW;
      const y = gridTop + 20 + (CARD_H * scale) / 2 + Math.floor(i / cols) * rowH;
      const owned = !!save.pets[id];
      if (owned && canLevelUp(id)) {
        // ready to level: a green glow pulses behind the card
        const g = s.add.image(x, y, "glow").setTint(0x7aff5a).setScale(scale * 1.5, scale * 1.9).setAlpha(0.5);
        s.tweens.add({ targets: g, alpha: 1, duration: 600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        list.add(g);
      } else if (owned && tierIndex(ITEMS[id].cls) >= 3) {
        list.add(s.add.image(x, y, "glow").setTint(TIER_INFO[ITEMS[id].cls].color).setScale(scale * 1.4, scale * 1.8).setAlpha(0.55));
      }
      const card = owned
        ? gemCard(s, x, y, id, { equipped: save.equipped.includes(id), isNew: save.newPets.includes(id) }).setScale(scale * CARD_SCALE)
        : gemCard(s, x, y, id).setScale(scale * CARD_SCALE);
      list.add(card);
      if (owned) this.items.push({ obj: card, onTap: () => this.openPet(id) });
      else if (this.tab === "pets") {
        card.setAlpha(0.75);
        card.add(text(s, 0, 24, "ROLL TO\nFIND", 30, "#ffe066"));
        this.items.push({ obj: card, onTap: () => this.host.setTab("roll") });
      }
    });
    this.list = list;
    this.listTop = gridTop;
    this.listBottom = gridBottom;
    this.listMax = Math.max(0, Math.ceil(ids.length / cols) * rowH + 36 - (gridBottom - gridTop));
    list.y = Phaser.Math.Clamp(keepY, -this.listMax, 0);
  }

  private sorted(): string[] {
    const ids = Object.keys(save.pets);
    const byRarity = (a: string, b: string) => ITEMS[b].index - ITEMS[a].index;
    const by: Record<Sort, (a: string, b: string) => number> = {
      power: (a, b) => petPower(b) - petPower(a),
      rarity: byRarity,
      level: (a, b) => save.pets[b].level - save.pets[a].level || byRarity(a, b),
      new: (a, b) => save.discovered.indexOf(b) - save.discovered.indexOf(a),
    };
    // pets that can level up always come first, so you never miss them
    return ids.sort((a, b) => Number(canLevelUp(b)) - Number(canLevelUp(a)) || by[this.sort](a, b));
  }

  /** Your team on stage: three podiums, the pets bouncing on them, and the TEAM POWER. */
  private buildTeam(y0: number, h: number): void {
    const s = this.scene;
    const W = s.scale.width;
    const c = this.content;
    c.add(s.add.image(W / 2, y0 + h / 2, stageTexture(s, 1040, h)));
    c.add(text(s, W / 2, y0 + 42, "TEAM POWER", 28, "#d9ccff"));
    this.powerText = text(s, W / 2, y0 + 96, "", 66, "#ffe066");
    c.add(this.powerText);
    const target = teamPower();
    if (this.power.shown < 0) this.power.shown = target;
    this.countPower(target);

    c.add(button(s, 160, y0 + 66, 250, 90, "blue", "BEST TEAM", () => this.equipBest(), { icon: "icon_star", iconSize: 40, size: 26 }));
    const ready = readyCount();
    c.add(button(s, W - 160, y0 + 66, 250, 90, ready ? "green" : "grey", "LEVEL ALL", () => this.levelAll(), { icon: "icon_fuse", iconSize: 40, size: 26 }));
    if (ready) {
      const badge = s.add.container(W - 52, y0 + 30, [s.add.circle(0, 0, 24, 0xf03e3e).setStrokeStyle(5, 0x4a2f1d), text(s, 0, -1, String(ready), 28)]);
      s.tweens.add({ targets: badge, scale: 1.18, duration: 420, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      c.add(badge);
    }

    const slots = petSlots();
    const base = y0 + 330;
    for (let i = 0; i < MAX_PETS; i++) {
      // the middle spot is the leader's: a little higher
      const order = [1, 0, 2][i];
      const x = W / 2 + (order - 1) * 320;
      const by = base - (order === 1 ? 16 : 0);
      const id = save.equipped[i];
      if (i >= slots) {
        c.add([
          s.add.ellipse(x, by, 190, 46, 0x1a1238, 0.8).setStrokeStyle(4, 0x4a2f1d),
          s.add.image(x, by - 70, "icon_lock").setScale(0.75).setAlpha(0.8),
          label(s, x, by + 46, "Unlock in Upgrades", 22, "#cbbcf0"),
        ]);
        continue;
      }
      if (!id) {
        const slot = s.add.image(x, by - 70, slotTexture(s, 130, false)).setAlpha(0.7);
        s.tweens.add({ targets: slot, scale: 1.08, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        c.add([
          s.add.ellipse(x, by, 190, 46, 0x1a1238, 0.8).setStrokeStyle(4, 0x4a2f1d),
          slot, text(s, x, by - 72, "+", 64, "#7a5236"),
          label(s, x, by + 46, "Tap a pet below", 22, "#cbbcf0"),
        ]);
        continue;
      }
      const def = ITEMS[id];
      const info = TIER_INFO[def.cls];
      const glow = s.add.image(x, by - 80, "glow").setTint(info.color).setScale(1.1).setAlpha(0.65);
      s.tweens.add({ targets: glow, alpha: 0.95, scale: 1.25, duration: 900 + i * 120, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      const ped = s.add.ellipse(x, by, 200, 50, info.color).setStrokeStyle(6, 0x4a2f1d);
      const img = s.add.image(x, by + 6, petTexture(s, id)).setOrigin(0.5, 1).setScale(0.95);
      img.setInteractive({ useHandCursor: true }).on("pointerup", () => this.openPet(id));
      s.tweens.add({ targets: img, scaleY: 0.9, scaleX: 1, duration: 260 + i * 30, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      const name = fitText(classText(s, x + 24, by + 46, `${def.name}  Lv.${save.pets[id].level}`, 26, def.cls), 250);
      if (!isPremium(id)) c.add(classBadge(s, x - name.displayWidth / 2 - 6, by + 46, def.cls, 38));
      c.add([glow, ped, img, name]);
      this.team.push({ img, id });
    }
  }

  /** Count the TEAM POWER up (or down) to its new value, with a "+123" popping out. */
  private countPower(target: number): void {
    const s = this.scene;
    const t = this.powerText!;
    const from = this.power.shown;
    s.tweens.killTweensOf(this.power);
    if (Math.abs(target - from) < 1e-9) {
      t.setText(fmt(target));
      return;
    }
    t.setText(fmt(from));
    s.tweens.add({
      targets: this.power, shown: target, duration: 900, ease: "Cubic.out",
      onUpdate: () => t.active && t.setText(fmt(this.power.shown)),
    });
    if (target > from) {
      s.tweens.add({ targets: t, scale: 1.25, duration: 160, yoyo: true, repeat: 1 });
      const plus = text(s, t.x + 180, t.y - 10, `+${fmt(target - from)}`, 40, "#8af06a").setScale(0);
      this.content.add(plus);
      s.tweens.add({ targets: plus, scale: 1, duration: 220, ease: "Back.out" });
      s.tweens.add({ targets: plus, y: plus.y - 60, alpha: 0, delay: 800, duration: 400, onComplete: () => plus.destroy() });
    }
  }

  /** Found so far, the next collection reward, and how complete each rarity is. */
  private buildCollection(cy: number): void {
    const s = this.scene;
    const W = s.scale.width;
    const c = this.content;
    const found = save.discovered.length;
    const next = Math.min(PET_LIST.length, (Math.floor(found / INDEX_STEP) + 1) * INDEX_STEP);
    const done = found >= PET_LIST.length;
    c.add(s.add.image(W / 2, cy, panelTexture(s, "cream", 1040, 144)));
    c.add(s.add.image(76, cy - 34, "icon_book").setScale(0.6));
    c.add(label(s, 122, cy - 46, "COLLECTION", 24, "#7a5236").setOrigin(0, 0.5));
    c.add(text(s, 122, cy - 16, `${found}/${PET_LIST.length}`, 36, "#ffffff").setOrigin(0, 0.5));
    const g = s.add.graphics();
    drawBar(g, 330, cy - 46, 670, 30, done ? 1 : (found % INDEX_STEP) / INDEX_STEP, 0x5ac8ff);
    c.add(g);
    c.add(fitText(text(s, 665, cy - 32, done ? "Every pet found!" : `Luck x${indexBonus().toFixed(2)}  →  x${(indexBonus() + INDEX_LUCK).toFixed(2)} at ${next} pets`, 22), 640));
    // one chip per class: its badge and found / total, gold when complete
    DICE_TIERS.forEach((cls, i) => {
      const left = W / 2 - 500 + i * 125 + 8;
      const y = cy + 36;
      const n = PET_LIST.filter((p) => p.cls === cls && save.discovered.includes(p.id)).length;
      const total = PET_LIST.filter((p) => p.cls === cls).length;
      const badge = classBadge(s, 0, y, cls, 36);
      badge.x = left + badge.width / 2;
      if (!n) badge.setAlpha(0.45);
      c.add(badge);
      c.add(text(s, left + badge.width + 4, y, `${n}/${total}`, 21, n >= total ? "#ffe066" : n ? "#ffffff" : "#e9dcc6").setOrigin(0, 0.5));
    });
  }

  private changed(): void {
    persist();
    this.host.petsChanged();
    this.build();
  }

  private equipBest(): void {
    save.equipped = Object.keys(save.pets).sort((a, b) => petScore(b) - petScore(a)).slice(0, petSlots());
    sfx.buy();
    buzz(30);
    this.changed();
  }

  private levelAll(): void {
    let n = 0;
    for (const id of Object.keys(save.pets)) while (levelUp(id)) n++;
    if (!n) {
      this.host.toast("Roll more copies to level up your pets!", "#ffe680");
      return;
    }
    sfx.levelUp();
    buzz(60);
    this.scene.cameras.main.flash(200, 200, 255, 170);
    this.host.toast(`+${n} pet level${n > 1 ? "s" : ""}!`, "#8af06a");
    this.sparkle(this.scene.scale.width / 2, this.host.L.headerBottom + 300, 60);
    this.changed();
  }

  /**
   * The Fuse window: a row per class with your spare copies, a bar to 100 and FUSE (100 of them
   * become 1 random pet of the next class), and FUSE ALL at the bottom.
   */
  private openFuse(): void {
    const s = this.scene;
    sfx.click();
    const W = 1000;
    const H = 1460;
    const top = -H / 2;
    const m = this.host.showModal(modal(s, W, H, "", "red", undefined, undefined, true));
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
          classBadge(s, -432, y - 30, cls, 58),
          text(s, -300, y - 22, `${fmt(have)} / ${FUSE_COST}`, 32, "#3a2a1a", { stroke: false }).setOrigin(0, 0.5),
          text(s, 52, y, "→", 54, "#ffb03b"),
          classBadge(s, 92, y - 30, nextClass(cls), 58),
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
        this.host.toast(`You need ${FUSE_COST} spare pets of a class. Roll more!`, "#ffe680");
        return;
      }
      sfx.levelUp();
      buzz(80);
      m.close();
      this.changed();
      this.host.showRewards("FUSED!", ids.sort((a, c) => ITEMS[c].index - ITEMS[a].index).map((id) => ({ icon: petTexture(s, id), amount: `x${got[id]}`, give: () => undefined })));
    };
    draw();
    b.add(button(s, 0, H / 2 - 110, 480, 120, canFuse() ? "gold" : "grey", "FUSE ALL", () => go(FUSE_CLASSES, 0), { icon: "icon_fuse", iconSize: 52, size: 40 }));
  }

  /** A burst of green and gold sparks. */
  private sparkle(x: number, y: number, n: number): void {
    const s = this.scene;
    const fx = s.add.particles(x, y, "spark", {
      speed: { min: 200, max: 620 }, lifespan: 800, scale: { start: 1, end: 0 }, tint: [0xffe066, 0x8af06a, 0xffffff], gravityY: 300, emitting: false,
    }).setDepth(6000);
    fx.explode(n);
    s.time.delayedCall(1000, () => fx.destroy());
  }

  openPet(id: string): void {
    const s = this.scene;
    const def = ITEMS[id];
    const info = RARITY_INFO[def.rarity];
    if (save.newPets.includes(id)) {
      save.newPets = save.newPets.filter((k) => k !== id);
      persist();
    }
    // online: one more line, how many players in the world have this pet
    const world = onlineEnabled();
    const h = world ? 1320 : 1260;
    const m = modal(s, 920, h, def.name, "purple", () => {
      if (this.detail === m) this.detail = null;
    });
    this.detail = m;
    const content = s.add.container(0, 0);
    m.body.add(content);
    const draw = () => {
      content.removeAll(true);
      const p = save.pets[id];
      const mult = levelMult(p.level);
      const max = p.level >= MAX_LEVEL;
      const need = copiesFor(p.level);
      const rays = s.add.image(0, -330, "rays").setTint(TIER_INFO[def.cls].color).setAlpha(0.45).setScale(0.75);
      s.tweens.add({ targets: rays, angle: 360, duration: 14000, repeat: -1 });
      const glow = s.add.image(0, -330, "glow").setTint(TIER_INFO[def.cls].color).setScale(1.9).setAlpha(0.7);
      const card = gemCard(s, 0, -330, id).setScale(1.1 * CARD_SCALE);
      content.add([rays, glow, card]);
      s.tweens.add({ targets: card, y: -338, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      // Premium Egg pets have no class: they hit for a share of your best pet
      if (isPremium(id)) content.add(classText(s, 0, -150, `EXCLUSIVE  •  ${def.description.replace("Exclusive: ", "")}`, 32, "uSSS"));
      else {
        const clsLine = classText(s, 36, -150, `CLASS ${def.cls}  •  ${oneIn(def.oneIn)}`, 36, def.cls);
        content.add([clsLine, classBadge(s, 36 - clsLine.width / 2 - 52, -150, def.cls, 50)]);
      }
      content.add(text(s, 0, -110, `${info.label}  •  ${KIND_LABEL[def.kind]}`, 26, info.css));
      content.add(label(s, 0, -76, def.description, 26, "#7a5236", 780));

      // power: now and after the next level
      content.add(s.add.image(0, 2, panelTexture(s, "inset", 780, 110)));
      content.add(text(s, -360, -20, "POWER", 26, "#ffe6b8").setOrigin(0, 0.5));
      const pw = text(s, -360, 22, fmt(petPower(id)), 48, "#ffe066").setOrigin(0, 0.5);
      content.add(pw);
      if (!max) {
        const nextPow = petPower(id) * (levelMult(p.level + 1) / mult);
        content.add(text(s, 360, 2, `Lv.${p.level + 1}:  ${fmt(nextPow)}`, 34, "#8af06a").setOrigin(1, 0.5));
      } else {
        content.add(text(s, 360, 2, "MAX LEVEL", 34, "#ffcf3a").setOrigin(1, 0.5));
      }

      const dmg = (lv: number) => def.damage * levelMult(lv);
      const rows: [string, string, string][] = def.kind === "buff"
        ? [["icon_sword", "Team damage", `+${fmt(dmg(p.level))}%`]]
        : [
          ["icon_sword", "Damage", fmt(dmg(p.level))],
          ["icon_clock", "Attacks every", `${(def.cooldown / 1000).toFixed(1)}s`],
          ["icon_target", "Targets", String(def.count)],
        ];
      if (world) {
        const n = ownersOf(id);
        rows.push(["icon_globe", "Players who have it", n === null ? "offline" : n <= 1 ? "only you!" : fmt(n)]);
      }
      const low = (rows.length - 3) * 60;
      rows.forEach(([icon, name, value], i) => {
        const y = 100 + i * 60;
        content.add([
          s.add.image(-350, y, icon).setScale(0.42),
          label(s, -310, y, name, 30).setOrigin(0, 0.5),
          text(s, 360, y, value, 32, "#ffe066").setOrigin(1, 0.5),
        ]);
      });
      const g = s.add.graphics();
      const ready = canLevelUp(id);
      drawBar(g, -360, 290 + low, 720, 40, max ? 1 : Math.min(1, p.copies / need), max ? 0xffcf3a : ready ? 0x7ad651 : 0x5ac8ff);
      content.add(g);
      content.add(text(s, 0, 309 + low, max ? `MAX LEVEL  (x${mult.toFixed(2)} power)` : `Lv.${p.level}   •   copies ${p.copies}/${need}`, 28));
      if (!max && !ready) content.add(label(s, 0, 362 + low, `Roll ${need - p.copies} more ${def.name} to level up`, 26, "#7a5236"));
      const equipped = save.equipped.includes(id);
      const full = !equipped && save.equipped.length >= petSlots();
      content.add(button(s, -205, 470 + low, 380, 134, equipped ? "red" : "green", equipped ? "UNEQUIP" : full ? "SWAP IN" : "EQUIP", () => {
        if (full) {
          const weakest = [...save.equipped].sort((a, b) => petScore(a) - petScore(b))[0];
          save.equipped = save.equipped.filter((k) => k !== weakest);
        }
        toggleEquip(id, petSlots());
        sfx.buy();
        m.close();
        this.changed();
      }, { size: 42 }));
      const lvBtn = button(s, 205, 470 + low, 380, 134, ready ? "orange" : "grey", max ? "MAXED" : "LEVEL UP", () => {
        if (!levelUp(id)) {
          this.host.toast(`Roll ${need - p.copies} more ${def.name} to level up`, "#ffe680");
          return;
        }
        persist();
        const before = petPower(id) / (levelMult(p.level) / levelMult(p.level - 1));
        this.levelBurst(card, p.level, petPower(id) - before);
        this.host.petsChanged();
        s.time.delayedCall(650, () => {
          if (this.detail === m) draw();
          this.build();
        });
      }, { size: 40, sub: max ? "" : `${Math.min(p.copies, need)}/${need} copies` }).setEnabled(ready);
      content.add(lvBtn);
      if (ready) {
        const shine = s.add.image(205, 470, "glow").setTint(0xffe066).setScale(2, 0.9).setAlpha(0.5);
        s.tweens.add({ targets: shine, alpha: 1, duration: 500, yoyo: true, repeat: -1 });
        content.addAt(shine, content.list.indexOf(lvBtn));
      }
    };
    draw();
  }

  /** Sparkly "LEVEL UP!" moment on a card, with the power it gained. */
  private levelBurst(card: Phaser.GameObjects.Container, level: number, gain: number): void {
    const s = this.scene;
    sfx.levelUp();
    buzz(50);
    const m = card.getWorldTransformMatrix();
    this.sparkle(m.tx, m.ty, 50);
    s.cameras.main.flash(160, 220, 255, 190);
    const t = text(s, m.tx, m.ty - 150, `LEVEL ${level}!`, 80, "#8af06a").setDepth(6001).setScale(0);
    s.tweens.add({ targets: t, scale: 1, duration: 260, ease: "Back.out" });
    s.tweens.add({ targets: t, y: t.y - 60, alpha: 0, delay: 700, duration: 400, onComplete: () => t.destroy() });
    const g = text(s, m.tx, m.ty + 40, `+${fmt(gain)} POWER`, 48, "#ffe066").setDepth(6001).setScale(0);
    s.tweens.add({ targets: g, scale: 1, duration: 260, delay: 150, ease: "Back.out" });
    s.tweens.add({ targets: g, y: g.y - 80, alpha: 0, delay: 900, duration: 400, onComplete: () => g.destroy() });
    s.tweens.add({ targets: card, scale: card.scale * 1.15, duration: 120, yoyo: true });
  }

  /** Team pets walk in place on their podiums. */
  update(time: number): void {
    if (!this.visible) return;
    const frame = 1 + (Math.floor(time / 240) % 2);
    for (const t of this.team) t.img.setTexture(petTexture(this.scene, t.id, frame));
  }
}
