import type { EntryRow, Kind } from "@/lib/ledger/types";

export function won(amount: number) {
  return `${Number(amount || 0).toLocaleString("ko-KR")}원`;
}

export function kindLabel(kind: Kind) {
  return kind === "income" ? "수입" : "지출";
}

export function sums(entries: EntryRow[]) {
  let income = 0;
  let expense = 0;
  for (const entry of entries) {
    if (entry.kind === "income") income += entry.amount;
    else expense += entry.amount;
  }
  return { income, expense, balance: income - expense };
}

export function grouped(entries: EntryRow[], key: "category" | "ownerName" | "actorName") {
  const map = new Map<string, number>();
  for (const entry of entries) {
    map.set(entry[key], (map.get(entry[key]) ?? 0) + entry.amount);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "요청을 처리하지 못했습니다.";
}
