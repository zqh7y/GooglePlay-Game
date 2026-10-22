const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

/** 1234 -> "1.23K", 5600000 -> "5.6M" — idle games get big numbers fast. */
export function fmt(n: number): string {
  if (n < 1000) return String(Math.floor(n));
  const tier = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(n) / 3));
  const scaled = n / 1000 ** tier;
  return (scaled >= 100 ? scaled.toFixed(0) : scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(2)) + SUFFIXES[tier];
}
