// Fails if a built game (dist/ by default) contains a Google API key. Run before publishing any
// build anywhere: the game's JavaScript never needs one (Android reads google-services.json).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? "dist";
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const bad = walk(dir).filter((f) => /AIza[0-9A-Za-z_-]{30,}/.test(readFileSync(f, "latin1")));
if (bad.length) {
  console.error(`API key found in the build, do not publish it:\n  ${bad.join("\n  ")}`);
  process.exit(1);
}
console.log(`Bundle check: no API keys in ${dir}.`);
