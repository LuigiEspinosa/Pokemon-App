export function normalizeDigits(n: number) {
  return String(n).padStart(3, "0");
}

export function normalizeName(s: string) {
  return s.replaceAll('-', ' ');
}
