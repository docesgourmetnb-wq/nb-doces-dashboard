import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInsumoCadastroDefaults,
  getInsumoQuantidadePlaceholder,
  getInsumoUnidadeLabel,
  isInsumoUnidadePadrao,
} from './insumos.ts';

test('isInsumoUnidadePadrao accepts controlled stock units', () => {
  assert.equal(isInsumoUnidadePadrao('g'), true);
  assert.equal(isInsumoUnidadePadrao('ml'), true);
  assert.equal(isInsumoUnidadePadrao('lata'), false);
});

test('getInsumoUnidadeLabel returns friendly labels and preserves unknown units', () => {
  assert.equal(getInsumoUnidadeLabel('g'), 'Gramas (g)');
  assert.equal(getInsumoUnidadeLabel('ml'), 'Mililitros (ml)');
  assert.equal(getInsumoUnidadeLabel('lata'), 'lata');
});

test('getInsumoQuantidadePlaceholder follows the selected unit', () => {
  assert.equal(getInsumoQuantidadePlaceholder('g'), 'Ex: 395');
  assert.equal(getInsumoQuantidadePlaceholder('kg'), 'Ex: 1,5');
  assert.equal(getInsumoQuantidadePlaceholder('desconhecida'), 'Ex: 1');
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
      quantidade_atual: 0,
      quantidade_minima: 395,
      consumo_medio: 0,
      preco_unitario: 0,
    },
  );
});
