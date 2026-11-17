export function buzz(pattern: number | number[] = [18, 40, 28]) {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    /* unsupported (e.g. iOS Safari) */
  }
}
