export const FINANCIAL_CONTROL_START_DATE = '2026-08-01';
export const FINANCIAL_CONTROL_START_LABEL = '01/08/2026';

export function isFinancialControlDate(date: string) {
  return date >= FINANCIAL_CONTROL_START_DATE;
}

export function isHistoricalFinancialOrder(dataEntrega: string) {
  return !isFinancialControlDate(dataEntrega);
}

export function isTransactionInFinancialPeriod(transactionDate: string, year: number, month: number) {
  const monthKey = String(month).padStart(2, '0');
  return transactionDate.startsWith(`${year}-${monthKey}-`);
}

export function calculateDeliveredAverageTicket(deliveredValue: number, deliveredOrders: number) {
  if (!Number.isFinite(deliveredValue) || !Number.isFinite(deliveredOrders) || deliveredOrders <= 0) {
    return 0;
  }

  return deliveredValue / deliveredOrders;
}
