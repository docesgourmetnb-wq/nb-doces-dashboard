import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDecimalInput, parseIntegerInput } from './numeros.ts';

test('parseDecimalInput accepts dot decimal values', () => {
  assert.equal(parseDecimalInput('35.50'), 35.5);
});

test('parseDecimalInput accepts comma decimal values', () => {
  assert.equal(parseDecimalInput('35,50'), 35.5);
});

test('parseDecimalInput rejects empty values', () => {
  assert.equal(Number.isNaN(parseDecimalInput('')), true);
});

test('parseIntegerInput accepts whole values', () => {
  assert.equal(parseIntegerInput('12'), 12);
});

test('parseIntegerInput accepts whole comma decimal values', () => {
  assert.equal(parseIntegerInput('12,0'), 12);
});

test('parseIntegerInput rejects fractional values', () => {
  assert.equal(Number.isNaN(parseIntegerInput('12,5')), true);
});

test('parseIntegerInput rejects empty values', () => {
  assert.equal(Number.isNaN(parseIntegerInput('')), true);
});
