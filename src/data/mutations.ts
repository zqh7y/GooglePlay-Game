/**
 * Monster mutations. From their stage on, some monsters spawn mutated, and the further you
 * go the more of them are, and the more mutations each one can stack.
 */
export type MutationId = "swift" | "lives" | "blink" | "armor" | "regen" | "giant" | "split" | "ghost" | "vampire" | "bomb";

export interface MutationDef {
  id: MutationId;
  name: string;
  /** first stage it can appear on */
  from: number;
  color: number;
  desc: string;
  /** bosses can get it too */
  boss?: boolean;
}

export const MUTATIONS: MutationDef[] = [
  { id: "swift", name: "Swift", from: 2, color: 0x5ac8ff, desc: "runs much faster", boss: true },
  { id: "lives", name: "Extra Life", from: 4, color: 0xff6a8a, desc: "gets back up once", boss: true },
  { id: "blink", name: "Blink", from: 7, color: 0xb36aff, desc: "teleports toward you" },
  { id: "armor", name: "Armored", from: 12, color: 0x9aa6b4, desc: "takes half damage", boss: true },
  { id: "regen", name: "Regrowing", from: 18, color: 0x5fd14a, desc: "heals over time", boss: true },
  { id: "giant", name: "Giant", from: 25, color: 0xff9a3a, desc: "huge, with triple health" },
  { id: "split", name: "Splitter", from: 35, color: 0xffd23f, desc: "splits in two when beaten" },
  { id: "ghost", name: "Ghost", from: 45, color: 0xe8f4ff, desc: "fades out and can't be hit" },
  { id: "vampire", name: "Vampire", from: 60, color: 0xb0182e, desc: "heals when it bites you", boss: true },
  { id: "bomb", name: "Exploder", from: 75, color: 0xff4a2a, desc: "blows up when beaten" },
];

export const MUTATION_BY_ID = Object.fromEntries(MUTATIONS.map((m) => [m.id, m])) as Record<MutationId, MutationDef>;

/** Mutations that can appear on a stage. */
export const mutationsAt = (stage: number) => MUTATIONS.filter((m) => stage >= m.from);

/**
 * Roll the mutations of a new monster. About 1 in 13 monsters is mutated on stage 2,
 * rising to over half by stage 90; deep stages stack a second and third mutation.
 */
export function rollMutations(stage: number, elite: boolean, boss: boolean): MutationId[] {
  const pool = mutationsAt(stage).filter((m) => !boss || m.boss);
  if (!pool.length) return [];
  const chance = boss ? (stage >= 20 ? 1 : 0) : elite ? 1 : Math.min(0.6, 0.06 + stage * 0.006);
  if (Math.random() >= chance) return [];
  const extra = [Math.min(0.5, Math.max(0, (stage - 20) / 100)), Math.min(0.35, Math.max(0, (stage - 50) / 100))];
  let n = 1;
  for (const p of extra) if (Math.random() < p) n++;
  if (boss) n = stage >= 70 ? 3 : stage >= 45 ? 2 : 1;
  const picked: MutationId[] = [];
  const left = [...pool];
  while (picked.length < n && left.length) {
    // newer mutations show up a bit more often than old ones
    const weights = left.map((m) => 1 + m.from / 25);
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    let i = 0;
    for (; i < left.length - 1; i++) {
      r -= weights[i];
      if (r <= 0) break;
    }
    picked.push(left[i].id);
    left.splice(i, 1);
  }
  return picked;
}
