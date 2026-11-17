import { useEffect, useState } from 'preact/hooks';

export interface ToastMsg {
  id: number;
  text: string;
  tone?: 'ok' | 'warn';
  action?: { label: string; run: () => void };
  ms?: number;
}

let current: ToastMsg | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function showToast(t: Omit<ToastMsg, 'id'>) {
  current = { ...t, id: ++seq };
  clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    emit();
  }, t.ms ?? 5000);
  emit();
}

export function dismissToast() {
  clearTimeout(timer);
  current = null;
  emit();
}

export function useToast() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  return current;
}
