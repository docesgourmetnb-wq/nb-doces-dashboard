import test from 'node:test';
import assert from 'node:assert/strict';
import { getProdutoNomeBase, getProdutoTamanho } from './produtos.ts';

test('getProdutoNomeBase removes gram suffix from product names', () => {
  assert.equal(getProdutoNomeBase('Brulée 30g'), 'Brulée');
  assert.equal(getProdutoNomeBase('Cheesecake de Goiabada 30g'), 'Cheesecake de Goiabada');
  assert.equal(getProdutoNomeBase('Branquinho 17,5g'), 'Branquinho');
});

test('getProdutoNomeBase preserves names without gram suffix', () => {
  assert.equal(getProdutoNomeBase('Mini cento sortido'), 'Mini cento sortido');
});

test('getProdutoTamanho extracts gram suffix from product names', () => {
  assert.equal(getProdutoTamanho('Brulée 30g'), '30g');
  assert.equal(getProdutoTamanho('Branquinho 17,5g'), '17,5g');
  assert.equal(getProdutoTamanho('Mini cento sortido'), null);
});
