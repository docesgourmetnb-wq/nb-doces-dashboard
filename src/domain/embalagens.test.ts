import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizePackagingProfileItems, validatePackagingItemQuantity } from './embalagens.ts';

test('summarizePackagingProfileItems counts valid items and total quantity', () => {
  const summary = summarizePackagingProfileItems([
    { quantidade_por_pedido: 1 },
    { quantidade_por_pedido: 2 },
    { quantidade_por_pedido: 0 },
  ]);

  assert.equal(summary.itemsCount, 2);
  assert.equal(summary.totalQuantity, 3);
  assert.equal(summary.knownCost, 0);
  assert.equal(summary.itemsWithKnownCost, 0);
  assert.equal(summary.itemsWithoutKnownCost, 2);
});

test('summarizePackagingProfileItems calculates known packaging cost', () => {
  const summary = summarizePackagingProfileItems([
    { quantidade_por_pedido: 2, insumos: { preco_unitario: 0.5 } },
    { quantidade_por_pedido: 3, insumos: { preco_unitario: 0.25 } },
    { quantidade_por_pedido: 1, insumos: { preco_unitario: 0 } },
  ]);

  assert.equal(summary.itemsCount, 3);
  assert.equal(summary.knownCost, 1.75);
  assert.equal(summary.itemsWithKnownCost, 2);
  assert.equal(summary.itemsWithoutKnownCost, 1);
});

test('validatePackagingItemQuantity accepts only positive values', () => {
  assert.equal(validatePackagingItemQuantity(1.5), 1.5);
  assert.throws(() => validatePackagingItemQuantity(0), /Quantidade por pedido invalida/);
});
