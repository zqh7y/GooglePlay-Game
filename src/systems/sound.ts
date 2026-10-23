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
  try {
    localStorage.setItem("dice-idle-muted", on ? "1" : "0");
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

function burst(dur: number, vol: number, cutoff: number): void {
  if (!ac || muted || !noise) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t);
  src.stop(t + dur);
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
  shoot: () => {
    if (throttle("shoot", 90)) return;
    tone(900, 0.06, "square", 0.02, 300);
  },
  buy: () => {
    tone(660, 0.08, "triangle", 0.07);
    tone(990, 0.14, "triangle", 0.07, 0, 0.07);
  },
  error: () => tone(220, 0.15, "square", 0.04, 160),
  alarm: () => [440, 330, 440, 330].forEach((f, i) => tone(f, 0.14, "sawtooth", 0.04, 0, i * 0.16)),
  levelUp: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, "square", 0.05, 0, i * 0.07)),
};

/** Short phone vibration for big moments (ignored where unsupported). */
export function buzz(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // ignore
  }
}
