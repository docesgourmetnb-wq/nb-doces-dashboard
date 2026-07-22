import test from 'node:test';
import assert from 'node:assert/strict';
import { getCategoriasTransacao, isCategoriaTransacaoValida } from './financeiro.ts';

test('getCategoriasTransacao returns categories by transaction type', () => {
  assert.deepEqual(getCategoriasTransacao('entrada'), [
    'Vendas',
    'Aporte',
    'Reembolso',
    'Outras entradas',
  ]);

  assert.ok(getCategoriasTransacao('saida').includes('Insumos'));
});

test('isCategoriaTransacaoValida validates category against transaction type', () => {
  assert.equal(isCategoriaTransacaoValida('entrada', 'Vendas'), true);
  assert.equal(isCategoriaTransacaoValida('entrada', 'Insumos'), false);
  assert.equal(isCategoriaTransacaoValida('saida', 'Insumos'), true);
});
