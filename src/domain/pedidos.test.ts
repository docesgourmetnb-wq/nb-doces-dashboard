import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPedidoStatusBadgeClass,
  getPedidoStatusLabel,
  isPedidoTerminal,
  shouldGenerateRevenue,
} from './pedidos.ts';

test('getPedidoStatusLabel returns labels for known statuses and preserves unknown values', () => {
  assert.equal(getPedidoStatusLabel('pendente'), 'Pendente');
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
  assert.equal(isPedidoTerminal('pendente'), false);
});

test('shouldGenerateRevenue only returns true for delivered orders', () => {
  assert.equal(shouldGenerateRevenue('entregue'), true);
  assert.equal(shouldGenerateRevenue('cancelado'), false);
  assert.equal(shouldGenerateRevenue('pronto'), false);
});
