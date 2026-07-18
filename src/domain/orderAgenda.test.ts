import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOrderAgenda,
  getAgendaAction,
  isPedidoNaAgenda,
} from './orderAgenda.ts';

test('isPedidoNaAgenda excludes delivered and canceled orders', () => {
  assert.equal(isPedidoNaAgenda('orcamento'), true);
  assert.equal(isPedidoNaAgenda('confirmado'), true);
  assert.equal(isPedidoNaAgenda('em-producao'), true);
  assert.equal(isPedidoNaAgenda('pronto'), true);
  assert.equal(isPedidoNaAgenda('entregue'), false);
  assert.equal(isPedidoNaAgenda('cancelado'), false);
});

test('getAgendaAction classifies the next operational action', () => {
  assert.equal(getAgendaAction('pronto', 50), 'cobrar_saldo');
  assert.equal(getAgendaAction('pronto', 0), 'separar_entrega');
  assert.equal(getAgendaAction('confirmado', 0), 'produzir');
  assert.equal(getAgendaAction('em-producao', 0), 'produzir');
});

test('buildOrderAgenda sorts open orders and labels urgency', () => {
  const result = buildOrderAgenda([
    {
      id: 'pedido-3',
      cliente: 'Bárbaros',
      data_entrega: '2026-07-20',
      tipo_entrega: 'retirada',
      status: 'confirmado',
      status_financeiro: 'parcial',
      valor_total: 160,
      saldo_restante: 80,
      itens_total: 40,
    },
    {
      id: 'pedido-1',
      cliente: 'Juliana',
      data_entrega: '2026-07-16',
      tipo_entrega: 'entrega',
      status: 'pronto',
      status_financeiro: 'pago',
      valor_total: 40,
      saldo_restante: 0,
      itens_total: 10,
    },
    {
      id: 'pedido-2',
      cliente: 'Sotaque Bar',
      data_entrega: '2026-07-17',
      tipo_entrega: 'retirada',
      status: 'entregue',
      status_financeiro: 'pago',
      valor_total: 204,
      saldo_restante: 0,
      itens_total: 51,
    },
  ], '2026-07-17');

  assert.deepEqual(result.map((pedido) => ({
    id: pedido.id,
    urgency: pedido.urgency,
    bloqueadoPorSaldo: pedido.bloqueadoPorSaldo,
  })), [
    { id: 'pedido-1', urgency: 'atrasado', bloqueadoPorSaldo: false },
    { id: 'pedido-3', urgency: 'proximo', bloqueadoPorSaldo: false },
  ]);
});

test('buildOrderAgenda flags ready orders with remaining balance', () => {
  const result = buildOrderAgenda([
    {
      id: 'pedido-1',
      cliente: 'Juliana',
      data_entrega: '2026-07-17',
      tipo_entrega: 'retirada',
      status: 'pronto',
      status_financeiro: 'parcial',
      valor_total: 100,
      saldo_restante: 50,
      itens_total: 25,
    },
    {
      id: 'pedido-2',
      cliente: 'Sotaque Bar',
      data_entrega: '2026-07-17',
      tipo_entrega: 'retirada',
      status: 'confirmado',
      status_financeiro: 'parcial',
      valor_total: 80,
      saldo_restante: 40,
      itens_total: 20,
    },
  ], '2026-07-17');

  assert.deepEqual(result.map((pedido) => ({
    id: pedido.id,
    bloqueadoPorSaldo: pedido.bloqueadoPorSaldo,
    acao: pedido.acao,
  })), [
    { id: 'pedido-1', bloqueadoPorSaldo: true, acao: 'cobrar_saldo' },
    { id: 'pedido-2', bloqueadoPorSaldo: false, acao: 'produzir' },
  ]);
});
