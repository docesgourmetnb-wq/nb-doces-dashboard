import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateProductionDemand,
  isPedidoDemandante,
} from './productionDemand.ts';

test('isPedidoDemandante includes only orders that still require production', () => {
  assert.equal(isPedidoDemandante('orcamento'), false);
  assert.equal(isPedidoDemandante('confirmado'), true);
  assert.equal(isPedidoDemandante('em-producao'), true);
  assert.equal(isPedidoDemandante('pronto'), false);
  assert.equal(isPedidoDemandante('entregue'), false);
  assert.equal(isPedidoDemandante('cancelado'), false);
});

test('aggregateProductionDemand groups items by flavor and keeps nearest delivery', () => {
  const result = aggregateProductionDemand([
    {
      id: 'pedido-1',
      cliente: 'Juliana',
      data_entrega: '2026-07-20',
      status: 'confirmado',
      itens: [
        { brigadeiro_nome: 'Brulee 30g', quantidade: 12 },
        { brigadeiro_nome: 'Ninho 30g', quantidade: 8 },
      ],
    },
    {
      id: 'pedido-2',
      cliente: 'Sotaque Bar',
      data_entrega: '2026-07-18',
      status: 'em-producao',
      itens: [
        { brigadeiro_nome: 'Brulee 30g', quantidade: 20 },
      ],
    },
    {
      id: 'pedido-3',
      cliente: 'Pedido pronto',
      data_entrega: '2026-07-17',
      status: 'pronto',
      itens: [
        { brigadeiro_nome: 'Brulee 30g', quantidade: 99 },
      ],
    },
  ]);

  assert.deepEqual(result, [
    {
      nome: 'Brulee 30g',
      quantidade: 32,
      pedidos: 2,
      proximaEntrega: '2026-07-18',
    },
    {
      nome: 'Ninho 30g',
      quantidade: 8,
      pedidos: 1,
      proximaEntrega: '2026-07-20',
    },
  ]);
});
