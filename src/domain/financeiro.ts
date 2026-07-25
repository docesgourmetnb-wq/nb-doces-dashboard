export const FINANCIAL_CONTROL_START_DATE = '2026-08-01';
export const FINANCIAL_CONTROL_START_LABEL = '01/08/2026';

export function isFinancialControlDate(date: string) {
  return date >= FINANCIAL_CONTROL_START_DATE;
}

export function isHistoricalFinancialOrder(dataEntrega: string) {
  return !isFinancialControlDate(dataEntrega);
}

export interface HistoricalOrderInput {
  data_entrega?: string | null;
  data?: string | null;
}

export function getOrderFinancialReferenceDate(order: HistoricalOrderInput) {
  return order.data_entrega || order.data || '';
}

export function isHistoricalOrder(order: HistoricalOrderInput) {
  const referenceDate = getOrderFinancialReferenceDate(order);
  if (!referenceDate) return false;
  return isHistoricalFinancialOrder(referenceDate);
}

export interface HistoricalCommercialOrderInput extends HistoricalOrderInput {
  archived_at?: string | null;
  status?: string | null;
  status_operacional?: string | null;
  status_financeiro?: string | null;
  valor_total?: number | null;
}

export function isHistoricalCommercialOrder(order: HistoricalCommercialOrderInput) {
  const status = order.status_operacional || order.status;
  return (
    isHistoricalOrder(order) &&
    !order.archived_at &&
    status === 'entregue' &&
    order.status_financeiro === 'pago' &&
    Number.isFinite(order.valor_total ?? Number.NaN) &&
    (order.valor_total ?? 0) > 0
  );
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

export const CATEGORIAS_TRANSACAO = {
  entrada: [
    'Vendas',
    'Aporte',
    'Reembolso',
    'Outras entradas',
  ],
  saida: [
    'Insumos',
    'Embalagens',
    'Taxas',
    'Entrega',
    'Equipamentos',
    'Manutenção',
    'Outras saídas',
  ],
} as const;

export type TransacaoTipo = keyof typeof CATEGORIAS_TRANSACAO;

export function getCategoriasTransacao(tipo: TransacaoTipo) {
  return CATEGORIAS_TRANSACAO[tipo];
}

export function getTodasCategoriasTransacao() {
  return [...CATEGORIAS_TRANSACAO.entrada, ...CATEGORIAS_TRANSACAO.saida];
}

export function isCategoriaTransacaoValida(tipo: TransacaoTipo, categoria: string) {
  return CATEGORIAS_TRANSACAO[tipo].some((item) => item === categoria);
}
