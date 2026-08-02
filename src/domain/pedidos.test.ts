import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canCreateHistoricalOrderAsDelivered,
  derivePedidoFinanceiroStatus,
  deriveInitialPedidoStatus,
  buildPedidoSearchFilter,
  calculateNextPedidoValorPago,
  getPedidoStatusUpdateErrorMessage,
  getPedidoStatusBadgeClass,
  getPedidoFinanceiroStatusLabel,
  getPedidoStatusOptions,
  getPedidoStatusLabel,
  isPedidoTerminal,
  shouldGenerateRevenue,
  sanitizePedidoSearchTerm,
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

test('canCreateHistoricalOrderAsDelivered requires historical order and full payment', () => {
  assert.equal(canCreateHistoricalOrderAsDelivered({ isHistoricalOrder: true, valorTotal: 100, valorPago: 100 }), true);
  assert.equal(canCreateHistoricalOrderAsDelivered({ isHistoricalOrder: true, valorTotal: 100, valorPago: 50 }), false);
  assert.equal(canCreateHistoricalOrderAsDelivered({ isHistoricalOrder: false, valorTotal: 100, valorPago: 100 }), false);
});

test('deriveInitialPedidoStatus only creates delivered historical orders when allowed', () => {
  assert.equal(
    deriveInitialPedidoStatus({
      isHistoricalOrder: true,
      markHistoricalAsDelivered: true,
      valorTotal: 100,
      valorPago: 100,
    }),
    'entregue',
  );
  assert.equal(
    deriveInitialPedidoStatus({
      isHistoricalOrder: true,
      markHistoricalAsDelivered: true,
      valorTotal: 100,
      valorPago: 50,
    }),
    'confirmado',
  );
  assert.equal(
    deriveInitialPedidoStatus({
      isHistoricalOrder: false,
      markHistoricalAsDelivered: true,
      valorTotal: 100,
      valorPago: 100,
    }),
    'confirmado',
  );
  assert.equal(
    deriveInitialPedidoStatus({
      isHistoricalOrder: true,
      markHistoricalAsDelivered: false,
      valorTotal: 100,
      valorPago: 0,
    }),
    'orcamento',
  );
});

test('getPedidoStatusOptions removes operational production states from historical orders', () => {
  assert.deepEqual(getPedidoStatusOptions({ isHistoricalOrder: false }), [
    'orcamento',
    'confirmado',
    'em-producao',
    'pronto',
    'entregue',
    'cancelado',
  ]);
  assert.deepEqual(getPedidoStatusOptions({ isHistoricalOrder: true }), [
    'orcamento',
    'confirmado',
    'entregue',
    'cancelado',
  ]);
});

test('getPedidoStatusOptions preserves a legacy current status for historical orders', () => {
  assert.deepEqual(getPedidoStatusOptions({ isHistoricalOrder: true, currentStatus: 'pronto' }), [
    'orcamento',
    'confirmado',
    'entregue',
    'cancelado',
    'pronto',
  ]);
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

test('getPedidoStatusUpdateErrorMessage explains insufficient final stock', () => {
  assert.equal(
    getPedidoStatusUpdateErrorMessage('Estoque pronto insuficiente para Brulée 30g. Necessário: 12, disponível: 4'),
    'Estoque pronto insuficiente para Brulée 30g. Necessário: 12, disponível: 4. Produza ou registre entrada no estoque de Produtos Finais antes de avançar o status.',
  );
});

test('getPedidoStatusUpdateErrorMessage explains pending balance', () => {
  assert.equal(
    getPedidoStatusUpdateErrorMessage('Este pedido ainda possui saldo pendente'),
    'Este pedido ainda possui saldo pendente. Registre o pagamento antes de marcar como entregue.',
  );
});

test('sanitizePedidoSearchTerm prepares search text for PostgREST filters', () => {
  assert.equal(sanitizePedidoSearchTerm('  Daniela, Martins (VIP)  '), 'Daniela Martins VIP');
});

test('buildPedidoSearchFilter searches legacy customer text and linked customer ids', () => {
  assert.equal(
    buildPedidoSearchFilter('Daniela', ['11111111-1111-1111-1111-111111111111']),
    'cliente.ilike.%Daniela%,cliente_id.in.(11111111-1111-1111-1111-111111111111)',
  );
});

test('buildPedidoSearchFilter returns null for empty terms and skips empty linked ids', () => {
  assert.equal(buildPedidoSearchFilter('   '), null);
  assert.equal(buildPedidoSearchFilter('Sotaque'), 'cliente.ilike.%Sotaque%');
});
