import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FINANCIAL_CONTROL_START_DATE,
  isFinancialControlDate,
} from './financeiro.ts';

test('isFinancialControlDate starts official finance on 2026-08-01', () => {
  assert.equal(FINANCIAL_CONTROL_START_DATE, '2026-08-01');
  assert.equal(isFinancialControlDate('2026-07-31'), false);
  assert.equal(isFinancialControlDate('2026-08-01'), true);
  assert.equal(isFinancialControlDate('2026-08-02'), true);
});
