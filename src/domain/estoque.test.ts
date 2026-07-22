import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInsumoEntry, calculateInsumoPurchaseQuantity, getInsumoStockStatus } from './estoque.ts';

test('getInsumoStockStatus ignores alerts when minimum stock is not defined', () => {
  assert.deepEqual(getInsumoStockStatus(0, 0), {
    status: 'unset',
    progressValue: 0,
    needsAttention: false,
  });
});

test('getInsumoStockStatus returns critical, low and ok statuses', () => {
  assert.equal(getInsumoStockStatus(4, 10).status, 'critical');
  assert.equal(getInsumoStockStatus(10, 10).status, 'low');
  assert.equal(getInsumoStockStatus(15, 10).status, 'ok');
});

test('calculateInsumoEntry adds quantity and calculates latest unit cost', () => {
  assert.deepEqual(calculateInsumoEntry(100, 50, 25), {
    quantidadeAtual: 150,
    precoUnitario: 0.5,
  });
});

test('calculateInsumoEntry rejects invalid entry values', () => {
  assert.throws(() => calculateInsumoEntry(100, 0, 25), /Quantidade/);
  assert.throws(() => calculateInsumoEntry(100, 10, -1), /Valor/);
});

test('calculateInsumoPurchaseQuantity calculates total from packages and content', () => {
  assert.equal(calculateInsumoPurchaseQuantity(10, 395), 3950);
  assert.equal(calculateInsumoPurchaseQuantity(2, 1.5), 3);
});

test('calculateInsumoPurchaseQuantity rejects invalid package values', () => {
  assert.throws(() => calculateInsumoPurchaseQuantity(0, 395), /embalagens/);
  assert.throws(() => calculateInsumoPurchaseQuantity(10, 0), /Conteúdo/);
});
