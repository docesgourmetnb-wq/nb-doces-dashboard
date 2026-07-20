export function parseDecimalInput(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return Number.NaN;
  return Number(normalized);
}

export function parseIntegerInput(value: string) {
  const parsed = parseDecimalInput(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export function toFiniteNumber(value: number | string | null | undefined, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}
