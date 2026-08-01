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
});

test('validatePackagingItemQuantity accepts only positive values', () => {
  assert.equal(validatePackagingItemQuantity(1.5), 1.5);
  assert.throws(() => validatePackagingItemQuantity(0), /Quantidade por pedido invalida/);
});
