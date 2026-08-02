import test from 'node:test';
import assert from 'node:assert/strict';

import { getPedidoItemDisplayInfo, getPedidoItemDisplayLabel } from './pedidoItens.ts';

test('getPedidoItemDisplayInfo formats brigadeiro items with commercial size', () => {
  const info = getPedidoItemDisplayInfo({
    brigadeiro_nome: 'Branquinho 25g',
    brigadeiro_categoria: 'brigadeiro',
    brigadeiro_tamanho_g: null,
  });

  assert.deepEqual(info, {
    nomeBase: 'Branquinho',
    detalhe: '25g',
  });
  assert.equal(getPedidoItemDisplayLabel(info), 'Branquinho 25g');
});

test('getPedidoItemDisplayInfo prefers explicit product lookup for brigadeiros', () => {
  assert.deepEqual(
    getPedidoItemDisplayInfo(
      { brigadeiro_nome: 'Nome legado', brigadeiro_categoria: 'brigadeiro' },
      { nome: 'Brûlée', categoria: 'brigadeiro', tamanho_g: 30 },
    ),
    {
      nomeBase: 'Brûlée',
      detalhe: '30g',
    },
  );
});

test('getPedidoItemDisplayInfo formats cake variations without brigadeiro gram rules', () => {
  assert.deepEqual(getPedidoItemDisplayInfo({
    brigadeiro_nome: 'Bolo de cenoura 30g',
    produto_categoria: 'bolo',
    produto_nome: 'Bolo de cenoura',
    produto_variacao_nome: 'Pequeno com cobertura',
    produto_variacao_tamanho: 'Pequeno',
    produto_variacao_cobertura: 'Com cobertura',
  }), {
    nomeBase: 'Bolo de cenoura',
    detalhe: 'Pequeno com cobertura • Pequeno • Com cobertura',
  });
});

test('getPedidoItemDisplayInfo removes duplicate cake detail equal to base name', () => {
  assert.deepEqual(getPedidoItemDisplayInfo({
    produto_categoria: 'bolo',
    produto_nome: 'Bolo de cenoura',
    produto_variacao_nome: 'Bolo de cenoura',
    produto_variacao_tamanho: 'Pequeno',
  }), {
    nomeBase: 'Bolo de cenoura',
    detalhe: 'Pequeno',
  });
});
