import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCommercialRecipeYields,
  calculateRecipeYield,
  convertRecipeComponentQtyToGrams,
  summarizeRecipeMass,
} from './receitas.ts';

test('convertRecipeComponentQtyToGrams converts mass and liquid units to grams', () => {
  assert.equal(convertRecipeComponentQtyToGrams(395, 'g'), 395);
  assert.equal(convertRecipeComponentQtyToGrams(1.2, 'kg'), 1200);
  assert.equal(convertRecipeComponentQtyToGrams(200, 'ml'), 200);
  assert.equal(convertRecipeComponentQtyToGrams(0.5, 'l'), 500);
});

test('convertRecipeComponentQtyToGrams ignores units that cannot be converted safely', () => {
  assert.equal(convertRecipeComponentQtyToGrams(2, 'un'), null);
  assert.equal(convertRecipeComponentQtyToGrams(0, 'g'), null);
  assert.equal(convertRecipeComponentQtyToGrams(Number.NaN, 'g'), null);
});

test('summarizeRecipeMass sums calculable components and counts ignored ones', () => {
  const summary = summarizeRecipeMass([
    { qty_per_batch: 395, uom: 'g' },
    { qty_per_batch: 0.2, uom: 'kg' },
    { qty_per_batch: 100, uom: 'ml' },
    { qty_per_batch: 1, uom: 'un' },
  ]);

  assert.equal(summary.totalGrams, 695);
  assert.equal(summary.calculableComponents, 3);
  assert.equal(summary.ignoredComponents, 1);
});

test('calculateRecipeYield returns whole units for a total mass and unit size', () => {
  assert.equal(calculateRecipeYield(510, 25), 20);
  assert.equal(calculateRecipeYield(510, 30), 17);
  assert.equal(calculateRecipeYield(0, 25), 0);
});

test('calculateCommercialRecipeYields returns 25g and 30g yields', () => {
  assert.deepEqual(calculateCommercialRecipeYields(510), {
    tamanho25g: 20,
    tamanho30g: 17,
  });
});
