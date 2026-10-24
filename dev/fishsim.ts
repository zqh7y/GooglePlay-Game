/**
 * Fishing simulator: fishes non-stop, buys the cheapest fishing upgrade whenever it can, and
 * prints when each upgrade maxes out and what an hour of fishing brings at a few points. Run with:
 *   npx esbuild dev/fishsim.ts --bundle --platform=node --outfile=/tmp/fishsim.js && node /tmp/fishsim.js
 */
import { FISH_UPGRADES, FishUpId, catchSecs, expectedCatch, fishLuck, prizesOpen, upgradeCost } from "../src/data/fishing";

const lv = Object.fromEntries(FISH_UPGRADES.map((u) => [u.id, 0])) as Record<FishUpId, number>;
let shells = 0;
let t = 0;
const maxedAt: Record<string, number> = {};
const marks = [1, 5, 10, 25, 50, 75, 100, 120];
let next = 0;
const STEP = 60;
while (t < 200 * 3600) {
  shells += (expectedCatch(lv).shells * STEP) / catchSecs(lv.speed);
  t += STEP;
  for (;;) {
    const open = FISH_UPGRADES.filter((u) => lv[u.id] < u.max).sort((a, b) => upgradeCost(a, lv[a.id]) - upgradeCost(b, lv[b.id]))[0];
    if (!open || upgradeCost(open, lv[open.id]) > shells) break;
    shells -= upgradeCost(open, lv[open.id]);
    lv[open.id]++;
    if (lv[open.id] === open.max) maxedAt[open.id] = t / 3600;
  }
  if (next < marks.length && t >= marks[next] * 3600) {
    const h = 3600 / catchSecs(lv.speed);
    const p = expectedCatch(lv);
    const dice = Object.entries(p.dice).map(([k, v]) => `${k} ${(v! * h).toFixed(k < "C" ? 0 : 2)}`).join(" ");
    console.log(`${String(marks[next]).padStart(4)} h  catch ${catchSecs(lv.speed).toFixed(1)}s luck x${fishLuck(lv.luck).toFixed(1)} open ${prizesOpen(lv.pond)}  per hour: money ${(p.cashSecs * h / 60).toFixed(0)} min of income, dice [${dice}], gems ${(p.gems * h).toFixed(1)}, potion ${(p.potionMin * h).toFixed(0)} min, shells ${(p.shells * h).toFixed(0)}`);
    next++;
  }
}
console.log("maxed at (h):", JSON.stringify(Object.fromEntries(Object.entries(maxedAt).map(([k, v]) => [k, +v.toFixed(1)]))));
