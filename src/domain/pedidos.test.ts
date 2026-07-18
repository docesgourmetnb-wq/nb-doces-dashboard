import test from 'node:test';
import assert from 'node:assert/strict';

import {
  derivePedidoFinanceiroStatus,
  calculateNextPedidoValorPago,
  getPedidoStatusBadgeClass,
  getPedidoFinanceiroStatusLabel,
  getPedidoStatusLabel,
  isPedidoTerminal,
  shouldGenerateRevenue,
} from './pedidos.ts';

test('getPedidoStatusLabel returns labels for known statuses and preserves unknown values', () => {
  assert.equal(getPedidoStatusLabel('orcamento'), 'Orçamento');
  assert.equal(getPedidoStatusLabel('confirmado'), 'Confirmado');
  assert.equal(getPedidoStatusLabel('em-producao'), 'Em Produção');
  assert.equal(getPedidoStatusLabel('status-novo'), 'status-novo');
});

test('getPedidoStatusBadgeClass returns configured classes only for known statuses', () => {
  assert.match(getPedidoStatusBadgeClass('entregue'), /success/);
  assert.equal(getPedidoStatusBadgeClass('status-novo'), '');
});

test('isPedidoTerminal marks only entregue and cancelado as terminal', () => {
  assert.equal(isPedidoTerminal('entregue'), true);
  assert.equal(isPedidoTerminal('cancelado'), true);
  assert.equal(isPedidoTerminal('pronto'), false);
  assert.equal(isPedidoTerminal('orcamento'), false);
});

test('shouldGenerateRevenue only returns true for paid financial status', () => {
  assert.equal(shouldGenerateRevenue('pago'), true);
  assert.equal(shouldGenerateRevenue('parcial'), false);
  assert.equal(shouldGenerateRevenue('nao_pago'), false);
});

test('derivePedidoFinanceiroStatus derives status from paid amount', () => {
  assert.equal(derivePedidoFinanceiroStatus(100, 0), 'nao_pago');
  assert.equal(derivePedidoFinanceiroStatus(100, 50), 'parcial');
  assert.equal(derivePedidoFinanceiroStatus(100, 100), 'pago');
});

test('getPedidoFinanceiroStatusLabel returns labels for known statuses', () => {
  assert.equal(getPedidoFinanceiroStatusLabel('nao_pago'), 'Não pago');
  assert.equal(getPedidoFinanceiroStatusLabel('parcial'), 'Parcial');
  assert.equal(getPedidoFinanceiroStatusLabel('pago'), 'Pago');
});

test('calculateNextPedidoValorPago adds a valid received amount to current paid amount', () => {
  assert.equal(calculateNextPedidoValorPago(40, 60, 20), 60);
  assert.equal(calculateNextPedidoValorPago(40, 60, 60), 100);
});

test('calculateNextPedidoValorPago rejects invalid received amounts', () => {
  assert.equal(calculateNextPedidoValorPago(40, 60, 0), null);
  assert.equal(calculateNextPedidoValorPago(40, 60, -10), null);
  assert.equal(calculateNextPedidoValorPago(40, 60, 70), null);
  assert.equal(calculateNextPedidoValorPago(40, 60, Number.NaN), null);
});
