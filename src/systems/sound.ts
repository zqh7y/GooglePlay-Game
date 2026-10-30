/**
 * Tiny synthesized sound effects (no audio files). Browsers only allow sound after
 * the first tap, so `unlockAudio` is called from the first pointer event.
 */
let ac: AudioContext | null = null;
let noise: AudioBuffer | null = null;
const last: Record<string, number> = {};

let muted = false;
try {
  muted = localStorage.getItem("dice-idle-muted") === "1";
} catch {
  // storage unavailable
}

export const isMuted = () => muted;
export function setMuted(on: boolean): void {
  muted = on;
  store("dice-idle-muted", on);
  if (musicGain) musicGain.gain.value = musicVolume();
}

function store(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    // ignore
  }
}

export function unlockAudio(): void {
  if (ac) {
    if (ac.state === "suspended") void ac.resume();
    return;
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ac = new Ctor();
  noise = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  musicGain = ac.createGain();
  musicGain.gain.value = musicVolume();
  musicGain.connect(ac.destination);
  if (wanted) music.play(wanted);
}

/** Skip a sound if the same one played less than `gap` ms ago (keeps busy fights pleasant). */
function throttle(name: string, gap: number): boolean {
  const now = performance.now();
  if (now - (last[name] ?? 0) < gap) return true;
  last[name] = now;
  return false;
}

function tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.06, slideTo = 0, delay = 0): void {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function burst(dur: number, vol: number, cutoff: number, delay = 0, kind: BiquadFilterType = "lowpass", swell = 0): void {
  if (!ac || muted || !noise) return;
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const filter = ac.createBiquadFilter();
  filter.type = kind;
  filter.frequency.value = cutoff;
  const gain = ac.createGain();
  // (a swell fades in over its first part, like a gust of wind)
  gain.gain.setValueAtTime(swell ? 0.0001 : vol, t);
  if (swell) gain.gain.exponentialRampToValueAtTime(vol, t + dur * swell);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093];

export const sfx = {
  click: () => tone(700, 0.05, "triangle", 0.07, 900),
  tick: (step: number) => {
    if (throttle("tick", 25)) return;
    tone(600 + (step % 12) * 40, 0.035, "square", 0.025);
  },
  /** Reveal jingle: more notes and brighter for rarer pets. */
  reveal: (rank: number) => {
    const n = 2 + Math.min(rank, 8);
    for (let i = 0; i < n; i++) tone(NOTES[Math.min(i + Math.floor(rank / 2), NOTES.length - 1)], 0.18, rank >= 4 ? "sawtooth" : "triangle", 0.05, 0, i * 0.06);
    if (rank >= 4) burst(0.5, 0.08, 3000);
  },
  fanfare: () => {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, "square", 0.045, 0, i * 0.1));
  },
  /** One step of the die charging up before a big reveal (higher and brighter each step). */
  charge: (step: number) => {
    const f = NOTES[Math.min(step + 2, NOTES.length - 1)];
    tone(f, 0.16, "triangle", 0.06, f * 1.5);
    if (step >= 4) tone(f * 2, 0.1, "sine", 0.03, 0, 0.04);
  },
  superRoll: () => {
    tone(220, 0.6, "sawtooth", 0.05, 1760);
    [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.18, "square", 0.04, 0, 0.35 + i * 0.07));
  },
  gift: () => [1319, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.12, "sine", 0.06, 0, i * 0.06)),
  /** Fishing: the line whips out, the bobber plops, a fish bites, the reel spins, a prize lands. */
  cast: () => tone(900, 0.18, "sine", 0.04, 300),
  plop: () => {
    burst(0.12, 0.06, 900);
    tone(420, 0.08, "sine", 0.05, 220);
  },
  bite: () => [988, 1319].forEach((f, i) => tone(f, 0.07, "square", 0.04, 0, i * 0.07)),
  reel: () => {
    for (let i = 0; i < 6; i++) tone(500 + i * 60, 0.03, "square", 0.025, 0, i * 0.045);
    burst(0.25, 0.07, 1400);
  },
  catch: (row: number) => {
    const n = 2 + row;
    for (let i = 0; i < n; i++) tone(NOTES[Math.min(i + row, NOTES.length - 1)], 0.14, row >= 3 ? "sawtooth" : "triangle", 0.05, 0, i * 0.06);
    if (row >= 3) burst(0.4, 0.07, 3000);
  },
  record: () => [659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.2, "square", 0.05, 0, i * 0.08)),
  lucky: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.15, "triangle", 0.06, 0, i * 0.05)),
  coin: () => {
    if (throttle("coin", 60)) return;
    tone(1250, 0.05, "square", 0.025);
    tone(1680, 0.08, "square", 0.025, 0, 0.045);
  },
  hit: () => {
    if (throttle("hit", 70)) return;
    burst(0.06, 0.05, 1800);
  },
  boom: () => {
    if (throttle("boom", 120)) return;
    burst(0.3, 0.12, 700);
    tone(140, 0.25, "sine", 0.1, 50);
  },
  /** Light gadgets swish, heavy ones thump. */
  shoot: (heavy = false) => {
    if (throttle("shoot", heavy ? 110 : 70)) return;
    if (heavy) {
      burst(0.12, 0.08, 1200);
      tone(220, 0.1, "square", 0.03, 90);
    } else {
      tone(900, 0.05, "square", 0.018, 300);
    }
  },
  reload: () => {
    tone(500, 0.05, "square", 0.03, 380);
    tone(700, 0.05, "square", 0.03, 900, 0.12);
  },
  airdrop: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.18, "triangle", 0.05, 0, i * 0.09)),
  shield: (on: boolean) => {
    tone(on ? 300 : 900, 0.4, "sine", 0.06, on ? 900 : 300);
    tone(on ? 450 : 1200, 0.4, "triangle", 0.03, on ? 1350 : 450, 0.05);
  },
  buy: () => {
    tone(660, 0.08, "triangle", 0.07);
    tone(990, 0.14, "triangle", 0.07, 0, 0.07);
  },
  error: () => tone(220, 0.15, "square", 0.04, 160),
  alarm: () => [440, 330, 440, 330].forEach((f, i) => tone(f, 0.14, "sawtooth", 0.04, 0, i * 0.16)),
  levelUp: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, "square", 0.05, 0, i * 0.07)),
  hurt: () => {
    if (throttle("hurt", 150)) return;
    tone(260, 0.12, "sawtooth", 0.05, 120);
  },
  xp: () => {
    if (throttle("xp", 45)) return;
    tone(1400 + Math.random() * 400, 0.04, "triangle", 0.025);
  },
  dice: () => [880, 1175, 1568].forEach((f, i) => tone(f, 0.1, "square", 0.04, 0, i * 0.05)),
  thunder: () => {
    burst(0.9, 0.2, 500);
    tone(70, 0.8, "sine", 0.12, 40);
  },
  claw: () => {
    tone(1400, 0.35, "sawtooth", 0.04, 300);
    tone(1500, 0.35, "square", 0.025, 340, 0.04);
  },
  /** night sounds: an owl's two hoots, a cricket's chirps */
  owl: () => {
    if (throttle("owl", 3000)) return;
    tone(392, 0.32, "sine", 0.05, 360);
    tone(392, 0.5, "sine", 0.05, 340, 0.45);
  },
  crickets: () => {
    if (throttle("crickets", 1500)) return;
    for (let i = 0; i < 6; i++) tone(4200 + (i % 2) * 300, 0.03, "triangle", 0.012, 0, i * 0.06);
  },
  /** the camera sweeping off somewhere */
  whoosh: () => {
    burst(0.5, 0.06, 1800);
    tone(300, 0.45, "sine", 0.03, 900);
  },
  /** a firework: a rising whistle, then the bang and crackle */
  firework: () => {
    tone(600, 0.35, "sine", 0.03, 1600);
    burst(0.35, 0.12, 2400);
    for (let i = 0; i < 5; i++) tone(2000 + i * 300, 0.04, "square", 0.015, 0, 0.4 + i * 0.05);
  },
  /** hurry up: a quick double beep */
  hurry: () => [880, 880, 1175].forEach((f, i) => tone(f, 0.09, "square", 0.045, 0, i * 0.11)),
  /** a lost die found: a chime that rises with every one */
  found: (n: number) => [0, 4, 7].forEach((st, i) => tone(523 * Math.pow(2, (n % 12 + st) / 12), 0.14, "triangle", 0.06, 0, i * 0.05)),
  /** a ball kicked: a soft thump and a boing */
  kick: () => {
    if (throttle("kick", 120)) return;
    burst(0.08, 0.12, 900);
    tone(220, 0.18, "sine", 0.06, 440);
  },
  /** water splashing */
  splash: () => {
    if (throttle("splash", 90)) return;
    burst(0.35, 0.09, 3000, 0, "bandpass");
    tone(900, 0.12, "sine", 0.025, 300, 0.03);
  },
  /** a big splash: something huge breaking the surface */
  bigSplash: () => {
    burst(0.9, 0.16, 1800);
    burst(0.6, 0.08, 4000, 0.1, "bandpass");
    tone(140, 0.5, "sine", 0.06, 60);
  },
  /** a happy little creature: a rising trill */
  happy: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.09, "triangle", 0.05, f * 1.06, i * 0.06)),
  /** a heavy hammer blow on wood */
  hammer: () => {
    if (throttle("hammer", 120)) return;
    burst(0.12, 0.16, 700);
    tone(160, 0.12, "square", 0.05, 90);
  },
  /** wood cracking and splitting apart */
  crack: () => {
    for (let i = 0; i < 6; i++) burst(0.06, 0.12, 2500 - i * 250, i * 0.05);
    tone(120, 0.6, "sawtooth", 0.05, 50, 0.1);
    burst(0.7, 0.12, 600, 0.25);
  },
  /** picking up something good: a sparkly arpeggio */
  item: () => [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.1, "triangle", 0.05, 0, i * 0.045)),
  /** a gem: a bright ding */
  gem: () => {
    tone(2093, 0.25, "sine", 0.05);
    tone(3136, 0.2, "sine", 0.03, 0, 0.04);
  },
  /** helicopter rotor: a burst of chops (called again and again while flying) */
  rotor: (fast = false) => {
    if (throttle("rotor", 380)) return;
    for (let i = 0; i < 5; i++) burst(0.05, 0.05, fast ? 900 : 600, i * 0.08);
  },
  /** a strong gust of wind: rising and falling filtered noise */
  wind: () => {
    if (throttle("wind", 900)) return;
    burst(2.2, 0.1, 700, 0, "bandpass", 0.4);
    burst(1.6, 0.05, 1500, 0.3, "bandpass", 0.5);
  },
  /** a deep rumble (a hurricane, an eruption) */
  rumble: () => {
    if (throttle("rumble", 1200)) return;
    burst(1.4, 0.14, 220, 0, "lowpass", 0.3);
    tone(48, 1.2, "sine", 0.07, 36);
  },
  /** warning beeps from the cockpit */
  beep: () => {
    if (throttle("beep", 500)) return;
    [1760, 1760].forEach((f, i) => tone(f, 0.07, "square", 0.035, 0, i * 0.12));
  },
  /** a crash: metal bending and a big bang */
  crash: () => {
    burst(1.4, 0.22, 900);
    tone(200, 0.9, "sawtooth", 0.06, 40);
    for (let i = 0; i < 6; i++) tone(1800 - i * 200, 0.08, "square", 0.02, 900, 0.1 + i * 0.07);
  },
  /** a whale's song: a long low moan sliding up and down */
  whale: () => {
    if (throttle("whale", 2500)) return;
    tone(180, 0.9, "sine", 0.06, 320);
    tone(320, 0.9, "sine", 0.05, 160, 0.85);
    tone(90, 1.6, "triangle", 0.03, 70);
  },
  /** a comic panel sliding in: a swish and a pop */
  panel: () => {
    burst(0.25, 0.07, 2600, 0, "highpass");
    tone(500, 0.08, "sine", 0.05, 1200, 0.18);
  },
  /** a comic "!": a bright two-note sting */
  sting: () => [1175, 1760].forEach((f, i) => tone(f, 0.14, "square", 0.04, 0, i * 0.09)),
  /** a sad little fall */
  sad: () => [659, 587, 523, 392].forEach((f, i) => tone(f, 0.14, "triangle", 0.045, 0, i * 0.1)),
  /** a heavy footstep / thud */
  thud: () => {
    if (throttle("thud", 150)) return;
    burst(0.15, 0.12, 300);
    tone(80, 0.2, "sine", 0.07, 45);
  },
};

// ───────────────────────── music ─────────────────────────

/**
 * Little chiptune loops played by a look-ahead sequencer: a happy tune for the lobby and menus, upbeat for
 * the fight and a faster, darker one for the boss. 16 steps per bar, 4 bars per loop.
 */
export type Track = "calm" | "battle" | "boss" | "story";

interface Song {
  bpm: number;
  /** chord per bar: [bass root, three chord notes] as MIDI numbers */
  chords: [number, number, number, number][];
  kick: number[];
  snare: number[];
  hat: number;
  bass: number[];
  bassType: OscillatorType;
  /** arpeggio every N steps (0 = none) */
  arp: number;
  arpType: OscillatorType;
  /** melody, one note per 8th (0 = rest), played every other loop */
  lead?: number[];
  /** or: several melodies (one note per 8th), played by loop as `leadOrder` says (-1 = no melody that loop) */
  leads?: number[][];
  leadOrder?: number[];
  /** steps where the bass jumps to the fifth instead of the root */
  bassFifth?: number[];
  /** a held chord pad at the start of each bar */
  pad?: boolean;
  /** glockenspiel sparkles: [step, chord note index] per bar */
  bells?: [number, number][];
}

const AM_F_C_G: Song["chords"] = [[45, 57, 60, 64], [41, 57, 60, 65], [36, 55, 60, 64], [43, 55, 59, 62]];

const SONGS: Record<Track, Song> = {
  calm: {
    // the lobby: a sunny, bouncy tune in C major (C G Am F) with a sing-along melody, a light beat,
    // a hopping bass, a warm pad and glockenspiel sparkles, so the village feels friendly and alive
    bpm: 116,
    chords: [[48, 60, 64, 67], [43, 59, 62, 67], [45, 60, 64, 69], [41, 60, 65, 69]],
    kick: [0, 8, 10], snare: [4, 12], hat: 0.01,
    bass: [0, 3, 6, 8, 11, 14], bassFifth: [6, 14], bassType: "triangle",
    arp: 2, arpType: "triangle", pad: true,
    bells: [[2, 2], [7, 1], [10, 2], [15, 0]],
    leads: [
      [
        72, 0, 76, 79, 81, 79, 76, 0,
        74, 0, 79, 0, 77, 76, 74, 71,
        72, 0, 76, 0, 81, 0, 79, 76,
        77, 76, 74, 72, 74, 0, 0, 0,
      ],
      [
        79, 0, 79, 81, 79, 76, 72, 0,
        74, 76, 77, 0, 79, 0, 74, 0,
        76, 0, 72, 76, 81, 79, 76, 72,
        74, 0, 72, 0, 72, 0, 0, 0,
      ],
    ],
    leadOrder: [-1, 0, 1, 0, 1, 0, -1, 1],
  },
  battle: {
    bpm: 128, chords: AM_F_C_G, kick: [0, 4, 8, 12], snare: [4, 12], hat: 0.018, bass: [0, 2, 4, 6, 8, 10, 12, 14], bassType: "square",
    arp: 1, arpType: "triangle",
    lead: [
      76, 0, 74, 76, 0, 72, 69, 0,
      72, 0, 74, 72, 69, 0, 65, 67,
      67, 0, 72, 0, 76, 74, 72, 0,
      74, 0, 71, 0, 67, 69, 71, 74,
    ],
  },
  story: {
    // the opening story: slow and wistful in D minor, a soft drum on each bar, the melody every other loop
    bpm: 76, chords: [[38, 50, 53, 57], [34, 50, 53, 58], [41, 53, 57, 60], [36, 52, 55, 60]], kick: [0], snare: [], hat: 0,
    bass: [0, 8, 12], bassType: "triangle", arp: 2, arpType: "sine",
    lead: [
      74, 0, 0, 72, 69, 0, 0, 0,
      70, 0, 69, 67, 65, 0, 0, 0,
      72, 0, 0, 69, 72, 0, 77, 0,
      76, 0, 0, 0, 72, 0, 0, 0,
    ],
  },
  boss: {
    // D minor, pounding drums and a stabbing riff: only you and the boss now
    bpm: 164, chords: [[38, 50, 53, 57], [34, 50, 53, 58], [36, 48, 52, 55], [33, 49, 52, 57]], kick: [0, 3, 4, 8, 11, 12], snare: [4, 12],
    hat: 0.026, bass: [0, 1, 2, 3, 4, 6, 8, 9, 10, 11, 12, 14], bassType: "sawtooth", arp: 1, arpType: "square",
    lead: [
      74, 0, 74, 77, 74, 72, 70, 0,
      70, 0, 70, 74, 70, 69, 67, 0,
      72, 0, 72, 76, 79, 76, 72, 0,
      73, 0, 76, 0, 81, 0, 79, 76,
    ],
  },
};

let musicGain: GainNode | null = null;
let musicOff = false;
try {
  musicOff = localStorage.getItem("dice-idle-music") === "0";
} catch {
  // storage unavailable
}
let wanted: Track | null = null;
let current: Track | null = null;
let step = 0;
let nextTime = 0;
let timer = 0;

const musicVolume = () => (muted || musicOff ? 0 : 0.55);
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

function note(freq: number, t: number, dur: number, type: OscillatorType, vol: number): void {
  if (!ac || !musicGain) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(musicGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function drum(t: number, kind: "kick" | "snare" | "hat", vol: number): void {
  if (!ac || !musicGain || !noise) return;
  if (kind === "kick") {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain).connect(musicGain);
    osc.start(t);
    osc.stop(t + 0.18);
    return;
  }
  const src = ac.createBufferSource();
  src.buffer = noise;
  const filter = ac.createBiquadFilter();
  filter.type = kind === "hat" ? "highpass" : "bandpass";
  filter.frequency.value = kind === "hat" ? 7000 : 1800;
  const gain = ac.createGain();
  const len = kind === "hat" ? 0.03 : 0.12;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(filter).connect(gain).connect(musicGain);
  src.start(t);
  src.stop(t + len + 0.01);
}

function playStep(song: Song, s: number, t: number, stepDur: number): void {
  const st = s % 16;
  const bar = Math.floor(s / 16) % 4;
  const loop = Math.floor(s / 64);
  const [root, ...chord] = song.chords[bar];
  if (song.kick.includes(st)) drum(t, "kick", 0.22);
  if (song.snare.includes(st)) drum(t, "snare", 0.09);
  if (song.hat && st % 2 === 1) drum(t, "hat", song.hat * 3);
  if (song.bass.includes(st)) {
    const up = song.bassFifth ? (song.bassFifth.includes(st) ? 7 : 0) : st % 8 === 4 && song.bass.length > 4 ? 12 : 0;
    note(midi(root + up), t, stepDur * 1.7, song.bassType, song.bassType === "triangle" ? 0.12 : 0.045);
  }
  if (song.pad && st === 0) for (const n of chord) note(midi(n - 12), t, stepDur * 15, "sine", 0.018);
  if (song.bells) for (const [bs, ci] of song.bells) if (bs === st) note(midi(chord[ci] + 12), t, stepDur * 4, "sine", 0.03);
  if (song.arp && st % song.arp === 0) {
    const n = chord[(st / song.arp) % chord.length] + (song.arp === 1 && st % 8 >= 4 ? 12 : 0);
    note(midi(n), t, stepDur * (song.arp === 1 ? 0.9 : 3), song.arpType, song.arp === 1 ? 0.022 : 0.04);
  }
  if (song.lead && loop % 2 === 1 && st % 2 === 0) {
    const n = song.lead[bar * 8 + st / 2];
    if (n) note(midi(n), t, stepDur * 1.8, "square", 0.03);
  }
  if (song.leads && st % 2 === 0) {
    const which = song.leadOrder ? song.leadOrder[loop % song.leadOrder.length] : loop % song.leads.length;
    const n = which >= 0 ? song.leads[which][bar * 8 + st / 2] : 0;
    if (n) {
      // a soft square lead doubled by a rounder triangle an octave down: cute and singable
      note(midi(n), t, stepDur * 1.8, "square", 0.022);
      note(midi(n - 12), t, stepDur * 1.8, "triangle", 0.05);
    }
  }
}

function schedule(): void {
  if (!ac || !current) return;
  const song = SONGS[current];
  const stepDur = 60 / song.bpm / 4;
  // after the tab was hidden, do not try to catch up on missed notes
  if (nextTime < ac.currentTime - 0.2) nextTime = ac.currentTime + 0.05;
  while (nextTime < ac.currentTime + 0.12) {
    playStep(song, step, nextTime, stepDur);
    step++;
    nextTime += stepDur;
  }
}

export const music = {
  /** Switch to a track (it starts once sound is unlocked by the first tap). */
  play(track: Track): void {
    wanted = track;
    if (!ac || track === current) return;
    current = track;
    step = 0;
    nextTime = ac.currentTime + 0.1;
    if (!timer) timer = window.setInterval(schedule, 25);
  },
  isOn: () => !musicOff,
  setOn(on: boolean): void {
    musicOff = !on;
    store("dice-idle-music", on);
    if (musicGain) musicGain.gain.value = musicVolume();
  },
};

/** Short phone vibration for big moments (ignored where unsupported). */
/** Settings: vibration can be switched off. */
let vibrateOn = true;
export const setVibrate = (on: boolean) => (vibrateOn = on);

export function buzz(ms: number): void {
  if (!vibrateOn) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    // ignore
  }
}
