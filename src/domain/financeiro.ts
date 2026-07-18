export const FINANCIAL_CONTROL_START_DATE = '2026-08-01';
export const FINANCIAL_CONTROL_START_LABEL = '01/08/2026';

export function isFinancialControlDate(date: string) {
  return date >= FINANCIAL_CONTROL_START_DATE;
}

export function isHistoricalFinancialOrder(dataEntrega: string) {
  return !isFinancialControlDate(dataEntrega);
}
