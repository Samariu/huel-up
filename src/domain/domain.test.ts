import { describe, expect, it } from 'vitest';
import type { Bag, Drink, Flavor } from '../db/types';
import { bagRemaining, markBagEmpty, newBag, setRemaining, usageByBag } from './bags';
import { logDrink } from './log';
import { lowStockFlavors } from './stock';
import { dailySeries, filterRange, streaks, totals } from './stats';

const flavor = (id: string, over: Partial<Flavor> = {}): Flavor => ({
  id,
  name: id.toUpperCase(),
  color: '#fff',
  proteinPer90g: 40,
  bagGrams: 1800,
  defaultBagPrice: 45,
  archived: false,
  ...over
});

const T0 = new Date(2026, 10, 17, 9, 0).getTime();
const day = (n: number, h = 9) => new Date(2026, 10, 17 + n, h, 0).getTime();

function setup() {
  const van = flavor('van');
  const ban = flavor('ban', { proteinPer90g: 38 });
  const bags: Bag[] = [newBag(van, T0), newBag(van, T0 + 1), newBag(ban, T0)];
  return { van, ban, flavors: [van, ban], bags };
}

describe('logDrink', () => {
  it('auto-opens the oldest sealed bag and snapshots protein + cost', () => {
    const { flavors, bags } = setup();
    const r = logDrink([{ flavorId: 'van', scoops: 1 }, { flavorId: 'ban', scoops: 1 }], flavors, bags, 45, T0);
    expect(r.opened.map((b) => b.id)).toEqual([bags[0].id, bags[2].id]);
    expect(r.missing).toEqual([]);
    expect(r.drink.portions[0]).toMatchObject({ grams: 45, protein: 20, cost: 1.13, bagId: bags[0].id });
    expect(r.drink.portions[1].protein).toBe(19);
    expect(r.bags.find((b) => b.id === bags[1].id)!.status).toBe('sealed');
  });

  it('still logs when a flavor has no bag at all', () => {
    const { flavors } = setup();
    const r = logDrink([{ flavorId: 'van', scoops: 2 }], flavors, [], 45, T0);
    expect(r.missing).toEqual(['VAN']);
    expect(r.drink.portions[0]).toMatchObject({ bagId: null, grams: 90, protein: 40, cost: 2.25 });
  });

  it('skips zero-scoop entries', () => {
    const { flavors, bags } = setup();
    const r = logDrink([{ flavorId: 'van', scoops: 2 }, { flavorId: 'ban', scoops: 0 }], flavors, bags, 45, T0);
    expect(r.drink.portions).toHaveLength(1);
  });
});

describe('bag estimates', () => {
  it('derives remaining from drinks, so deleting a drink restores the bag', () => {
    const { flavors, bags } = setup();
    const r1 = logDrink([{ flavorId: 'van', scoops: 2 }], flavors, bags, 45, T0);
    const r2 = logDrink([{ flavorId: 'van', scoops: 2 }], flavors, r1.bags, 45, T0 + 1000);
    const open = r2.bags.find((b) => b.status === 'open')!;
    expect(bagRemaining(open, usageByBag([r1.drink, r2.drink]))).toBe(1620);
    expect(bagRemaining(open, usageByBag([r1.drink]))).toBe(1710);
  });

  it('can go below zero (estimate) and be corrected with setRemaining', () => {
    const { van } = setup();
    const bag: Bag = { ...newBag(van, T0), status: 'open', gramsStart: 90 };
    const drinks: Drink[] = [0, 1].map((i) => ({
      id: `d${i}`,
      at: T0 + i,
      portions: [{ flavorId: 'van', scoops: 2, grams: 90, bagId: bag.id, protein: 40, cost: 2 }]
    }));
    const usage = usageByBag(drinks);
    expect(bagRemaining(bag, usage)).toBe(-90);
    const fixed = setRemaining(bag, 200, usage);
    expect(bagRemaining(fixed, usage)).toBe(200);
  });

  it('markBagEmpty auto-opens the next sealed bag of the same flavor', () => {
    const { bags } = setup();
    const opened = bags.map((b, i) => (i === 0 ? { ...b, status: 'open' as const, openedAt: T0 } : b));
    const r = markBagEmpty(opened, bags[0].id, T0 + 5);
    expect(r.bags[0]).toMatchObject({ status: 'empty', finishedAt: T0 + 5 });
    expect(r.opened?.id).toBe(bags[1].id);
    expect(r.bags[1].status).toBe('open');
    expect(r.bags[2].status).toBe('sealed');
  });

  it('markBagEmpty with no sealed bags left opens nothing', () => {
    const { van } = setup();
    const b = { ...newBag(van, T0), status: 'open' as const };
    const r = markBagEmpty([b], b.id, T0);
    expect(r.opened).toBeUndefined();
    expect(r.bags[0].status).toBe('empty');
  });
});

describe('lowStockFlavors', () => {
  it('only warns when no sealed bag is left and open bag is at/below threshold', () => {
    const { flavors, van, ban } = setup();
    const vanOpen: Bag = { ...newBag(van, T0), status: 'open', gramsStart: 180 }; // 2 servings
    const vanSealed = newBag(van, T0);
    const banOpen: Bag = { ...newBag(ban, T0), status: 'open', gramsStart: 180 };
    const mix = [{ flavorId: 'van', scoops: 1 }, { flavorId: 'ban', scoops: 1 }];

    const low = lowStockFlavors(flavors, [vanOpen, vanSealed, banOpen], [], mix, 3);
    expect(low.map((s) => s.flavor.id)).toEqual(['ban']);

    expect(lowStockFlavors(flavors, [vanOpen, vanSealed, banOpen], [], mix, 1)).toEqual([]);
  });

  it('warns for a mix flavor with no bags at all', () => {
    const { flavors } = setup();
    const low = lowStockFlavors(flavors, [], [], [{ flavorId: 'van', scoops: 2 }], 3);
    expect(low.map((s) => s.flavor.id)).toEqual(['van']);
  });
});

describe('stats', () => {
  const mk = (at: number): Drink => ({
    id: String(at),
    at,
    portions: [{ flavorId: 'van', scoops: 2, grams: 90, bagId: null, protein: 40, cost: 2.5 }]
  });

  it('totals', () => {
    expect(totals([mk(T0), mk(T0 + 1)])).toEqual({ drinks: 2, grams: 180, protein: 80, cost: 5 });
  });

  it('range filter uses local calendar days', () => {
    const drinks = [mk(day(0, 0)), mk(day(-1, 23)), mk(day(-6, 1)), mk(day(-7, 23))];
    const now = day(0, 12);
    expect(filterRange(drinks, 'today', now)).toHaveLength(1);
    expect(filterRange(drinks, '7d', now)).toHaveLength(3);
    expect(filterRange(drinks, 'all', now)).toHaveLength(4);
  });

  it('streaks: current counts from yesterday if nothing today yet; longest across gaps', () => {
    const drinks = [day(-1), day(-2), day(-3), day(-6), day(-7), day(-8), day(-9)].map((t) => mk(t));
    expect(streaks(drinks, day(0, 8))).toEqual({ current: 3, longest: 4 });
    expect(streaks([...drinks, mk(day(0, 7))], day(0, 8)).current).toBe(4);
    expect(streaks(drinks.slice(1), day(0, 8)).current).toBe(0);
    expect(streaks([], T0)).toEqual({ current: 0, longest: 0 });
  });

  it('dailySeries returns oldest→newest with zeros', () => {
    const s = dailySeries([mk(day(0)), mk(day(0, 10)), mk(day(-2))], 3, day(0, 12));
    expect(s.map((x) => x.count)).toEqual([1, 0, 2]);
  });
});
