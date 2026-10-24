import Phaser from "phaser";
import { INK_N } from "../art/draw";
import { petTexture } from "../art/pets";
import { panelTexture } from "../art/ui";
import { ITEMS } from "../data/items";
import { Board, PlayerEntry, leaderboard, online, onlineEnabled, playerName, rename, startOnline } from "../online/online";
import { sfx } from "../systems/sound";
import { fmt, oneIn } from "./format";
import { Host } from "./screens";
import { button, fitText, label, modal, text } from "./widgets";

const TABS: { id: Board; name: string }[] = [
  { id: "stage", name: "STAGE" },
  { id: "rarest", name: "RAREST PET" },
  { id: "pets", name: "PETS" },
];
const MEDALS = [0xffd23f, 0xd8e0e8, 0xe0a060];

/** Ask for a new name (the phone's own text box). */
export function askName(host: Host): void {
  const raw = window.prompt("Your name on the leaderboards (2-16 letters or numbers):", playerName());
  if (raw === null) return;
  if (rename(raw)) host.toast(`You are now ${playerName()}`, "#8af06a");
  else host.toast("Use 2-16 letters, numbers, spaces, _ or -", "#ff9a9a");
}

/**
 * The leaderboards: the top 20 by best stage, rarest pet or pets found, your place in each, and
 * your account (Google Play or guest) with a button to change your name.
 */
export function showLeaderboard(scene: Phaser.Scene, host: Host, close: () => void): void {
  const s = scene;
  const H = s.scale.height;
  const h = Math.min(H - 120, 1680);
  let closed = false;
  const m = host.showModal(modal(s, 960, h, "LEADERBOARD", "gold", () => {
    closed = true;
    close();
  }));
  const top = -h / 2 + 110;
  // as many rows as fit, keeping two for "..." and your own place
  const fit = Math.floor((h - 110 - 130 - 230) / 62) - 2;
  if (!onlineEnabled()) {
    m.body.add([
      s.add.image(0, -120, "icon_globe").setScale(1.6),
      label(s, 0, 60, "Online play comes with the Google Play version of the game.", 34, "#7a5236", 760),
      button(s, 0, 260, 360, 110, "green", "OK", () => m.close(), { size: 40 }),
    ]);
    return;
  }
  let board: Board = "stage";
  const tabs = TABS.map((t, i) =>
    button(s, (i - 1) * 300, top + 40, 280, 84, "brown", t.name, () => {
      if (board === t.id) return;
      board = t.id;
      sfx.click();
      load();
    }, { size: 28 }),
  );
  m.body.add(tabs);
  const list = s.add.container(0, 0);
  m.body.add(list);
  const foot = s.add.container(0, h / 2 - 150);
  m.body.add(foot);
  let ticket = 0;

  const rowY = (i: number) => top + 130 + i * 62;
  const row = (i: number, rank: number, e: PlayerEntry, mine: boolean) => {
    const y = rowY(i);
    const parts: Phaser.GameObjects.GameObject[] = [s.add.image(0, y, panelTexture(s, mine ? "cream" : "row", 880, 56))];
    if (mine) {
      const edge = s.add.graphics();
      edge.lineStyle(5, 0x4caf50, 1).strokeRoundedRect(-440, y - 28, 880, 56, 20);
      parts.push(edge);
    }
    if (rank <= 3) parts.push(s.add.circle(-390, y, 22, MEDALS[rank - 1]).setStrokeStyle(4, INK_N), text(s, -390, y - 1, `${rank}`, 26));
    else parts.push(fitText(label(s, -390, y, `#${fmt(rank)}`, 26, "#7a5236"), 90));
    parts.push(fitText(label(s, -350, y, e.name, 30, mine ? "#2f7a3a" : "#4a2f1d").setOrigin(0, 0.5), 330));
    if (board === "rarest" && ITEMS[e.rarest]) {
      const pic = s.add.image(150, y, petTexture(s, e.rarest));
      pic.setScale(50 / Math.max(pic.width, pic.height));
      parts.push(pic, fitText(label(s, 420, y, oneIn(e.rarestOdds), 28, "#c9663a").setOrigin(1, 0.5), 230));
    } else if (board === "pets") {
      parts.push(label(s, 420, y, `${e.petsFound}/100 pets`, 28, "#c9663a").setOrigin(1, 0.5));
    } else {
      parts.push(label(s, 420, y, `Stage ${e.bestStage}`, 30, "#c9663a").setOrigin(1, 0.5), label(s, 230, y, `${e.petsFound} pets`, 22, "#9a7a5a").setOrigin(1, 0.5));
    }
    list.add(parts);
  };

  const status = (str: string) => list.add(label(s, 0, rowY(4), str, 34, "#7a5236", 760));

  const drawFoot = () => {
    foot.removeAll(true);
    const who = online.provider === "playgames" ? "Google Play" : online.provider === "guest" ? "Guest" : "Offline";
    foot.add(fitText(label(s, 0, -36, `You: ${playerName()}  •  ${who}`, 30, "#7a5236"), 800));
    foot.add(button(s, 0, 50, 400, 100, "blue", "CHANGE NAME", () => {
      askName(host);
      drawFoot();
    }, { size: 32 }));
  };

  const load = () => {
    const my = ++ticket;
    tabs.forEach((b, i) => b.setColor(TABS[i].id === board ? "gold" : "brown"));
    list.removeAll(true);
    drawFoot();
    if (online.status !== "online") {
      status(online.status === "connecting" ? "Connecting..." : "Can't reach the leaderboard right now.");
      if (online.status !== "connecting") {
        list.add(button(s, 0, rowY(6), 320, 100, "green", "RETRY", () => {
          void startOnline().then(() => my === ticket && load());
          load();
        }, { size: 36 }));
      } else {
        s.time.delayedCall(800, () => my === ticket && !closed && load());
      }
      return;
    }
    status("Loading...");
    leaderboard(board, fit)
      .then(({ top: rows, myRank, me }) => {
        if (my !== ticket || closed) return;
        list.removeAll(true);
        if (!rows.length) status("Nobody here yet. Be the first!");
        rows.forEach((e, i) => row(i, i + 1, e, e.uid === online.uid));
        if (me && myRank && !rows.some((e) => e.uid === online.uid)) {
          list.add(label(s, 0, rowY(rows.length) - 6, "• • •", 30, "#9a7a5a"));
          row(rows.length + 1, myRank, me, true);
        }
      })
      .catch(() => {
        if (my !== ticket || closed) return;
        list.removeAll(true);
        status("Can't reach the leaderboard right now.");
      });
  };
  load();
}
