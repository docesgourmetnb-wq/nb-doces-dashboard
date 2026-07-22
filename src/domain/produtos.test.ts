import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findProdutosSemParDeTamanho,
  getProdutoNomeBase,
  getProdutoTamanho,
  getProdutoTamanhoComercial,
  inferProdutoTamanhoGramas,
  summarizeProdutos,
} from './produtos.ts';

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

test('getProdutoTamanhoComercial prefers explicit brigadeiro size', () => {
  assert.equal(getProdutoTamanhoComercial({ nome: 'Brulée especial', categoria: 'brigadeiro', tamanho_g: 25 }), '25g');
  assert.equal(getProdutoTamanhoComercial({ nome: 'Brulée 30g', categoria: 'brigadeiro', tamanho_g: null }), '30g');
});

test('getProdutoTamanhoComercial does not apply brigadeiro sizes to cakes', () => {
  assert.equal(getProdutoTamanhoComercial({ nome: 'Bolo de cenoura 30g', categoria: 'bolo', tamanho_g: 30 }), null);
});

test('inferProdutoTamanhoGramas derives size from product name', () => {
  assert.equal(inferProdutoTamanhoGramas('Branquinho 25g'), 25);
  assert.equal(inferProdutoTamanhoGramas('Branquinho 17,5g'), 17.5);
  assert.equal(inferProdutoTamanhoGramas('Bolo de cenoura'), null);
});

test('summarizeProdutos counts products by commercial size', () => {
  assert.deepEqual(summarizeProdutos([
    { nome: 'Brulée', categoria: 'brigadeiro', tamanho_g: 25, margem_lucro: 69 },
    { nome: 'Brulée', categoria: 'brigadeiro', tamanho_g: 30, margem_lucro: 74 },
    { nome: 'Pistache 25g', margem_lucro: 41 },
    { nome: 'Bolo de cenoura 30g', categoria: 'bolo', tamanho_g: 30, margem_lucro: 50 },
  ]), {
    total: 4,
    total25g: 2,
    total30g: 1,
    semTamanho: 1,
    margemMedia: 58.5,
    saboresSemPar: [
      { nomeBase: 'Pistache', faltando: ['30g'] },
    ],
  });
});

test('summarizeProdutos handles empty product lists', () => {
  assert.deepEqual(summarizeProdutos([]), {
    total: 0,
    total25g: 0,
    total30g: 0,
    semTamanho: 0,
    margemMedia: 0,
    saboresSemPar: [],
  });
});

test('findProdutosSemParDeTamanho reports flavors missing 25g or 30g pair', () => {
  assert.deepEqual(findProdutosSemParDeTamanho([
    { nome: 'Branquinho 25g' },
    { nome: 'Branquinho 30g' },
    { nome: 'Brulée 30g' },
    { nome: 'Pistache 25g' },
    { nome: 'Combo sortido' },
  ]), [
    { nomeBase: 'Brulée', faltando: ['25g'] },
    { nomeBase: 'Pistache', faltando: ['30g'] },
  ]);
});
