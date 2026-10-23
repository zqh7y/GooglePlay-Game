/**
 * Progression simulator: plays the game run by run using the real data files and prints
 * how long a steady player needs to reach each stage. Run with:
 *   npx esbuild dev/sim.ts --bundle --platform=node --outfile=/tmp/sim.js && node /tmp/sim.js
 *
 * Model (deliberately simple):
 * - a stage is a 5 minute run; skills and airdropped guns multiply your damage as it goes
 * - each minute you survive if your damage keeps up with the monsters coming in (kiting covers some)
 * - the boss at 5:00 has to die within ~40 s; a failed run still pays money and the dice you found
 * - every roll costs one die; dice come from the map, elites, chests and the boss, in tiers that
 *   depend on the stage (a rarer die multiplies the roll's luck)
 * - the best pets are equipped and levelled up; the cheapest open tree hexagon is bought whenever affordable
 */
import {
  AIRDROP_FIRST_MS, AIRDROP_MS, BOSS, FLYER, HERO_BASE_DMG, HERO_TEAM_SHARE, MAX_STAGE, MINUTES, WALKER_A, WALKER_B, monsterCash,
  monsterHp, spawnGap,
} from "../src/data/balance";
import { GUN_TIERS, DICE_TIERS, DICE_LUCK, diceTierChances, gunTierWeights } from "../src/data/tiers";
import { STARTER_GUN, gunDps, gunsOfTier } from "../src/data/guns";
import { MAX_LEVEL, PET_LIST, copiesFor, levelMult } from "../src/data/items";
import { TREE, TreeNode } from "../src/data/tree";

const owned = new Set<string>(["start"]);
const sum = (e: TreeNode["effect"]) => TREE.reduce((s, t) => (t.effect === e && owned.has(t.id) ? s + t.per : s), 0);
const prod = (e: TreeNode["effect"]) => TREE.reduce((p, t) => (t.effect === e && owned.has(t.id) ? p * t.per : p), 1);

const pets = PET_LIST.map(() => ({ have: 0, level: 0, copies: 0 }));
pets[0] = { have: 1, level: 1, copies: 0 };
let cash = 0;
let gems = 10;
let stage = 1;
let t = 0;
let potionLeft = 0;
let discovered = 1;

const kindTargets = { shot: 1, splash: 2.2, pierce: 1.8, zap: 1, buff: 0 };

function teamDps(): { dps: number; best: number } {
  const ids = pets.map((p, i) => i).filter((i) => pets[i].level > 0);
  const score = (i: number) => {
    const d = PET_LIST[i];
    if (d.kind === "buff") return d.damage * levelMult(pets[i].level) * 0.05 * (1 + d.index);
    return ((d.damage * levelMult(pets[i].level) * d.count) / (d.cooldown / 1000)) * (d.kind === "splash" || d.kind === "pierce" ? 1.4 : 1);
  };
  const team = ids.sort((a, b) => score(b) - score(a)).slice(0, 3 + sum("slot"));
  let buff = 0;
  let petDps = 0;
  let perHit = 0;
  for (const i of team) {
    const d = PET_LIST[i];
    const dmg = d.damage * levelMult(pets[i].level);
    if (d.kind === "buff") buff += dmg / 100;
    else {
      petDps += (dmg * (d.kind === "shot" || d.kind === "zap" ? d.count : kindTargets[d.kind])) / (d.cooldown / 1000);
      perHit += dmg;
    }
  }
  const mult = prod("dmg") * (1 + buff);
  const hero = (HERO_BASE_DMG + perHit * HERO_TEAM_SHARE) * mult * prod("heroDmg") * gunDps(STARTER_GUN);
  const crit = 1 + (0.05 + sum("crit")) * (3 + sum("critDmg") - 1);
  return { dps: (petDps * mult + hero) * crit, best: Math.max(...team) };
}

/** Skills picked during a run: roughly x1 at the start up to x4.5 by the boss. */
const gunAt = (() => {
  // expected best gun (damage relative to the Glock) after each minute, from the airdrop odds
  const tierMult = GUN_TIERS.map((t) => gunsOfTier(t).reduce((a, g) => a + gunDps(g), 0) / gunsOfTier(t).length / gunDps(STARTER_GUN));
  const out: number[] = [];
  for (let m = 0; m <= MINUTES; m++) {
    const drops: number[][] = [];
    for (let at = AIRDROP_FIRST_MS; at <= m * 60000; at += AIRDROP_MS) {
      const w = gunTierWeights(at / 60000, 0);
      const tot = w.reduce((a, b) => a + b, 0);
      drops.push(w.map((x) => x / tot));
    }
    let e = 0;
    for (let t = 0; t < GUN_TIERS.length; t++) {
      // chance the best tier so far is exactly t
      const atMost = (k: number) => drops.reduce((p, d) => p * d.slice(0, k + 1).reduce((a, b) => a + b, 0), 1);
      e += (atMost(t) - (t ? atMost(t - 1) : 0)) * Math.max(1, tierMult[t]);
    }
    out.push(e);
  }
  return out;
})();
/** Skills (about +35% a minute) and better guns from airdrops, at a point of the run. */
const skillMult = (minute: number) => (1 + 0.35 * minute) * (0.7 + 0.3 * gunAt[Math.min(MINUTES, minute)]);
const group = (_minute: number, s: number) => 1 + (s > 40 ? 1 : 0);
const avgBase = (WALKER_A.hp + WALKER_B.hp + FLYER.hp) / 3;

/** One 5 minute run: how far you get, the money it pays and the dice you find. */
function run(s: number, dps: number): { won: boolean; secs: number; cash: number; dice: number } {
  let kills = 0;
  let minutesSurvived = 0;
  for (let m = 0; m < MINUTES; m++) {
    const perSec = (1000 / spawnGap(m)) * group(m, s);
    const need = perSec * monsterHp(avgBase, s, m);
    // kiting lets you get by with ~70% of what would be needed to kill everything
    const ok = dps * skillMult(m) >= need * 0.7;
    kills += Math.min(1, (dps * skillMult(m)) / need) * perSec * 60 + (m ? 10 + 4 * m : 0);
    if (!ok) break;
    minutesSurvived++;
  }
  const bossOk = minutesSurvived === MINUTES && dps * skillMult(MINUTES) * 40 >= monsterHp(BOSS.hp, s, MINUTES);
  const cash = kills * monsterCash((WALKER_A.cash + WALKER_B.cash + FLYER.cash) / 3, s) * prod("cash") * 1.4 + (bossOk ? monsterCash(BOSS.cash, s) : 0);
  // dice: ~60% of the 14 on the map, elites, chests, rare drops, boss
  const frac = Math.max(0.2, minutesSurvived / MINUTES);
  const dice = (8 + 9 + 6 + kills * 0.006) * frac + (bossOk ? 5 : 0);
  return { won: bossOk, secs: Math.max(60, minutesSurvived * 60) + (bossOk ? 30 : 0) + 20, cash, dice };
}

const rollTime = () => Math.max(150, 2000 * TREE.reduce((m, n) => (n.effect === "speed" && owned.has(n.id) ? m * (1 - n.per) : m), 1));
const luck = () => {
  const potion = potionLeft > 0 ? 2 + sum("potionPower") : 1;
  const index = 1 + 0.25 * Math.floor(discovered / 10);
  const every = 10 - sum("luckyEvery");
  const lucky = (every - 1 + 2 + sum("luckyPower")) / every; // average lucky-roll boost
  return prod("luck") * prod("die") * index * potion * lucky;
};

/** Expected copies of each pet per roll at this luck (rarest-first rule). */
function rollChances(L: number): number[] {
  const out = PET_LIST.map(() => 0);
  let remaining = 1;
  for (let i = PET_LIST.length - 1; i >= 1; i--) {
    const c = Math.min(1, L / PET_LIST[i].oneIn);
    out[i] = remaining * c;
    remaining *= 1 - c;
    if (remaining <= 0) break;
  }
  out[0] = remaining;
  return out;
}

const report: string[] = [];
const marks = new Set([2, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100]);
let dice = 10;
let fails = 0;
const LIMIT = 300 * 3600;
while (stage <= MAX_STAGE && t < LIMIT) {
  const r = run(stage, teamDps().dps);
  t += r.secs;
  cash += r.cash;
  dice += r.dice;
  // potion: drink whenever 10 gems are saved (lasts this run and the next couple)
  potionLeft = Math.max(0, potionLeft - r.secs);
  if (gems >= 10 && potionLeft <= 0) {
    gems -= 10;
    potionLeft = (5 + sum("potionTime")) * 60;
  }
  // rolling: spend every die (in the tiers this stage drops)
  const rolls = Math.floor(dice) * (1 + sum("multi"));
  dice -= Math.floor(dice);
  const tiers = diceTierChances(stage);
  const ch = PET_LIST.map(() => 0);
  DICE_TIERS.forEach((t, k) => rollChances(luck() * DICE_LUCK[t]).forEach((c, i) => (ch[i] += c * tiers[k])));
  for (let i = 0; i < ch.length; i++) {
    if (!ch[i]) continue;
    const got = ch[i] * rolls;
    const p = pets[i];
    p.have += got;
    if (p.level === 0 && p.have >= 1) {
      p.level = 1;
      p.copies = p.have - 1;
      discovered++;
    } else if (p.level > 0) {
      p.copies += got;
    }
    while (p.level > 0 && p.level < MAX_LEVEL && p.copies >= copiesFor(p.level)) {
      p.copies -= copiesFor(p.level);
      p.level++;
    }
  }
  if (r.won) {
    gems += 2 + sum("gems");
    if (marks.has(stage)) {
      const { best } = teamDps();
      report.push(`stage ${String(stage).padStart(3)} at ${(t / 3600).toFixed(2).padStart(6)} h   fails ${String(fails).padStart(4)}   luck ${luck().toExponential(1)}   best pet #${best} (${PET_LIST[best].rarity})   tree ${owned.size - 1}/${TREE.length - 1}`);
    }
    stage++;
  } else {
    fails++;
  }
  // shopping: cheapest open hexagon first
  for (;;) {
    const open = TREE.filter((n) => !owned.has(n.id) && n.req.every((q) => owned.has(q))).sort((a, b) => a.cost - b.cost)[0];
    if (!open || open.cost > cash) break;
    cash -= open.cost;
    owned.add(open.id);
  }
}
console.log(report.join("\n"));
const need = (1000 / spawnGap(MINUTES - 1)) * group(MINUTES - 1, stage) * monsterHp(avgBase, stage, MINUTES - 1) * 0.7;
console.log(`ended: stage ${stage} after ${(t / 3600).toFixed(1)} h, ${fails} failed runs, tree ${owned.size - 1}/${TREE.length - 1}, luck ${luck().toExponential(2)}, last minute needs ${need.toExponential(2)} vs dps ${(teamDps().dps * skillMult(MINUTES - 1)).toExponential(2)}`);
console.log(`best gun by minute (x Glock): ${gunAt.map((g) => g.toFixed(1)).join(" ")}`);
