import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProductionMatchName,
  suggestProductionIntegration,
} from './producaoIntegrada.ts';

test('normalizeProductionMatchName removes gram suffix and accents', () => {
  assert.equal(normalizeProductionMatchName('Brulée 30g'), 'brulee');
  assert.equal(normalizeProductionMatchName('Ninho com Nutella 17,5g'), 'ninho com nutella');
});

test('suggestProductionIntegration matches recipe and output item by product base name', () => {
  const suggestion = suggestProductionIntegration(
    'Brulée 30g',
    [
      { id: 'recipe-1', recipeName: 'Brulee', recipeType: 'produto_final' },
      { id: 'recipe-2', recipeName: 'Coco Queimado', recipeType: 'produto_final' },
    ],
    [
      { id: 'item-1', nome: 'Brulée 30g', tipo: 'produto_final' },
      { id: 'item-2', nome: 'Coco Queimado 30g', tipo: 'produto_final' },
    ],
  );

  assert.deepEqual(suggestion, {
    recipeVersionId: 'recipe-1',
    outputItemId: 'item-1',
  });
});

test('suggestProductionIntegration prefers produto_final when names are equal', () => {
  const suggestion = suggestProductionIntegration(
    'Branquinho 30g',
    [
      { id: 'recipe-massa', recipeName: 'Branquinho', recipeType: 'massa_base' },
      { id: 'recipe-produto', recipeName: 'Branquinho', recipeType: 'produto_final' },
    ],
    [
      { id: 'item-massa', nome: 'Branquinho', tipo: 'massa_base' },
      { id: 'item-produto', nome: 'Branquinho 30g', tipo: 'produto_final' },
    ],
  );

  assert.deepEqual(suggestion, {
    recipeVersionId: 'recipe-produto',
    outputItemId: 'item-produto',
  });
});

test('suggestProductionIntegration returns null without complete match', () => {
  const suggestion = suggestProductionIntegration(
    'Pistache 30g',
    [{ id: 'recipe-1', recipeName: 'Pistache', recipeType: 'produto_final' }],
    [{ id: 'item-1', nome: 'Brulee 30g', tipo: 'produto_final' }],
  );

  assert.equal(suggestion, null);
});
