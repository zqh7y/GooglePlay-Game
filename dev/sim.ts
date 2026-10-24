/**
 * Progression simulator: plays the game run by run using the real data files and prints
 * how long a steady player needs to reach each stage. Run with:
 *   npx esbuild dev/sim.ts --bundle --platform=node --outfile=/tmp/sim.js && node /tmp/sim.js
 *
 * Model (deliberately simple):
 * - a stage is a 5 minute run; skills and airdropped gadgets multiply your damage as it goes
 * - each minute you survive if your damage keeps up with the monsters coming in (kiting covers some)
 * - the boss at 5:00 has to die within ~40 s while you close its seals (it heals until you do); a failed
 *   run still pays money and the dice you found
 * - every roll costs one die; dice come from the map, elites, chests and the boss, in tiers that
 *   depend on the stage (a rarer die multiplies the roll's luck)
 * - the best pets are equipped and levelled up; the cheapest open tree hexagon is bought whenever affordable
 * - after every run the Boss Rush is tried: each boss your team (one target, ~80% of its damage, no skills)
 *   kills inside 15 s clears its stage
 */
import {
  BOSS, BOSS_HEAL, FLYER, HEALING_BOSS_HP, SKILLED_HEAL_SECS, HERO_BASE_DMG, HERO_TEAM_SHARE, MAX_STAGE, MINUTES, WALKER_A, WALKER_B, monsterCash,
  monsterHp, spawnGap,
} from "../src/data/balance";
import { GADGET_TIERS, DICE_TIERS, DICE_LUCK, Tier, diceTierChances } from "../src/data/tiers";
import { FISH_UPGRADES, FishUpId, catchSecs, expectedCatch, upgradeCost } from "../src/data/fishing";
import { GADGET_KINDS, STARTER_GADGET, gadgetDps } from "../src/data/gadgets";
import { MAX_LEVEL, PET_LIST, copiesFor, levelMult } from "../src/data/items";
import { TREE, TreeNode } from "../src/data/tree";
import { RUSH_MS, rushBossHp } from "../src/data/bosses";
import { petChances } from "../src/data/luck";

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
  const team = ids.sort((a, b) => score(b) - score(a)).slice(0, Math.min(3, 1 + sum("slot")));
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
  const hero = (HERO_BASE_DMG + perHit * HERO_TEAM_SHARE) * mult * prod("heroDmg") * gadgetDps(STARTER_GADGET, "A", 1);
  const crit = 1 + (0.05 + sum("crit")) * (3 + sum("critDmg") - 1);
  return { dps: (petDps * mult + hero) * crit, best: Math.max(...team) };
}

/**
 * Gadgets during a run: level-ups bring new gadgets, levels and tier-ups, up to the Forge's tier cap
 * (C at first, SSS with the Titan Forge). Roughly: levels fill up in the first ~2.5 minutes and the
 * tier climbs to the cap by ~4 minutes. As a multiple of the starting shuriken.
 */
const tierMult = GADGET_TIERS.map((t) => GADGET_KINDS.reduce((a, k) => a + gadgetDps(k, t, 1), 0) / GADGET_KINDS.length / gadgetDps(STARTER_GADGET, "A", 1));
const gadgetAt = (minute: number) => {
  const cap = Math.min(6, 2 + sum("forge"));
  const tier = cap * Math.min(1, minute / 4);
  const lo = Math.floor(tier);
  const t = tierMult[lo] + (tierMult[Math.min(cap, lo + 1)] - tierMult[lo]) * (tier - lo);
  return t * (1 + 0.8 * Math.min(1, minute / 2.5));
};
/** Skills (about +35% a minute) and better gadgets from level-ups, at a point of the run. */
const skillMult = (minute: number) => (1 + 0.35 * minute) * (0.7 + 0.3 * gadgetAt(Math.min(MINUTES, minute)));
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
  // the boss heals until you close its seals (a skilled player closes one every ~6 s)
  const bossHp = monsterHp(BOSS.hp, s, MINUTES) * HEALING_BOSS_HP * (1 + BOSS_HEAL * SKILLED_HEAL_SECS);
  const bossOk = minutesSurvived === MINUTES && dps * skillMult(MINUTES) * 40 >= bossHp;
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

// fishing runs all the time; the cheapest fishing upgrade is bought whenever there are shells for it
const fish = Object.fromEntries(FISH_UPGRADES.map((u) => [u.id, 0])) as Record<FishUpId, number>;
let shells = 0;
const fishDice = Object.fromEntries(DICE_TIERS.map((k) => [k, 0])) as Record<Tier, number>;
let fishCash = 0;
let earned = 0;

const report: string[] = [];
const marks = new Set([2, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100]);
let dice = 10;
let fails = 0;
let rushed = 0;
const cleared = (how: string) => {
  if (marks.has(stage)) {
    const { best } = teamDps();
    report.push(`stage ${String(stage).padStart(3)} at ${(t / 3600).toFixed(2).padStart(6)} h   fails ${String(fails).padStart(4)}   luck ${luck().toExponential(1)}   best pet #${best} (${PET_LIST[best].rarity})   tree ${owned.size - 1}/${TREE.length - 1}   forge ${sum("forge")}   fish speed ${fish.speed} luck ${fish.luck}   ${how}`);
  }
  stage++;
};
const LIMIT = 300 * 3600;
const forgeAt: number[] = [];
// after stage 100, keep farming it until the Titan Forge (the best gadgets) is bought
while (t < LIMIT && (stage <= MAX_STAGE || sum("forge") < 4)) {
  const r = run(Math.min(stage, MAX_STAGE), teamDps().dps);
  t += r.secs;
  cash += r.cash;
  earned += r.cash;
  dice += r.dice;
  // what the fishing line brought meanwhile (money is counted in seconds of fighting income)
  const casts = process.env.NOFISH ? 0 : r.secs / catchSecs(fish.speed);
  const haul = expectedCatch(fish);
  shells += haul.shells * casts;
  const fc = process.env.X_CASH ? 0 : haul.cashSecs * casts * (r.cash / r.secs);
  fishCash += fc;
  cash += fc;
  if (!process.env.X_DICE) for (const [k, v] of Object.entries(haul.dice)) fishDice[k as Tier] += v! * casts;
  if (!process.env.X_GEMS) gems += haul.gems * casts;
  if (!process.env.X_POT) potionLeft += haul.potionMin * 60 * casts;
  for (;;) {
    const open = FISH_UPGRADES.filter((u) => fish[u.id] < u.max).sort((a, b) => upgradeCost(a, fish[a.id]) - upgradeCost(b, fish[b.id]))[0];
    if (!open || upgradeCost(open, fish[open.id]) > shells) break;
    shells -= upgradeCost(open, fish[open.id]);
    fish[open.id]++;
  }
  // potion: drink whenever 10 gems are saved (lasts this run and the next couple)
  potionLeft = Math.max(0, potionLeft - r.secs);
  if (gems >= 10 && potionLeft <= 0) {
    gems -= 10;
    potionLeft = (5 + sum("potionTime")) * 60;
  }
  // rolling: spend every die (in the tiers this stage drops)
  const rolls = Math.floor(dice) * (1 + sum("multi"));
  dice -= Math.floor(dice);
  const tiers = diceTierChances(Math.min(stage, MAX_STAGE));
  const ch = PET_LIST.map(() => 0);
  DICE_TIERS.forEach((t, k) => petChances(luck() * DICE_LUCK[t]).forEach((c, i) => (ch[i] += c * tiers[k] * rolls)));
  // and the dice the fishing line brought, in their own tiers
  for (const k of DICE_TIERS) {
    const n = Math.floor(fishDice[k]);
    if (!n) continue;
    fishDice[k] -= n;
    petChances(luck() * DICE_LUCK[k]).forEach((c, i) => (ch[i] += c * n * (1 + sum("multi"))));
  }
  for (let i = 0; i < ch.length; i++) {
    if (!ch[i]) continue;
    const got = ch[i];
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
  if (stage > MAX_STAGE) {
    // farming stage 100 for the forge
  } else if (r.won) {
    gems += 2 + sum("gems");
    cleared("run");
  } else {
    fails++;
  }
  // shopping: cheapest open hexagon first
  for (;;) {
    const open = TREE.filter((n) => !owned.has(n.id) && n.req.every((q) => owned.has(q))).sort((a, b) => a.cost - b.cost)[0];
    if (!open || open.cost > cash) break;
    cash -= open.cost;
    owned.add(open.id);
    if (open.effect === "forge") forgeAt.push(t / 3600);
  }
  // Boss Rush: on through the stage bosses while each one dies in time
  while (stage <= MAX_STAGE && teamDps().dps * 0.8 * (RUSH_MS / 1000) >= rushBossHp(stage)) {
    if (stage % 5 === 0) gems += 3;
    t += 8;
    rushed++;
    cleared("rush");
  }
}
console.log(report.join("\n"));
const need = (1000 / spawnGap(MINUTES - 1)) * group(MINUTES - 1, stage) * monsterHp(avgBase, stage, MINUTES - 1) * 0.7;
console.log(`ended: stage ${stage} after ${(t / 3600).toFixed(1)} h, ${fails} failed runs, ${rushed} stages cleared in the Boss Rush, tree ${owned.size - 1}/${TREE.length - 1}, luck ${luck().toExponential(2)}, last minute needs ${need.toExponential(2)} vs dps ${(teamDps().dps * skillMult(MINUTES - 1)).toExponential(2)}`);
console.log(`forge levels bought at (h): ${forgeAt.map((h) => h.toFixed(1)).join(", ")}   gadget power by minute now (x shuriken): ${[0, 1, 2, 3, 4, 5].map((m) => gadgetAt(m).toFixed(1)).join(" ")}`);
console.log(`fishing: levels ${JSON.stringify(fish)}, fishing paid ${(fishCash / (earned + fishCash) * 100).toFixed(0)}% of all money`);
