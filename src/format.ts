import type { Flavor, MixEntry } from './db/types';

export const kg = (g: number) => (g >= 1000 ? `${(g / 1000).toFixed(g >= 10000 ? 1 : 2)} kg` : `${Math.round(g)} g`);
export const money = (v: number, cur: string) => `${v.toFixed(2)} ${cur}`;
export const num = (v: number, d = 0) => v.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

export function shortDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });
}

export function time(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function ago(ts: number, now = Date.now()) {
  const m = Math.round((now - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export function daysBetween(a: number, b: number) {
  return Math.max(1, Math.round((b - a) / 86400000));
}

export function abbr(name: string) {
  return name.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 3).toUpperCase();
}

export function mixLabel(mix: MixEntry[], flavors: Flavor[]) {
  return mix
    .filter((m) => m.scoops > 0)
    .map((m) => `${m.scoops}× ${flavors.find((f) => f.id === m.flavorId)?.name ?? '?'}`)
    .join(' + ');
}

/** value for <input type="datetime-local"> in local time */
export function toLocalInput(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
