import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeFornecedorPurchases } from './fornecedores.ts';

test('summarizeFornecedorPurchases groups purchases by supplier', () => {
  const summary = summarizeFornecedorPurchases([
    { fornecedor_id: 'fornecedor-1', valor: 20, data: '2026-08-01' },
    { fornecedor_id: 'fornecedor-1', valor: 15.5, data: '2026-08-03' },
    { fornecedor_id: 'fornecedor-2', valor: 8, data: '2026-08-02' },
    { fornecedor_id: 'fornecedor-2', valor: 5, data: null },
    { fornecedor_id: null, valor: 99, data: '2026-08-04' },
  ]);

  assert.deepEqual(summary['fornecedor-1'], {
    totalCompras: 35.5,
    quantidadeCompras: 2,
    ultimaCompra: '2026-08-03',
  });
  assert.deepEqual(summary['fornecedor-2'], {
    totalCompras: 13,
    quantidadeCompras: 2,
    ultimaCompra: '2026-08-02',
  });
  assert.equal(summary['fornecedor-3'], undefined);
});
