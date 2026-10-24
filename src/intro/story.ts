import * as THREE from "three";
import { music, sfx } from "../systems/sound";
import { Overlay } from "./overlay";
import { DICE_COLORS, MOODS, Mood, World3D, mixMood } from "./world3d";

/**
 * The opening story, shown once to new players (and again from Settings). About 40 seconds of
 * film in the 3D world, every moment worked out from the story clock so it plays the same on any
 * device:
 *   1. five lands float above the clouds, each lit by its Crystal
 *   2. the Storm rolls in: dark sky, lightning
 *   3. monsters rain down on the lands, a crowned boss rises from the clouds and drinks the
 *      Crystals' light, one by one
 *   4. darkness... until a pair of eyes lights up inside an old cardboard box
 *   5. dice fall from the sky and every one pops into a new friend
 *   6. dawn breaks over the dark lands ahead: the title
 */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** 0 before a, 1 after b, smooth in between */
const smooth = (a: number, b: number, t: number) => {
  const k = clamp01((t - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const easeInOut = (k: number) => 0.5 - Math.cos(Math.PI * clamp01(k)) / 2;
const backOut = (k: number) => {
  const c = 1.9;
  const x = clamp01(k) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
};

const GRAVITY = 28;
const BOUNCE = 0.42;
/** Height of something dropped from h at time 0 that bounces until it settles. */
function bounce(t: number, h: number): number {
  if (t <= 0) return h;
  const fall = Math.sqrt((2 * h) / GRAVITY);
  if (t < fall) return h - 0.5 * GRAVITY * t * t;
  t -= fall;
  let v = GRAVITY * fall * BOUNCE;
  while (v > 0.6) {
    const air = (2 * v) / GRAVITY;
    if (t < air) return v * t - 0.5 * GRAVITY * t * t;
    t -= air;
    v *= BOUNCE;
  }
  return 0;
}
function bounceEnd(h: number): number {
  let t = Math.sqrt((2 * h) / GRAVITY);
  let v = GRAVITY * t * BOUNCE;
  while (v > 0.6) {
    t += (2 * v) / GRAVITY;
    v *= BOUNCE;
  }
  return t;
}

/** What the narrator says, and when (seconds). *word* is highlighted. */
const CAPTIONS: [number, number, string][] = [
  [0.8, 6.2, "Long ago, five lands floated above the clouds, each lit by a magic *Crystal*."],
  [7.0, 12.2, "Then one night... the *Storm* came."],
  [13.0, 20.2, "Its monsters swarmed the lands, and their *bosses* stole every Crystal's light."],
  [21.0, 23.9, "The lands went dark."],
  [24.3, 26.9, "But in an old cardboard box... something *woke up*."],
  [27.6, 33.8, "A handful of lucky *dice*... and every roll brought a new *friend*!"],
  [34.6, 39.4, "Together they set out to bring the light back. All the way to *Stage 100*!"],
];
const TITLE_AT = 39.8;
const LETTERS_PER_SECOND = 34;

interface Shot {
  t0: number;
  t1: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  lookFrom: THREE.Vector3;
  lookTo: THREE.Vector3;
  /** heights follow the near land as it floats */
  follow?: boolean;
}

const SHOTS: Shot[] = [
  // 1. a slow flight over the five lands
  { t0: 0, t1: 6.5, from: V(-10, 5, 14), to: V(-5.5, 3.4, 8), lookFrom: V(4, 2, -24), lookTo: V(5, 2.5, -27) },
  // 2. looking up at the sky as the storm rolls in
  { t0: 6.5, t1: 12.5, from: V(3.5, 1.4, 8), to: V(2.8, 1.5, 6.6), lookFrom: V(3, 7, -20), lookTo: V(3, 8.5, -20) },
  // 3a. monsters raining down on the lands
  { t0: 12.5, t1: 15.5, from: V(11, 4.5, -2), to: V(10, 4, -4), lookFrom: V(3, 1.2, -15), lookTo: V(2, 1.2, -17) },
  // 3b. the boss rises and drinks the light
  { t0: 15.5, t1: 20.5, from: V(-4.2, 2.9, 6.4), to: V(-3.6, 2.5, 5.6), lookFrom: V(1.5, 3, -30), lookTo: V(1.5, 3.4, -30) },
  // 4. the old box in the dark
  { t0: 20.5, t1: 27, from: V(2.9, 1.7, 6.6), to: V(2.0, 1.4, 5.2), lookFrom: V(1.1, 1.0, 1.6), lookTo: V(1.1, 1.05, 1.6), follow: true },
  // 5 is an orbit (below); 6. pulling back over the dark lands as dawn breaks
  { t0: 34, t1: 41, from: V(3, 2.6, 7.5), to: V(-3.5, 6.5, 15.5), lookFrom: V(1, 1.2, 0), lookTo: V(3, 1, -20) },
];
const ORBIT = { t0: 27, t1: 34, center: V(0.9, 0.95, 1.9), r0: 5.4, r1: 4.6, a0: 0.45, a1: -0.3, h0: 2.3, h1: 1.7 };

/** Lightning: when and where it strikes. */
const STRIKES: [number, THREE.Vector3][] = [
  [8.6, V(9, 6, -18)], [10.4, V(-6, 6, -15)], [11.8, V(12, 5, -26)], [14.4, V(-1, 5, -21)], [18.6, V(-4, 6, -8)], [19.9, V(8, 5, -22)],
];
/** The boss drinks the light of each land's crystal, the far ones first. */
const DRAIN: [number, number][] = [[16.0, 4], [16.5, 3], [17.0, 2], [17.5, 1], [18.6, 0]];
const DRAIN_TIME = 1.1;
const SLIME_COLORS = [0x7fd35a, 0xffa040, 0xa070e0, 0xe0c070, 0x9ad8ff];
/** Where the three dice land, around the hero (x, z), when they fall and how rare they look. */
const DICE_DROPS: { x: number; z: number; at: number; die: number; rank: number }[] = [
  { x: -0.3, z: 2.6, at: 27.5, die: 0, rank: 1 },
  { x: 2.3, z: 2.5, at: 28.7, die: 2, rank: 3 },
  { x: -0.5, z: 1.3, at: 29.9, die: 4, rank: 6 },
];
const DROP_H = 9;

function moodAt(t: number): Mood {
  if (t < 6.5) return MOODS.day;
  if (t < 9.5) return mixMood(MOODS.day, MOODS.storm, smooth(6.5, 9.5, t));
  if (t < 20.5) return MOODS.storm;
  if (t < 23) return mixMood(MOODS.storm, MOODS.night, smooth(20.5, 23, t));
  if (t < 34) return MOODS.night;
  return mixMood(MOODS.night, MOODS.dawn, smooth(34, 41, t) * 0.9);
}

export interface StoryRun {
  /** resolves when the player taps the title, or skips */
  done: Promise<void>;
  /** jump the story clock (tests) */
  seek(t: number): void;
}

/** Plays the story in the world (already running) and the overlay. Pets: three drawn pets. */
export function playStory(w: World3D, ui: Overlay, pets: HTMLCanvasElement[]): StoryRun {
  w.clearTicks();
  ui.startStory();
  music.play("story");
  // the cast
  w.islands.forEach((isl) => isl.crystal.setLight(1));
  w.dice.forEach((d) => (d.visible = false));
  w.openFlaps(0);
  w.eyes = 0;
  w.heroHop = 0;
  w.hero.group.rotation.y = 0;
  w.hero.body.scale.set(1, 1, 1);
  const slimes: { m: THREE.Group; island: number; at: number }[] = [];
  w.islands.forEach((isl, i) => {
    if (i === 0) return;
    for (let k = 0; k < 3; k++) {
      const m = w.makeMonster(SLIME_COLORS[i]);
      const a = k * 2.1 + 0.6;
      m.position.set(Math.cos(a) * isl.radius * 0.45, 0, Math.sin(a) * isl.radius * 0.45);
      m.rotation.y = -isl.group.rotation.y + (k - 1) * 0.4;
      m.scale.setScalar(1.2 + k * 0.15);
      isl.group.add(m);
      slimes.push({ m, island: i, at: 12.6 + (i - 1) * 0.55 + k * 0.22 });
    }
  });
  const boss = w.makeMonster(0x4a2470, true);
  boss.scale.setScalar(7);
  boss.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
    if (mat && mat.type === "MeshBasicMaterial") mat.fog = false;
  });
  w.scene.add(boss);
  const bossGlow = w.makeGlow(0xa04aff, 26);
  w.scene.add(bossGlow);
  const BOSS_X = 1.5;
  const BOSS_Z = -31;
  // light streaks: a bright head and a fading trail
  const streaks = DRAIN.map(([, i]) => {
    const col = w.islands[i].crystal.color.getHex();
    const parts = [0, 1, 2, 3, 4].map((j) => {
      const g = w.makeGlow(col, 1.6 - j * 0.25);
      g.material.fog = false;
      w.scene.add(g);
      return g;
    });
    return parts;
  });
  // the dice and the friends they turn into
  const drops = DICE_DROPS.map((d, i) => {
    const die = w.dice[d.die];
    const end = bounceEnd(DROP_H);
    const pet = w.makeSprite(pets[i], 1.05);
    pet.visible = false;
    w.scene.add(pet);
    const burst = w.makeGlow(DICE_COLORS[d.die], 1);
    burst.material.fog = false;
    w.scene.add(burst);
    const axis = new THREE.Vector3(Math.random() - 0.5, 1, Math.random() - 0.5).normalize();
    return { ...d, die, pet, burst, pop: d.at + end + 0.3, end, axis };
  });
  const wake = w.makeGlow(0xfff2b0, 1);
  wake.material.fog = false;
  w.scene.add(wake);
  const look = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const qSpin = new THREE.Quaternion();
  const fired = new Set<string>();
  let t = 0;
  let shake = 0;
  let titled = false;
  let finished = false;
  let finish: () => void = () => {};
  const done = new Promise<void>((res) => (finish = res));
  /** Runs once when the story clock passes `at`. */
  const once = (key: string, at: number, fn: () => void) => {
    if (t >= at && !fired.has(key)) {
      fired.add(key);
      fn();
    }
  };
  const end = () => {
    if (finished) return;
    finished = true;
    ui.showSkip(false);
    finish();
  };
  ui.skipBtn.onclick = (e) => {
    e.stopPropagation();
    sfx.click();
    end();
  };
  ui.root.onpointerdown = () => {
    if (titled) end();
  };

  const camera = (dt: number) => {
    const g = w.ground() - 0.25;
    if (t >= ORBIT.t0 && t < ORBIT.t1) {
      const k = easeInOut((t - ORBIT.t0) / (ORBIT.t1 - ORBIT.t0));
      const a = ORBIT.a0 + (ORBIT.a1 - ORBIT.a0) * k;
      // tall phones see less from side to side: step back so all three friends are in the picture
      const r = (ORBIT.r0 + (ORBIT.r1 - ORBIT.r0) * k) * (w.camera.aspect < 1 ? 1.5 : 1);
      const h = ORBIT.h0 + (ORBIT.h1 - ORBIT.h0) * k;
      w.camera.position.set(ORBIT.center.x + Math.sin(a) * r, g + h, ORBIT.center.z + Math.cos(a) * r);
      look.copy(ORBIT.center).setY(ORBIT.center.y + g);
    } else {
      const s = SHOTS.find((x) => t < x.t1) ?? SHOTS[SHOTS.length - 1];
      const k = easeInOut((t - s.t0) / (s.t1 - s.t0));
      w.camera.position.lerpVectors(s.from, s.to, k);
      look.lerpVectors(s.lookFrom, s.lookTo, k);
      if (s.follow) {
        w.camera.position.y += g;
        look.y += g;
      }
      // after the last shot, keep drifting gently
      if (t > s.t1) w.camera.position.x += Math.sin((t - s.t1) * 0.3) * 0.8;
    }
    shake = Math.max(0, shake - dt * 1.6);
    if (shake > 0) w.camera.position.add(tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake * 0.5));
    w.camera.lookAt(look);
  };

  const step = (dt: number) => {
    t += dt;
    w.setMood(moodAt(t));
    // ── lightning
    w.bolt.material.opacity = 0;
    let flash = 0;
    STRIKES.forEach(([at, p], i) => {
      const k = (t - at) / 0.4;
      if (k < 0 || k > 1) return;
      once(`bolt${i}`, at, () => {
        sfx.thunder();
        shake = Math.max(shake, 0.5);
        w.bolt.material.rotation = (Math.random() - 0.5) * 0.3;
      });
      const flicker = k < 0.15 || (k > 0.3 && k < 0.5) ? 1 : 0.35;
      w.bolt.position.copy(p);
      w.bolt.material.opacity = (1 - k) * flicker;
      flash = Math.max(flash, 0.55 * (1 - k) ** 2 * flicker);
    });
    ui.flash(flash);
    w.hemi.intensity += flash * 3;
    // ── monsters fall on the lands
    for (const s of slimes) {
      const local = t - s.at;
      s.m.visible = local > -0.05;
      if (!s.m.visible) continue;
      s.m.position.y = 0.25 + bounce(local, 14);
      const hit = local - Math.sqrt((2 * 14) / GRAVITY);
      const squash = hit > 0 ? Math.max(0, 1 - hit * 4) * 0.35 : 0;
      const idle = hit > 0.3 ? Math.sin((t + s.at) * 6) * 0.05 : 0;
      s.m.scale.y = s.m.scale.x * (1 - squash + idle);
      if (hit > 0) once(`land${s.island}${s.at}`, s.at + 0.6, () => sfx.hit());
    }
    // ── the boss rises from the clouds, then sinks away
    const rise = backOut(smooth(15.3, 18, t)) - smooth(21, 24, t);
    boss.visible = t > 15 && t < 24.5;
    bossGlow.visible = boss.visible;
    boss.position.set(BOSS_X, -18 + 18.5 * rise, BOSS_Z);
    boss.rotation.y = Math.sin(t * 0.7) * 0.15;
    bossGlow.position.set(BOSS_X, boss.position.y + 3, BOSS_Z - 1);
    bossGlow.material.opacity = 0.3 * clamp01(rise) + 0.25 * flash;
    once("bossRise", 15.6, () => {
      sfx.boom();
      sfx.claw();
      shake = Math.max(shake, 0.4);
    });
    // ── the light of each crystal flies into the boss
    const mouth = tmp.set(BOSS_X, boss.position.y + 3.2, BOSS_Z + 3.6).clone();
    DRAIN.forEach(([at, i], n) => {
      const c = w.islands[i].crystal;
      c.setLight(Math.max(1 - smooth(at, at + 0.7, t), i === 0 ? 0.65 * smooth(35.2, 36.8, t) : 0));
      const k = (t - at) / DRAIN_TIME;
      const from = c.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.3, 0));
      const ctrl = from.clone().lerp(mouth, 0.5).add(new THREE.Vector3(0, 6, 0));
      streaks[n].forEach((g, j) => {
        const kj = k - j * 0.045;
        g.visible = kj > 0 && kj < 1;
        if (!g.visible) return;
        const u = 1 - kj;
        g.position.set(0, 0, 0).addScaledVector(from, u * u).addScaledVector(ctrl, 2 * u * kj).addScaledVector(mouth, kj * kj);
        g.material.opacity = (1 - j * 0.18) * (kj < 0.9 ? 1 : (1 - kj) * 10);
      });
      once(`drain${i}`, at, () => {
        sfx.shield(false);
        if (i === 0) shake = Math.max(shake, 0.6);
      });
    });
    // ── darkness... and then a pair of eyes in the old box
    w.eyes = smooth(24.5, 25.0, t) * (t > 25.3 && t < 25.42 ? 0.1 : 1);
    w.openFlaps(t < 26 ? 0 : backOut((t - 26) / 0.45));
    once("eyes", 24.5, () => sfx.charge(5));
    once("wake", 26.0, () => {
      sfx.levelUp();
      music.play("calm");
      shake = Math.max(shake, 0.15);
    });
    const wk = (t - 26) / 0.7;
    wake.visible = wk > 0 && wk < 1;
    if (wake.visible) {
      wake.position.set(w.hero.group.position.x, w.ground() + 1.4, w.hero.group.position.z);
      wake.scale.setScalar(1 + wk * 5);
      wake.material.opacity = 1 - wk;
    }
    // the hero hops: when it wakes, and when each friend appears
    let hop = 0;
    for (const at of [26.0, ...drops.map((d) => d.pop), 35.3, 36.1]) {
      const k = (t - at) / 0.5;
      if (k > 0 && k < 1) hop = Math.max(hop, Math.sin(k * Math.PI) * (at === 26 ? 0.7 : 0.35));
    }
    w.heroHop = hop;
    w.hero.group.rotation.y = t > 27 ? Math.sin(t * 0.8) * 0.25 : 0;
    // ── dice fall and pop into new friends
    const g = w.ground();
    for (const d of drops) {
      const local = t - d.at;
      d.die.visible = local > -0.05 && t < d.pop + 0.15;
      if (d.die.visible) {
        d.die.position.set(d.x, g + 0.35 + bounce(local, DROP_H), d.z);
        const left = Math.max(0, d.end - local);
        d.die.quaternion.setFromAxisAngle(d.axis, left * left * 4);
        d.die.quaternion.multiply(qSpin.setFromAxisAngle(V(0, 1, 0), d.x));
        d.die.scale.setScalar(1 - smooth(d.pop, d.pop + 0.15, t));
        once(`die${d.at}`, d.at + Math.sqrt((2 * DROP_H) / GRAVITY), () => sfx.dice());
      }
      const pk = (t - d.pop) / 0.45;
      d.pet.visible = pk > 0;
      if (d.pet.visible) {
        const s = backOut(pk);
        const bob = Math.abs(Math.sin((t - d.pop) * 4.5 + d.x)) * 0.12;
        d.pet.position.set(d.x, g + bob, d.z);
        d.pet.scale.set(1.05 * (pets[0].width / pets[0].height) * s, 1.05 * s, 1);
      }
      const bk = (t - d.pop) / 0.6;
      d.burst.visible = bk > 0 && bk < 1;
      if (d.burst.visible) {
        d.burst.position.set(d.x, g + 0.5, d.z);
        d.burst.scale.setScalar(0.5 + bk * (2.5 + d.rank * 0.4));
        d.burst.material.opacity = 1 - bk;
      }
      once(`pop${d.at}`, d.pop, () => sfx.reveal(d.rank));
    }
    // ── hope: the near crystal glows again, dawn breaks, the title
    once("hope", 35.2, () => sfx.shield(true));
    once("title", TITLE_AT, () => {
      titled = true;
      ui.showTitle();
      ui.showSkip(false);
      sfx.fanfare();
    });
    const tf = (t - TITLE_AT) / 0.6;
    if (tf > 0 && tf < 1) ui.flash(0.7 * (1 - tf));
    // ── captions
    const cap = CAPTIONS.find(([a, b]) => t >= a - 0.1 && t <= b + 0.6);
    if (cap) ui.caption(cap[2], Math.floor((t - cap[0]) * LETTERS_PER_SECOND), t <= cap[1]);
    else ui.caption("", 0, false);
    camera(dt);
  };

  ui.showSkip(true);
  w.onTick((_now, dt) => {
    if (!finished) step(dt);
  });
  return {
    done,
    seek(to: number) {
      // run the clock forward in small steps so every moment on the way happens
      while (t < to - 1e-6) step(Math.min(0.05, to - t));
    },
  };
}
