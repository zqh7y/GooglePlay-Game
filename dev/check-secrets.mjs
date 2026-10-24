// Fails if any file git would commit contains something that looks like a secret:
// Google API keys, private keys, service account files, or a google-services.json.
// Runs before every commit (.githooks/pre-commit) and with `npm run check-secrets`.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PATTERNS = [
  [/AIza[0-9A-Za-z_-]{30,}/, "a Google API key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
  [/"type"\s*:\s*"service_account"/, "a service account key"],
  [/"client_secret"\s*:/, "an OAuth client secret"],
];
const BANNED_FILES = [/(^|\/)google-services\.json$/, /(^|\/)GoogleService-Info\.plist$/, /\.(jks|keystore)$/, /(^|\/)\.env(\.(?!example$)[^/]*)?$/];

const staged = process.argv.includes("--staged");
const files = execSync(staged ? "git diff --cached --name-only --diff-filter=ACM" : "git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
const problems = [];
for (const f of files) {
  if (BANNED_FILES.some((re) => re.test(f))) problems.push(`${f}: this file must never be committed`);
  let text;
  try {
    text = staged ? execSync(`git show :${JSON.stringify(f)}`, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }) : readFileSync(f, "utf8");
  } catch {
    continue;
  }
  for (const [re, what] of PATTERNS) if (re.test(text)) problems.push(`${f}: contains ${what}`);
}
if (problems.length) {
  console.error("Secret check failed, nothing was committed:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`Secret check: ${files.length} files, nothing found.`);
