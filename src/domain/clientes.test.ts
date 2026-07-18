import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPedidosSemVinculoComMesmoNome,
  getPedidosVinculadosAoCliente,
} from './clientes.ts';

const cliente = {
  id: 'cliente-1',
  nome: 'Juliana',
};

const pedidos = [
  { id: 'pedido-1', cliente: 'Juliana', cliente_id: 'cliente-1', valor_total: 50 },
  { id: 'pedido-2', cliente: 'Juliana', cliente_id: 'cliente-2', valor_total: 90 },
  { id: 'pedido-3', cliente: '  juliana  ', cliente_id: null, valor_total: 30 },
  { id: 'pedido-4', cliente: 'Sotaque Bar', cliente_id: null, valor_total: 120 },
];

test('getPedidosVinculadosAoCliente only returns orders linked by cliente_id', () => {
  assert.deepEqual(getPedidosVinculadosAoCliente(cliente, pedidos), [
    { id: 'pedido-1', cliente: 'Juliana', cliente_id: 'cliente-1', valor_total: 50 },
  ]);
});

test('getPedidosSemVinculoComMesmoNome returns legacy name matches separately', () => {
  assert.deepEqual(getPedidosSemVinculoComMesmoNome(cliente, pedidos), [
    { id: 'pedido-3', cliente: '  juliana  ', cliente_id: null, valor_total: 30 },
  ]);
});
