import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateProductionDemand,
  isPedidoDemandante,
  summarizeProductionDemand,
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
  ], []);

  assert.deepEqual(result, [
    {
      brigadeiroId: null,
      nome: 'Brulee 30g',
      quantidade: 32,
      quantidadePedido: 32,
      estoqueDisponivel: 0,
      pedidos: 2,
      proximaEntrega: '2026-07-18',
    },
    {
      brigadeiroId: null,
      nome: 'Ninho 30g',
      quantidade: 8,
      quantidadePedido: 8,
      estoqueDisponivel: 0,
      pedidos: 1,
      proximaEntrega: '2026-07-20',
    },
  ]);
});

test('aggregateProductionDemand subtracts ready final product stock', () => {
  const result = aggregateProductionDemand([
    {
      id: 'pedido-1',
      cliente: 'Juliana',
      data_entrega: '2026-07-20',
      status: 'confirmado',
      itens: [
        { brigadeiro_id: 'brigadeiro-1', brigadeiro_nome: 'Brulée 30g', quantidade: 18 },
        { brigadeiro_id: 'brigadeiro-2', brigadeiro_nome: 'Ninho 30g', quantidade: 8 },
      ],
    },
  ], [
    { brigadeiro_id: 'brigadeiro-1', nome: 'Brulée 30g', quantidade: 6 },
    { brigadeiro_id: 'brigadeiro-2', nome: 'Ninho 30g', quantidade: 10 },
  ]);

  assert.deepEqual(result, [
    {
      brigadeiroId: 'brigadeiro-1',
      nome: 'Brulée 30g',
      quantidade: 12,
      quantidadePedido: 18,
      estoqueDisponivel: 6,
      pedidos: 1,
      proximaEntrega: '2026-07-20',
    },
  ]);
});

test('aggregateProductionDemand can match stock by normalized name without ids', () => {
  const result = aggregateProductionDemand([
    {
      id: 'pedido-1',
      cliente: 'Juliana',
      data_entrega: '2026-07-20',
      status: 'confirmado',
      itens: [
        { brigadeiro_nome: 'Brulée 30g', quantidade: 18 },
      ],
    },
  ], [
    { nome: 'Brulee', quantidade: 3 },
  ]);

  assert.equal(result[0]?.quantidade, 15);
});

test('summarizeProductionDemand reports demand covered by ready stock', () => {
  const result = summarizeProductionDemand([
    {
      id: 'pedido-1',
      cliente: 'Juliana',
      data_entrega: '2026-07-20',
      status: 'confirmado',
      itens: [
        { brigadeiro_id: 'brigadeiro-1', brigadeiro_nome: 'Brulée 30g', quantidade: 18 },
        { brigadeiro_id: 'brigadeiro-2', brigadeiro_nome: 'Ninho 30g', quantidade: 8 },
      ],
    },
  ], [
    { brigadeiro_id: 'brigadeiro-1', nome: 'Brulée 30g', quantidade: 6 },
    { brigadeiro_id: 'brigadeiro-2', nome: 'Ninho 30g', quantidade: 10 },
  ]);

  assert.equal(result.totalPedido, 26);
  assert.equal(result.totalCobertoPorEstoque, 14);
  assert.equal(result.totalAProduzir, 12);
  assert.deepEqual(result.items, [
    {
      brigadeiroId: 'brigadeiro-1',
      nome: 'Brulée 30g',
      quantidade: 12,
      quantidadePedido: 18,
      estoqueDisponivel: 6,
      pedidos: 1,
      proximaEntrega: '2026-07-20',
    },
  ]);
});
