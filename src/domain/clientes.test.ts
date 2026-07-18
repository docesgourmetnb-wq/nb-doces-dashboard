import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findClienteByContato,
  getPedidosSemVinculoComMesmoNome,
  getPedidosVinculadosAoCliente,
  normalizeClienteEmail,
  normalizeClienteTelefone,
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

test('normalizeClienteEmail trims and lowercases email', () => {
  assert.equal(normalizeClienteEmail('  CLIENTE@EXEMPLO.COM  '), 'cliente@exemplo.com');
});

test('normalizeClienteTelefone keeps only digits', () => {
  assert.equal(normalizeClienteTelefone('(47) 99999-0000'), '47999990000');
});

test('findClienteByContato reuses existing customer by email or phone', () => {
  const clientes = [
    { id: 'cliente-1', nome: 'Juliana', email: 'ju@example.com', telefone: null },
    { id: 'cliente-2', nome: 'Sotaque Bar', email: null, telefone: '(47) 3333-4444' },
  ];

  assert.equal(findClienteByContato(clientes, { email: 'JU@example.com' })?.id, 'cliente-1');
  assert.equal(findClienteByContato(clientes, { telefone: '47 3333 4444' })?.id, 'cliente-2');
});

test('findClienteByContato does not match by name alone', () => {
  const clientes = [
    { id: 'cliente-1', nome: 'Juliana', email: null, telefone: null },
  ];

  assert.equal(findClienteByContato(clientes, {}), undefined);
});
