import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInsumoCadastroDefaults,
  getInsumoTipoEstoqueLabel,
  getInsumoQuantidadePlaceholder,
  getInsumoUnidadePadraoPorTipo,
  getInsumoUnidadeLabel,
  isInsumoTipoEstoque,
  isInsumoUnidadePadrao,
} from './insumos.ts';

test('isInsumoUnidadePadrao accepts controlled stock units', () => {
  assert.equal(isInsumoUnidadePadrao('g'), true);
  assert.equal(isInsumoUnidadePadrao('ml'), true);
  assert.equal(isInsumoUnidadePadrao('cm'), true);
  assert.equal(isInsumoUnidadePadrao('lata'), false);
});

test('getInsumoUnidadeLabel returns friendly labels and preserves unknown units', () => {
  assert.equal(getInsumoUnidadeLabel('g'), 'Gramas (g)');
  assert.equal(getInsumoUnidadeLabel('ml'), 'Mililitros (ml)');
  assert.equal(getInsumoUnidadeLabel('cm'), 'Centímetros (cm)');
  assert.equal(getInsumoUnidadeLabel('lata'), 'lata');
});

test('getInsumoQuantidadePlaceholder follows the selected unit', () => {
  assert.equal(getInsumoQuantidadePlaceholder('g'), 'Ex: 395');
  assert.equal(getInsumoQuantidadePlaceholder('kg'), 'Ex: 1,5');
  assert.equal(getInsumoQuantidadePlaceholder('cm'), 'Ex: 150');
  assert.equal(getInsumoQuantidadePlaceholder('desconhecida'), 'Ex: 1');
});

test('isInsumoTipoEstoque accepts production and packaging stock types', () => {
  assert.equal(isInsumoTipoEstoque('producao'), true);
  assert.equal(isInsumoTipoEstoque('embalagem'), true);
  assert.equal(isInsumoTipoEstoque('financeiro'), false);
});

test('getInsumoTipoEstoqueLabel returns friendly stock type labels', () => {
  assert.equal(getInsumoTipoEstoqueLabel('producao'), 'Insumo de produção');
  assert.equal(getInsumoTipoEstoqueLabel('embalagem'), 'Embalagem');
  assert.equal(getInsumoTipoEstoqueLabel(null), 'Insumo de produção');
});

test('getInsumoUnidadePadraoPorTipo defaults packaging to units', () => {
  assert.equal(getInsumoUnidadePadraoPorTipo('producao'), 'g');
  assert.equal(getInsumoUnidadePadraoPorTipo('embalagem'), 'un');
});

test('buildInsumoCadastroDefaults creates stock-neutral cadastro data', () => {
  assert.deepEqual(
    buildInsumoCadastroDefaults({
      nome: '  Leite Condensado ',
      unidade: 'g',
      quantidadeMinima: 395,
    }),
    {
      nome: 'Leite Condensado',
      unidade: 'g',
      tipo_estoque: 'producao',
      quantidade_atual: 0,
      quantidade_minima: 395,
      consumo_medio: 0,
      preco_unitario: 0,
    },
  );
});

test('buildInsumoCadastroDefaults preserves packaging stock type', () => {
  assert.equal(
    buildInsumoCadastroDefaults({
      nome: 'Pelotine',
      unidade: 'un',
      quantidadeMinima: 500,
      tipoEstoque: 'embalagem',
    }).tipo_estoque,
    'embalagem',
  );
});
