#!/usr/bin/env node
/**
 * Android helpers, run on your own computer (needs Android Studio installed once, for its SDK and Java).
 *
 *   npm run android -- keystore   creates your upload key (android/upload-key.jks) and
 *                                 android/keystore.properties with its password; both stay on
 *                                 your computer (git ignores them). Back them up somewhere safe.
 *   npm run android -- sha        prints the SHA-1 / SHA-256 of your upload key (and of the debug key)
 *   npm run android -- bundle     builds the game and the signed .aab to upload to Google Play
 *   npm run android -- bump       raises the version (Google Play wants a new one for every upload)
 *   npm run android -- github     what to paste into GitHub's secrets so GitHub builds the signed
 *                                 .aab for you (.github/workflows/android.yml), no Android Studio needed
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ANDROID = join(ROOT, "android");
const PROPS = join(ANDROID, "keystore.properties");
const KEY = join(ANDROID, "upload-key.jks");
const GRADLE_APP = join(ANDROID, "app", "build.gradle");
const WIN = process.platform === "win32";

const ok = (s) => console.log(`  \x1b[32m✔\x1b[0m ${s}`);
const warn = (s) => console.log(`  \x1b[33m•\x1b[0m ${s}`);
const fail = (s) => {
  console.error(`\n  \x1b[31m✘ ${s}\x1b[0m\n`);
  process.exit(1);
};

/** keytool from Android Studio's own Java if there is one, else from PATH. */
function keytool() {
  const studio = [
    process.env.JAVA_HOME && join(process.env.JAVA_HOME, "bin"),
    WIN && "C:\\Program Files\\Android\\Android Studio\\jbr\\bin",
    process.platform === "darwin" && "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin",
    join(homedir(), "android-studio", "jbr", "bin"),
    "/opt/android-studio/jbr/bin",
  ].filter(Boolean);
  for (const dir of studio) {
    const exe = join(dir, WIN ? "keytool.exe" : "keytool");
    if (existsSync(exe)) return exe;
  }
  return "keytool";
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: WIN, ...opts });
  if (r.error) fail(`Could not run ${cmd}: ${r.error.message}`);
  if (r.status !== 0) fail(`${cmd} ${args[0] ?? ""} failed (see above)`);
  return r;
}

/** Asks for passwords without showing them (one prompt after the other). */
async function askHidden(questions) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let muted = false;
  rl._writeToOutput = (s) => {
    if (!muted) rl.output.write(s);
  };
  // typed lines wait in a queue until their question comes
  const lines = [];
  let waiting = null;
  rl.on("line", (l) => {
    rl.output.write("\n");
    if (waiting) {
      const w = waiting;
      waiting = null;
      w(l);
    } else lines.push(l);
  });
  rl.on("close", () => waiting && fail("Cancelled."));
  const answers = [];
  for (const q of questions) {
    muted = false;
    rl.output.write(q);
    muted = true;
    answers.push(lines.length ? lines.shift() : await new Promise((done) => (waiting = done)));
  }
  rl.close();
  return answers;
}

function readProps() {
  if (!existsSync(PROPS)) return null;
  return Object.fromEntries(
    readFileSync(PROPS, "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

async function keystore() {
  if (existsSync(KEY) || existsSync(PROPS)) fail("You already have an upload key (android/upload-key.jks). Keep using it; a new one would not match the app on Google Play.");
  console.log("\nCreating your upload key. Pick a password of at least 6 characters and write it down somewhere safe.\n");
  const [pass, again] = await askHidden(["  Password: ", "  Password again: "]);
  if (pass.length < 6) fail("The password needs at least 6 characters.");
  if (pass !== again) fail("The two passwords are not the same.");
  // the password goes to keytool through an environment variable, never on the command line
  run(keytool(), [
    "-genkeypair", "-keystore", KEY, "-alias", "upload", "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
    "-dname", "CN=Dice Idle", "-storepass:env", "DICE_KEY_PASS", "-keypass:env", "DICE_KEY_PASS",
  ], { env: { ...process.env, DICE_KEY_PASS: pass }, stdio: "pipe" });
  writeFileSync(PROPS, [
    "# Your upload key for Google Play. Stays on this computer: git ignores this file and upload-key.jks.",
    "storeFile=upload-key.jks", `storePassword=${pass}`, "keyAlias=upload", `keyPassword=${pass}`, "",
  ].join("\n"));
  ok("created android/upload-key.jks and android/keystore.properties");
  warn("Back up BOTH files (and the password) somewhere safe, like a USB stick. Never put them in git or send them to anyone.");
  console.log("");
  sha();
}

/** SHA-1 and SHA-256 of a keystore entry, read with keytool. */
function fingerprints(file, alias, pass) {
  const r = spawnSync(keytool(), ["-list", "-v", "-keystore", file, "-alias", alias, "-storepass:env", "DICE_KEY_PASS"], {
    encoding: "utf8", shell: WIN, env: { ...process.env, DICE_KEY_PASS: pass },
  });
  if (r.status !== 0) return null;
  const grab = (name) => new RegExp(`${name}:\\s*([0-9A-F:]+)`).exec(r.stdout)?.[1] ?? null;
  return { sha1: grab("SHA1"), sha256: grab("SHA256") };
}

function sha() {
  const p = readProps();
  if (p) {
    const f = fingerprints(join(ANDROID, p.storeFile), p.keyAlias, p.storePassword);
    if (!f) fail("Could not read android/upload-key.jks (is the password in keystore.properties right?)");
    console.log("Your upload key:");
    console.log(`  SHA-1:   ${f.sha1}\n  SHA-256: ${f.sha256}`);
    console.log(`  Add them to Firebase with:  npm run online -- sha ${f.sha1} ${f.sha256}\n`);
  } else {
    warn("No upload key yet: npm run android -- keystore");
  }
  const debug = join(homedir(), ".android", "debug.keystore");
  if (existsSync(debug)) {
    const f = fingerprints(debug, "androiddebugkey", "android");
    if (f) console.log(`Debug key (for test builds from Android Studio):\n  SHA-1:   ${f.sha1}\n  SHA-256: ${f.sha256}\n`);
  }
}

function sdkReady() {
  if (process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT) return true;
  const local = join(ANDROID, "local.properties");
  return existsSync(local) && /sdk\.dir=/.test(readFileSync(local, "utf8"));
}

function bundle() {
  if (!readProps()) fail("Create your upload key first:  npm run android -- keystore");
  if (!sdkReady()) fail("Android SDK not found. Install Android Studio, open the android/ folder in it once (it writes android/local.properties), then run this again.");
  if (!existsSync(join(ANDROID, "app", "google-services.json"))) warn("No google-services.json: the app will build, but play offline (run  npm run online -- setup  first).");
  const npm = WIN ? "npm.cmd" : "npm";
  const npx = WIN ? "npx.cmd" : "npx";
  run(npm, ["run", "build"], { cwd: ROOT });
  run(npx, ["cap", "sync", "android"], { cwd: ROOT });
  run(WIN ? "gradlew.bat" : "./gradlew", ["bundleRelease"], { cwd: ANDROID });
  const out = join(ANDROID, "app", "build", "outputs", "bundle", "release", "app-release.aab");
  ok(`Ready to upload: ${out}`);
  const code = /versionCode\s+(\d+)/.exec(readFileSync(GRADLE_APP, "utf8"))?.[1];
  warn(`This is version ${code}. Before your next upload, run  npm run android -- bump`);
}

function bump() {
  let g = readFileSync(GRADLE_APP, "utf8");
  const code = Number(/versionCode\s+(\d+)/.exec(g)?.[1] ?? 1) + 1;
  const name = /versionName\s+"([^"]+)"/.exec(g)?.[1] ?? "1.0";
  const parts = name.split(".").map(Number);
  parts[parts.length - 1]++;
  g = g.replace(/versionCode\s+\d+/, `versionCode ${code}`).replace(/versionName\s+"[^"]+"/, `versionName "${parts.join(".")}"`);
  writeFileSync(GRADLE_APP, g);
  ok(`version ${code} (${parts.join(".")})`);
}

/** The three GitHub secrets for the cloud build. Prints the key (base64) on YOUR screen only. */
function github() {
  const p = readProps();
  if (!p) fail("Create your upload key first:  npm run android -- keystore");
  const key = readFileSync(join(ANDROID, p.storeFile)).toString("base64");
  console.log("\nOn GitHub: your repository → Settings → Secrets and variables → Actions → New repository secret.");
  console.log("Add these three, then open Actions → Android build → Run workflow:\n");
  console.log("  UPLOAD_KEY_BASE64     this whole line:\n");
  console.log(key);
  console.log("\n  UPLOAD_KEY_PASSWORD   the password you chose for your upload key");
  console.log("  GOOGLE_SERVICES_JSON  everything inside android/app/google-services.json (open it in a text editor, copy all)\n");
  warn("Clear this terminal afterwards. Secrets added on GitHub are hidden from everyone, also from the build logs.");
}

const cmd = process.argv[2];
if (cmd === "keystore") await keystore();
else if (cmd === "sha") sha();
else if (cmd === "bundle") bundle();
else if (cmd === "bump") bump();
else if (cmd === "github") github();
else {
  console.log("Use: npm run android -- keystore | sha | bundle | bump | github");
  process.exit(cmd ? 1 : 0);
}
