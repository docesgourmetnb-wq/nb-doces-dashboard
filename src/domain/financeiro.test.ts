import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateDeliveredAverageTicket,
  FINANCIAL_CONTROL_START_DATE,
  isTransactionInFinancialPeriod,
  isHistoricalFinancialOrder,
  isFinancialControlDate,
  isHistoricalCommercialOrder,
  isHistoricalOrder,
} from './financeiro.ts';

test('isFinancialControlDate starts official finance on 2026-08-01', () => {
  assert.equal(FINANCIAL_CONTROL_START_DATE, '2026-08-01');
  assert.equal(isFinancialControlDate('2026-07-31'), false);
  assert.equal(isFinancialControlDate('2026-08-01'), true);
  assert.equal(isFinancialControlDate('2026-08-02'), true);
});

test('isHistoricalFinancialOrder marks orders before official finance start', () => {
  assert.equal(isHistoricalFinancialOrder('2026-07-31'), true);
  assert.equal(isHistoricalFinancialOrder('2026-08-01'), false);
});

test('isHistoricalOrder uses delivery date as the financial reference date', () => {
  assert.equal(isHistoricalOrder({ data_entrega: '2026-07-31', data: '2026-08-02' }), true);
  assert.equal(isHistoricalOrder({ data_entrega: '2026-08-01', data: '2026-07-20' }), false);
  assert.equal(isHistoricalOrder({ data: '2026-07-31' }), true);
});

test('isHistoricalCommercialOrder requires historical, delivered, paid and not archived order', () => {
  const baseOrder = {
    data_entrega: '2026-07-31',
    archived_at: null,
    status_operacional: 'entregue',
    status_financeiro: 'pago',
    valor_total: 204,
  };

  assert.equal(isHistoricalCommercialOrder(baseOrder), true);
  assert.equal(isHistoricalCommercialOrder({ ...baseOrder, data_entrega: '2026-08-01' }), false);
  assert.equal(isHistoricalCommercialOrder({ ...baseOrder, status_operacional: 'confirmado' }), false);
  assert.equal(isHistoricalCommercialOrder({ ...baseOrder, status_financeiro: 'parcial' }), false);
  assert.equal(isHistoricalCommercialOrder({ ...baseOrder, archived_at: '2026-07-31T10:00:00Z' }), false);
});

test('isTransactionInFinancialPeriod uses transaction date instead of delivery date', () => {
  const paymentDate = '2026-07-21';
  const deliveryDate = '2026-08-16';

  assert.equal(isTransactionInFinancialPeriod(paymentDate, 2026, 7), true);
  assert.equal(isTransactionInFinancialPeriod(paymentDate, 2026, 8), false);
  assert.equal(isTransactionInFinancialPeriod(deliveryDate, 2026, 7), false);
});

test('calculateDeliveredAverageTicket uses delivered commercial value', () => {
  assert.equal(calculateDeliveredAverageTicket(612.5, 2), 306.25);
  assert.equal(calculateDeliveredAverageTicket(306.25, 0), 0);
});
