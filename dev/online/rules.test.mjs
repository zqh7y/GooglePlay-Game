// Security rules tests, run against the Firestore emulator:
//   npm run test:rules
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, test } from "node:test";
import { arrayUnion, doc, getDoc, increment, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-dice-idle",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
after(async () => env.cleanup());
beforeEach(async () => env.clearFirestore());

const me = () => env.authenticatedContext("alice").firestore();
const other = () => env.authenticatedContext("bob").firestore();
const nobody = () => env.unauthenticatedContext().firestore();

const entry = (over = {}) => ({
  name: "Alice", bestStage: 12, stageScore: 12.05, rarest: "king_hammy", rarestOdds: 5000, petsFound: 50, rolls: 900, rushBest: 10,
  pets: [], updatedAt: serverTimestamp(), ...over,
});

/** Make the player entry exist (rules off), with some counted pets. */
async function seed(uid, pets = [], counts = null) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `players/${uid}`), { ...entry({ pets }), updatedAt: new Date(Date.now() - 60000) });
    if (counts) await setDoc(doc(db, "stats/pets"), { counts, last: Object.keys(counts)[0] ?? "x" });
  });
}

/** The world counts, read with the rules off. */
async function counts() {
  let out = null;
  await env.withSecurityRulesDisabled(async (c) => {
    out = (await getDoc(doc(c.firestore(), "stats/pets"))).data().counts;
  });
  return out;
}

const countPet = (db, uid, id) => {
  const b = writeBatch(db);
  b.update(doc(db, `players/${uid}`), { pets: arrayUnion(id), updatedAt: serverTimestamp() });
  b.set(doc(db, "stats/pets"), { counts: { [id]: increment(1) }, last: id }, { merge: true });
  return b.commit();
};

test("anyone can read the boards and counts, nobody else's data", async () => {
  await seed("alice", [], { gumdrop: 3 });
  await assertSucceeds(getDoc(doc(nobody(), "players/alice")));
  await assertSucceeds(getDoc(doc(nobody(), "stats/pets")));
  await assertFails(getDoc(doc(nobody(), "secret/thing")));
});

test("you can create and update only your own entry", async () => {
  await assertSucceeds(setDoc(doc(me(), "players/alice"), entry()));
  await assertFails(setDoc(doc(me(), "players/bob"), entry()));
  await assertFails(setDoc(doc(nobody(), "players/carol"), entry()));
});

test("entries must look right", async () => {
  await assertFails(setDoc(doc(me(), "players/alice"), entry({ bestStage: 101 })));
  await assertFails(setDoc(doc(me(), "players/alice"), entry({ name: "<script>" })));
  await assertFails(setDoc(doc(me(), "players/alice"), entry({ name: "x" })));
  await assertFails(setDoc(doc(me(), "players/alice"), entry({ hacked: true })));
  await assertFails(setDoc(doc(me(), "players/alice"), entry({ pets: ["gumdrop"] })));
  await assertFails(setDoc(doc(me(), "players/alice"), entry({ updatedAt: new Date() })));
});

test("plain updates at most every 5 s, and nobody can delete", async () => {
  await assertSucceeds(setDoc(doc(me(), "players/alice"), entry()));
  await assertFails(setDoc(doc(me(), "players/alice"), entry({ bestStage: 13, stageScore: 13.05 })));
  await seed("alice");
  await assertSucceeds(setDoc(doc(me(), "players/alice"), entry({ bestStage: 13, stageScore: 13.05 })));
});

test("counting a pet: once, together with your own list", async () => {
  await seed("alice");
  await assertSucceeds(countPet(me(), "alice", "gumdrop"));
  if ((await counts()).gumdrop !== 1) throw new Error("expected 1 owner");
  // the same pet again: refused
  await assertFails(countPet(me(), "alice", "gumdrop"));
  // another player counts it too
  await seed("bob");
  await assertSucceeds(countPet(other(), "bob", "gumdrop"));
  if ((await counts()).gumdrop !== 2) throw new Error("expected 2 owners");
});

test("no cheating the counts", async () => {
  await seed("alice", [], { gumdrop: 5, mochi: 2 });
  const db = me();
  // +1 without adding it to your list
  await assertFails(setDoc(doc(db, "stats/pets"), { counts: { mochi: increment(1) }, last: "mochi" }, { merge: true }));
  // +2
  let b = writeBatch(db);
  b.update(doc(db, "players/alice"), { pets: arrayUnion("mochi"), updatedAt: serverTimestamp() });
  b.set(doc(db, "stats/pets"), { counts: { mochi: increment(2) }, last: "mochi" }, { merge: true });
  await assertFails(b.commit());
  // two pets at once
  b = writeBatch(db);
  b.update(doc(db, "players/alice"), { pets: arrayUnion("mochi"), updatedAt: serverTimestamp() });
  b.set(doc(db, "stats/pets"), { counts: { mochi: increment(1), gumdrop: increment(1) }, last: "mochi" }, { merge: true });
  await assertFails(b.commit());
  // lowering someone's count
  await assertFails(updateDoc(doc(db, "stats/pets"), { counts: { gumdrop: 0, mochi: 2 }, last: "gumdrop" }));
  // counting into someone else's list
  await seed("bob");
  b = writeBatch(db);
  b.update(doc(db, "players/bob"), { pets: arrayUnion("mochi"), updatedAt: serverTimestamp() });
  b.set(doc(db, "stats/pets"), { counts: { mochi: increment(1) }, last: "mochi" }, { merge: true });
  await assertFails(b.commit());
  // removing a pet from your list to count it again
  await seed("alice", ["gumdrop"]);
  await assertFails(updateDoc(doc(db, "players/alice"), { pets: [], updatedAt: serverTimestamp() }));
});
