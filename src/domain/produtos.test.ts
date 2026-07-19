import test from 'node:test';
import assert from 'node:assert/strict';
import { getProdutoNomeBase, getProdutoTamanho, summarizeProdutos } from './produtos.ts';

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

test('summarizeProdutos counts products by commercial size', () => {
  assert.deepEqual(summarizeProdutos([
    { nome: 'Brulée 25g', margem_lucro: 69 },
    { nome: 'Brulée 30g', margem_lucro: 74 },
    { nome: 'Pistache 25g', margem_lucro: 41 },
    { nome: 'Cento sortido', margem_lucro: 50 },
  ]), {
    total: 4,
    total25g: 2,
    total30g: 1,
    semTamanho: 1,
    margemMedia: 58.5,
  });
});

test('summarizeProdutos handles empty product lists', () => {
  assert.deepEqual(summarizeProdutos([]), {
    total: 0,
    total25g: 0,
    total30g: 0,
    semTamanho: 0,
    margemMedia: 0,
  });
});
