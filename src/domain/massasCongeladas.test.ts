import test from 'node:test';
import assert from 'node:assert/strict';
import { getMassaValidadeInfo } from './massasCongeladas.ts';

test('getMassaValidadeInfo classifies expired masses', () => {
  assert.deepEqual(getMassaValidadeInfo('2026-07-16', '2026-07-17'), {
    diasRestantes: -1,
    status: 'vencida',
  });
});

test('getMassaValidadeInfo classifies masses near expiration', () => {
  assert.deepEqual(getMassaValidadeInfo('2026-07-24', '2026-07-17'), {
    diasRestantes: 7,
    status: 'proxima',
  });
});

test('getMassaValidadeInfo classifies healthy masses', () => {
  assert.deepEqual(getMassaValidadeInfo('2026-08-17', '2026-07-17'), {
    diasRestantes: 31,
    status: 'ok',
  });
});
