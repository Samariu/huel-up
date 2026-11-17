import type { Bag, Drink, Flavor } from '../db/types';
import { SERVING_GRAMS } from '../db/types';

/** grams consumed from each bag, derived from the drink log */
export function usageByBag(drinks: Drink[]): Map<string, number> {
  const used = new Map<string, number>();
  for (const d of drinks) {
    for (const p of d.portions) {
      if (p.bagId) used.set(p.bagId, (used.get(p.bagId) ?? 0) + p.grams);
    }
  }
  return used;
}

/** estimated grams left in a bag (can go negative: the estimate is only an estimate) */
export function bagRemaining(bag: Bag, usage: Map<string, number>): number {
  return bag.gramsStart - (usage.get(bag.id) ?? 0) + bag.adjustmentGrams;
}

export function servingsFromGrams(grams: number): number {
  return grams / SERVING_GRAMS;
}

const byOldest = (a: Bag, b: Bag) => a.addedAt - b.addedAt || a.id.localeCompare(b.id);

export function openBagFor(bags: Bag[], flavorId: string): Bag | undefined {
  return bags
    .filter((b) => b.flavorId === flavorId && b.status === 'open')
    .sort((a, b) => (a.openedAt ?? 0) - (b.openedAt ?? 0))[0];
}

export function nextSealedFor(bags: Bag[], flavorId: string): Bag | undefined {
  return bags.filter((b) => b.flavorId === flavorId && b.status === 'sealed').sort(byOldest)[0];
}

/** returns a new bag list with `bagId` opened */
export function openBag(bags: Bag[], bagId: string, now: number): Bag[] {
  return bags.map((b) => (b.id === bagId ? { ...b, status: 'open', openedAt: now, finishedAt: undefined } : b));
}

/**
 * Mark a bag as empty and auto-open the next sealed bag of the same flavor
 * (only if no other bag of that flavor is still open).
 */
export function markBagEmpty(bags: Bag[], bagId: string, now: number): { bags: Bag[]; opened?: Bag } {
  const target = bags.find((b) => b.id === bagId);
  if (!target) return { bags };
  let next = bags.map((b) =>
    b.id === bagId ? { ...b, status: 'empty' as const, finishedAt: now, openedAt: b.openedAt ?? now } : b
  );
  if (openBagFor(next, target.flavorId)) return { bags: next };
  const sealed = nextSealedFor(next, target.flavorId);
  if (!sealed) return { bags: next };
  next = openBag(next, sealed.id, now);
  return { bags: next, opened: next.find((b) => b.id === sealed.id) };
}

/** set the adjustment so that the bag's estimate equals `grams` */
export function setRemaining(bag: Bag, grams: number, usage: Map<string, number>): Bag {
  const used = usage.get(bag.id) ?? 0;
  return { ...bag, adjustmentGrams: grams - bag.gramsStart + used };
}

export function newBag(flavor: Flavor, now: number, price = flavor.defaultBagPrice): Bag {
  return {
    id: crypto.randomUUID(),
    flavorId: flavor.id,
    status: 'sealed',
    gramsStart: flavor.bagGrams,
    price,
    addedAt: now,
    adjustmentGrams: 0
  };
}
