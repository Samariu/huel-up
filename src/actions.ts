import { getState, update } from './db/store';
import type { Bag, Drink, Flavor, MixEntry, Settings } from './db/types';
import { markBagEmpty, newBag, openBag, setRemaining, usageByBag } from './domain/bags';
import { logDrink } from './domain/log';

const sortDrinks = (d: Drink[]) => [...d].sort((a, b) => a.at - b.at);

export function drinkNow(at = Date.now(), mix?: MixEntry[]) {
  const s = getState();
  const r = logDrink(mix ?? s.settings.mix, s.flavors, s.bags, s.settings.gramsPerScoop, at);
  if (r.drink.portions.length === 0) return null;
  update((st) => ({ ...st, bags: r.bags, drinks: sortDrinks([...st.drinks, r.drink]) }));
  return r;
}

/** undo/delete. Bags auto-opened by this drink are re-sealed only if nothing else used them. */
export function deleteDrink(id: string, resealBagIds: string[] = []) {
  update((st) => {
    const drinks = st.drinks.filter((d) => d.id !== id);
    const used = usageByBag(drinks);
    const bags = st.bags.map((b) =>
      resealBagIds.includes(b.id) && b.status === 'open' && !used.has(b.id)
        ? { ...b, status: 'sealed' as const, openedAt: undefined }
        : b
    );
    return { ...st, drinks, bags };
  });
}

/** replace a drink's time and/or mix (portions are re-derived against current bags) */
export function editDrink(id: string, at: number, mix: MixEntry[]) {
  const st = getState();
  const old = st.drinks.find((d) => d.id === id);
  if (!old) return;
  const sameMix =
    mix.length === old.portions.length &&
    mix.every((m, i) => m.flavorId === old.portions[i].flavorId && m.scoops === old.portions[i].scoops);
  if (sameMix) {
    update((s) => ({ ...s, drinks: sortDrinks(s.drinks.map((d) => (d.id === id ? { ...d, at } : d))) }));
    return;
  }
  const r = logDrink(mix, st.flavors, st.bags, st.settings.gramsPerScoop, at);
  update((s) => ({
    ...s,
    bags: r.bags,
    drinks: sortDrinks(s.drinks.map((d) => (d.id === id ? { ...r.drink, id } : d)))
  }));
}

export function setMix(mix: MixEntry[]) {
  update((s) => ({ ...s, settings: { ...s.settings, mix: mix.filter((m) => m.scoops > 0) } }));
}

export function patchSettings(patch: Partial<Settings>) {
  update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

// ------------------------------------------------------------------ flavors

export function addFlavor(f: Omit<Flavor, 'id' | 'archived'>) {
  update((s) => ({ ...s, flavors: [...s.flavors, { ...f, id: crypto.randomUUID(), archived: false }] }));
}

export function patchFlavor(id: string, patch: Partial<Flavor>) {
  update((s) => ({ ...s, flavors: s.flavors.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
}

/** hard-delete only if never used; otherwise archive so history stays intact */
export function removeFlavor(id: string) {
  update((s) => {
    const used = s.drinks.some((d) => d.portions.some((p) => p.flavorId === id)) || s.bags.some((b) => b.flavorId === id);
    const mix = s.settings.mix.filter((m) => m.flavorId !== id);
    return {
      ...s,
      flavors: used
        ? s.flavors.map((f) => (f.id === id ? { ...f, archived: true } : f))
        : s.flavors.filter((f) => f.id !== id),
      settings: { ...s.settings, mix }
    };
  });
}

// --------------------------------------------------------------------- bags

export function addBags(flavorId: string, count: number, price: number, gramsStart?: number) {
  const now = Date.now();
  update((s) => {
    const f = s.flavors.find((x) => x.id === flavorId);
    if (!f) return s;
    const fresh = Array.from({ length: count }, (_, i) => ({
      ...newBag(f, now + i, price),
      ...(gramsStart ? { gramsStart } : {})
    }));
    return { ...s, bags: [...s.bags, ...fresh] };
  });
}

export function openBagNow(bagId: string) {
  update((s) => ({ ...s, bags: openBag(s.bags, bagId, Date.now()) }));
}

export function markEmpty(bagId: string): Bag | undefined {
  let opened: Bag | undefined;
  update((s) => {
    const r = markBagEmpty(s.bags, bagId, Date.now());
    opened = r.opened;
    return { ...s, bags: r.bags };
  });
  return opened;
}

export function setBagRemaining(bagId: string, grams: number) {
  update((s) => {
    const usage = usageByBag(s.drinks);
    return { ...s, bags: s.bags.map((b) => (b.id === bagId ? setRemaining(b, grams, usage) : b)) };
  });
}

export function patchBag(bagId: string, patch: Partial<Bag>) {
  update((s) => ({ ...s, bags: s.bags.map((b) => (b.id === bagId ? { ...b, ...patch } : b)) }));
}

/** delete a bag; drinks that referenced it keep their stats but lose the bag link */
export function deleteBag(bagId: string) {
  update((s) => ({
    ...s,
    bags: s.bags.filter((b) => b.id !== bagId),
    drinks: s.drinks.map((d) =>
      d.portions.some((p) => p.bagId === bagId)
        ? { ...d, portions: d.portions.map((p) => (p.bagId === bagId ? { ...p, bagId: null } : p)) }
        : d
    )
  }));
}
