import type { Bag, Drink, Flavor, MixEntry } from '../db/types';
import { bagRemaining, servingsFromGrams, usageByBag } from './bags';

export interface FlavorStock {
  flavor: Flavor;
  open: Bag[];
  sealed: Bag[];
  empty: Bag[];
  /** estimated grams in open bags (clamped at 0 per bag) */
  openGrams: number;
  openServings: number;
}

export function stockByFlavor(flavors: Flavor[], bags: Bag[], drinks: Drink[]): FlavorStock[] {
  const usage = usageByBag(drinks);
  return flavors.map((flavor) => {
    const mine = bags.filter((b) => b.flavorId === flavor.id);
    const open = mine.filter((b) => b.status === 'open');
    const openGrams = open.reduce((s, b) => s + Math.max(0, bagRemaining(b, usage)), 0);
    return {
      flavor,
      open,
      sealed: mine.filter((b) => b.status === 'sealed').sort((a, b) => a.addedAt - b.addedAt),
      empty: mine
        .filter((b) => b.status === 'empty')
        .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)),
      openGrams,
      openServings: servingsFromGrams(openGrams)
    };
  });
}

/**
 * A flavor is low only when the cupboard has no sealed bag left AND the
 * open bag(s) are at or below the threshold. Only flavors that are in the
 * current mix or have an open bag are considered.
 */
export function lowStockFlavors(
  flavors: Flavor[],
  bags: Bag[],
  drinks: Drink[],
  mix: MixEntry[],
  thresholdServings: number
): FlavorStock[] {
  const inMix = new Set(mix.filter((m) => m.scoops > 0).map((m) => m.flavorId));
  return stockByFlavor(
    flavors.filter((f) => !f.archived),
    bags,
    drinks
  ).filter(
    (s) =>
      (inMix.has(s.flavor.id) || s.open.length > 0) &&
      s.sealed.length === 0 &&
      s.openServings <= thresholdServings
  );
}
