import type { Drink } from '../db/types';

export type RangeId = 'today' | '7d' | '30d' | 'all';

export interface Totals {
  drinks: number;
  grams: number;
  protein: number;
  cost: number;
}

export interface FlavorShare {
  flavorId: string;
  scoops: number;
  grams: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** local-calendar day key, DST-safe */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function rangeStart(range: RangeId, now: number): number {
  const today = startOfDay(now);
  switch (range) {
    case 'today':
      return today;
    case '7d':
      return addDays(today, -6);
    case '30d':
      return addDays(today, -29);
    case 'all':
      return -Infinity;
  }
}

export function filterRange(drinks: Drink[], range: RangeId, now: number): Drink[] {
  const from = rangeStart(range, now);
  return drinks.filter((d) => d.at >= from && d.at <= now + DAY);
}

export function totals(drinks: Drink[]): Totals {
  const t: Totals = { drinks: drinks.length, grams: 0, protein: 0, cost: 0 };
  for (const d of drinks)
    for (const p of d.portions) {
      t.grams += p.grams;
      t.protein += p.protein;
      t.cost += p.cost;
    }
  return t;
}

export function flavorShares(drinks: Drink[]): FlavorShare[] {
  const m = new Map<string, FlavorShare>();
  for (const d of drinks)
    for (const p of d.portions) {
      const s = m.get(p.flavorId) ?? { flavorId: p.flavorId, scoops: 0, grams: 0 };
      s.scoops += p.scoops;
      s.grams += p.grams;
      m.set(p.flavorId, s);
    }
  return [...m.values()].sort((a, b) => b.grams - a.grams);
}

/** drink counts for each of the last `days` calendar days, oldest first */
export function dailySeries(drinks: Drink[], days: number, now: number): { key: string; ts: number; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of drinks) counts.set(dayKey(d.at), (counts.get(dayKey(d.at)) ?? 0) + 1);
  const today = startOfDay(now);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const ts = addDays(today, -i);
    const key = dayKey(ts);
    out.push({ key, ts, count: counts.get(key) ?? 0 });
  }
  return out;
}

/**
 * current streak: consecutive days with ≥1 drink ending today
 * (or yesterday, so the streak isn't "broken" before you've had today's drink).
 */
export function streaks(drinks: Drink[], now: number): { current: number; longest: number } {
  const days = new Set(drinks.map((d) => dayKey(d.at)));
  if (days.size === 0) return { current: 0, longest: 0 };

  let current = 0;
  let cursor = startOfDay(now);
  if (!days.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  while (days.has(dayKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...days].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseKey(sorted[i - 1]);
    const expected = dayKey(addDays(prev, 1));
    run = sorted[i] === expected ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return { current, longest };
}

function parseKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}
