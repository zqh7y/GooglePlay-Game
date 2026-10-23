/**
 * Progression simulator: plays the game second by second using the real data files and
 * prints how long a steady player needs to reach each stage. Run with:
 *   npx esbuild dev/sim.ts --bundle --platform=node --outfile=/tmp/sim.js && node /tmp/sim.js
 *
 * Model (deliberately simple):
 * - rolls happen at the roll-speed rate with auto roll; luck from the tree, index bonus, potion and lucky rolls
 * - expected pet copies per second come from the same rarest-first roll rule as the game
 * - the best 6 pets are equipped and levelled up whenever copies allow
 * - a stage is cleared when effective damage per second beats what its monsters need
 * - money comes from kills at the current stage; the cheapest open tree hexagon is bought whenever affordable
 */
import {
  BOSS, FLYER, HERO_BASE_DMG, HERO_FIRE_MS, HERO_TEAM_SHARE, MAX_STAGE, SPAWN_MAX, SPAWN_MIN, WALKER_A, WALKER_B,
  WAVES_PER_STAGE, monsterCash, monsterHp, waveSize,
} from "../src/data/balance";
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

const SPAWN = (SPAWN_MIN + SPAWN_MAX) / 2000;
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
  const hero = ((HERO_BASE_DMG + perHit * HERO_TEAM_SHARE) * mult * prod("heroDmg")) / (HERO_FIRE_MS / 1000);
  const crit = 1 + (0.05 + sum("crit")) * (3 + sum("critDmg") - 1);
  return { dps: (petDps * mult + hero) * crit, best: Math.max(...team) };
}

/** Damage per second the player needs to hold a stage (normal waves and the boss). */
function needed(s: number): number {
  const avg = (WALKER_A.hp + WALKER_B.hp + FLYER.hp) / 3;
  const wave = (monsterHp(avg, s, 3) * 1.3) / SPAWN;
  const boss = monsterHp(BOSS.hp, s, WAVES_PER_STAGE) / 22 + monsterHp(avg, s, WAVES_PER_STAGE) / SPAWN;
  // pets and the hero are not perfectly efficient (walking, overkill, misses)
  return Math.max(wave, boss) / 0.55;
}

function stageSeconds(s: number): number {
  let secs = 0;
  for (let w = 1; w <= WAVES_PER_STAGE; w++) secs += waveSize(s, w) * SPAWN + (w === WAVES_PER_STAGE ? 12 : 1.5);
  return secs + 3.6;
}

function cashPerSecond(s: number): number {
  let kills = 0;
  let money = 0;
  for (let w = 1; w <= WAVES_PER_STAGE; w++) {
    const n = waveSize(s, w);
    kills += n;
    money += n * monsterCash((WALKER_A.cash + WALKER_B.cash + FLYER.cash) / 3, s);
  }
  money += monsterCash(BOSS.cash, s);
  // combo bonus ~ +20%, quests/chests/daily ~ +15%
  return ((money * prod("cash")) / stageSeconds(s)) * 1.35;
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
const marks = new Set([5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100]);
let stageProgress = 0;
const DT = 5;
const LIMIT = 200 * 3600;
while (stage <= MAX_STAGE && t < LIMIT) {
  t += DT;
  // rolling
  const rolls = ((1 + sum("multi")) * DT) / (rollTime() / 1000);
  const ch = rollChances(luck());
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
  // potion: drink whenever 10 gems are saved
  potionLeft = Math.max(0, potionLeft - DT);
  if (gems >= 10 && potionLeft <= 0) {
    gems -= 10;
    potionLeft = (5 + sum("potionTime")) * 60;
  }
  // fighting and money
  cash += cashPerSecond(stage) * DT;
  const { dps } = teamDps();
  if (dps >= needed(stage)) {
    stageProgress += DT / stageSeconds(stage);
    if (stageProgress >= 1) {
      stageProgress = 0;
      gems += 2 + sum("gems");
      if (marks.has(stage)) {
        const { best } = teamDps();
        report.push(`stage ${String(stage).padStart(3)} at ${(t / 3600).toFixed(2).padStart(6)} h   luck ${luck().toExponential(1)}   best pet #${best} (${PET_LIST[best].rarity})   tree ${owned.size - 1}/${TREE.length - 1}`);
      }
      stage++;
    }
  }
  // shopping: cheapest open hexagon first
  for (;;) {
    const open = TREE.filter((n) => !owned.has(n.id) && n.req.every((r) => owned.has(r))).sort((a, b) => a.cost - b.cost)[0];
    if (!open || open.cost > cash) break;
    cash -= open.cost;
    owned.add(open.id);
  }
}
console.log(report.join("\n"));
console.log(`ended: stage ${stage} after ${(t / 3600).toFixed(1)} h, tree ${owned.size - 1}/${TREE.length - 1}, luck ${luck().toExponential(2)}, needed ${needed(stage).toExponential(2)} vs dps ${teamDps().dps.toExponential(2)}`);
