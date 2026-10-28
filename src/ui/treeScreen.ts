import Phaser from "phaser";
import { canvasTexture, darken, lighten, linear, mix, rgba } from "../art/draw";
import { BRANCH_INFO, Branch, TREE, TREE_BY_ID, TreeNode, effectText, hexPos, perAt, stepsOf } from "../data/tree";
import { buyNode, canBuy, nextCost, nodeOwned, nodeUnlocked, paysGems, stepsBought } from "../systems/stats";
import { sfx } from "../systems/sound";
import { Layout } from "../layout";
import { fmt } from "./format";
import { save } from "../systems/save";
import { Button, button, drawBar, fitText, label, text } from "./widgets";

const SIZE = 74;
type State = "owned" | "ready" | "open" | "locked";

/** What each path is for, in a few words. */
const BRANCH_DESC: Record<Branch, string> = {
  start: "",
  luck: "Roll rarer pets",
  roll: "Roll faster, more dice",
  money: "Earn more money",
  power: "Hit harder in battle",
  team: "More pets, more health",
  gems: "Gems and stronger potions",
};

/** Pointy-top hexagon path. */
function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function hexTexture(scene: Phaser.Scene, branch: Branch, state: State): string {
  const W = 156;
  const H = 172;
  return canvasTexture(scene, `hex_${branch}_${state}`, W, H, (ctx) => {
    const c = BRANCH_INFO[branch].color;
    const cx = W / 2;
    const cy = H / 2;
    const [top, bottom, rim] = {
      owned: [lighten(c, 0.35), c, 0xffffff],
      ready: [lighten(c, 0.7), lighten(c, 0.35), lighten(c, 0.8)],
      open: [mix(c, 0x8a96a6, 0.55), mix(c, 0x5a6676, 0.6), mix(c, 0xb8c2cc, 0.5)],
      locked: [0x3a4a5a, 0x26323e, 0x4a5a6a],
    }[state];
    hexPath(ctx, cx, cy + 4, SIZE);
    ctx.fillStyle = "rgba(10,20,30,0.35)";
    ctx.fill();
    hexPath(ctx, cx, cy, SIZE);
    ctx.lineJoin = "round";
    ctx.lineWidth = 12;
    ctx.strokeStyle = state === "locked" ? "#141c24" : rgba(darken(c, 0.55));
    ctx.stroke();
    ctx.fillStyle = linear(ctx, 0, cy - SIZE, 0, cy + SIZE, [[0, rgba(top)], [1, rgba(bottom)]]);
    ctx.fill();
    hexPath(ctx, cx, cy, SIZE - 9);
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba(rim, state === "owned" ? 0.95 : 0.6);
    ctx.stroke();
    if (state !== "locked") {
      ctx.save();
      hexPath(ctx, cx, cy, SIZE - 9);
      ctx.clip();
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(0, 0, W, cy - SIZE * 0.35);
      ctx.restore();
    }
  });
}

/** Soft teal background with a faint honeycomb, like the reference. */
function backgroundTexture(scene: Phaser.Scene): string {
  return canvasTexture(scene, "tree_bg", 512, 512, (ctx) => {
    ctx.fillStyle = "#1f6b72";
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 3;
    const r = 40;
    for (let row = -1; row < 9; row++) {
      for (let col = -1; col < 8; col++) {
        hexPath(ctx, col * r * Math.sqrt(3) + (row % 2 ? (r * Math.sqrt(3)) / 2 : 0), row * r * 1.5, r - 4);
        ctx.stroke();
      }
    }
  });
}

interface NodeView {
  node: TreeNode;
  hex: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  price: Phaser.GameObjects.Text;
  q: Phaser.GameObjects.Text;
  check: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  /** one dot per step, for hexagons bought in steps */
  pips: Phaser.GameObjects.Arc[];
  state: State | "";
  steps: number;
}

const BRANCHES = (Object.keys(BRANCH_INFO) as Branch[]).filter((b) => b !== "start");

/**
 * The upgrade tree screen: a honeycomb you drag around (pinch or mouse wheel to zoom).
 * Owned hexes are bright in their branch colour with a check, ones you can buy glow, ones
 * you can't afford yet are greyish with their price in red, and locked ones are dark "?".
 * Up top, one chip per path shows what it is for and how much of it you own (tap to jump
 * there); at the bottom, the best next upgrade with a BUY button. A bouncing NEXT marker
 * sits on that hexagon.
 */
export class TreeScreen {
  readonly root: Phaser.GameObjects.Container;
  private map: Phaser.GameObjects.Container;
  private lines: Phaser.GameObjects.Graphics;
  private views = new Map<string, NodeView>();
  private tip: Phaser.GameObjects.Container | null = null;
  private top: number;
  private bottom: number;
  private refreshTimer = 0;
  private drag = { on: false, x: 0, y: 0, mx: 0, my: 0, moved: false, pinch: 0, scale: 1 };
  private pointers = new Map<number, { x: number; y: number }>();
  private chips: { branch: Branch; count: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Graphics; dot: Phaser.GameObjects.Arc }[] = [];
  private nextMark: Phaser.GameObjects.Container;
  private best: { panel: Phaser.GameObjects.Container; icon: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text; info: Phaser.GameObjects.Text; buy: Button; node: TreeNode | null };

  constructor(private scene: Phaser.Scene, L: Layout, private onBuy: () => void, private toast: (s: string, c?: string) => void) {
    const W = scene.scale.width;
    this.top = L.headerBottom + 250;
    this.bottom = L.navTop - 160;
    this.root = scene.add.container(0, 0).setDepth(3000).setVisible(false);
    const bg = scene.add.tileSprite(0, 0, W, L.navTop, backgroundTexture(scene)).setOrigin(0).setInteractive();
    this.map = scene.add.container(W / 2, (this.top + this.bottom) / 2);
    this.lines = scene.add.graphics();
    this.map.add(this.lines);
    for (const node of TREE) this.makeNode(node);
    this.nextMark = scene.add.container(0, 0, [
      scene.add.image(0, 0, "glow").setTint(0xffe066).setScale(0.6, 0.35).setAlpha(0.8),
      scene.add.rectangle(0, 0, 112, 44, 0xffcf3a).setStrokeStyle(5, 0x4a2f1d),
      text(scene, 0, -2, "NEXT", 28),
      scene.add.triangle(0, 34, -14, 0, 14, 0, 0, 16, 0xffcf3a).setStrokeStyle(4, 0x4a2f1d),
    ]).setVisible(false);
    this.map.add(this.nextMark);

    // the six paths: what they do and how much of each you own (tap to jump there)
    const top = scene.add.container(0, 0);
    const shade = scene.add.graphics();
    shade.fillStyle(0x0d3a40, 0.85).fillRect(0, 0, W, L.headerBottom + 240);
    top.add(shade);
    BRANCHES.forEach((b, i) => {
      const x = 20 + (i % 3) * 347;
      const y = L.headerBottom + 10 + Math.floor(i / 3) * 96;
      const info = BRANCH_INFO[b];
      const g = scene.add.graphics();
      g.fillStyle(0x0a2a30, 1).fillRoundedRect(0, 0, 333, 86, 18);
      g.lineStyle(4, info.color, 1).strokeRoundedRect(0, 0, 333, 86, 18);
      const dot = scene.add.circle(30, 26, 14, info.color).setStrokeStyle(4, 0x0a1a20);
      const count = text(scene, 318, 26, "", 24, "#ffffff").setOrigin(1, 0.5);
      const bar = scene.add.graphics();
      const chip = scene.add.container(x, y, [
        g, dot, text(scene, 54, 26, info.label, 26).setOrigin(0, 0.5), count,
        label(scene, 18, 52, BRANCH_DESC[b], 20, "#bfe6e8").setOrigin(0, 0.5), bar,
      ]).setSize(333, 86).setInteractive(new Phaser.Geom.Rectangle(0, 0, 333, 86), Phaser.Geom.Rectangle.Contains);
      chip.on("pointerup", () => this.jumpTo(b));
      top.add(chip);
      this.chips.push({ branch: b, count, bar, dot });
    });
    // what the colours mean
    const ly = L.headerBottom + 216;
    const key: [State, string][] = [["owned", "Owned"], ["ready", "Can buy"], ["open", "Need money"], ["locked", "Locked"]];
    key.forEach(([st, str], i) => {
      const x = 50 + i * 262;
      top.add([scene.add.image(x, ly, hexTexture(scene, "luck", st)).setScale(0.26), text(scene, x + 30, ly, str, 24, "#cfeff0").setOrigin(0, 0.5)]);
      if (st === "owned") top.add(scene.add.image(x + 12, ly - 12, "icon_check").setScale(0.2));
      if (st === "locked") top.add(text(scene, x, ly - 1, "?", 24, "#7f93a3", { stroke: false }));
    });

    // the best next upgrade, always on screen
    const by = L.navTop - 82;
    const pg = scene.add.graphics();
    pg.fillStyle(0x0d3a40, 0.95).fillRect(0, by - 78, W, 156);
    pg.fillStyle(0xffcf3a, 1).fillRect(0, by - 78, W, 6);
    const bIcon = scene.add.image(78, by, "icon_star").setScale(0.75);
    const bName = text(scene, 140, by - 26, "", 32, "#ffe066").setOrigin(0, 0.5);
    const bInfo = text(scene, 140, by + 18, "", 24, "#cfeff0").setOrigin(0, 0.5);
    const buy = button(scene, W - 150, by, 250, 108, "green", "BUY", () => this.best.node && this.buy(this.best.node), { size: 36, sub: "", subIcon: "icon_cash" });
    const panel = scene.add.container(0, 0, [pg, text(scene, 140, by - 60, "BEST NEXT UPGRADE", 20, "#8fd0d4").setOrigin(0, 0.5), bIcon, bName, bInfo, buy]);
    const tapArea = scene.add.zone(0, by - 78, W - 300, 156).setOrigin(0).setInteractive();
    tapArea.on("pointerup", () => this.best.node && this.focusOn(this.best.node, true));
    panel.add(tapArea);
    this.best = { panel, icon: bIcon, name: bName, info: bInfo, buy, node: null };
    this.root.add([bg, this.map, top, panel]);
    this.setupInput(bg);
  }

  show(): void {
    this.root.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 160 });
    this.refresh(true);
    this.focus();
  }

  hide(): void {
    this.closeTip();
    this.root.setVisible(false);
  }

  update(delta: number): void {
    if (!this.root.visible) return;
    this.refreshTimer -= delta;
    if (this.refreshTimer <= 0) {
      this.refreshTimer = 300;
      this.refresh(false);
    }
  }

  private makeNode(node: TreeNode): void {
    const s = this.scene;
    const { x, y } = hexPos(node, SIZE + 4);
    const glow = s.add.image(x, y, "glow").setTint(BRANCH_INFO[node.branch].color).setScale(0.75).setVisible(false);
    s.tweens.add({ targets: glow, alpha: { from: 0.35, to: 0.95 }, scale: { from: 0.7, to: 0.85 }, duration: 700, yoyo: true, repeat: -1 });
    const hex = s.add.image(x, y, hexTexture(s, node.branch, "locked"));
    const icon = s.add.image(x, y - 16, `icon_${node.icon}`).setScale(node.id === "start" ? 0.8 : 0.55);
    const name = fitText(text(s, x, y + 28, node.name, 20), 112);
    const price = text(s, x, y + 52, "", 20);
    const q = text(s, x, y - 4, "?", 64, "#7f93a3", { stroke: false });
    const check = s.add.image(x + 46, y - 44, "icon_check").setScale(0.48);
    const n = stepsOf(node);
    const pips = n > 1 ? [...Array(n)].map((_, i) => s.add.circle(x + (i - (n - 1) / 2) * 22, y - 54, 8, 0x0a1a20, 0.5).setStrokeStyle(3, 0xffffff, 0.9)) : [];
    // gem hexagons show a little gem next to their price
    const gem = paysGems(node) ? s.add.image(x - 34, y + 52, "icon_gem").setScale(0.28) : null;
    if (gem) price.setX(x + 10);
    this.map.add([glow, hex, icon, name, price, q, check, ...pips, ...(gem ? [gem] : [])]);
    this.views.set(node.id, { node, hex, icon, name, price, q, check, glow, pips, state: "", steps: -1 });
  }

  private stateOf(node: TreeNode): State {
    if (nodeOwned(node.id)) return "owned";
    if (!nodeUnlocked(node)) return "locked";
    return canBuy(node) ? "ready" : "open";
  }

  /** The best thing to buy now: the cheapest one you can afford, else the cheapest open one. */
  private bestNext(): TreeNode | null {
    const open = TREE.filter((n) => n.id !== "start" && !paysGems(n) && (this.stateOf(n) === "ready" || this.stateOf(n) === "open")).sort((a, b) => nextCost(a) - nextCost(b));
    return open.find((n) => this.stateOf(n) === "ready") ?? open[0] ?? null;
  }

  /** Path chips, the NEXT marker and the best-next bar. */
  private refreshGuide(): void {
    for (const c of this.chips) {
      const nodes = TREE.filter((n) => n.branch === c.branch);
      const owned = nodes.filter((n) => nodeOwned(n.id)).length;
      const canBuyHere = nodes.some((n) => this.stateOf(n) === "ready");
      c.count.setText(`${owned}/${nodes.length}`).setColor(owned === nodes.length ? "#ffe066" : "#ffffff");
      c.bar.clear();
      drawBar(c.bar, 18, 68, 297, 10, owned / nodes.length, BRANCH_INFO[c.branch].color, 0x163a40);
      c.dot.setScale(canBuyHere ? 1.25 : 1);
    }
    const node = this.bestNext();
    this.best.node = node;
    if (!node) {
      this.nextMark.setVisible(false);
      this.best.name.setText("Everything bought!");
      this.best.info.setText("You own the whole tree");
      this.best.buy.setVisible(false);
      return;
    }
    const p = hexPos(node, SIZE + 4);
    this.nextMark.setVisible(true).setX(p.x);
    if (!this.nextMark.getData("y") || this.nextMark.getData("id") !== node.id) {
      this.scene.tweens.killTweensOf(this.nextMark);
      this.nextMark.setY(p.y - 112).setData("id", node.id).setData("y", 1);
      this.scene.tweens.add({ targets: this.nextMark, y: p.y - 98, duration: 420, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    }
    const ready = this.stateOf(node) === "ready";
    this.best.icon.setTexture(`icon_${node.icon}`);
    fitText(this.best.name.setText(`${node.name}  •  ${BRANCH_INFO[node.branch].label}`), this.scene.scale.width - 460);
    const what = this.stepText(node);
    fitText(this.best.info.setText(ready ? what : `${what}  •  need ${fmt(nextCost(node) - (paysGems(node) ? save.gems : save.cash))} more`), this.scene.scale.width - 460);
    this.best.buy.setVisible(true).setColor(ready ? "green" : "grey").setSub(fmt(nextCost(node)));
  }

  /** Jump to a path: its best open hexagon, with its info. */
  private jumpTo(branch: Branch): void {
    sfx.click();
    const open = TREE.filter((n) => n.branch === branch && (this.stateOf(n) === "ready" || this.stateOf(n) === "open")).sort((a, b) => nextCost(a) - nextCost(b));
    const node = open.find((n) => this.stateOf(n) === "ready") ?? open[0] ?? TREE.filter((n) => n.branch === branch).pop();
    if (node) this.focusOn(node, true);
  }

  /** Slide the map so a hexagon is in the middle, then (optionally) open its info. */
  private focusOn(node: TreeNode, tip: boolean): void {
    const p = hexPos(node, SIZE + 4);
    const W = this.scene.scale.width;
    this.closeTip();
    this.scene.tweens.add({
      targets: this.map, x: W / 2 - p.x * this.map.scale, y: (this.top + this.bottom) / 2 + 60 - p.y * this.map.scale, duration: 350, ease: "Cubic.out",
      onComplete: () => tip && node.id !== "start" && this.showTip(node),
    });
  }

  /** Update hex colours and the connecting lines. */
  private refresh(force: boolean): void {
    let changed = force;
    this.refreshGuide();
    for (const v of this.views.values()) {
      const st = this.stateOf(v.node);
      const showPrice = st === "ready" || st === "open";
      if (showPrice) v.price.setText(fmt(nextCost(v.node))).setColor(st === "ready" ? (paysGems(v.node) ? "#9ae6ff" : "#b6ff8a") : "#ff9a9a");
      v.price.setVisible(showPrice);
      const steps = stepsBought(v.node);
      if (steps !== v.steps) {
        v.steps = steps;
        v.pips.forEach((pip, i) => pip.setFillStyle(i < steps ? BRANCH_INFO[v.node.branch].color : 0x0a1a20, i < steps ? 1 : 0.5));
      }
      v.pips.forEach((pip) => pip.setVisible(st !== "locked"));
      if (st === v.state) continue;
      changed = true;
      v.state = st;
      v.hex.setTexture(hexTexture(this.scene, v.node.branch, v.node.id === "start" ? "owned" : st));
      const hidden = st === "locked";
      v.icon.setVisible(!hidden).setAlpha(st === "open" ? 0.7 : 1);
      v.name.setVisible(!hidden).setAlpha(st === "open" ? 0.8 : 1);
      v.q.setVisible(hidden);
      v.check.setVisible(st === "owned" && v.node.id !== "start");
      v.glow.setVisible(st === "ready");
    }
    if (!changed) return;
    const g = this.lines;
    g.clear();
    for (const v of this.views.values()) {
      const a = hexPos(v.node, SIZE + 4);
      for (const r of v.node.req) {
        const b = hexPos(TREE_BY_ID[r], SIZE + 4);
        const lit = v.state === "owned";
        const avail = v.state === "ready" || v.state === "open";
        const col = BRANCH_INFO[v.node.branch].color;
        g.lineStyle(26, 0x0a1a20, 0.9).lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(14, lit ? col : avail ? mix(col, 0xffffff, 0.45) : 0x3a4a5a, 1).lineBetween(a.x, a.y, b.x, b.y);
      }
    }
  }

  /** Start centred on something you can buy (or the middle). */
  private focus(): void {
    const target = TREE.filter((n) => this.stateOf(n) === "ready").sort((a, b) => a.cost - b.cost)[0]
      ?? TREE.filter((n) => this.stateOf(n) === "open").sort((a, b) => a.cost - b.cost)[0] ?? TREE[0];
    const p = hexPos(target, SIZE + 4);
    const W = this.scene.scale.width;
    this.map.setPosition(W / 2 - p.x * this.map.scale, (this.top + this.bottom) / 2 - p.y * this.map.scale);
  }

  private setupInput(bg: Phaser.GameObjects.TileSprite): void {
    const s = this.scene;
    bg.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.y < this.top - 60) return;
      this.pointers.set(p.id, { x: p.x, y: p.y });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.drag.pinch = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        this.drag.scale = this.map.scale;
        return;
      }
      this.drag = { ...this.drag, on: true, x: p.x, y: p.y, mx: this.map.x, my: this.map.y, moved: false };
    });
    const move = (p: Phaser.Input.Pointer) => {
      if (!this.pointers.has(p.id)) return;
      this.pointers.set(p.id, { x: p.x, y: p.y });
      if (this.pointers.size === 2 && this.drag.pinch) {
        const [a, b] = [...this.pointers.values()];
        const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        this.zoomTo(this.drag.scale * (d / this.drag.pinch), (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.drag.moved = true;
        return;
      }
      if (!this.drag.on) return;
      const dx = p.x - this.drag.x;
      const dy = p.y - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 12) this.drag.moved = true;
      this.map.setPosition(this.drag.mx + dx, this.drag.my + dy);
      this.clampMap();
    };
    const up = (p: Phaser.Input.Pointer) => {
      if (!this.pointers.has(p.id)) return;
      this.pointers.delete(p.id);
      if (this.pointers.size > 0) return;
      this.drag.pinch = 0;
      if (!this.drag.on) return;
      this.drag.on = false;
      if (!this.drag.moved) this.tap(p.x, p.y);
    };
    s.input.on("pointermove", move);
    s.input.on("pointerup", up);
    s.input.on("pointerupoutside", up);
    const wheel = (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.root.visible) this.zoomTo(this.map.scale * (dy > 0 ? 0.9 : 1.1), s.input.x, s.input.y);
    };
    s.input.on("wheel", wheel);
    this.root.once("destroy", () => {
      s.input.off("pointermove", move);
      s.input.off("pointerup", up);
      s.input.off("pointerupoutside", up);
      s.input.off("wheel", wheel);
    });
  }

  private zoomTo(scale: number, fx: number, fy: number): void {
    const s = Phaser.Math.Clamp(scale, 0.45, 1.4);
    const k = s / this.map.scale;
    this.map.setPosition(fx - (fx - this.map.x) * k, fy - (fy - this.map.y) * k).setScale(s);
    this.clampMap();
    this.closeTip();
  }

  private clampMap(): void {
    const { width: W } = this.scene.scale;
    const H = this.bottom;
    const xs = TREE.map((n) => hexPos(n, SIZE + 4).x * this.map.scale);
    const ys = TREE.map((n) => hexPos(n, SIZE + 4).y * this.map.scale);
    this.map.x = Phaser.Math.Clamp(this.map.x, W - 120 - Math.max(...xs), 120 - Math.min(...xs));
    this.map.y = Phaser.Math.Clamp(this.map.y, H - 140 - Math.max(...ys), this.top + 100 - Math.min(...ys));
  }

  private tap(x: number, y: number): void {
    const lx = (x - this.map.x) / this.map.scale;
    const ly = (y - this.map.y) / this.map.scale;
    const hit = TREE.find((n) => {
      const p = hexPos(n, SIZE + 4);
      return Phaser.Math.Distance.Between(lx, ly, p.x, p.y) < SIZE * 0.9;
    });
    if (!hit || hit.id === "start") {
      this.closeTip();
      return;
    }
    sfx.click();
    this.showTip(hit);
  }

  private closeTip(): void {
    this.tip?.destroy();
    this.tip = null;
  }

  /** White pop-up next to the hexagon: name, what it does, and BUY / Purchased / Locked. */
  private showTip(node: TreeNode): void {
    this.closeTip();
    const s = this.scene;
    const { width: W } = s.scale;
    const st = this.stateOf(node);
    const p = hexPos(node, SIZE + 4);
    const sx = this.map.x + p.x * this.map.scale;
    const sy = this.map.y + p.y * this.map.scale;
    const w = 560;
    const h = 300;
    const below = sy - h - 90 < this.top;
    const tx = Phaser.Math.Clamp(sx, w / 2 + 20, W - w / 2 - 20);
    const ty = below ? sy + 90 * this.map.scale + h / 2 : sy - 90 * this.map.scale - h / 2;
    const g = s.add.graphics();
    g.fillStyle(0x0a1a20, 0.35).fillRoundedRect(-w / 2 + 6, -h / 2 + 10, w, h, 34);
    g.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 34);
    g.lineStyle(6, BRANCH_INFO[node.branch].color, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 34);
    const parts: Phaser.GameObjects.GameObject[] = [
      g,
      fitText(label(s, 0, -h / 2 + 46, st === "locked" ? "???" : node.name, 44, "#2a2a2a"), w - 60),
      fitText(label(s, 0, -h / 2 + 100, st === "locked" ? "Buy the hexagon before it first" : stepsOf(node) > 1 && st !== "owned" ? this.stepText(node) : effectText(node), 32, "#6a6a6a"), w - 60),
      fitText(label(s, 0, -h / 2 + 142, {
        owned: "You own this",
        ready: stepsOf(node) > 1 ? `Step ${stepsBought(node) + 1} of ${stepsOf(node)}: you can buy it now!` : "You can buy this now!",
        open: paysGems(node) ? `Need ${fmt(nextCost(node) - save.gems)} more gems` : `Need ${fmt(nextCost(node) - save.cash)} more money`,
        locked: `Part of the ${BRANCH_INFO[node.branch].label} path`,
      }[st], 26, st === "ready" ? "#3f9a2f" : st === "open" ? "#c0564a" : "#8a8a8a"), w - 60),
    ];
    if (st === "owned") {
      parts.push(text(s, 0, h / 2 - 62, "Purchased", 46, "#5fd14a"));
    } else if (st === "locked") {
      parts.push(fitText(label(s, 0, h / 2 - 62, `Needs: ${node.req.map((r) => TREE_BY_ID[r].name).join(", ")}`, 30, "#c0564a"), w - 60));
    } else {
      parts.push(button(s, 0, h / 2 - 66, 360, 100, st === "ready" ? "green" : "grey", stepsOf(node) > 1 ? `BUY STEP ${stepsBought(node) + 1}` : "BUY", () => this.buy(node), {
        sub: fmt(nextCost(node)), subIcon: paysGems(node) ? "icon_gem" : "icon_cash", size: 34,
      }));
    }
    this.tip = s.add.container(tx, ty, parts).setScale(0.6).setAlpha(0);
    this.root.add(this.tip);
    s.tweens.add({ targets: this.tip, scale: 1, alpha: 1, duration: 180, ease: "Back.out" });
  }

  /** "x2 luck: x1.26 → x1.59" for a hexagon bought in steps; its whole effect otherwise. */
  private stepText(node: TreeNode): string {
    const n = stepsOf(node);
    const k = stepsBought(node);
    if (n === 1 || k >= n) return effectText(node);
    return k === 0 ? `${effectText(node)} in ${n} steps: first ${effectText(node, perAt(node, 1))}` : `${effectText(node, perAt(node, k))} → ${effectText(node, perAt(node, k + 1))}`;
  }

  private buy(node: TreeNode): void {
    if (!buyNode(node.id)) {
      sfx.error();
      this.toast("Not enough money!", "#ff9a9a");
      return;
    }
    sfx.buy();
    this.onBuy();
    this.closeTip();
    const v = this.views.get(node.id)!;
    const s = this.scene;
    const color = BRANCH_INFO[node.branch].color;
    s.tweens.add({ targets: [v.hex, v.icon], scale: "*=1.25", duration: 120, yoyo: true, ease: "Quad.out" });
    const ring = s.add.image(v.hex.x, v.hex.y, "ring").setTint(color).setScale(0.6);
    this.map.add(ring);
    s.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
    const burst = s.add.particles(v.hex.x, v.hex.y, "spark", {
      speed: { min: 150, max: 420 }, lifespan: 600, scale: { start: 0.8, end: 0 }, tint: [color, 0xffffff], emitting: false,
    });
    this.map.add(burst);
    burst.explode(24);
    s.time.delayedCall(800, () => burst.destroy());
    this.refresh(true);
    // more steps to go: keep its info open for the next one
    if (!nodeOwned(node.id)) {
      this.showTip(node);
      return;
    }
    // newly opened hexes pop in
    for (const child of TREE.filter((n) => n.req.includes(node.id))) {
      const cv = this.views.get(child.id)!;
      cv.hex.setScale(0.4);
      s.tweens.add({ targets: cv.hex, scale: 1, duration: 380, delay: 150, ease: "Back.out" });
    }
  }

}
