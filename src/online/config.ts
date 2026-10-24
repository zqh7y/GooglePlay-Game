import type { FirebaseOptions } from "firebase/app";

/**
 * Online setup. No key is ever written in the code or committed.
 * - The Android app needs nothing here: its native Firebase SDK reads android/app/google-services.json
 *   (ignored by git), so the game's JavaScript contains no key at all.
 * - Only to try online play in a browser, put the web config in `.env.local` (ignored by git) as
 *     VITE_FIREBASE_CONFIG={"apiKey":"...","projectId":"...","appId":"..."}
 *   and never publish that build. See ONLINE.md.
 * Without either, the game simply plays offline (no leaderboard, no world pet counts).
 */
function fromEnv(): FirebaseOptions | null {
  try {
    const raw = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined;
    return raw ? (JSON.parse(raw) as FirebaseOptions) : null;
  } catch {
    return null;
  }
}

/**
 * For testing against the local Firebase emulators (`npm run emulators`): open the game with
 * `?online=emulator`. The emulators run a made-up "demo-" project on your own computer only.
 */
export const EMULATOR =
  typeof location !== "undefined" && new URLSearchParams(location.search).get("online") === "emulator"
    ? { host: new URLSearchParams(location.search).get("host") ?? "127.0.0.1", firestorePort: 8080, authPort: 9099 }
    : null;

/** The emulators need some value in `apiKey`; this is a placeholder, not a key. */
const EMULATOR_CONFIG: FirebaseOptions = { apiKey: "emulator-placeholder-not-a-key", projectId: "demo-dice-idle", appId: "demo-app" };

export const FIREBASE_CONFIG: FirebaseOptions | null = EMULATOR ? EMULATOR_CONFIG : fromEnv();
