import type { Bag, Drink, Flavor, MixEntry, Portion } from '../db/types';
import { SERVING_GRAMS } from '../db/types';
import { nextSealedFor, openBag, openBagFor } from './bags';

export interface LogResult {
  drink: Drink;
  bags: Bag[];
  /** bags that were auto-opened to serve this drink */
  opened: Bag[];
  /** flavor names that had no bag at all (drink still logged) */
  missing: string[];
}

/**
 * Build a drink from the current mix. Never blocks: if a flavor has no bag,
 * the portion is logged without a bag reference.
 */
export function logDrink(
  mix: MixEntry[],
  flavors: Flavor[],
  bags: Bag[],
  gramsPerScoop: number,
  at: number
): LogResult {
  let next = bags;
  const opened: Bag[] = [];
  const missing: string[] = [];
  const portions: Portion[] = [];

  for (const m of mix) {
    if (m.scoops <= 0) continue;
    const flavor = flavors.find((f) => f.id === m.flavorId);
    if (!flavor) continue;
    const grams = m.scoops * gramsPerScoop;

    let bag = openBagFor(next, flavor.id);
    if (!bag) {
      const sealed = nextSealedFor(next, flavor.id);
      if (sealed) {
        next = openBag(next, sealed.id, at);
        bag = next.find((b) => b.id === sealed.id)!;
        opened.push(bag);
      }
    }
    if (!bag) missing.push(flavor.name);

    const pricePerGram = bag
      ? bag.gramsStart > 0
        ? bag.price / bag.gramsStart
        : 0
      : flavor.bagGrams > 0
        ? flavor.defaultBagPrice / flavor.bagGrams
        : 0;

    portions.push({
      flavorId: flavor.id,
      scoops: m.scoops,
      grams,
      bagId: bag?.id ?? null,
      protein: round2((flavor.proteinPer90g * grams) / SERVING_GRAMS),
      cost: round2(pricePerGram * grams)
    });
  }

  return { drink: { id: crypto.randomUUID(), at, portions }, bags: next, opened, missing };
}

export function mixTotalScoops(mix: MixEntry[]): number {
  return mix.reduce((s, m) => s + Math.max(0, m.scoops), 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
