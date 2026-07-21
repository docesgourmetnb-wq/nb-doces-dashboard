import test from 'node:test';
import assert from 'node:assert/strict';

import {
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

test('getProducaoErrorMessage makes insufficient stock errors user friendly', () => {
  assert.equal(
    getProducaoErrorMessage('Saldo insuficiente para insumo Leite Condensado: saldo 0, necessário 395.0000'),
    'Estoque insuficiente: Leite Condensado. Disponível: 0. Necessário: 395.',
  );
});

test('getProducaoErrorMessage preserves unknown errors', () => {
  assert.equal(getProducaoErrorMessage('Erro de banco'), 'Erro de banco');
});
