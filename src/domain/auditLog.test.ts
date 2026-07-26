import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatAuditLogDetail,
  getAuditActionLabel,
} from './auditLog.ts';

const formatCurrency = (value: number) => `R$ ${value.toFixed(2)}`;
const formatDate = (date: string) => date.split('-').reverse().join('/');

test('getAuditActionLabel hides internal action names from users', () => {
  assert.equal(getAuditActionLabel('payment_created'), 'Pagamento registrado');
  assert.equal(getAuditActionLabel('historical_payment_recorded'), 'Pagamento histórico registrado');
  assert.equal(getAuditActionLabel('unknown_internal_action'), 'Evento registrado');
});

test('formatAuditLogDetail formats status changes with friendly labels', () => {
  assert.equal(
    formatAuditLogDetail('status_changed', { from: 'confirmado', to: 'entregue' }, formatCurrency, formatDate),
    'de Confirmado para Entregue',
  );
});

test('formatAuditLogDetail formats payment values and effective dates', () => {
  assert.equal(
    formatAuditLogDetail(
      'payment_created',
      { delta: 306.25, data_pagamento: '2026-08-16' },
      formatCurrency,
      formatDate,
    ),
    'R$ 306.25 • 16/08/2026',
  );
});
