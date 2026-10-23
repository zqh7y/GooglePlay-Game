const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc", "Ud", "Dd", "Td", "Qad", "Qid"];

/** 1234 -> "1.23K", 5e26 -> "500Sp" — idle games get big numbers fast. */
export function fmt(n: number): string {
  if (!isFinite(n)) return "∞";
  if (n < 1000) return n < 10 && n % 1 !== 0 ? n.toFixed(1) : String(Math.floor(n));
  const tier = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(n) / 3));
  const scaled = n / 1000 ** tier;
  const s = scaled >= 100 ? scaled.toFixed(0) : scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(2);
  return (s.includes(".") ? s.replace(/\.?0+$/, "") : s) + SUFFIXES[tier];
}

/** "1 in 250", "1 in 500Sp" */
export const oneIn = (n: number) => `1 in ${fmt(Math.max(1, n))}`;

/** Luck as "x1.5", "x12K" */
export const luckText = (l: number) => `x${l < 100 ? (Math.round(l * 10) / 10).toString() : fmt(l)}`;
