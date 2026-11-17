export type ThemeId = 'neon' | 'acid' | 'matrix';
export type BagStatus = 'sealed' | 'open' | 'empty';

export interface Flavor {
  id: string;
  name: string;
  color: string;
  /** grams of protein per 90 g serving, from the bag label */
  proteinPer90g: number;
  /** net powder per bag in grams, from the bag label */
  bagGrams: number;
  /** default price per bag (prefilled when adding bags) */
  defaultBagPrice: number;
  archived: boolean;
  /** true until the user has edited the label values (seed placeholders) */
  needsLabel?: boolean;
}

export interface Bag {
  id: string;
  flavorId: string;
  status: BagStatus;
  gramsStart: number;
  price: number;
  addedAt: number;
  openedAt?: number;
  finishedAt?: number;
  /** manual correction added on top of the derived estimate */
  adjustmentGrams: number;
}

export interface Portion {
  flavorId: string;
  scoops: number;
  grams: number;
  bagId: string | null;
  /** snapshot at log time */
  protein: number;
  /** snapshot at log time */
  cost: number;
}

export interface Drink {
  id: string;
  at: number;
  portions: Portion[];
}

export interface MixEntry {
  flavorId: string;
  scoops: number;
}

export interface Settings {
  mix: MixEntry[];
  gramsPerScoop: number;
  theme: ThemeId;
  /** warn when a flavor has no sealed bags and ≤ this many servings in open bags */
  lowStockServings: number;
  haptics: boolean;
  sound: boolean;
  currency: string;
}

export interface AppData {
  flavors: Flavor[];
  bags: Bag[];
  drinks: Drink[];
  settings: Settings;
}

export const SERVING_GRAMS = 90;
