#!/usr/bin/env node
/**
 * Sets up the game's online side in YOUR Firebase project, from your own computer.
 * First sign in once with `npx firebase login`, then:
 *
 *   npm run online -- setup [--project <id>] [--location <region>]
 *       creates (or reuses) the Firebase project, the Firestore database, uploads the security
 *       rules, turns on guest sign-in, registers the Android app and saves google-services.json
 *   npm run online -- sha <SHA-1> [<SHA-256>]
 *       adds your app's signing fingerprints (from Play Console → App integrity) and refreshes
 *       google-services.json
 *   npm run online -- games-id <number>
 *       puts your Play Games Services project ID into the Android app
 *   npm run online -- status
 *       shows what is done and what is left
 *
 * Nothing secret is printed, stored in git or sent anywhere but Google: google-services.json goes
 * straight to android/app/ (git ignores it, and the pre-commit check refuses it).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const at = (...p) => join(ROOT, ...p);
const SERVICES = at("android", "app", "google-services.json");
const STRINGS = at("android", "app", "src", "main", "res", "values", "strings.xml");
const RC = at(".firebaserc");
const PACKAGE = /appId:\s*["']([^"']+)["']/.exec(readFileSync(at("capacitor.config.ts"), "utf8"))?.[1] ?? "com.diceidle.game";
const NAME = "Dice Idle";

const ok = (s) => console.log(`  \x1b[32m✔\x1b[0m ${s}`);
const todo = (s) => console.log(`  \x1b[33m•\x1b[0m ${s}`);
const fail = (s) => {
  console.error(`\n  \x1b[31m✘ ${s}\x1b[0m\n`);
  process.exit(1);
};

/** Runs the Firebase CLI; with json, returns its result (or throws with its message). */
function firebase(args, { json = true, quiet = true } = {}) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const r = spawnSync(npx, ["firebase", ...args, ...(json ? ["--json"] : []), "--non-interactive"], {
    cwd: ROOT, encoding: "utf8", shell: process.platform === "win32", stdio: json || quiet ? "pipe" : "inherit",
  });
  if (!json) {
    if (r.status !== 0) throw new Error((r.stderr || r.stdout || "").trim().split("\n").slice(-3).join(" "));
    return null;
  }
  let out;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    throw new Error((r.stderr || r.stdout || "firebase did not answer").trim().split("\n").slice(-3).join(" "));
  }
  if (out.status !== "success") throw new Error(out.error || "firebase failed");
  return out.result;
}

function signedInEmail() {
  try {
    const list = firebase(["login:list"]);
    return list?.[0]?.user?.email ?? null;
  } catch {
    return null;
  }
}

function savedProject() {
  try {
    return JSON.parse(readFileSync(RC, "utf8")).projects?.default ?? null;
  } catch {
    return null;
  }
}

function args() {
  const a = process.argv.slice(3);
  const opt = (name) => {
    const i = a.indexOf(`--${name}`);
    return i >= 0 ? a[i + 1] : null;
  };
  return { rest: a.filter((x, i) => !x.startsWith("--") && !(i > 0 && a[i - 1].startsWith("--"))), project: opt("project"), location: opt("location") };
}

function androidApp(project) {
  const apps = firebase(["apps:list", "ANDROID", "--project", project]) ?? [];
  return apps.find((x) => x.packageName === PACKAGE) ?? null;
}

/** Writes google-services.json and checks it has the web client that Play Games sign-in needs. */
function saveServices(project, appId) {
  // fetched into a fresh folder first (the CLI will not overwrite a file), then put in place
  const dir = mkdtempSync(join(tmpdir(), "dice-idle-services-"));
  try {
    const fresh = join(dir, "google-services.json");
    firebase(["apps:sdkconfig", "ANDROID", appId, "--project", project, "--out", fresh], { json: false });
    writeFileSync(SERVICES, readFileSync(fresh));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const conf = JSON.parse(readFileSync(SERVICES, "utf8"));
  const web = conf.client?.some((c) => c.oauth_client?.some((o) => o.client_type === 3));
  ok("google-services.json saved to android/app/ (git ignores it; never send it to anyone)");
  if (!web) todo("it has no web client yet: in the Firebase console, Authentication → Sign-in method, turn on Google, then run setup again");
  return web;
}

// ───────────────────────── setup ─────────────────────────

function setup() {
  const { project: wanted, location = "eur3" } = args();
  console.log("\nDice Idle: online setup\n");
  const email = signedInEmail();
  if (!email) fail("Sign in first:  npx firebase login   (then run this again)");
  ok(`signed in to Firebase as ${email}`);

  // 1. the project
  let project = wanted ?? savedProject();
  const mine = (firebase(["projects:list"]) ?? []).map((p) => p.projectId);
  if (project && mine.includes(project)) {
    ok(`using your project "${project}"`);
  } else {
    project ??= `dice-idle-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`  … creating the project "${project}" (takes a minute)`);
    try {
      firebase(["projects:create", project, "--display-name", NAME]);
    } catch (e) {
      fail(`Could not create the project: ${e.message}\n    Pick another id with --project my-dice-game, or create it at https://console.firebase.google.com and run setup --project <its id>`);
    }
    ok(`created the project "${project}"`);
  }
  writeFileSync(RC, JSON.stringify({ projects: { default: project } }, null, 2) + "\n");

  // 2. the database
  const dbs = firebase(["firestore:databases:list", "--project", project]) ?? [];
  if (dbs.some((d) => String(d.name ?? d).endsWith("/databases/(default)"))) {
    ok("Firestore database is there");
  } else {
    console.log(`  … creating the Firestore database in ${location}`);
    firebase(["firestore:databases:create", "(default)", "--location", location, "--project", project]);
    ok(`created the Firestore database (${location})`);
  }

  // 3. the security rules (only you can change them)
  firebase(["deploy", "--only", "firestore", "--project", project], { json: false });
  ok("security rules and indexes uploaded");

  // 4. the Android app
  let app = androidApp(project);
  if (!app) {
    app = firebase(["apps:create", "ANDROID", NAME, "--package-name", PACKAGE, "--project", project]);
    ok(`registered the Android app ${PACKAGE}`);
  } else {
    ok(`Android app ${PACKAGE} is registered`);
  }

  // 5. sign-in: guests (silent, for everyone) and Google (it creates the web client Play Games needs)
  const dir = mkdtempSync(join(tmpdir(), "dice-idle-auth-"));
  try {
    writeFileSync(join(dir, "firebase.json"), JSON.stringify({ auth: { providers: { anonymous: true, googleSignIn: { oAuthBrandDisplayName: NAME, supportEmail: email } } } }));
    firebase(["deploy", "--only", "auth", "--project", project, "--config", join(dir, "firebase.json")], { json: false });
    ok("guest sign-in turned on (and Google, for Play Games)");
  } catch (e) {
    todo(`could not turn sign-in on by itself (${e.message.slice(0, 120)}): in the Firebase console → Authentication → Sign-in method, turn on Anonymous and Google`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // 6. the config file the Android app reads
  saveServices(project, app.appId);
  console.log(`\nDone on the Firebase side. Project console: https://console.firebase.google.com/project/${project}/overview\n`);
  status();
}

// ───────────────────────── the rest ─────────────────────────

function sha() {
  const { rest } = args();
  const hashes = rest.filter((h) => /^([0-9A-Fa-f]{2}:?){20}$|^([0-9A-Fa-f]{2}:?){32}$/.test(h));
  if (!hashes.length) fail("Give the fingerprints, like:  npm run online -- sha AB:CD:...(SHA-1) 12:34:...(SHA-256)");
  const project = savedProject();
  if (!project) fail("Run  npm run online -- setup  first");
  const app = androidApp(project);
  if (!app) fail("The Android app is not registered yet: run  npm run online -- setup");
  for (const h of hashes) {
    try {
      firebase(["apps:android:sha:create", app.appId, h, "--project", project]);
      ok(`added ${h.replace(/:/g, "").length === 40 ? "SHA-1" : "SHA-256"} ${h.slice(0, 11)}…`);
    } catch (e) {
      if (/already exists/i.test(e.message)) ok(`${h.slice(0, 11)}… was already there`);
      else fail(e.message);
    }
  }
  saveServices(project, app.appId);
}

function gamesId() {
  const id = args().rest[0];
  if (!/^\d{6,}$/.test(id ?? "")) fail("Give the Play Games project ID (a long number), like:  npm run online -- games-id 123456789012");
  const xml = readFileSync(STRINGS, "utf8");
  writeFileSync(STRINGS, xml.replace(/(<string name="game_services_project_id"[^>]*>)[^<]*(<\/string>)/, `$1${id}$2`));
  ok(`Play Games project ID ${id} is in the Android app (android/app/src/main/res/values/strings.xml)`);
}

function status() {
  console.log("What is done:");
  const project = savedProject();
  project ? ok(`Firebase project: ${project}`) : todo("Firebase project: not yet (npm run online -- setup)");
  existsSync(SERVICES) ? ok("google-services.json is in android/app/") : todo("google-services.json: not yet (npm run online -- setup)");
  const games = /name="game_services_project_id"[^>]*>(\d+)</.exec(readFileSync(STRINGS, "utf8"))?.[1];
  games && games !== "0" ? ok(`Play Games project ID: ${games}`) : todo("Play Games project ID: not yet (npm run online -- games-id <number>)");
  existsSync(at("android", "keystore.properties")) ? ok("upload key for signing: android/keystore.properties") : todo("upload key: not yet (npm run android -- keystore)");
  console.log("");
}

const cmd = process.argv[2];
try {
  if (cmd === "setup") setup();
  else if (cmd === "sha") sha();
  else if (cmd === "games-id") gamesId();
  else if (cmd === "status") status();
  else {
    console.log("Use: npm run online -- setup | sha <SHA-1> [SHA-256] | games-id <number> | status");
    process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  fail(e.message);
}
