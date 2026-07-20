export function parseDecimalInput(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return Number.NaN;
  return Number(normalized);
}

export function parseIntegerInput(value: string) {
  const parsed = parseDecimalInput(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}
