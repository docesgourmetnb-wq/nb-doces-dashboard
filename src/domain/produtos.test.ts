import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findProdutosSemParDeTamanho,
  filterProdutosBrigadeiro,
  filterProdutoCatalogoByCategoria,
  getProdutoCatalogoVariacoesAtivas,
  getProdutoNomeBase,
  getProdutoNomeComercial,
  getProdutoTamanho,
  getProdutoTamanhoComercial,
  getProdutoCategoriaLabel,
  inferProdutoTamanhoGramas,
  isBrigadeiroTamanhoGramas,
  isProdutoCategoria,
  matchesBrigadeiroTamanhoFilter,
  summarizeProdutoCatalogo,
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

test('getProdutoNomeComercial only removes gram suffix from brigadeiros', () => {
  assert.equal(getProdutoNomeComercial({ nome: 'Branquinho 25g', categoria: 'brigadeiro' }), 'Branquinho');
  assert.equal(getProdutoNomeComercial({ nome: 'Bolo de cenoura 30g', categoria: 'bolo' }), 'Bolo de cenoura 30g');
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

test('filterProdutosBrigadeiro keeps only brigadeiro products', () => {
  assert.deepEqual(filterProdutosBrigadeiro([
    { nome: 'Branquinho', categoria: 'brigadeiro', tamanho_g: 25 },
    { nome: 'Bolo de cenoura', categoria: 'bolo', tamanho_g: null },
    { nome: 'Legado 30g', tamanho_g: null },
  ]), [
    { nome: 'Branquinho', categoria: 'brigadeiro', tamanho_g: 25 },
    { nome: 'Legado 30g', tamanho_g: null },
  ]);
});

test('isProdutoCategoria accepts only supported product categories', () => {
  assert.equal(isProdutoCategoria('brigadeiro'), true);
  assert.equal(isProdutoCategoria('bolo'), true);
  assert.equal(isProdutoCategoria('sobremesa'), false);
  assert.equal(isProdutoCategoria(null), false);
});

test('getProdutoCategoriaLabel returns friendly category labels', () => {
  assert.equal(getProdutoCategoriaLabel('brigadeiro'), 'Brigadeiro');
  assert.equal(getProdutoCategoriaLabel('bolo'), 'Bolo');
  assert.equal(getProdutoCategoriaLabel('sobremesa'), 'Produto');
});

test('filterProdutoCatalogoByCategoria filters catalog products by explicit category', () => {
  const produtos = [
    { categoria_codigo: 'brigadeiro', ativo: true },
    { categoria_codigo: 'bolo', ativo: true },
  ];

  assert.deepEqual(filterProdutoCatalogoByCategoria(produtos, 'todos'), produtos);
  assert.deepEqual(filterProdutoCatalogoByCategoria(produtos, 'bolo'), [
    { categoria_codigo: 'bolo', ativo: true },
  ]);
});

test('getProdutoCatalogoVariacoesAtivas ignores inactive variations', () => {
  assert.deepEqual(getProdutoCatalogoVariacoesAtivas([
    { ativo: true, nome: '25g' },
    { ativo: false, nome: '30g' },
    { ativo: null, nome: 'Sem status legado' },
  ]), [
    { ativo: true, nome: '25g' },
    { ativo: null, nome: 'Sem status legado' },
  ]);
});

test('summarizeProdutoCatalogo counts active products and active variations by category', () => {
  assert.deepEqual(summarizeProdutoCatalogo([
    {
      categoria_codigo: 'brigadeiro',
      ativo: true,
      variacoes: [{ ativo: true }, { ativo: true }],
    },
    {
      categoria_codigo: 'bolo',
      ativo: true,
      variacoes: [{ ativo: true }, { ativo: false }],
    },
    {
      categoria_codigo: 'brigadeiro',
      ativo: false,
      variacoes: [{ ativo: true }],
    },
  ]), {
    totalProdutos: 2,
    totalBrigadeiros: 1,
    totalBolos: 1,
    totalVariacoesAtivas: 3,
    totalVariacoesBrigadeiros: 2,
    totalVariacoesBolos: 1,
  });
});

test('matchesBrigadeiroTamanhoFilter only matches brigadeiros by commercial size', () => {
  assert.equal(matchesBrigadeiroTamanhoFilter({ nome: 'Branquinho', categoria: 'brigadeiro', tamanho_g: 25 }, '25g'), true);
  assert.equal(matchesBrigadeiroTamanhoFilter({ nome: 'Branquinho', categoria: 'brigadeiro', tamanho_g: 25 }, '30g'), false);
  assert.equal(matchesBrigadeiroTamanhoFilter({ nome: 'Bolo 25g', categoria: 'bolo', tamanho_g: 25 }, '25g'), false);
});

test('isBrigadeiroTamanhoGramas accepts only current commercial sizes', () => {
  assert.equal(isBrigadeiroTamanhoGramas(25), true);
  assert.equal(isBrigadeiroTamanhoGramas(30), true);
  assert.equal(isBrigadeiroTamanhoGramas(20), false);
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
    { nome: 'Bolo de cenoura 30g', categoria: 'bolo' },
    { nome: 'Combo sortido' },
  ]), [
    { nomeBase: 'Brulée', faltando: ['25g'] },
    { nomeBase: 'Pistache', faltando: ['30g'] },
  ]);
});
