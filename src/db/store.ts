import { openDB, type IDBPDatabase } from 'idb';
import { useEffect, useState } from 'preact/hooks';
import type { AppData, Flavor, Settings } from './types';

const DB_NAME = 'huel-up';
const DB_VERSION = 1;
type StoreName = 'flavors' | 'bags' | 'drinks';
const LISTS: StoreName[] = ['flavors', 'bags', 'drinks'];

export const PLACEHOLDER_BAG_GRAMS = 1530; // 17 × 90 g — placeholder, verify from label
export const PLACEHOLDER_PROTEIN = 40; // g per 90 g — placeholder, verify from label

function seedFlavors(): Flavor[] {
  const base = [
    ['Vanilla', '#f5e6b8'],
    ['Chocolate', '#8b5a3c'],
    ['Banana', '#ffe135']
  ] as const;
  return base.map(([name, color]) => ({
    id: crypto.randomUUID(),
    name,
    color,
    proteinPer90g: PLACEHOLDER_PROTEIN,
    bagGrams: PLACEHOLDER_BAG_GRAMS,
    defaultBagPrice: 0,
    archived: false,
    needsLabel: true
  }));
}

export function defaultSettings(flavors: Flavor[]): Settings {
  return {
    mix: flavors[0] ? [{ flavorId: flavors[0].id, scoops: 2 }] : [],
    gramsPerScoop: 45,
    theme: 'neon',
    lowStockServings: 3,
    haptics: true,
    sound: true,
    currency: '€'
  };
}

export function emptyData(): AppData {
  const flavors = seedFlavors();
  return { flavors, bags: [], drinks: [], settings: defaultSettings(flavors) };
}

// ---------------------------------------------------------------- store core

let db: IDBPDatabase | null = null;
let state: AppData | null = null;
const listeners = new Set<() => void>();

async function getDb() {
  if (!db) {
    db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        for (const s of LISTS) d.createObjectStore(s, { keyPath: 'id' });
        d.createObjectStore('meta');
      }
    });
  }
  return db;
}

export async function loadData(): Promise<AppData> {
  const d = await getDb();
  const settings = (await d.get('meta', 'settings')) as Settings | undefined;
  if (!settings) {
    const fresh = emptyData();
    await writeAll(fresh);
    state = fresh;
    return fresh;
  }
  const [flavors, bags, drinks] = await Promise.all(LISTS.map((s) => d.getAll(s)));
  state = {
    flavors: flavors as AppData['flavors'],
    bags: bags as AppData['bags'],
    drinks: (drinks as AppData['drinks']).sort((a, b) => a.at - b.at),
    settings: { ...defaultSettings([]), ...settings }
  };
  return state;
}

async function writeAll(data: AppData) {
  const d = await getDb();
  const tx = d.transaction([...LISTS, 'meta'], 'readwrite');
  for (const s of LISTS) {
    await tx.objectStore(s).clear();
    for (const item of data[s]) await tx.objectStore(s).put(item);
  }
  await tx.objectStore('meta').put(data.settings, 'settings');
  await tx.done;
}

/** persist only records whose object identity changed */
async function persistDiff(prev: AppData, next: AppData) {
  const d = await getDb();
  const tx = d.transaction([...LISTS, 'meta'], 'readwrite');
  const ops: Promise<unknown>[] = [];
  for (const s of LISTS) {
    const before = prev[s] as { id: string }[];
    const after = next[s] as { id: string }[];
    if (before === after) continue;
    const prevById = new Map(before.map((x) => [x.id, x]));
    const nextIds = new Set<string>();
    for (const item of after) {
      nextIds.add(item.id);
      if (prevById.get(item.id) !== item) ops.push(tx.objectStore(s).put(item));
    }
    for (const id of prevById.keys()) if (!nextIds.has(id)) ops.push(tx.objectStore(s).delete(id));
  }
  if (prev.settings !== next.settings) ops.push(tx.objectStore('meta').put(next.settings, 'settings'));
  await Promise.all(ops);
  await tx.done;
}

export function getState(): AppData {
  if (!state) throw new Error('store not loaded');
  return state;
}

/** apply an immutable update; UI updates immediately, IndexedDB write follows */
export function update(fn: (s: AppData) => AppData): AppData {
  const prev = getState();
  const next = fn(prev);
  if (next === prev) return prev;
  state = next;
  listeners.forEach((l) => l());
  persistDiff(prev, next).catch((e) => console.error('persist failed', e));
  return next;
}

export function useAppData(): AppData {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return getState();
}

// ---------------------------------------------------------- export / import

export function exportJson(): string {
  return JSON.stringify({ app: 'huel-up', version: 1, exportedAt: new Date().toISOString(), data: getState() }, null, 2);
}

export async function importJson(text: string): Promise<void> {
  const parsed = JSON.parse(text);
  const data: AppData = parsed?.data ?? parsed;
  if (!Array.isArray(data.flavors) || !Array.isArray(data.bags) || !Array.isArray(data.drinks) || !data.settings) {
    throw new Error('Not a HUEL//UP backup file');
  }
  const clean: AppData = {
    flavors: data.flavors,
    bags: data.bags,
    drinks: [...data.drinks].sort((a, b) => a.at - b.at),
    settings: { ...defaultSettings(data.flavors), ...data.settings }
  };
  await writeAll(clean);
  state = clean;
  listeners.forEach((l) => l());
}
