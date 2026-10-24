import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication, type User } from "@capacitor-firebase/authentication";
import { FieldValue, FirebaseFirestore, type WriteBatchOperation } from "@capacitor-firebase/firestore";
import { initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";

/**
 * Everything that talks to Firebase. Loaded only when online play is set up (see config.ts), so
 * the game downloads none of it otherwise. The Capacitor plugins use the native Firebase SDKs in
 * the Android app (with Google Play Games sign-in) and the Firebase JS SDK in a browser.
 */

export type { User };
export const native = () => Capacitor.isNativePlatform();

export async function init(config: FirebaseOptions | null, emulator: { host: string; firestorePort: number; authPort: number } | null): Promise<void> {
  // the Android app is configured by google-services.json; a browser needs the JS SDK set up
  if (!native()) {
    if (!config) throw new Error("no Firebase config");
    initializeApp(config);
  }
  if (emulator) {
    await FirebaseAuthentication.useEmulator({ host: emulator.host, port: emulator.authPort });
    await FirebaseFirestore.useEmulator({ host: emulator.host, port: emulator.firestorePort });
  }
  // a browser restores the last sign-in asynchronously
  if (!native()) await getAuth().authStateReady();
}

export async function currentUser(): Promise<User | null> {
  return (await FirebaseAuthentication.getCurrentUser()).user;
}

export async function signInPlayGames(): Promise<User | null> {
  return (await FirebaseAuthentication.signInWithPlayGames()).user;
}

/** A guest who later signs in with Google Play keeps their account (and their counted pets). */
export async function linkPlayGames(): Promise<User | null> {
  return (await FirebaseAuthentication.linkWithPlayGames()).user;
}

export async function signInGuest(): Promise<User | null> {
  return (await FirebaseAuthentication.signInAnonymously()).user;
}

export async function getDoc<T>(path: string): Promise<T | null> {
  return (await FirebaseFirestore.getDocument<T & Record<string, unknown>>({ reference: path })).snapshot.data;
}

export async function setDoc(path: string, data: Record<string, unknown>, merge = true): Promise<void> {
  await FirebaseFirestore.setDocument({ reference: path, data, merge });
}

export async function batch(operations: WriteBatchOperation[]): Promise<void> {
  await FirebaseFirestore.writeBatch({ operations });
}

/** The top documents of a collection by one number field. */
export async function top<T>(collection: string, field: string, n: number): Promise<{ id: string; data: T }[]> {
  const { snapshots } = await FirebaseFirestore.getCollection<T & Record<string, unknown>>({
    reference: collection,
    queryConstraints: [
      { type: "orderBy", fieldPath: field, directionStr: "desc" },
      { type: "limit", limit: n },
    ],
  });
  return snapshots.filter((s) => s.data).map((s) => ({ id: s.id, data: s.data as T }));
}

/** How many documents have a bigger value (your rank is that + 1). */
export async function countAbove(collection: string, field: string, value: number): Promise<number> {
  const { count } = await FirebaseFirestore.getCountFromServer({
    reference: collection,
    compositeFilter: { type: "and", queryConstraints: [{ type: "where", fieldPath: field, opStr: ">", value }] },
  });
  return count;
}

export const increment = (n: number) => FieldValue.increment(n);
export const serverTime = () => FieldValue.serverTimestamp();
export const arrayUnion = (...v: unknown[]) => FieldValue.arrayUnion(...v);
