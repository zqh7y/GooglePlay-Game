import { Capacitor } from "@capacitor/core";
import { ITEMS, PET_LIST } from "../data/items";
import { persist, save } from "../systems/save";
import { EMULATOR, FIREBASE_CONFIG } from "./config";

/**
 * Online play: a Google Play Games account (a guest account in a browser), your entry on the
 * leaderboards, and how many players in the world own each pet.
 *
 * Firestore holds:
 * - `players/{uid}`: name, best stage, rarest pet, pets found, rolls, Boss Rush best, and the list
 *   of pets this player has counted;
 * - `stats/pets`: `counts[petId]` = how many players own that pet. A player adds +1 for a pet only
 *   once, in the same write that adds the pet to their own list (firestore.rules checks it).
 *
 * Everything here fails softly: without a config, offline or on an error the game goes on as normal.
 */

export type OnlineStatus = "off" | "connecting" | "online" | "error";
export type Board = "stage" | "rarest" | "pets";

export interface PlayerEntry {
  uid: string;
  name: string;
  bestStage: number;
  rarest: string;
  rarestOdds: number;
  petsFound: number;
  rushBest: number;
}

interface PlayerDoc extends Omit<PlayerEntry, "uid"> {
  stageScore: number;
  rolls: number;
  pets: string[];
}

export const BOARD_FIELD: Record<Board, "stageScore" | "rarestOdds" | "petsFound"> = { stage: "stageScore", rarest: "rarestOdds", pets: "petsFound" };

type Backend = typeof import("./backend");

export const online = {
  status: "off" as OnlineStatus,
  uid: null as string | null,
  /** "playgames" when signed in with Google Play, "guest" otherwise */
  provider: null as "playgames" | "guest" | null,
  error: "",
};

let be: Backend | null = null;
let counts: Record<string, number> | null = null;
let countsAt = 0;
/** pets this account has already counted (from the server) */
let counted = new Set<string>();
let dirty = true;
let flushing = false;
let lastFlush = 0;
/** last successful write: the rules allow a plain update of your entry at most every 5 s */
let lastWrite = 0;
const WRITE_GAP = 6000;
let retryAt = 0;
let failures = 0;
const listeners: (() => void)[] = [];

/** On Android the native Firebase setup (google-services.json) is used; in a browser only with a web config. */
export const onlineEnabled = () => FIREBASE_CONFIG !== null || Capacitor.isNativePlatform();
export const canUsePlayGames = () => Capacitor.getPlatform() === "android";
export const onOnlineChange = (fn: () => void) => listeners.push(fn);
const changed = () => listeners.forEach((fn) => fn());

/** How many players own a pet, or null if we don't know (offline). */
export const ownersOf = (petId: string): number | null => (counts ? counts[petId] ?? 0 : null);

/** Your name on the leaderboards. */
export function playerName(): string {
  if (!save.online.name) {
    save.online.name = `Player${Math.floor(1000 + Math.random() * 9000)}`;
    persist();
  }
  return save.online.name;
}

/** Letters, numbers, spaces, _ and -, 2 to 16 of them. */
export function cleanName(raw: string): string | null {
  const s = raw.replace(/[^A-Za-z0-9 _-]/g, "").replace(/\s+/g, " ").trim().slice(0, 16);
  return s.length >= 2 ? s : null;
}

/**
 * Called once when the game starts. Nobody is asked to sign up or sign in: the game quietly uses
 * the account from last time, or a new guest account. Google Play sign-in is optional, from Settings.
 */
export async function startOnline(): Promise<void> {
  if (!onlineEnabled() || online.status === "connecting") return;
  online.status = "connecting";
  changed();
  try {
    be = await import("./backend");
    await be.init(FIREBASE_CONFIG, EMULATOR);
    let user = await be.currentUser();
    if (!user) user = await be.signInGuest();
    if (!user) throw new Error("could not sign in");
    setUser(user);
    await loadMe();
    online.status = "online";
    online.error = "";
    failures = 0;
    changed();
    await refreshCounts(true);
    await flush(true);
  } catch (e) {
    fail(e);
  }
}

function setUser(user: { uid: string; isAnonymous: boolean; displayName: string | null }): void {
  online.uid = user.uid;
  online.provider = user.isAnonymous ? "guest" : "playgames";
  // the Play Games name, the first time
  if (!user.isAnonymous && user.displayName && !save.online.named) {
    save.online.name = cleanName(user.displayName) ?? save.online.name;
    persist();
  }
}

function fail(e: unknown): void {
  online.status = "error";
  online.error = e instanceof Error ? e.message : String(e);
  // try again later, waiting longer each time (1 min, 2, 4... up to 30)
  failures++;
  retryAt = Date.now() + Math.min(30, 2 ** (failures - 1)) * 60000;
  console.warn("online:", online.error);
  changed();
}

/** Your own entry: which pets you already counted, and your best numbers so far (they only go up). */
async function loadMe(): Promise<void> {
  const me = await be!.getDoc<PlayerDoc>(`players/${online.uid}`);
  counted = new Set(me?.pets ?? []);
  if (me) {
    // a fresh install keeps the best numbers already on the board
    save.bestStage = Math.max(save.bestStage, me.bestStage ?? 0);
    save.bossRushBest = Math.max(save.bossRushBest, me.rushBest ?? 0);
    if (!save.online.named && me.name) save.online.name = me.name;
  }
}

/** The pets you own, rarest first. */
function ownedPets(): string[] {
  return Object.keys(save.pets).filter((id) => ITEMS[id]).sort((a, b) => ITEMS[b].oneIn - ITEMS[a].oneIn);
}

function myDoc(): Omit<PlayerDoc, "pets"> {
  const owned = ownedPets();
  const rarest = owned[0] ?? PET_LIST[0].id;
  const petsFound = owned.length;
  return {
    name: playerName(),
    bestStage: Math.min(100, Math.max(1, save.bestStage)),
    // stage first, then pets found to break ties
    stageScore: Math.min(100, Math.max(1, save.bestStage)) + petsFound / 1000,
    rarest,
    rarestOdds: ITEMS[rarest]?.oneIn ?? 2,
    petsFound,
    rolls: Math.floor(save.totalRolls),
    rushBest: Math.floor(save.bossRushBest),
  };
}

/** Something worth sending happened (a stage cleared, a new pet...). */
export function syncSoon(): void {
  dirty = true;
}

/** Called every frame or so: sends your entry when needed (at most every 30 s, else every 2 min). */
export function onlineTick(): void {
  const now = Date.now();
  if (online.status === "error" && now > retryAt && onlineEnabled()) {
    online.status = "off";
    void startOnline();
    return;
  }
  if (online.status !== "online" || flushing) return;
  if ((dirty && now - lastFlush > 30000) || now - lastFlush > 120000) void flush();
}

/** Send your entry, then count any pets you have that this account has not counted yet. */
export async function flush(force = false): Promise<void> {
  if (!be || !online.uid || flushing || (!force && !dirty)) return;
  flushing = true;
  dirty = false;
  lastFlush = Date.now();
  try {
    const path = `players/${online.uid}`;
    if (Date.now() - lastWrite > WRITE_GAP) {
      await be.setDoc(path, { ...myDoc(), updatedAt: be.serverTime(), ...(counted.size ? {} : { pets: [] }) });
      lastWrite = Date.now();
    } else {
      dirty = true;
    }
    // one small write per new pet: add it to your list and +1 to its world count, together
    for (const id of ownedPets().reverse()) {
      if (counted.has(id)) continue;
      await be.batch([
        { type: "update", reference: path, data: { pets: be.arrayUnion(id), updatedAt: be.serverTime() } },
        { type: "set", reference: "stats/pets", data: { counts: { [id]: be.increment(1) }, last: id }, options: { merge: true } },
      ]);
      counted.add(id);
      lastWrite = Date.now();
      if (counts) counts[id] = (counts[id] ?? 0) + 1;
    }
  } catch (e) {
    dirty = true;
    fail(e);
  } finally {
    flushing = false;
  }
}

/** How many players own each pet (one small read, at most every few minutes). */
export async function refreshCounts(force = false): Promise<void> {
  if (!be || online.status !== "online" || (!force && Date.now() - countsAt < 180000)) return;
  countsAt = Date.now();
  try {
    const doc = await be.getDoc<{ counts: Record<string, number> }>("stats/pets");
    counts = { ...(doc?.counts ?? {}) };
    changed();
  } catch (e) {
    fail(e);
  }
}

/** The top players of a board, and where you stand. */
export async function leaderboard(board: Board, n = 20): Promise<{ top: PlayerEntry[]; myRank: number | null; me: PlayerEntry | null }> {
  if (!be || online.status !== "online") throw new Error("offline");
  await flush(true);
  const field = BOARD_FIELD[board];
  const rows = await be.top<PlayerDoc>("players", field, n);
  const top = rows.map(({ id, data }) => ({ uid: id, name: data.name, bestStage: data.bestStage, rarest: data.rarest, rarestOdds: data.rarestOdds, petsFound: data.petsFound, rushBest: data.rushBest }));
  const mine = myDoc();
  const myRank = (await be.countAbove("players", field, mine[field])) + 1;
  return { top, myRank, me: { uid: online.uid!, ...mine } };
}

/**
 * Optional, from Settings: sign in with Google Play. A guest keeps their leaderboard entry and
 * counted pets (the guest account is linked to Google Play); if that Google Play account already
 * played on another phone, we switch to it.
 */
export async function signInWithPlay(): Promise<boolean> {
  if (!be || !canUsePlayGames()) return false;
  try {
    let user;
    try {
      user = online.provider === "guest" ? await be.linkPlayGames() : await be.signInPlayGames();
    } catch (e) {
      // already linked to another account: use that one
      if (online.provider !== "guest") throw e;
      user = await be.signInPlayGames();
    }
    if (user) {
      setUser(user);
      await loadMe();
      online.status = "online";
      changed();
      await flush(true);
      return true;
    }
    return false;
  } catch (e) {
    // the player closed the Google Play window, or there is no Play Games: stay as you were
    console.warn("online: Google Play sign-in failed", e);
    return false;
  }
}

export function rename(raw: string): boolean {
  const name = cleanName(raw);
  if (!name) return false;
  save.online.name = name;
  save.online.named = true;
  persist();
  syncSoon();
  void flush(true);
  return true;
}

// testing against the local emulators only: let the test scripts look inside
if (EMULATOR && typeof window !== "undefined") (window as unknown as Record<string, unknown>).__online = { online, ownersOf, flush, leaderboard, refreshCounts, startOnline };
