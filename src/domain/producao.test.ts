import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateProductionLoss,
  getProducaoErrorMessage,
  getProducaoStatusBadgeClass,
  getProducaoStatusLabel,
  isProducaoConcluida,
} from './producao.ts';

test('getProducaoStatusLabel returns labels for known statuses and preserves unknown values', () => {
  assert.equal(getProducaoStatusLabel('planejado'), 'Planejado');
  assert.equal(getProducaoStatusLabel('em-andamento'), 'Em produção');
  assert.equal(getProducaoStatusLabel('status-novo'), 'status-novo');
});

test('getProducaoStatusBadgeClass returns configured classes only for known statuses', () => {
  assert.match(getProducaoStatusBadgeClass('concluido'), /success/);
  assert.equal(getProducaoStatusBadgeClass('status-novo'), '');
});

test('isProducaoConcluida only returns true for concluido', () => {
  assert.equal(isProducaoConcluida('concluido'), true);
  assert.equal(isProducaoConcluida('em-andamento'), false);
  assert.equal(isProducaoConcluida('planejado'), false);
});

test('calculateProductionLoss derives loss in grams and percent', () => {
  const result = calculateProductionLoss({ rendimentoPrevisto: 1578, rendimentoReal: 1183 });

  assert.equal(result?.perda, 395);
  assert.equal(result?.percentual.toFixed(1), '25.0');
});

test('calculateProductionLoss ignores missing or invalid yields', () => {
  assert.equal(calculateProductionLoss({ rendimentoPrevisto: 1578, rendimentoReal: null }), null);
  assert.equal(calculateProductionLoss({ rendimentoPrevisto: 0, rendimentoReal: 1183 }), null);
});

test('getProducaoErrorMessage makes insufficient stock errors user friendly', () => {
  assert.equal(
    getProducaoErrorMessage('Saldo insuficiente para insumo Leite Condensado: saldo 0, necessário 395.0000'),
    'Estoque insuficiente: Leite Condensado. Disponível: 0. Necessário: 395.',
  );
});

test('getProducaoErrorMessage preserves unknown errors', () => {
  assert.equal(getProducaoErrorMessage('Erro de banco'), 'Erro de banco');
});
