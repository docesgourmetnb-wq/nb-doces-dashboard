import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDecimalInput } from './numeros.ts';

test('parseDecimalInput accepts dot decimal values', () => {
  assert.equal(parseDecimalInput('35.50'), 35.5);
});

test('parseDecimalInput accepts comma decimal values', () => {
  assert.equal(parseDecimalInput('35,50'), 35.5);
});

test('parseDecimalInput rejects empty values', () => {
  assert.equal(Number.isNaN(parseDecimalInput('')), true);
});
